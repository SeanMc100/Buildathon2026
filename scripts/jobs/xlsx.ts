// A minimal, streaming .xlsx reader.
//
// BLS publishes the OEWS metro wage tables as .xlsx only — there is no CSV — and
// the sheet inside is 184 MB of XML. The project takes no new dependencies, so
// this reads the two parts of the format we actually need:
//
//   1. the ZIP central directory, to find a member's compressed bytes, and
//   2. the SpreadsheetML <row>/<c> elements, streamed and handed back one row at
//      a time so the 184 MB never sits in memory at once.
//
// Only what BLS emits is supported: deflate or stored members, shared strings
// and inline numbers. That is deliberate — this is a reader for these files, not
// a general spreadsheet library.

import { createReadStream, createWriteStream } from 'node:fs';
import { mkdir, open, rename } from 'node:fs/promises';
import { dirname } from 'node:path';
import { pipeline } from 'node:stream/promises';
import { createInflateRaw } from 'node:zlib';

type ZipEntry = { name: string; method: number; compressedSize: number; headerOffset: number };

const EOCD_SIGNATURE = 0x06054b50;
const CENTRAL_SIGNATURE = 0x02014b50;

/** Read the central directory so we can pull a single member out of the archive. */
async function readDirectory(path: string): Promise<Map<string, ZipEntry>> {
  const file = await open(path, 'r');
  try {
    const { size } = await file.stat();
    // The end-of-central-directory record sits in the last 22 bytes plus at most
    // a 64 KB comment.
    const tailLength = Math.min(size, 66_000);
    const tail = Buffer.alloc(tailLength);
    await file.read(tail, 0, tailLength, size - tailLength);

    let eocd = -1;
    for (let i = tail.length - 22; i >= 0; i -= 1) {
      if (tail.readUInt32LE(i) === EOCD_SIGNATURE) {
        eocd = i;
        break;
      }
    }
    if (eocd < 0) throw new Error(`${path} is not a zip archive`);

    const entryCount = tail.readUInt16LE(eocd + 10);
    const directorySize = tail.readUInt32LE(eocd + 12);
    const directoryStart = tail.readUInt32LE(eocd + 16);
    if (directoryStart === 0xffffffff) throw new Error(`${path} uses zip64, which this reader does not handle`);

    const directory = Buffer.alloc(directorySize);
    await file.read(directory, 0, directorySize, directoryStart);

    const entries = new Map<string, ZipEntry>();
    let cursor = 0;
    for (let i = 0; i < entryCount; i += 1) {
      if (directory.readUInt32LE(cursor) !== CENTRAL_SIGNATURE) break;
      const method = directory.readUInt16LE(cursor + 10);
      const compressedSize = directory.readUInt32LE(cursor + 20);
      const nameLength = directory.readUInt16LE(cursor + 28);
      const extraLength = directory.readUInt16LE(cursor + 30);
      const commentLength = directory.readUInt16LE(cursor + 32);
      const headerOffset = directory.readUInt32LE(cursor + 42);
      const name = directory.toString('utf8', cursor + 46, cursor + 46 + nameLength);
      entries.set(name, { name, method, compressedSize, headerOffset });
      cursor += 46 + nameLength + extraLength + commentLength;
    }
    return entries;
  } finally {
    await file.close();
  }
}

/** Where a member's bytes start, which the local header (not the directory) decides. */
async function dataOffset(path: string, entry: ZipEntry): Promise<number> {
  const file = await open(path, 'r');
  try {
    const header = Buffer.alloc(30);
    await file.read(header, 0, 30, entry.headerOffset);
    const nameLength = header.readUInt16LE(26);
    const extraLength = header.readUInt16LE(28);
    return entry.headerOffset + 30 + nameLength + extraLength;
  } finally {
    await file.close();
  }
}

async function* memberChunks(path: string, entry: ZipEntry): AsyncGenerator<string> {
  const start = await dataOffset(path, entry);
  const raw = createReadStream(path, { start, end: start + entry.compressedSize - 1 });
  const stream = entry.method === 0 ? raw : raw.pipe(createInflateRaw());
  for await (const chunk of stream) yield (chunk as Buffer).toString('utf8');
}

async function readMember(path: string, entry: ZipEntry): Promise<string> {
  let text = '';
  for await (const chunk of memberChunks(path, entry)) text += chunk;
  return text;
}

/** Member names inside a zip. The BLS archive holds one .xlsx per geography level. */
export async function listZipMembers(path: string): Promise<string[]> {
  return [...(await readDirectory(path)).keys()];
}

/**
 * Write one member of a zip out to `target`. The OEWS download is a zip of
 * .xlsx files, and .xlsx is itself a zip, so the inner workbook has to come out
 * before the sheet reader can open it.
 */
