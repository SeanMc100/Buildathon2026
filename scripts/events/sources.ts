// Event sources. Each one reads something the organiser publishes for the public:
// a calendar feed, or the page data behind a public listing. Nothing here logs in,
// and nothing touches Facebook or Eventbrite, whose terms restrict automated reads.
//
// To add a source, write one more EventSource and append it to SOURCES.

import { parseIcs } from './ics';
import type { EventSource, RawEvent } from './types';

const USER_AGENT = 'BuildathonApp-EventIngest/0.1 (career-matching prototype)';
const TIMEOUT_MS = 20000;

async function get(url: string): Promise<string> {
  const response = await fetch(url, {
    headers: { 'User-Agent': USER_AGENT },
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (!response.ok) throw new Error(`${url} returned ${response.status}`);
  return response.text();
}

const ONLINE_HINT = /\b(virtual|online|zoom|webinar|teams meeting|livestream)\b/i;

// ---- TechTown Detroit: a standard "The Events Calendar" WordPress feed ---------

const TECHTOWN_FEED = 'https://techtowndetroit.org/?post_type=tribe_events&ical=1&eventDisplay=list';

const techtown: EventSource = {
  name: 'techtown',
  endpoint: TECHTOWN_FEED,
  async fetch() {
    const events = parseIcs(await get(TECHTOWN_FEED));
    return events.map((event): RawEvent => {
      const location = event.location || null;
      return {
        source: 'techtown',
        sourceId: event.uid,
        title: event.summary,
        description: event.description,
        url: event.url,
        startsAt: event.startsAt,
        endsAt: event.endsAt,
        location,
        // The feed gives a full address, so keep the whole string and let the
        // region filter look for a metro city inside it.
        city: location,
        isOnline: !location || ONLINE_HINT.test(`${event.summary} ${location}`),
        costUsd: null,
        organizer: event.organizer || 'TechTown Detroit',
      };
    });
  },
};

// ---- Luma Detroit: the public city page lists upcoming events from many hosts ---

const LUMA_DETROIT = 'https://luma.com/detroit';

type LumaEntry = {
  event: {
    api_id: string;
    name: string;
    url: string;
    start_at: string;
    end_at: string | null;
    location_type: string;
    geo_address_info?: { address?: string; city_state?: string; sublocality?: string } | null;
  };
  hosts?: Array<{ name: string }>;
  calendar?: { name?: string };
  ticket_info?: { is_free?: boolean } | null;
};

const luma: EventSource = {
  name: 'luma-detroit',
  endpoint: LUMA_DETROIT,
  async fetch() {
    const html = await get(LUMA_DETROIT);
    const match = /<script id="__NEXT_DATA__"[^>]*>(.*?)<\/script>/s.exec(html);
    if (!match) throw new Error('Luma page no longer carries __NEXT_DATA__; the adapter needs updating.');

    const entries = (JSON.parse(match[1]) as { props?: { pageProps?: { initialData?: { data?: { events?: LumaEntry[] } } } } })
      .props?.pageProps?.initialData?.data?.events;
    if (!Array.isArray(entries)) throw new Error('Luma page data has a new shape; the adapter needs updating.');

    const raw = entries.map(({ event, hosts, calendar, ticket_info }): RawEvent => {
      const geo = event.geo_address_info ?? null;
      return {
        source: 'luma-detroit',
        sourceId: event.api_id,
        title: event.name,
        // The listing has no description; it is filled in from each event page below.
        description: '',
        url: `https://luma.com/${event.url}`,
        startsAt: event.start_at,
        endsAt: event.end_at,
        // Hosts can hide the exact address until you register; fall back to the area.
        location: geo?.address ?? geo?.sublocality ?? null,
        city: geo?.city_state ?? null,
        isOnline: event.location_type === 'online',
        // Paid tickets carry a price we have not verified the units of, so leave those unknown.
        costUsd: ticket_info?.is_free ? 0 : null,
        organizer: hosts?.[0]?.name ?? calendar?.name ?? 'Luma host',
      };
    });

    // One polite request per event, in sequence. A miss just leaves the description empty.
    for (const event of raw) {
      try {
        event.description = metaDescription(await get(event.url));
      } catch {
        // Keep the event; tagging falls back to the title alone.
      }
    }
    return raw;
  },
};

const ENTITIES: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' };

/** Reads the page's own <meta name="description">, the summary the host wrote for link previews. */
function metaDescription(html: string): string {
  const raw = /<meta name="description" content="([^"]*)"/i.exec(html)?.[1] ?? '';
  return raw
    .replace(/&#x([0-9a-f]+);/gi, (_, hex: string) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, code: string) => String.fromCodePoint(Number(code)))
    .replace(/&([a-z]+);/gi, (whole, name: string) => ENTITIES[name.toLowerCase()] ?? whole)
    .trim();
}

export const SOURCES: EventSource[] = [techtown, luma];
