// The catalog side of the contract: things a person can be matched to, and what
// the matcher hands back to the results screen. Sean owns this file.
// Mirrors docs/schema.json.
//
// Every kind shares one set of tags drawn from the same vocabulary as
// CareerProfile (Holland code, the seven priority traits, job zone, education),
// so a single scoring function can compare a profile to any opportunity.

import type {
  CareerStage,
  EducationLevel,
  EmploymentType,
  JobZone,
  PreferenceTrait,
  RiasecCode,
} from './profile';
import type { QuestionId } from './questionnaire';

export type OpportunityKind = 'job' | 'program' | 'event' | 'research' | 'mentorship';

/**
 * Sections the matcher ranks. Mentorship is listed and filtered by audience,
 * never ranked. 'internship' is not a catalog kind: internships and
 * apprenticeships are jobs in the data, ranked apart from the occupations.
 */
export type MatchedKind = Exclude<OpportunityKind, 'mentorship'> | 'internship';

/**
 * Things an opportunity asks of the person. Same keys as the "dealbreakers"
 * question, so HardConstraints.exclusions can be checked against these directly.
 */
export type WorkDemand =
  | 'night_shifts'
  | 'heavy_travel'
  | 'on_call'
  | 'sales_targets'
  | 'managing_people'
  | 'physical_work'
  | 'high_stakes';

export type EventFormat = 'workshop' | 'networking' | 'talk' | 'career_fair' | 'conference';

type OpportunityBase = {
  /** Stable slug, unique across the catalog. */
  id: string;
  kind: OpportunityKind;
  title: string;
  organization: string;
  /** One or two sentences, shown on the result card. */
  summary: string;
  url: string;
  /** City or venue. Null for location-free items. */
  location: string | null;

  // ---- Match tags -------------------------------------------------------
  /** Top one to three RIASEC codes, ranked. */
  hollandCode: RiasecCode[];
  /** 0-100: how strongly this opportunity delivers each trait. Not a sum-to-100. */
  traits: Record<PreferenceTrait, number>;
  /** Preparation level the opportunity assumes. Null = open to any level. */
  jobZone: JobZone | null;
  /** Education needed to take part. 'none_required' when open. */
  minEducation: EducationLevel;
  /** Stages it is aimed at. Empty = suitable for all. */
  suitableStages: CareerStage[];
  /** Checked against HardConstraints.exclusions. */
  demands: WorkDemand[];

  // ---- Provenance -------------------------------------------------------
  /** ISO date someone last confirmed the listing is real and current. */
  verifiedOn: string;
  /** True for placeholder entries. The UI must label these as samples. */
  isSample: boolean;
};

export type JobOpportunity = OpportunityBase & {
  kind: 'job';
  employmentType: EmploymentType;
  payMinUsd: number | null;
  payMaxUsd: number | null;
  /** ISO date. Null = rolling or unknown. */
  applyBy: string | null;
  /** Detroit wage, demand and entry-route context. Added by `npm run ingest:jobs`. */
  detroit?: DetroitJobContext;
};

export type ProgramOpportunity = OpportunityBase & {
  kind: 'program';
  /** Cost to the participant. 0 = free. */
  costUsd: number | null;
  /** Stipend or paid training. Null = none or unknown. */
  stipendUsd: number | null;
  durationWeeks: number | null;
  /** ISO date the next cohort starts. */
  startsAt: string | null;
  applyBy: string | null;
  /** Plain-language requirements, e.g. 'Open to women and gender-expansive adults'. */
  eligibility: string[];
  /** Sector, audience, funding and per-fact provenance. Added by `npm run ingest:programs`. */
  program?: ProgramContext;
};

export type EventOpportunity = OpportunityBase & {
  kind: 'event';
  format: EventFormat;
  /** ISO date-time. */
  startsAt: string;
  /** ISO date-time. Null = single point in time. */
  endsAt: string | null;
  costUsd: number | null;
};

export type ResearchOpportunity = OpportunityBase & {
  kind: 'research';
  /** Research field, e.g. 'Human-computer interaction'. */
  field: string;
  stipendUsd: number | null;
  durationWeeks: number | null;
  startsAt: string | null;
  applyBy: string | null;
  eligibility: string[];
  /** Institution, barriers and drift notes. Added by `npm run ingest:research`. */
  research?: ResearchContext;
};

