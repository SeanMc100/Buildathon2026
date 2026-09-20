// Shapes shared by the research-opportunity ingestion scripts.
//
// A research opportunity is something a person in metro Detroit can actually
// apply to: an REU, a summer research programme, a hospital research
// internship, a fellowship, a paid lab or study-coordinator route, or a
// community-based research project. A grant award is *not* one of those, so the
// award APIs in discovery.ts feed coverage checks rather than items.

import type { EducationLevel, ResearchOpportunity } from '../../src/models';

/** How current the facts on an item are, and where they were read from. */
export type FactsSource =
  /** Read off the programme's own public page by the fetcher or by a human. */
  | 'program_page'
  /** Returned by a public API (NSF Awards, NIH RePORTER, Grants.gov). */
  | 'api'
  /** Read off a third-party listing because the programme's own host blocks robots. */
  | 'aggregator'
  /** In the registry but nobody has confirmed the details yet. Emitted with nulls. */
  | 'unverified';

/** What the last reachability check saw. Kept apart so a blocked host is not called dead. */
export type UrlStatus =
  /** 2xx. */
  | 'ok'
  /** 401/403/429 or a bot challenge: the page is almost certainly still there. */
  | 'blocked'
  /** 404/410, or the host does not resolve. */
  | 'dead'
  /** Checking was skipped this run. */
  | 'unchecked';

/** What a person must currently be enrolled in to take part. */
export type EnrollmentRequirement =
  | 'none'
  | 'high_school'
  | 'undergraduate'
  | 'graduate'
  | 'postdoc';

export type CitizenshipRequirement =
  | 'us_citizen_or_pr'
  | 'us_work_authorized'
  | 'open'
  | 'unstated';

/** How the person is supervised. Drives the manager_support trait. */
export type MentorshipModel =
  /** One faculty member, in their lab. */
  | 'faculty_lab'
  /** A cohort with a shared curriculum and a programme director. */
  | 'cohort_program'
  /** Embedded in a clinical or hospital research team. */
  | 'clinical_team'
  /** Community organisation and academic partner together. */
  | 'community_partnership'
  /** You define and run the project yourself. */
  | 'self_directed';

export type ApplicationMethod =
  | 'online_form'
  | 'email'
  | 'job_board'
  | 'nsf_etap'
  | 'contact_program'
  | 'unstated';

/** When the opportunity comes round again. Decides what happens once applyBy passes. */
export type Recurrence =
  | 'annual_summer'
  | 'annual_academic_year'
  | 'rolling'
  | 'one_time'
  | 'unknown';

/**
 * Everything true of a research opportunity that OpportunityBase has no room
 * for. Emitted under `research` so the shared model stays untouched; Sean
 * promotes these into src/models/opportunity.ts.
 */
export type ResearchExtras = {
  /** The university, health system or organisation that hosts the work. */
  institution: string;
  enrollmentRequired: EnrollmentRequirement;
  citizenship: CitizenshipRequirement;
  /** True when the page says there is a stipend, wage or salary. Null when it does not say. */
  isPaid: boolean | null;
  mentorshipModel: MentorshipModel;
  /** Free-text discipline tags, e.g. ['public health', 'epidemiology']. */
  disciplines: string[];
  applicationMethod: ApplicationMethod;
  recurrence: Recurrence;
  /** True when applyBy is in the past. Recurring programmes are kept, not deleted. */
  deadlinePassed: boolean;
  /** ISO date the next application window is expected to open, when the page says. */
  nextWindowOpens: string | null;
  /**
   * 'MM-DD' when the page states a deadline that comes round every year without
   * naming a year ("applications are due February 15"). Kept apart from applyBy
   * so a recurring date is never written out as a specific year we did not read.
   */
  annualDeadline: string | null;
  /** Runs in partnership with a community organisation, not only a university. */
  communityBased: boolean;
  /** Reachable without a bachelor's degree and without current enrolment. */
  lowBarrier: boolean;
  factsFrom: FactsSource;
  urlStatus: UrlStatus;
  /** ISO date-time the url was last checked. */
  lastCheckedAt: string;
  /**
   * Standing context a curator wrote down that no field can hold, e.g. "the
   * $3,000 on this page is a lab budget, not pay". Stable across runs.
   */
  curatorNotes: string[];
  /**
   * What this run found that disagrees with the registry: a page that has gone,
   * a host that refused us, a deadline that has passed, a number that moved.
   * Empty when the run was clean, which is the point.
   */
  driftNotes: string[];
};

/** What the ingest writes: the shared contract plus the fields it has no room for. */
export type ResearchItem = ResearchOpportunity & { research: ResearchExtras };

/**
 * One opportunity as a source described it, before tagging. The match tags
 * (Holland code, traits, job zone, stages, demands) are added by enrich.ts.
 */
export type RawResearch = {
  /** Which source produced it. Used for ids, dedupe and the run report. */
  source: string;
  /** Stable id inside that source. Must not change between runs. */
  sourceId: string;
  title: string;
  /** Who runs it, as shown on the card. */
  organization: string;
  /** Plain text. Drives the summary and the keyword tagging. */
  description: string;
  url: string;
  /** City, checked against the metro region list. Null for remote or unstated. */
  city: string | null;
  isOnline: boolean;

  // ---- Contract fields, read from the page. Null means the page did not say. ----
  field: string;
  stipendUsd: number | null;
  durationWeeks: number | null;
  startsAt: string | null;
  applyBy: string | null;
  eligibility: string[];
  minEducation: EducationLevel;

  /**
   * What the source already learned about the url, so ingest.ts does not fetch
   * it a second time. Sources that never touch the page leave this out and the
   * page is checked centrally.
   */
  urlStatusHint?: UrlStatus;

  // ---- The extras, minus what ingest.ts fills in itself ----
  research: Omit<ResearchExtras, 'deadlinePassed' | 'urlStatus' | 'lastCheckedAt' | 'driftNotes' | 'curatorNotes'> & {
    curatorNotes?: string[];
    driftNotes?: string[];
  };
};

/** A source is a named function, so one failing never stops the others. */
export type ResearchSource = {
  name: string;
  /** What is fetched, shown in the run report. */
  endpoint: string;
  fetch: () => Promise<RawResearch[]>;
};

/** Per-source line in the run report and in data/research.json. */
export type SourceReport = { name: string; fetched: number; kept: number; error?: string };
