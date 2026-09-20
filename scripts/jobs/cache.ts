// Polite downloads with an on-disk cache.
//
// O*NET is ~70 MB of tables and the BLS wage file is ~40 MB. Neither changes
// more than once a year, so a monthly re-run should not pull them again. Files
// land in .cache/ (gitignored) and are reused until they are older than
// maxAgeDays.

import { existsSync, mkdirSync, renameSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

import { CACHE_DIR } from './paths';

/**
 * download.bls.gov rejects generic user agents outright, so every request
 * carries a descriptive one with a contact, the same way the events ingest does.
 */
export const USER_AGENT =
  'BuildathonApp-JobIngest/0.1 (Detroit career-matching prototype; seanmcdonnell2000@gmail.com)';

const TIMEOUT_MS = 180_000;

/** Seconds between requests to the same host, so we never hammer a public server. */
const POLITE_GAP_MS = 750;

const lastRequestAt = new Map<string, number>();

const sleep = (ms: number) => new Promise((done) => setTimeout(done, ms));

async function politeWait(url: string): Promise<void> {
  const host = new URL(url).host;
  const previous = lastRequestAt.get(host);
  if (previous !== undefined) {
    const wait = POLITE_GAP_MS - (Date.now() - previous);
    if (wait > 0) await sleep(wait);
  }
  lastRequestAt.set(host, Date.now());
}

export async function getText(url: string): Promise<string> {
  await politeWait(url);
  const response = await fetch(url, {
    headers: { 'User-Agent': USER_AGENT, Accept: '*/*' },
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (!response.ok) throw new Error(`${url} returned ${response.status}`);
  return response.text();
}

export async function getJson<T>(url: string): Promise<T> {
  return JSON.parse(await getText(url)) as T;
}

const ageDays = (path: string) => (Date.now() - statSync(path).mtimeMs) / 86_400_000;

/**
 * Fetch `url` into `.cache/<name>` and return the path. A cached copy younger
 * than maxAgeDays is reused, which is what makes a re-run cheap and idempotent.
 */
export async function cachedDownload(url: string, name: string, maxAgeDays = 30): Promise<string> {
  const path = join(CACHE_DIR, name);
  if (existsSync(path) && ageDays(path) < maxAgeDays) return path;

  await politeWait(url);
  const response = await fetch(url, {
    headers: { 'User-Agent': USER_AGENT, Accept: '*/*' },
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (!response.ok) throw new Error(`${url} returned ${response.status}`);
  const body = Buffer.from(await response.arrayBuffer());
  if (body.length === 0) throw new Error(`${url} returned an empty body`);

  mkdirSync(dirname(path), { recursive: true });
  // Write beside the target first, so an interrupted run never leaves a
  // half-written file that the next run would happily reuse.
  const partial = `${path}.partial`;
  writeFileSync(partial, body);
  renameSync(partial, path);
  return path;
}

/**
 * HEAD a page to confirm it is still there. Used to spot-check the hand-checked
 * sponsor links; a dead one is flagged rather than silently published.
 */
export async function isReachable(url: string): Promise<boolean> {
  const attempt = async (method: 'HEAD' | 'GET') => {
    await politeWait(url);
    const response = await fetch(url, {
      method,
      redirect: 'follow',
      headers: { 'User-Agent': USER_AGENT, Accept: 'text/html,*/*' },
      signal: AbortSignal.timeout(25_000),
    });
    // Drain GET bodies so the socket is released.
    if (method === 'GET') await response.text();
    return response.status;
  };

  try {
    const head = await attempt('HEAD');
    if (head < 400) return true;
    // Plenty of sites answer HEAD with 403/405 but serve GET fine.
    return (await attempt('GET')) < 400;
  } catch {
    return false;
  }
}
