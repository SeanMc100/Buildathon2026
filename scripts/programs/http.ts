// Every network call in this pipeline goes through here, so the politeness rules
// live in one place: a descriptive User-Agent, one request at a time per host
// with a gap between them, a timeout, and one retry on a transient failure.
//
// Public pages and public APIs only. Nothing here logs in or sends a cookie.

const USER_AGENT = 'BuildathonApp-ProgramIngest/0.1 (career-matching prototype; Detroit programs catalog)';
const TIMEOUT_MS = 45000;
/** Minimum gap between two requests to the same host. */
const HOST_GAP_MS = 700;

const lastCallByHost = new Map<string, Promise<void>>();

const sleep = (ms: number) => new Promise<void>((done) => setTimeout(done, ms));

/** Queues per host, so we never open two connections to the same site at once. */
function queued<T>(url: string, run: () => Promise<T>): Promise<T> {
  const host = new URL(url).host;
  const previous = lastCallByHost.get(host) ?? Promise.resolve();
  const result = previous.then(run, run);
  lastCallByHost.set(
    host,
    result.then(
      () => sleep(HOST_GAP_MS),
      () => sleep(HOST_GAP_MS),
    ),
  );
  return result;
}

async function once(url: string, method: 'GET' | 'HEAD'): Promise<Response> {
  return fetch(url, {
    method,
    headers: { 'User-Agent': USER_AGENT, Accept: '*/*' },
    redirect: 'follow',
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
}

/** A timeout or a 5xx is worth one more try; a 404 is not. */
async function withRetry(url: string, method: 'GET' | 'HEAD'): Promise<Response> {
  try {
    const response = await once(url, method);
    if (response.status >= 500) {
      await sleep(1200);
      return await once(url, method);
    }
    return response;
  } catch (error) {
    await sleep(1200);
    try {
      return await once(url, method);
    } catch {
      throw error instanceof Error ? error : new Error(String(error));
    }
  }
}

export async function get(url: string): Promise<string> {
  return queued(url, async () => {
    const response = await withRetry(url, 'GET');
    if (!response.ok) throw new Error(`${url} returned ${response.status}`);
    return response.text();
  });
}

export async function getJson<T>(url: string): Promise<T> {
  const body = await get(url);
  try {
    return JSON.parse(body) as T;
  } catch {
    throw new Error(`${url} did not return JSON (got ${body.slice(0, 60).replace(/\s+/g, ' ')}…)`);
  }
}

export type UrlCheck = { ok: boolean; status: number; finalUrl: string; note: string | null };

/**
 * Confirms a link a person would actually tap still works. HEAD first because it
 * is cheap; some sites (and most PDF hosts) refuse HEAD, so fall back to GET.
 * A demo that links to a 404 is worse than one entry short.
 */
export async function checkUrl(url: string): Promise<UrlCheck> {
  return queued(url, async () => {
    try {
      let response = await withRetry(url, 'HEAD');
      if (response.status === 405 || response.status === 403 || response.status === 501) {
        response = await withRetry(url, 'GET');
      }
      const finalUrl = response.url || url;
      // A site that answers a missing page with its home page has not really got it.
      const redirectedHome = response.ok && new URL(finalUrl).pathname === '/' && new URL(url).pathname !== '/';
      return {
        ok: response.ok && !redirectedHome,
        status: response.status,
        finalUrl,
        note: redirectedHome ? 'redirected to the site home page' : null,
      };
    } catch (error) {
      return { ok: false, status: 0, finalUrl: url, note: error instanceof Error ? error.message : String(error) };
    }
  });
}