export async function extractZipMember(path: string, member: string, target: string): Promise<void> {
  const entry = (await readDirectory(path)).get(member);
  if (!entry) throw new Error(`${path} has no member ${member}`);

  const start = await dataOffset(path, entry);
  const raw = createReadStream(path, { start, end: start + entry.compressedSize - 1 });
  await mkdir(dirname(target), { recursive: true });
  const partial = `${target}.partial`;
  const out = createWriteStream(partial);
  if (entry.method === 0) await pipeline(raw, out);
  else await pipeline(raw, createInflateRaw(), out);
  await rename(partial, target);
}

const XML_ENTITIES: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" };

function decodeXml(value: string): string {
  return value
    .replace(/&#x([0-9a-f]+);/gi, (_, hex: string) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, code: string) => String.fromCodePoint(Number(code)))
    .replace(/&([a-z]+);/gi, (whole, name: string) => XML_ENTITIES[name.toLowerCase()] ?? whole);
}

/** xl/sharedStrings.xml is one <si> per unique string, sometimes split into runs. */
function parseSharedStrings(xml: string): string[] {
  const strings: string[] = [];
  for (const match of xml.matchAll(/<si>([\s\S]*?)<\/si>/g)) {
    const parts = [...(match[1] ?? '').matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g)].map((part) => part[1] ?? '');
    strings.push(decodeXml(parts.join('')));
  }
  return strings;
}

/** "AF12" -> 31 (zero-based column index). */
function columnIndex(reference: string): number {
  let index = 0;
  for (const char of reference) {
    const code = char.charCodeAt(0);
    if (code < 65 || code > 90) break;
    index = index * 26 + (code - 64);
  }
  return index - 1;
}

const CELL = /<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g;

function parseRow(xml: string, shared: string[], width: number): string[] {
  const cells: string[] = new Array(width).fill('');
  for (const match of xml.matchAll(CELL)) {
    const attributes = match[1] ?? '';
    const body = match[2];
    if (body === undefined) continue;

    const reference = /\br="([A-Z]+)\d+"/.exec(attributes)?.[1];
    const index = reference ? columnIndex(reference) : -1;
    if (index < 0 || index >= width) continue;

    const type = /\bt="([^"]+)"/.exec(attributes)?.[1] ?? 'n';
    if (type === 'inlineStr') {
      const parts = [...body.matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g)].map((part) => part[1] ?? '');
      cells[index] = decodeXml(parts.join(''));
      continue;
    }
    const value = /<v>([\s\S]*?)<\/v>/.exec(body)?.[1];
    if (value === undefined) continue;
    cells[index] = type === 's' ? (shared[Number(value)] ?? '') : decodeXml(value);
  }
  return cells;
}

/**
 * Stream one worksheet as records keyed by its header row.
 *
 * `keep` runs on every row before the record is built, so a caller that wants
 * one metro out of every metro in the country never pays for the rest.
 */
export async function* readSheetRecords(
  path: string,
  options: { sheet?: string; keep?: (cells: string[], header: string[]) => boolean } = {},
): AsyncGenerator<Record<string, string>> {
  const entries = await readDirectory(path);
  const sheetName = options.sheet ?? 'xl/worksheets/sheet1.xml';
  const sheet = entries.get(sheetName);
  if (!sheet) throw new Error(`${path} has no ${sheetName}`);

  const sharedEntry = entries.get('xl/sharedStrings.xml');
  const shared = sharedEntry ? parseSharedStrings(await readMember(path, sharedEntry)) : [];

  let buffer = '';
  let header: string[] = [];
  let width = 0;

  for await (const chunk of memberChunks(path, sheet)) {
    buffer += chunk;
    let end = buffer.indexOf('</row>');
    while (end !== -1) {
      const start = buffer.lastIndexOf('<row', end);
      if (start !== -1) {
        const rowXml = buffer.slice(start, end);
        if (width === 0) {
          // The header row sets the width; later rows are padded to match.
          const probe = parseRow(rowXml, shared, 512).filter((value) => value !== '');
          header = probe;
          width = probe.length;
        } else {
          const cells = parseRow(rowXml, shared, width);
          if (!options.keep || options.keep(cells, header)) {
            const record: Record<string, string> = {};
            header.forEach((name, index) => {
              record[name] = cells[index] ?? '';
            });
            yield record;
          }
        }
      }
      buffer = buffer.slice(end + 6);
      end = buffer.indexOf('</row>');
    }
    // Keep only the tail that might hold the start of an unfinished row.
    if (buffer.length > 4_000_000) buffer = buffer.slice(-1_000_000);
  }
}
