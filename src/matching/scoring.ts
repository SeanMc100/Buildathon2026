// Turns raw answers into a CareerProfile. Matching slice.
//
// Two rules hold everywhere in this file:
//  1. Nothing is inferred without recording which question ids produced it and
//     how sure we are. A recommendation that cannot be traced to an answer is
//     not one we are willing to show.
//  2. Anything the user skipped degrades confidence rather than inventing a
//     default. A skipped question is information, not a gap to paper over.

import {
  EXCLUDED_ATTRIBUTES,
  QUESTION_BANK,
  QUESTION_BANK_VERSION,
} from '../content';
import { isAnswered, visibleQuestions } from '../intake/flow';
import type {
  AnswerMap,
  CareerProfile,
  CareerStage,
  ChallengeAppetite,
  EducationLevel,
  EmploymentType,
  ExperienceBand,
  HardConstraints,
  Inference,
  InterestProfile,
  JobZone,
  Pace,
  PayStance,
  PreferenceTrait,
  PreferenceWeight,
  QuestionId,
  RiasecCode,
  TeamShape,
  WorkArrangement,
  WorkStyle,
  WorkValue,
} from '../models';
import { readAllocation, readList, readString, scaleToPercent } from './answers';
import { buildNarrative } from './narrative';

const RIASEC: RiasecCode[] = ['R', 'I', 'A', 'S', 'E', 'C'];

/** Weight given to a user's 1st, 2nd and 3rd interest pick. */
const INTEREST_RANK_WEIGHTS = [100, 72, 52];

const STAGE_MAP: Record<string, CareerStage> = {
  first_role: 'FirstRole',
  early: 'EarlyCareer',
  mid: 'MidCareer',
  pivot: 'Pivot',
  returner: 'Returner',
  stepping_up: 'SteppingUp',
};

const EDUCATION_BASE_ZONE: Record<EducationLevel, JobZone> = {
  none_required: 1,
  secondary: 2,
  certificate: 3,
  associate: 3,
  bachelor: 4,
  postgraduate: 5,
};

const PACE_MAP: Record<string, Pace> = {
  steady: 'Steady',
  mixed: 'Mixed',
  intense: 'Intense',
};

const CHALLENGE_MAP: Record<string, ChallengeAppetite> = {
  energised: 'Energised',
  neutral: 'Neutral',
  drained: 'Drained',
};

const TEAM_MAP: Record<string, TeamShape> = {
  solo: 'Solo',
  small_team: 'SmallTeam',
  large_org: 'LargeOrg',
};

const PRIORITY_LABELS: Record<PreferenceTrait, string> = {
  pay_and_security: 'Pay and security',
  flexibility_and_balance: 'Flexibility and balance',
  growth_and_learning: 'Growth and learning',
  mission_and_impact: 'Mission and impact',
  people_and_team: 'People and team',
  manager_support: 'A manager who backs you',
  autonomy: 'Running your own work',
};

function inference<T>(value: T, confidence: number, sourceQuestionIds: QuestionId[]): Inference<T> {
  return { value, confidence: Math.round(confidence * 100) / 100, sourceQuestionIds };
}

function deriveStage(answers: AnswerMap): Inference<CareerStage> {
  const raw = readString(answers, 'stage');
  if (raw && STAGE_MAP[raw]) return inference(STAGE_MAP[raw], 0.95, ['stage']);

  // Fall back on experience alone, and say so with a low confidence.
  const experience = readString(answers, 'experience_band');
  const fallback: CareerStage =
    experience === 'none' || experience === 'under_1' ? 'FirstRole' : 'MidCareer';
  return inference(fallback, 0.25, ['experience_band']);
}

function deriveJobZone(answers: AnswerMap): Inference<JobZone> {
  const education = readString(answers, 'education') as EducationLevel | null;
  const experience = readString(answers, 'experience_band') as ExperienceBand | null;

  if (!education && !experience) return inference(3 as JobZone, 0.15, []);

  const base = education ? EDUCATION_BASE_ZONE[education] : 3;
  let zone: number = base;

  // Long service stands in for formal preparation; no experience pulls it down.
  if (experience === '6_10' || experience === '10_plus') zone += 1;
  if (experience === 'none') zone -= 1;

  const clamped = Math.min(5, Math.max(1, zone)) as JobZone;
  const sources: QuestionId[] = [];
  if (education) sources.push('education');
  if (experience) sources.push('experience_band');

  return inference(clamped, education && experience ? 0.7 : 0.4, sources);
}

