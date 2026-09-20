// Pulls career development programmes from every source and writes the metro
// Detroit ones to data/programs.json.
//
//   npm run ingest:programs
//
// Three things this run guarantees, because a catalog nobody re-runs goes stale
// and a catalog that links to 404s is worse than a short one:
//
//   * one source failing is reported and skipped, never blocking the others;
//   * every url is fetched and must answer 200, or the item is dropped and named;
//   * the previous snapshot is diffed, so the run says what is NEW, what has GONE,
//     whose page CHANGED and whose dates moved.
//
// Ids are a hash of source + source id, so re-running is idempotent: the same
// programme keeps the same id and anything holding a reference stays valid.

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';

import { metroCity } from '../events/region';
import { checkUrl } from './http';
import { assessProgram } from './enrich';
import { OUTPUT_PATH } from './paths';
import { SOURCES } from './sources';
import type { ProgramRecord, RawProgram } from './types';

const REGION = 'Detroit, MI';

type SourceReport = {
  name: string;
  fetched: number;
  kept: number;
  error?: string;
  endpoint: string;
  fragility: 'low' | 'medium' | 'high';
  /** Items dropped because their link no longer answers. */
  deadLinks: number;
};

type Snapshot = {
  generatedAt: string;
  region: string;
  sources: SourceReport[];
  drift: Drift;
  items: ProgramRecord[];
};

type Drift = {
  added: string[];
  removed: string[];
  pageChanged: string[];
  datesChanged: string[];
  deadLinks: string[];
};

/** Statewide and online programmes have no city; everything else must be in metro Detroit. */
function inRegion(raw: RawProgram): boolean {
  if (raw.statewide) return true;
  return metroCity(raw.city) !== null || metroCity(raw.location) !== null;
}

/** The same programme reached through two sources (a provider site and a listing). */
function dedupeKey(raw: RawProgram): string {
  // Singularise every word, so "Information Technology Pathway" and
  // "…Pathways" — the same Focus: HOPE course listed twice — collapse.
  const fold = (value: string) =>
    value
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, ' ')
      .trim()
      .split(' ')
      .map((word) => (word.length > 3 ? word.replace(/s$/, '') : word))
      .join(' ');
  return `${fold(raw.organization)}|${fold(raw.title)}`;
}

function readPrevious(): ProgramRecord[] {
  if (!existsSync(OUTPUT_PATH)) return [];
  try {
    const file = JSON.parse(readFileSync(OUTPUT_PATH, 'utf8')) as Partial<Snapshot>;
    return Array.isArray(file.items) ? file.items : [];
  } catch {
    return [];
  }
}

/** What a scheduled re-run should shout about. */
function diff(previous: ProgramRecord[], current: ProgramRecord[]): Omit<Drift, 'deadLinks'> {
  const before = new Map(previous.map((item) => [item.id, item]));
  const after = new Map(current.map((item) => [item.id, item]));

  const added = current.filter((item) => !before.has(item.id)).map((item) => `${item.organization} — ${item.title}`);
  const removed = previous.filter((item) => !after.has(item.id)).map((item) => `${item.organization} — ${item.title}`);

  const pageChanged: string[] = [];
  const datesChanged: string[] = [];
  for (const item of current) {
    const was = before.get(item.id);
    if (!was) continue;
    if (was.program?.contentHash && was.program.contentHash !== item.program.contentHash) {
      pageChanged.push(`${item.organization} — ${item.title}`);
    }
    if (was.startsAt !== item.startsAt || was.applyBy !== item.applyBy) {
      datesChanged.push(
        `${item.organization} — ${item.title}: starts ${was.startsAt ?? 'null'} → ${item.startsAt ?? 'null'}, applyBy ${was.applyBy ?? 'null'} → ${item.applyBy ?? 'null'}`,
      );
    }
  }
  return { added, removed, pageChanged, datesChanged };
}