/**
 * A mentorship program run by someone else. The app only points at it: the
 * listing carries who it is for and a link to the provider's own page, and the
 * provider handles applications.
 */
export type MentorshipOpportunity = OpportunityBase & {
  kind: 'mentorship';
  /** Who the provider says can join. Empty = open to anyone. */
  audiences: MentorshipAudience[];
  /** Plain-language requirements, e.g. 'Current Ilitch School undergraduates'. */
  eligibility: string[];
  /** How mentoring happens, e.g. 'One-on-one with an industry mentor'. */
  format: string;
  /** Length or cadence in the provider's words, e.g. 'January to May'. Null = not stated. */
  schedule: string | null;
  costUsd: number | null;
};

/**
 * Visibility rule, applied by the matching slice before ranking: an event is
 * hidden once endsAt (or startsAt when endsAt is null) has passed, and any
 * opportunity whose applyBy has passed is hidden too.
 */
export type Opportunity =
  | JobOpportunity
  | ProgramOpportunity
  | EventOpportunity
  | ResearchOpportunity
  | MentorshipOpportunity;

/**
 * One scored result, produced by the matching slice and read by the results
 * screen. Refers to the catalog by id rather than copying it.
 */
export type OpportunityMatch = {
  opportunityId: string;
  kind: OpportunityKind;
  /** 0-100. */
  matchScore: number;
  /** Why it fits, each line grounded in the answers that drove it. */
  whyItFits: string[];
  /** What is missing or a stretch. */
  gaps: string[];
  citedQuestionIds: QuestionId[];
};

/** Everything the results screen renders. */
export type OpportunityResults = {
  profileId: string;
  generatedAt: string;
  /** Best matches first within each kind. */
  byKind: Record<MatchedKind, OpportunityMatch[]>;
  /**
   * Jobs the person could grow into: a fit for their interests and strengths
   * that need more preparation than they have today. Ranked on aptitude, not on
   * where they are now. Not in `byKind.job`, and never empty while the catalog
   * has jobs.
   */
  growthPaths: OpportunityMatch[];
  /** Lines the person set that were stretched rather than met, worth telling them about. */
  unmetConstraints: string[];
};

// ---------------------------------------------------------------------------
// Ingestion extras
//
// What the ingestion scripts collect beyond the fields above. These are added
// by `npm run ingest:*` and are absent on the hand-written samples, so every
// block is optional — read it defensively.
//
// Each block carries its own provenance, because these pipelines mix measured
// data (O*NET instrument scores, BLS wage percentiles) with facts a person read
// off a page and with editorial curation. The UI should not present the three
// as equally certain.
// ---------------------------------------------------------------------------

/** Annual USD wage percentiles for one occupation in the Detroit MSA. */
export type WageBand = {
  pct10: number | null;
  pct25: number | null;
  median: number | null;
  pct75: number | null;
  pct90: number | null;
};

/** Local context on an occupation. Present on ingested `job` items. */
export type DetroitJobContext = {
  /** 6-digit SOC, e.g. '51-4041'. The join key across O*NET, BLS and projections. */
  socCode: string;
  /** 8-digit O*NET-SOC the match tags came from. Null for cross-sector entry routes. */
  onetSocCode: string | null;
  /** Plain-language sector, e.g. 'Skilled trades'. */
  sector: string;
  /** Jobs in the Detroit MSA. Null when BLS suppressed the cell. */
  localEmployment: number | null;
  /** Local concentration against the national rate. 1.0 = the national rate. */
  locationQuotient: number | null;
  wage: WageBand | null;
  /** Which BLS release the wages came from, for the footnote. */
  wageVintage: string | null;
  /** True when the top of the band is BLS's cap rather than a real figure. */
  wageTopCoded: boolean;
  /** Statewide, not MSA: there is no metro-level projection series. */
  outlook: {
    area: string;
    baseYear: number;
    projectedYear: number;
    percentChange: number | null;
    annualOpenings: number | null;
  } | null;
  /** How someone actually gets in, front door first. */
  entryRoutes: string[];
  /** Who employs this work locally. Curated, not sourced — label it as such. */
  hiringHere: string[];
  /** 1 = highest local demand in this snapshot. */
  demandRank: number | null;
  provenance: {
    wages: 'bls-oews-detroit-msa' | 'sponsor-published' | 'none';
    tags: 'onet-measured' | 'onet-measured-via-related-soc' | 'none';
    outlook: 'projections-central-michigan' | 'none';
    hiringHere: 'curated-by-sector' | 'curated-by-sponsor';
  };
};

