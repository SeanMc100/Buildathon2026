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
  WorkArrangement,
} from './profile';
import type { QuestionId } from './questionnaire';

export type OpportunityKind = 'job' | 'program' | 'event' | 'research';

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
  /** City or venue. Null for fully remote or location-free items. */
  location: string | null;
  arrangement: WorkArrangement;

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
  | ResearchOpportunity;

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
  byKind: Record<OpportunityKind, OpportunityMatch[]>;
  /** Hard-constraint conflicts worth telling the user about, e.g. an empty kind. */
  unmetConstraints: string[];
};