async function main() {
  const now = new Date();
  const seen = new Set<string>();
  const reports: SourceReport[] = [];
  const dropped: Array<{ title: string; source: string; reason: string }> = [];
  const candidates: Array<{ record: ProgramRecord; source: string }> = [];

  console.log(`Ingesting Detroit programmes at ${now.toISOString()}\n`);

  for (const { source, mayBeEmpty } of SOURCES) {
    let raw: RawProgram[];
    try {
      raw = await source.fetch();
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      reports.push({ name: source.name, fetched: 0, kept: 0, error: message, endpoint: source.endpoint, fragility: source.fragility, deadLinks: 0 });
      console.log(`✗ ${source.name}: ${message}`);
      continue;
    }

    let accepted = 0;
    for (const program of raw) {
      const drop = (reason: string) => dropped.push({ title: program.title, source: source.name, reason });

      if (!inRegion(program)) {
        drop(`outside metro Detroit (${program.city ?? program.location ?? 'unknown'})`);
        continue;
      }
      const key = dedupeKey(program);
      if (seen.has(key)) {
        drop('already listed by another source');
        continue;
      }
      const result = assessProgram(program, now);
      if (!result.keep) {
        drop(result.reason);
        continue;
      }

      seen.add(key);
      candidates.push({ record: result.record, source: source.name });
      accepted += 1;
    }

    reports.push({ name: source.name, fetched: raw.length, kept: accepted, endpoint: source.endpoint, fragility: source.fragility, deadLinks: 0 });
    const flag = raw.length === 0 && !mayBeEmpty ? `  ⚠ returned nothing; ${source.fragility} fragility — has the page changed?` : '';
    console.log(`✓ ${source.name.padEnd(22)} ${String(raw.length).padStart(3)} fetched, ${String(accepted).padStart(3)} kept${flag}`);
  }

  // ---- Every link a person could tap, checked ----------------------------------
  console.log(`\nChecking ${candidates.length} links…`);
  const deadLinks: string[] = [];
  const checks = await Promise.all(
    candidates.map(async ({ record, source }) => ({ record, source, check: await checkUrl(record.url) })),
  );

  const kept: ProgramRecord[] = [];
  for (const { record, source, check } of checks) {
    if (!check.ok) {
      const reason = `link is dead (${check.status || 'no response'}${check.note ? `: ${check.note}` : ''})`;
      dropped.push({ title: record.title, source, reason });
      deadLinks.push(`${record.organization} — ${record.title} — ${record.url}`);
      const report = reports.find((entry) => entry.name === source);
      if (report) report.deadLinks += 1;
      continue;
    }
    kept.push(record);
  }

  // Stable order, so a re-run with no changes produces a byte-identical file.
  kept.sort((a, b) => a.organization.localeCompare(b.organization) || a.title.localeCompare(b.title));

  const drift: Drift = { ...diff(readPrevious(), kept), deadLinks };

  const snapshot: Snapshot = { generatedAt: now.toISOString(), region: REGION, sources: reports, drift, items: kept };
  mkdirSync(dirname(OUTPUT_PATH), { recursive: true });
  writeFileSync(OUTPUT_PATH, `${JSON.stringify(snapshot, null, 2)}\n`);

  // ---- Report -------------------------------------------------------------------
  const withDates = kept.filter((item) => item.startsAt !== null || item.applyBy !== null).length;
  const withCost = kept.filter((item) => item.costUsd !== null).length;
  const handEntered = kept.filter((item) => Object.values(item.program.provenance).includes('registry')).length;

  console.log(`\nWrote ${kept.length} programmes to ${OUTPUT_PATH}`);
  console.log(`  ${withCost} have a cost figure, ${withDates} have a real date, ${handEntered} carry at least one hand-entered fact`);

  const bySector = new Map<string, number>();
  for (const item of kept) bySector.set(item.program.sector, (bySector.get(item.program.sector) ?? 0) + 1);
  console.log(`  sectors: ${[...bySector].sort((a, b) => b[1] - a[1]).map(([name, n]) => `${name} ${n}`).join(', ')}`);

  if (drift.added.length > 0) console.log(`\nNew since the last run (${drift.added.length}):\n${drift.added.map((line) => `  + ${line}`).join('\n')}`);
  if (drift.removed.length > 0) console.log(`\nGone since the last run (${drift.removed.length}):\n${drift.removed.map((line) => `  - ${line}`).join('\n')}`);
  if (drift.pageChanged.length > 0) console.log(`\nPage text changed (${drift.pageChanged.length}) — re-read these before trusting their facts:\n${drift.pageChanged.map((line) => `  ~ ${line}`).join('\n')}`);
  if (drift.datesChanged.length > 0) console.log(`\nDates moved (${drift.datesChanged.length}):\n${drift.datesChanged.map((line) => `  ~ ${line}`).join('\n')}`);
  if (deadLinks.length > 0) console.log(`\nDropped for dead links (${deadLinks.length}):\n${deadLinks.map((line) => `  ✗ ${line}`).join('\n')}`);

  if (dropped.length > 0) {
    console.log(`\nLeft out (${dropped.length}):`);
    for (const item of dropped) console.log(`  - [${item.source}] ${item.title.slice(0, 60)} — ${item.reason}`);
  }

  if (kept.length === 0) process.exitCode = 1;
}

main();