function deriveInterests(answers: AnswerMap): InterestProfile {
  const picks = readList(answers, 'interest_pull').filter((code): code is RiasecCode =>
    (RIASEC as string[]).includes(code),
  );

  const scores = Object.fromEntries(RIASEC.map((code) => [code, 0])) as Record<RiasecCode, number>;
  picks.forEach((code, index) => {
    scores[code] = INTEREST_RANK_WEIGHTS[index] ?? 40;
  });

  return {
    scores,
    hollandCode: picks.slice(0, 3),
    // One multi-select is a hint, not the 60-item Interest Profiler. The low
    // ceiling here is deliberate: the model should not treat this as a
    // measured Holland code.
    confidence: picks.length === 0 ? 0 : 0.45,
    sourceQuestionIds: picks.length === 0 ? [] : ['interest_pull'],
  };
}

function deriveWorkStyle(answers: AnswerMap): WorkStyle {
  const autonomy = scaleToPercent(answers, 'autonomy', 5);
  const variety = scaleToPercent(answers, 'variety_vs_depth', 5);
  const pace = readString(answers, 'pace');
  const challenge = readString(answers, 'deadline_response');
  const team = readString(answers, 'team_shape');

  return {
    autonomy:
      autonomy === null
        ? inference(50, 0.1, [])
        : inference(autonomy, 0.8, ['autonomy']),
    variety:
      variety === null
        ? inference(50, 0.1, [])
        : inference(variety, 0.75, ['variety_vs_depth']),
    pace:
      pace && PACE_MAP[pace]
        ? inference(PACE_MAP[pace], 0.85, ['pace'])
        : inference('Mixed' as Pace, 0.1, []),
    challengeAppetite:
      challenge && CHALLENGE_MAP[challenge]
        ? inference(CHALLENGE_MAP[challenge], 0.8, ['deadline_response'])
        : inference('Neutral' as ChallengeAppetite, 0.1, []),
    teamShape:
      team && TEAM_MAP[team]
        ? inference(TEAM_MAP[team], 0.85, ['team_shape'])
        : inference('SmallTeam' as TeamShape, 0.1, []),
  };
}

/**
 * The spend-100-points answer is the backbone. Manager support and autonomy are
 * folded in from their own items, then the whole list is renormalised to 100 so
 * every weight stays comparable.
 */
function derivePriorities(answers: AnswerMap, style: WorkStyle): PreferenceWeight[] {
  const budget = readAllocation(answers, 'priority_budget');
  const raw: PreferenceWeight[] = [];

  for (const [trait, amount] of Object.entries(budget)) {
    if (!(trait in PRIORITY_LABELS)) continue;
    raw.push({
      trait: trait as PreferenceTrait,
      label: PRIORITY_LABELS[trait as PreferenceTrait],
      weight: amount,
      confidence: 0.9,
      sourceQuestionIds: ['priority_budget'],
    });
  }

  const manager = scaleToPercent(answers, 'manager_support', 5);
  if (manager !== null && manager > 0) {
    raw.push({
      trait: 'manager_support',
      label: PRIORITY_LABELS.manager_support,
      // Caps at 30 points so a single scale item cannot outrank the budget.
      weight: Math.round((manager / 100) * 30),
      confidence: 0.7,
      sourceQuestionIds: ['manager_support'],
    });
  }

  if (style.autonomy.sourceQuestionIds.length > 0 && style.autonomy.value >= 60) {
    raw.push({
      trait: 'autonomy',
      label: PRIORITY_LABELS.autonomy,
      weight: Math.round(((style.autonomy.value - 50) / 50) * 20),
      // Inferred from a style question, not stated as a priority. Marked lower.
      confidence: 0.55,
      sourceQuestionIds: ['autonomy'],
    });
  }

  const total = raw.reduce((sum, item) => sum + item.weight, 0);
  if (total === 0) return [];

  const scaled = raw
    .map((item) => ({ ...item, weight: Math.round((item.weight / total) * 100) }))
    .filter((item) => item.weight > 0)
    .sort((a, b) => b.weight - a.weight);

  // Rounding leaves the list a point or two off. Give the remainder to the top
  // item so the weights always read as a clean 100.
  const drift = 100 - scaled.reduce((sum, item) => sum + item.weight, 0);
  if (drift !== 0 && scaled.length > 0) scaled[0].weight += drift;

  return scaled;
}

/**
 * O*NET's six work values, inferred from answers we already have rather than
 * asked directly. Cheap personalisation, explicitly low confidence.
 */
