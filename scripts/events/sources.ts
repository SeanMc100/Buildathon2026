// Event sources. Each one reads something the organiser publishes for the public:
// a calendar API or feed, or the page data behind a public listing. Nothing here
// logs in, and nothing touches Facebook or Eventbrite, whose terms restrict
// automated reads.
//
// Four kinds of adapter cover almost everything:
//   tribeSource  WordPress sites running "The Events Calendar" (public REST API)
//   icsSource    any calendar feed (.ics), including every Meetup group
//   lumaSource   a Luma city page, which lists events from many hosts
//   manualSource events typed into data/manual-events.json, for organisers with no
//                feed at all (Facebook-only groups, one-off events)
//
// To add a source, add one line to SOURCES.

import { readFileSync } from 'node:fs';

import { parseIcs } from './ics';
import { MANUAL_EVENTS_PATH } from './paths';
import { decodeEntities, htmlToText, stripMarkdown } from './text';
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

// ---- WordPress "The Events Calendar" -----------------------------------------

type TribeEvent = {
  id: number;
  url: string;
  title: string;
  description: string;
  utc_start_date: string;
  utc_end_date: string;
  cost?: string;
  cost_details?: { values?: string[] };
  venue?: { venue?: string; address?: string; city?: string; state?: string } | unknown[];
  organizer?: Array<{ organizer?: string }>;
};

type TribePage = { events?: TribeEvent[]; total_pages?: number };

/** "Free" is 0, "$275 – $550" is 275 (the cheapest ticket), anything else is unknown. */
function tribeCost(event: TribeEvent): number | null {
  const values = (event.cost_details?.values ?? []).map(Number).filter((value) => Number.isFinite(value));
  if (values.length > 0) return Math.min(...values);
  return /free/i.test(event.cost ?? '') ? 0 : null;
}

/** The API sends UTC as "2026-09-22 22:00:00". */
const tribeUtc = (value: string) => `${value.replace(' ', 'T')}Z`;

function tribeSource(name: string, base: string, organizer: string): EventSource {
  const endpoint = `${base}/wp-json/tribe/events/v1/events`;
  return {
    name,
    endpoint,
    async fetch() {
      const events: TribeEvent[] = [];
      for (let page = 1, pages = 1; page <= pages; page += 1) {
        const body = JSON.parse(await get(`${endpoint}?per_page=50&page=${page}&start_date=now`)) as TribePage;
        events.push(...(body.events ?? []));
        pages = body.total_pages ?? 1;
      }

      return events.map((event): RawEvent => {
        // With no venue the API sends an empty array instead of an object.
        const venue = Array.isArray(event.venue) ? null : (event.venue ?? null);
        const organizerName = event.organizer?.[0]?.organizer || organizer;
        const title = decodeEntities(event.title);
        const place = [venue?.venue, venue?.address].filter(Boolean).join(', ');
        const city = [venue?.city, venue?.state].filter(Boolean).join(', ');

        return {
          source: name,
          sourceId: String(event.id),
          title,
          description: htmlToText(event.description ?? ''),
          url: event.url,
          startsAt: tribeUtc(event.utc_start_date),
          endsAt: event.utc_end_date ? tribeUtc(event.utc_end_date) : null,
          location: place || null,
          city: city || null,
          // No venue means unknown, not online: only say online when the listing does.
          isOnline: ONLINE_HINT.test(`${title} ${place} ${city}`),
          costUsd: tribeCost(event),
          organizer: decodeEntities(String(organizerName)),
        };
      });
    },
  };
}

// ---- Calendar feeds (.ics) ---------------------------------------------------

function icsSource(name: string, url: string, organizer: string): EventSource {
  return {
    name,
    endpoint: url,
    async fetch() {
      return parseIcs(await get(url)).map((event): RawEvent => {
        const location = event.location || null;
        return {
          source: name,
          sourceId: event.uid || `${event.summary}|${event.startsAt}`,
          // Some feeds double-encode, so "&#8211;" arrives as literal text.
          title: decodeEntities(event.summary),
          description: stripMarkdown(decodeEntities(event.description)),
          url: event.url || url,
          startsAt: event.startsAt,
          endsAt: event.endsAt,
          location,
          // A feed gives one address string, so keep it whole and let the region
          // filter look for a metro city inside it.
          city: location,
          isOnline: ONLINE_HINT.test(`${event.summary} ${location ?? ''}`),
          costUsd: null,
          organizer: event.organizer || organizer,
        };
      });
    },
  };
}

