// The catalog the app actually matches against: real events from the last
// ingestion run (data/events.json, written by `npm run ingest:events`), plus the
// sample entries for kinds we do not ingest yet.

import type { EventOpportunity, Opportunity } from '../models';
import liveEventsFile from '../../data/events.json';
import { OPPORTUNITIES } from './opportunities';

type EventsFile = { generatedAt: string; region: string; events: EventOpportunity[] };

// The JSON import is typed loosely (e.g. format is just a string), so it is
// narrowed once here. The ingestion script is what guarantees the shape.
const file = liveEventsFile as unknown as EventsFile;
const liveEvents: EventOpportunity[] = Array.isArray(file.events) ? file.events : [];

const sampleEvents = OPPORTUNITIES.filter((item) => item.kind === 'event');
const otherSamples = OPPORTUNITIES.filter((item) => item.kind !== 'event');

/** When the snapshot was pulled. Shown nowhere yet; handy when a demo looks stale. */
export const EVENTS_PULLED_AT: string | null = file.generatedAt ?? null;

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
