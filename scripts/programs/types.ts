// Shapes shared by the program ingestion scripts.
//
// A "program" here is something you *enrol in and keep attending*: a cohort, an
// apprenticeship, an academy, a fellowship, a credential course. One-off events
// belong to scripts/events, and open roles belong to scripts/jobs.
//
// ProgramOpportunity (src/models/opportunity.ts) is the shared contract and Sean
// owns it. The facts a training provider publishes that the contract has no room
// for live under `program`, so nothing in src/ has to change for this pipeline to
// run. See docs/program-sources.md for the list waiting to be promoted.

import type { ProgramOpportunity } from '../../src/models';

/** Broad field of work, used for coverage reporting and for the Holland pass. */
export type ProgramSector =
  | 'skilled_trades'
  | 'healthcare'
  | 'manufacturing'
  | 'transport_logistics'
  | 'tech'
  | 'entrepreneurship'
  | 'creative'
  | 'adult_education'
  | 'general_workforce';

/** Who the provider says the program is for. Empty means "open to adults generally". */
export type ProgramAudience =
  | 'youth'
  | 'young_adults'
  | 'returning_citizens'
  | 'women'
  | 'immigrants'
  | 'veterans'
  | 'older_workers'
  | 'detroit_residents'
  | 'low_income'
  | 'disability_support'
  | 'spanish_speakers';

export type DeliveryFormat = 'in_person' | 'online' | 'hybrid' | 'unknown';

/** How money works for the participant. Drives the "is this actually free?" line on the card. */
export type FundingModel =
  | 'free_to_participant'
  | 'wioa_funded'
  | 'employer_sponsored'
  | 'paid_training'
  | 'tuition'
  | 'scholarship_available'
  | 'unknown';

export type ApplicationMethod = 'online_form' | 'phone' | 'email' | 'in_person' | 'info_session' | 'unknown';

export type CohortCadence = 'rolling' | 'cohort' | 'continuous' | 'annual' | 'unknown';

/** Where a single field came from, so the run report can be honest about it. */
export type FactSource = 'page' | 'registry' | 'absent';

/**
 * Everything a training provider publishes that ProgramOpportunity has no field
 * for. Emitted under `program` on every item.
 */
export type ProgramExtras = {
  sector: ProgramSector;
  audiences: ProgramAudience[];
  delivery: DeliveryFormat;
  funding: FundingModel;
  /** Certificate or licence named on the page, e.g. 'CDL-A', 'CompTIA A+'. Empty when none is named. */
  credentials: string[];
  /** Support the page offers alongside the training. */
  supports: Array<'childcare' | 'transport' | 'stipend' | 'tools_or_equipment' | 'job_placement' | 'housing' | 'meals'>;
  applicationMethod: ApplicationMethod;
  cadence: CohortCadence;
  /** Schedule exactly as the page words it, when it gives no parseable date. */
  scheduleNote: string | null;
  /** Cost exactly as the page words it, when no dollar figure could be read. */
  costNote: string | null;
  /** True when the program is open statewide or nationally rather than being Detroit-specific. */
  statewide: boolean;
  /** How this item was read, for the drift report. */
  readAs: 'wp_rest' | 'html_table' | 'html_page';
  /** Which fields came off the live page and which were typed into registry.ts. */
  provenance: Record<'costUsd' | 'durationWeeks' | 'startsAt' | 'applyBy' | 'stipendUsd' | 'eligibility', FactSource>;
  /** sha1 of the page text this run read, so the next run can say "this page changed". */
  contentHash: string;
  /** Page the facts were read from, when it differs from the public `url`. */
  sourcePage: string;
};

/** What lands in data/programs.json. ProgramOpportunity plus the fields it lacks. */
export type ProgramRecord = ProgramOpportunity & { program: ProgramExtras };

/** One program exactly as a source described it, before any tagging. */
export type RawProgram = {
  /** Which source produced it, e.g. 'techtown'. Used for ids, dedupe and reporting. */
  source: string;
  /** Stable id inside that source. Must not change between runs. */
  sourceId: string;
  title: string;
  organization: string;
  /** Plain text of the program page. May be empty when only a listing row exists. */
  description: string;
  /** The link a person follows. Checked for a 200 before the item is kept. */
  url: string;
  /** Page the description was read from, when that is not `url` (a listing page, say). */
  sourcePage?: string;
  /** City, or null for online/statewide. */
  city: string | null;
  /** Venue or campus line for the card. */
  location: string | null;
  statewide?: boolean;
  readAs: ProgramExtras['readAs'];

  // ---- Curated hints (registry.ts). Everything else is read off the page. ----
  sector?: ProgramSector;
  /** True when `sector` was chosen by a human and must not be overridden by keywords. */
  sectorFixed?: boolean;
  audiences?: ProgramAudience[];
  /** Facts a human confirmed on the page and typed in, because no rule could read them. */
  facts?: Partial<{
    costUsd: number | null;
    stipendUsd: number | null;
    durationWeeks: number | null;
    startsAt: string | null;
    applyBy: string | null;
    eligibility: string[];
    funding: FundingModel;
    delivery: DeliveryFormat;
    credentials: string[];
    applicationMethod: ApplicationMethod;
    cadence: CohortCadence;
  }>;
  /** Summary to use when the page yields nothing usable. */
  summary?: string;
};

/** A source is a named function, so one failing never stops the others. */
export type ProgramSource = {
  name: string;
  /** What we fetch, shown in the run report and in docs/program-sources.md. */
  endpoint: string;
  /** How brittle this is if the site changes. Printed when a source returns nothing. */
  fragility: 'low' | 'medium' | 'high';
  fetch: () => Promise<RawProgram[]>;
};

export type SourceEntry = {
  source: ProgramSource;
  /** True when returning nothing is a normal state rather than a broken adapter. */
  mayBeEmpty?: boolean;
};
