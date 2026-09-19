// The output side of the contract: what the questionnaire turns into, and what
// gets sent to the opportunity-matching model. Sean owns this file.
// Mirrors docs/schema.json. Design notes and citations: docs/intake-research.md.

import type { QuestionId } from './questionnaire';

/** Holland (RIASEC) interest dimensions. */
export type RiasecCode = 'R' | 'I' | 'A' | 'S' | 'E' | 'C';

/** O*NET work values, used as a personalisation layer rather than a predictor. */
export type WorkValue =
  | 'Achievement'
  | 'Independence'
  | 'Recognition'
  | 'Relationships'
  | 'Support'
  | 'WorkingConditions';

export type CareerStage =
  | 'FirstRole'
  | 'EarlyCareer'
  | 'MidCareer'
  | 'Pivot'
  | 'Returner'
  | 'SteppingUp';

export type ExperienceBand = 'none' | 'under_1' | '1_3' | '3_6' | '6_10' | '10_plus';

export type EducationLevel =
  | 'none_required'
  | 'secondary'
  | 'certificate'
  | 'associate'
  | 'bachelor'
  | 'postgraduate';

/** O*NET Job Zone: 1 little/no prep ... 5 extensive prep. Derived, never asked. */
export type JobZone = 1 | 2 | 3 | 4 | 5;

export type WorkArrangement = 'Remote' | 'Hybrid' | 'Onsite';

export type EmploymentType =
  | 'FullTime'
  | 'PartTime'
  | 'Contract'
  | 'Freelance'
  | 'Internship'
  | 'Apprenticeship';

export type PayStance = 'flexible' | 'market' | 'top_of_market' | 'has_floor';

export type TeamShape = 'Solo' | 'SmallTeam' | 'LargeOrg';

export type Pace = 'Steady' | 'Mixed' | 'Intense';

/** Whether pressure reads as a challenge demand or a hindrance demand (JD-R). */
export type ChallengeAppetite = 'Energised' | 'Neutral' | 'Drained';

/**
 * Every inferred value carries how sure we are and which answers produced it,
 * so the app can explain itself and low-confidence inferences can be discounted.
 */
export type Inference<T> = {
  value: T;
  /** 0..1 */
  confidence: number;
  sourceQuestionIds: QuestionId[];
};

/** A weighted soft preference, 0-100, comparable across traits. */
export type PreferenceWeight = {
  trait: PreferenceTrait;
  label: string;
  weight: number;
  confidence: number;
  sourceQuestionIds: QuestionId[];
};

export type PreferenceTrait =
  | 'pay_and_security'
  | 'flexibility_and_balance'
  | 'growth_and_learning'
  | 'mission_and_impact'
  | 'people_and_team'
  | 'manager_support'
  | 'autonomy';

/** Must-satisfy filters. Kept structurally separate from soft preferences. */
export type HardConstraints = {
  arrangements: WorkArrangement[];
  employmentTypes: EmploymentType[];
  maxCommuteMinutes: number | null;
  openToRelocation: boolean;
  payStance: PayStance;
  minSalaryUsd: number | null;
  /** Things the user ruled out, e.g. 'night_shifts'. */
  exclusions: string[];
};

export type WorkStyle = {
  /** 0 = wants clear direction, 100 = wants to run it their own way. */
  autonomy: Inference<number>;
  /** 0 = one deep specialism, 100 = many different tasks. */
  variety: Inference<number>;
  pace: Inference<Pace>;
  challengeAppetite: Inference<ChallengeAppetite>;
  teamShape: Inference<TeamShape>;
};

export type InterestProfile = {
  /** 0-100 leaning per dimension. Not a validated Interest Profiler score. */
  scores: Record<RiasecCode, number>;
  /** Top three, ranked. Empty when the user skipped the interest question. */
  hollandCode: RiasecCode[];
  confidence: number;
  sourceQuestionIds: QuestionId[];
};

export type CareerProfile = {
  profileId: string;
  generatedAt: string;
  /** Question-bank version the answers came from. */
  version: number;
  /** Plain-language synthesis, shown to the user and sent to the model. */
  narrativeSummary: string;
  stage: Inference<CareerStage>;
  experienceBand: ExperienceBand | null;
  educationLevel: EducationLevel | null;
  jobZone: Inference<JobZone>;
  /** Free text the user typed about what they do or want to do. */
  focusArea: string | null;
  interests: InterestProfile;
  workStyle: WorkStyle;
  /** Soft preferences, highest weight first. Weights sum to ~100. */
  priorities: PreferenceWeight[];
  /** Derived O*NET work-value leaning. Personalisation layer, low confidence. */
  workValues: Inference<WorkValue[]>;
  hardConstraints: HardConstraints;
  /** Anything the user typed at the end, verbatim. */
  extraContext: string | null;
  /** Ids of visible questions the user chose not to answer. */
  skippedQuestionIds: QuestionId[];
  /** 0..1 - how much of the bank was actually answered. */
  completeness: number;
};

/** The request body posted to the opportunity-matching model. */
export type MatchRequest = {
  schemaVersion: string;
  profileId: string;
  generatedAt: string;
  narrativeSummary: string;
  candidateContext: {
    careerStage: CareerStage;
    experienceBand: ExperienceBand | null;
    educationLevel: EducationLevel | null;
    jobZone: JobZone;
    focusArea: string | null;
  };
  hardConstraints: HardConstraints;
  softPreferences: Array<{
    trait: PreferenceTrait;
    label: string;
    weight_0_100: number;
    confidence: number;
    source_question_ids: QuestionId[];
  }>;
  workStyle: Array<{
    trait: string;
    value: string | number;
    confidence: number;
    source_question_ids: QuestionId[];
  }>;
  interests: {
    holland_code: RiasecCode[];
    scores_0_100: Record<RiasecCode, number>;
    confidence: number;
    source_question_ids: QuestionId[];
  };
  derivedWorkValues: {
    values: WorkValue[];
    confidence: number;
    source_question_ids: QuestionId[];
  };
  freeText: string | null;
  responseContract: {
    max_recommendations: number;
    must_cite_source_question_ids: boolean;
    must_explain_tradeoffs: boolean;
    must_flag_unmet_hard_constraints: boolean;
  };
  /** Attributes deliberately absent, so the model does not ask for them. */
  excludedAttributes: string[];
};

export type MatchRecommendation = {
  title: string;
  summary: string;
  matchScore: number;
  whyItFits: string[];
  gaps: string[];
  citedQuestionIds: QuestionId[];
};

export type MatchResponse = {
  recommendations: MatchRecommendation[];
  unmetConstraints?: string[];
};
