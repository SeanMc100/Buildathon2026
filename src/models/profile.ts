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

/**
 * The "what the world needs" side of Ikigai: the kinds of problem a person
 * wants their work pointed at. Each maps to a keyword vocabulary in
 * src/matching/topics.ts, which tags every opportunity with the same themes.
 */
export type CauseTheme =
  | 'health'
  | 'education'
  | 'community'
  | 'technology'
  | 'business'
  | 'trades'
  | 'creative'
  | 'environment';

/** Must-satisfy filters. Kept structurally separate from soft preferences. */
export type HardConstraints = {
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
  /**
   * 0-100 leaning per dimension, blending what the person enjoys with what they
   * are good at. Not a validated Interest Profiler score.
   */
  scores: Record<RiasecCode, number>;
  /** Top three of the blend, ranked. Empty when both questions were skipped. */
  hollandCode: RiasecCode[];
  /** What they would happily lose an afternoon to, in the order picked. */
  enjoys: RiasecCode[];
  /** What people come to them for, in the order picked. */
  strengths: RiasecCode[];
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
  /** What they want their work to improve. Empty when skipped. */
  causes: Inference<CauseTheme[]>;
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
    enjoys: RiasecCode[];
    strengths: RiasecCode[];
    scores_0_100: Record<RiasecCode, number>;
    confidence: number;
    source_question_ids: QuestionId[];
  };
  purpose: {
    themes: CauseTheme[];
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