export type ProgramSector =
  | 'skilled_trades' | 'healthcare' | 'manufacturing' | 'transport_logistics' | 'tech'
  | 'entrepreneurship' | 'creative' | 'adult_education' | 'general_workforce';

export type ProgramAudience =
  | 'youth' | 'young_adults' | 'returning_citizens' | 'women' | 'immigrants' | 'veterans'
  | 'older_workers' | 'detroit_residents' | 'low_income' | 'disability_support' | 'spanish_speakers';

/**
 * Who a mentorship program is open to. The program audiences plus three that
 * only mentorships use. A visitor picks theirs in the optional "which describe
 * you" question; it stays on the device and never reaches the match request.
 */
export type MentorshipAudience =
  | ProgramAudience
  | 'students'
  | 'first_gen'
  | 'underrepresented_pros';

export type ProgramSupport =
  | 'childcare' | 'transport' | 'stipend' | 'tools_or_equipment' | 'job_placement' | 'housing' | 'meals';

/** Where one fact came from. 'absent' = the page did not say, so the field is null. */
export type FactSource = 'page' | 'registry' | 'absent';

/** Extra detail on a career program. Present on ingested `program` items. */
export type ProgramContext = {
  sector: ProgramSector;
  /** Who the provider says it is for. Empty = open generally. */
  audiences: ProgramAudience[];
  delivery: 'in_person' | 'online' | 'hybrid' | 'unknown';
  funding:
    | 'free_to_participant' | 'wioa_funded' | 'employer_sponsored' | 'paid_training'
    | 'tuition' | 'scholarship_available' | 'unknown';
  /** Certificates or licences named on the page. */
  credentials: string[];
  supports: ProgramSupport[];
  applicationMethod: 'online_form' | 'phone' | 'email' | 'in_person' | 'info_session' | 'unknown';
  cadence: 'rolling' | 'cohort' | 'continuous' | 'annual' | 'unknown';
  /** The schedule in the page's own words, when no date could be parsed. */
  scheduleNote: string | null;
  /** The cost in the page's own words ('sliding scale'), when no figure was read. */
  costNote: string | null;
  /** Open beyond metro Detroit. */
  statewide: boolean;
  readAs: 'wp_rest' | 'html_table' | 'html_page';
  provenance: Record<'costUsd' | 'durationWeeks' | 'startsAt' | 'applyBy' | 'stipendUsd' | 'eligibility', FactSource>;
  /** sha1 of the page text, so a re-run can report that the page changed. */
  contentHash: string;
  /** The page the facts were read from, when that is not `url`. */
  sourcePage: string;
};

/** Extra detail on a research opportunity. Present on ingested `research` items. */
export type ResearchContext = {
  institution: string;
  enrollmentRequired: 'none' | 'high_school' | 'undergraduate' | 'graduate' | 'postdoc';
  citizenship: 'us_citizen_or_pr' | 'us_work_authorized' | 'open' | 'unstated';
  /** Null = the page did not say. */
  isPaid: boolean | null;
  mentorshipModel: 'faculty_lab' | 'cohort_program' | 'clinical_team' | 'community_partnership' | 'self_directed';
  disciplines: string[];
  applicationMethod: 'online_form' | 'email' | 'job_board' | 'nsf_etap' | 'contact_program' | 'unstated';
  recurrence: 'annual_summer' | 'annual_academic_year' | 'rolling' | 'one_time' | 'unknown';
  /** applyBy is in the past. The item is kept anyway when it recurs. */
  deadlinePassed: boolean;
  nextWindowOpens: string | null;
  /** 'MM-DD', for a deadline stated without a year. Never guess the year. */
  annualDeadline: string | null;
  /** Run with a community organisation, not only a university. */
  communityBased: boolean;
  /** Needs neither a degree nor current enrolment. */
  lowBarrier: boolean;
  factsFrom: 'program_page' | 'api' | 'aggregator' | 'unverified';
  urlStatus: 'ok' | 'blocked' | 'dead' | 'unchecked';
  lastCheckedAt: string;
  /** Standing context, stable across runs. */
  curatorNotes: string[];
  /** What this run found that disagrees with what we last read. Empty = clean. */
  driftNotes: string[];
};
