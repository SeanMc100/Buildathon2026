// The catalog the app actually matches against: real events from the last
// ingestion run (data/events.json, written by `npm run ingest:events`), plus the
// sample entries for kinds we do not ingest yet.

import type { EventOpportunity, Opportunity } from '../models';
import liveEventsFile from '../../data/events.json';
import { OPPORTUNITIES } from './opportunities';

/** One line per source from the last ingest run. `kept` is how many of its events made it in. */
export type EventSourceSummary = { name: string; fetched: number; kept: number; error?: string };

type EventsFile = {
  generatedAt: string;
  region: string;
  sources: EventSourceSummary[];
  events: EventOpportunity[];
};

// The JSON import is typed loosely (e.g. format is just a string), so it is
// narrowed once here. The ingestion script is what guarantees the shape.
const file = liveEventsFile as unknown as EventsFile;
const liveEvents: EventOpportunity[] = Array.isArray(file.events) ? file.events : [];

const sampleEvents = OPPORTUNITIES.filter((item) => item.kind === 'event');
const otherSamples = OPPORTUNITIES.filter((item) => item.kind !== 'event');

/** When the snapshot was pulled, and which sources fed it. Shown on the all-events screen. */
export const EVENTS_PULLED_AT: string | null = file.generatedAt ?? null;
export const EVENT_SOURCES: EventSourceSummary[] = Array.isArray(file.sources)
  ? file.sources.filter((source) => source.kept > 0)
  : [];

/**
 * Real events replace the sample ones. If the snapshot has gone stale and every
 * event in it has ended, fall back to the samples (labelled "(sample)") rather
 * than show an empty Events row; re-run the ingest to refresh.
 */
export function buildCatalog(now: Date = new Date()): Opportunity[] {
  const hasUpcoming = liveEvents.some((event) => Date.parse(event.endsAt ?? event.startsAt) >= now.getTime());
  return [...otherSamples, ...(hasUpcoming ? liveEvents : sampleEvents)];
}

export const CATALOG: Opportunity[] = buildCatalog();
