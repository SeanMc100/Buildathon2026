// Polite HTTP for the research ingest: one descriptive User-Agent, a timeout, a
// gap between requests to the same host, and a status check that tells a page
// that has gone away apart from a host that simply refuses robots.
//
// Nothing here logs in, solves a challenge or pretends to be a browser. A host
// that blocks automated reads stays blocked, and the item says so.

import type { UrlStatus } from './types';

const USER_AGENT = 'BuildathonApp-ResearchIngest/0.1 (career-matching prototype; contact seanmcdonnell2000@gmail.com)';
const TIMEOUT_MS = 25000;
/** Minimum gap between two requests to the same host. */
const HOST_GAP_MS = 800;

const lastHit = new Map<string, number>();

const sleep = (ms: number) => new Promise((done) => setTimeout(done, ms));

async function waitForHost(url: string): Promise<void> {
  let host: string;
  try {
    host = new URL(url).host;
  } catch {
    return;
  }
  const previous = lastHit.get(host);
  const now = Date.now();
  if (previous !== undefined && now - previous < HOST_GAP_MS) await sleep(HOST_GAP_MS - (now - previous));
  lastHit.set(host, Date.now());
}

export type Fetched = { status: number; url: string; body: string };

/** A GET that never throws on an HTTP status; the caller decides what a status means. */
export async function get(url: string): Promise<Fetched> {
  await waitForHost(url);
  const response = await fetch(url, {
    headers: { 'User-Agent': USER_AGENT, Accept: 'text/html,application/json;q=0.9,*/*;q=0.8' },
    signal: AbortSignal.timeout(TIMEOUT_MS),
    redirect: 'follow',
  });
  return { status: response.status, url: response.url, body: await response.text() };
}

/** A GET that throws on anything but 2xx. For APIs, where a bad status is a real failure. */
export async function getOk(url: string): Promise<string> {
  const response = await get(url);
  if (response.status < 200 || response.status >= 300) throw new Error(`${url} returned ${response.status}`);
  return response.body;
}

export async function postJson(url: string, payload: unknown): Promise<string> {
  await waitForHost(url);
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'User-Agent': USER_AGENT, 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (!response.ok) throw new Error(`${url} returned ${response.status}`);
  return response.text();
}

/**
 * Cloudflare and AWS WAF answer a robot with a 200 or 202 carrying a challenge
 * page instead of the content. Treating that as a live page would let us record
 * "verified" against something we never read.
 */
const CHALLENGE = /Just a moment\.\.\.|Enable JavaScript and cookies to continue|cf-browser-verification|__cf_chl|awswaf/i;

export function classify(response: Fetched): UrlStatus {
  if (response.status === 404 || response.status === 410) return 'dead';
  if (response.status === 401 || response.status === 403 || response.status === 429) return 'blocked';
  if (response.status >= 500) return 'blocked';
  if (response.status === 202 && response.body.trim().length === 0) return 'blocked';
  if (CHALLENGE.test(response.body.slice(0, 4000))) return 'blocked';
  if (response.status >= 200 && response.status < 400) return 'ok';
  return 'blocked';
}

/**
 * Some hosts serve a 200 "page not found". Checking the text as well as the
 * status stops a soft 404 being recorded as a live programme page.
 */
const SOFT_404 = /404 Page Not Found|Error 404|page can'?t be found|page you are looking for cannot be found/i;

export function isSoft404(text: string): boolean {
  return SOFT_404.test(text.slice(0, 2000));
}