function deriveWorkValues(
  answers: AnswerMap,
  priorities: PreferenceWeight[],
  style: WorkStyle,
): Inference<WorkValue[]> {
  const weightOf = (trait: PreferenceTrait) =>
    priorities.find((item) => item.trait === trait)?.weight ?? 0;

  const sources = new Set<QuestionId>();
  const score: Record<WorkValue, number> = {
    Achievement: 0,
    Independence: 0,
    Recognition: 0,
    Relationships: 0,
    Support: 0,
    WorkingConditions: 0,
  };

  const growth = weightOf('growth_and_learning');
  if (growth > 0) {
    score.Achievement += growth;
    sources.add('priority_budget');
  }
  if (style.pace.value === 'Intense') {
    score.Achievement += 10;
    sources.add('pace');
  }

  score.Independence += Math.round(style.autonomy.value / 5);
  if (style.autonomy.sourceQuestionIds.length > 0) sources.add('autonomy');
  if (style.teamShape.value === 'Solo') {
    score.Independence += 12;
    sources.add('team_shape');
  }

  if (readString(answers, 'pay_stance') === 'top_of_market') {
    score.Recognition += 18;
    sources.add('pay_stance');
  }
  if (readString(answers, 'stage') === 'stepping_up') {
    score.Recognition += 15;
    sources.add('stage');
  }

  const people = weightOf('people_and_team');
  const mission = weightOf('mission_and_impact');
  if (people > 0 || mission > 0) {
    score.Relationships += people + Math.round(mission / 2);
    sources.add('priority_budget');
  }

  const manager = weightOf('manager_support');
  if (manager > 0) {
    score.Support += manager * 2;
    sources.add('manager_support');
  }

  const conditions = weightOf('flexibility_and_balance') + weightOf('pay_and_security');
  if (conditions > 0) {
    score.WorkingConditions += conditions;
    sources.add('priority_budget');
  }

  const ranked = (Object.entries(score) as Array<[WorkValue, number]>)
    .filter(([, value]) => value > 0)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([value]) => value);

  return inference(ranked, ranked.length === 0 ? 0 : 0.4, Array.from(sources));
}

function deriveConstraints(answers: AnswerMap): HardConstraints {
  const arrangements = readList(answers, 'arrangement') as WorkArrangement[];
  const employmentTypes = readList(answers, 'employment_type') as EmploymentType[];
  const commute = readString(answers, 'commute_limit');
  const payStance = (readString(answers, 'pay_stance') ?? 'flexible') as PayStance;
  const floorBand = readString(answers, 'pay_floor_band');

  return {
    arrangements: arrangements.length > 0 ? arrangements : ['Remote', 'Hybrid', 'Onsite'],
    employmentTypes: employmentTypes.length > 0 ? employmentTypes : ['FullTime'],
    maxCommuteMinutes: commute && commute !== 'relocate' ? Number(commute) : null,
    openToRelocation: commute === 'relocate',
    payStance,
    minSalaryUsd: payStance === 'has_floor' && floorBand ? Number(floorBand) : null,
    exclusions: readList(answers, 'dealbreakers'),
  };
}

function completenessOf(answers: AnswerMap): number {
  const path = visibleQuestions(QUESTION_BANK, answers);
  if (path.length === 0) return 0;
  const answered = path.filter((question) => isAnswered(question, answers[question.id])).length;
  return Math.round((answered / path.length) * 100) / 100;
}

function makeProfileId(): string {
  // Good enough to correlate a profile with a request. Not an identity.
  return `p_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

export function buildProfile(
  answers: AnswerMap,
  skippedQuestionIds: QuestionId[] = [],
): CareerProfile {
  const stage = deriveStage(answers);
  const jobZone = deriveJobZone(answers);
  const interests = deriveInterests(answers);
  const workStyle = deriveWorkStyle(answers);
  const priorities = derivePriorities(answers, workStyle);
  const workValues = deriveWorkValues(answers, priorities, workStyle);
  const hardConstraints = deriveConstraints(answers);

  const profile: CareerProfile = {
    profileId: makeProfileId(),
    generatedAt: new Date().toISOString(),
    version: QUESTION_BANK_VERSION,
    narrativeSummary: '',
    stage,
    experienceBand: readString(answers, 'experience_band') as ExperienceBand | null,
    educationLevel: readString(answers, 'education') as EducationLevel | null,
    jobZone,
    focusArea: readString(answers, 'focus_area'),
    interests,
    workStyle,
    priorities,
    workValues,
    hardConstraints,
    extraContext: readString(answers, 'extra_context'),
    skippedQuestionIds,
    completeness: completenessOf(answers),
  };

  profile.narrativeSummary = buildNarrative(profile);
  return profile;
}

export { EXCLUDED_ATTRIBUTES, PRIORITY_LABELS };