/** Every Meetup group publishes its upcoming events as a calendar feed. */
const meetup = (group: string, organizer: string) =>
  icsSource(`meetup-${group}`, `https://www.meetup.com/${group}/events/ical/`, organizer);

// ---- Luma city pages ---------------------------------------------------------

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

/** Reads the page's own <meta name="description">, the summary the host wrote for link previews. */
function metaDescription(html: string): string {
  return decodeEntities(/<meta name="description" content="([^"]*)"/i.exec(html)?.[1] ?? '').trim();
}

function lumaSource(place: string): EventSource {
  const page = `https://luma.com/${place}`;
  return {
    name: `luma-${place}`,
    endpoint: page,
    async fetch() {
      const html = await get(page);
      const match = /<script id="__NEXT_DATA__"[^>]*>(.*?)<\/script>/s.exec(html);
      if (!match) throw new Error('Luma page no longer carries __NEXT_DATA__; the adapter needs updating.');

      const entries = (JSON.parse(match[1]) as { props?: { pageProps?: { initialData?: { data?: { events?: LumaEntry[] } } } } })
        .props?.pageProps?.initialData?.data?.events;
      if (!Array.isArray(entries)) throw new Error('Luma page data has a new shape; the adapter needs updating.');

      const raw = entries.map(({ event, hosts, calendar, ticket_info }): RawEvent => {
        const geo = event.geo_address_info ?? null;
        return {
          source: `luma-${place}`,
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
}

// ---- Manual entries ----------------------------------------------------------

type ManualEvent = {
  title: string;
  url: string;
  startsAt: string;
  endsAt?: string | null;
  organizer: string;
  location?: string | null;
  city?: string | null;
  description?: string;
  isOnline?: boolean;
  costUsd?: number | null;
};

/**
 * For anyone who posts only on Facebook, or who has no feed at all. Add the
 * event to data/manual-events.json by hand; it goes through the same filters
 * and tagging as everything else.
 */
const manual: EventSource = {
  name: 'manual',
  endpoint: MANUAL_EVENTS_PATH,
  async fetch() {
    const file = JSON.parse(readFileSync(MANUAL_EVENTS_PATH, 'utf8')) as { events?: ManualEvent[] };
    return (file.events ?? []).map((event, index): RawEvent => {
      if (!event.title || !event.url || !event.startsAt || Number.isNaN(Date.parse(event.startsAt))) {
        throw new Error(`manual-events.json entry ${index + 1} needs a title, url and a valid startsAt.`);
      }
      return {
        source: 'manual',
        sourceId: event.url,
        title: event.title,
        description: event.description ?? '',
        url: event.url,
        startsAt: new Date(event.startsAt).toISOString(),
        endsAt: event.endsAt ? new Date(event.endsAt).toISOString() : null,
        location: event.location ?? null,
        city: event.city ?? event.location ?? null,
        isOnline: event.isOnline ?? false,
        costUsd: event.costUsd ?? null,
        organizer: event.organizer,
      };
    });
  },
};

// ---- The list ------------------------------------------------------------------

export type SourceEntry = {
  source: EventSource;
  /** True when having no events right now is normal. */
  mayBeEmpty?: boolean;
  /**
   * The organiser is based in metro Detroit, so an event with no listed venue is
   * kept as local. Without this an event that omits its address would be dropped.
   */
  localOrganizer?: boolean;
};

export const SOURCES: SourceEntry[] = [
  // Home of Build 313's Build Nights and the Venture 313 events.
  { source: tribeSource('techtown', 'https://techtowndetroit.org', 'TechTown Detroit'), localOrganizer: true },
  { source: tribeSource('detroit-chamber', 'https://detroitchamber.com', 'Detroit Regional Chamber'), localOrganizer: true },
  { source: tribeSource('detroit-future-city', 'https://detroitfuturecity.com', 'Detroit Future City'), mayBeEmpty: true, localOrganizer: true },
  { source: icsSource('automation-alley', 'https://automationalley.com/events/feed.ics', 'Automation Alley'), localOrganizer: true },
  { source: meetup('itinthed', 'IT in the D'), localOrganizer: true },
  { source: meetup('detroit-women-in-tech', 'Detroit Women in Tech'), localOrganizer: true },
  { source: meetup('startup-detroit', 'Startup Detroit'), mayBeEmpty: true, localOrganizer: true },
  { source: meetup('dnewtech', 'Detroit New Tech'), mayBeEmpty: true, localOrganizer: true },
  { source: lumaSource('detroit') },
  { source: manual, mayBeEmpty: true },
];
