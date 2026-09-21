// The catalog the app actually matches against: real opportunities from the
// last ingestion run, plus the sample entries for anything not yet ingested.
//
// One snapshot file per kind, each written by its own script:
//   data/events.json    npm run ingest:events     Detroit-area events
//   data/jobs.json      npm run ingest:jobs       occupation types, not postings
//   data/programs.json  npm run ingest:programs   career development programs
//   data/research.json  npm run ingest:research   research opportunities
//
// Every file has the same envelope, so one loader reads all four.

import type {
  EventOpportunity,
  JobOpportunity,
  Opportunity,
  OpportunityKind,
  ProgramOpportunity,
  ResearchOpportunity,
} from '../models';
import eventsFile from '../../data/events.json';
import jobsFile from '../../data/jobs.json';
import programsFile from '../../data/programs.json';
import researchFile from '../../data/research.json';
import { MENTORSHIPS } from './mentorships';
import { OPPORTUNITIES } from './opportunities';

/** One line per source from an ingest run. `kept` is how many of its items made it in. */
export type SourceSummary = { name: string; fetched: number; kept: number; error?: string };

type Snapshot<T> = {
  generatedAt: string;
  region: string;
  sources: SourceSummary[];
  items: T[];
};

// The JSON imports are typed loosely by TypeScript (enums widen to string, and
// each item carries extra per-kind fields the shared model does not name yet),
// so each is narrowed once here. The ingestion scripts guarantee the shape.
function snapshot<T>(file: unknown, key: 'items' | 'events'): Snapshot<T> {
  const raw = file as Record<string, unknown>;
  const items = raw[key];
  return {
    generatedAt: typeof raw.generatedAt === 'string' ? raw.generatedAt : '',
    region: typeof raw.region === 'string' ? raw.region : '',
    sources: Array.isArray(raw.sources) ? (raw.sources as SourceSummary[]) : [],
    items: Array.isArray(items) ? (items as T[]) : [],
  };
}

// events.json predates the shared envelope and still names its array "events".
const events = snapshot<EventOpportunity>(eventsFile, 'events');
const jobs = snapshot<JobOpportunity>(jobsFile, 'items');
const programs = snapshot<ProgramOpportunity>(programsFile, 'items');
const research = snapshot<ResearchOpportunity>(researchFile, 'items');

// Mentorships are a hand-curated list with no ingest run, so they have no snapshot.
type IngestedKind = Exclude<OpportunityKind, 'mentorship'>;

const SNAPSHOTS: Record<IngestedKind, Snapshot<Opportunity>> = {
  event: events as Snapshot<Opportunity>,
  job: jobs as Snapshot<Opportunity>,
  program: programs as Snapshot<Opportunity>,
  research: research as Snapshot<Opportunity>,
};

/** When each kind was last pulled, and which sources fed it. Shown in the UI. */
export const INGEST_RUNS: Record<IngestedKind, { pulledAt: string | null; sources: SourceSummary[] }> = {
  event: { pulledAt: events.generatedAt || null, sources: events.sources.filter((s) => s.kept > 0) },
  job: { pulledAt: jobs.generatedAt || null, sources: jobs.sources.filter((s) => s.kept > 0) },
  program: { pulledAt: programs.generatedAt || null, sources: programs.sources.filter((s) => s.kept > 0) },
  research: { pulledAt: research.generatedAt || null, sources: research.sources.filter((s) => s.kept > 0) },
};

/** Kept for the existing events screen, which was written before the other kinds landed. */
export const EVENTS_PULLED_AT: string | null = INGEST_RUNS.event.pulledAt;
export const EVENT_SOURCES: SourceSummary[] = INGEST_RUNS.event.sources;

/** Is this item still worth showing? Events expire; so do passed deadlines. */
function isLive(item: Opportunity, now: Date): boolean {
  if (item.kind === 'event') return Date.parse(item.endsAt ?? item.startsAt) >= now.getTime();
  return true;
}

/**
 * Real data replaces the samples for a kind. If a snapshot has gone stale and
 * nothing in it is still live, fall back to that kind's samples (which the UI
 * labels "(sample)") rather than show an empty row; re-run the ingest to refresh.
 */
export function buildCatalog(now: Date = new Date()): Opportunity[] {
  const kinds: IngestedKind[] = ['job', 'program', 'event', 'research'];
  const ingested = kinds.flatMap((kind) => {
    const live = SNAPSHOTS[kind].items.filter((item) => isLive(item, now));
    return live.length > 0 ? live : OPPORTUNITIES.filter((item) => item.kind === kind);
  });
  return [...ingested, ...MENTORSHIPS];
}

export const CATALOG: Opportunity[] = buildCatalog();
