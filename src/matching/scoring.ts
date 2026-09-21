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
  CauseTheme,
  ChallengeAppetite,
  EducationLevel,
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
  WorkStyle,
  WorkValue,
} from '../models';
import { readAllocation, readList, readString, scaleToPercent } from './answers';
import { buildNarrative } from './narrative';
import { CAUSE_THEMES } from './topics';

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

  // Nothing else in the bank says where someone is, so this is a placeholder.
  return inference('MidCareer' as CareerStage, 0.1, []);
}

/** Education is the only preparation signal the bank asks for. */
function deriveJobZone(answers: AnswerMap): Inference<JobZone> {
  const education = readString(answers, 'education') as EducationLevel | null;
  if (!education) return inference(3 as JobZone, 0.15, []);

  return inference(EDUCATION_BASE_ZONE[education], 0.4, ['education']);
}

/** How much of the blended interest score comes from what someone enjoys vs what they are good at. */
const ENJOY_SHARE = 0.55;
const STRENGTH_SHARE = 0.45;

/**
 * 0-100 per Holland letter from two ranked pick lists. The shares are
 * renormalised over whichever lists are non-empty, so skipping one question does
 * not shrink the other. The growth-path ranking calls this with a heavier
 * strengths share: what you are good at says more about where you can go than
 * what you like doing today.
 */
export function blendInterestScores(
  enjoys: RiasecCode[],
  strengths: RiasecCode[],
  enjoyWeight: number,
  strengthWeight: number,
): Record<RiasecCode, number> {
  const enjoyShare = enjoys.length > 0 ? enjoyWeight : 0;
  const strengthShare = strengths.length > 0 ? strengthWeight : 0;
  const shareTotal = enjoyShare + strengthShare;

  const scores = Object.fromEntries(RIASEC.map((code) => [code, 0])) as Record<RiasecCode, number>;
  if (shareTotal > 0) {
    enjoys.forEach((code, index) => {
      scores[code] += (enjoyShare / shareTotal) * (INTEREST_RANK_WEIGHTS[index] ?? 40);
    });
    strengths.forEach((code, index) => {
      scores[code] += (strengthShare / shareTotal) * (INTEREST_RANK_WEIGHTS[index] ?? 40);
    });
  }
  for (const code of RIASEC) scores[code] = Math.round(scores[code]);
  return scores;
}

function readCodes(answers: AnswerMap, id: QuestionId): RiasecCode[] {
  return readList(answers, id).filter((code): code is RiasecCode => (RIASEC as string[]).includes(code));
}

/**
 * Two taps of the same six dimensions: what someone would happily lose an
 * afternoon to, and what people come to them for. A letter picked on both sides
 * is the strongest signal we get. The blend is renormalised when only one of the
 * two was answered, so skipping one does not shrink the other.
 */
function deriveInterests(answers: AnswerMap): InterestProfile {
  const enjoys = readCodes(answers, 'interest_pull');
  const strengths = readCodes(answers, 'strengths');

  const scores = blendInterestScores(enjoys, strengths, ENJOY_SHARE, STRENGTH_SHARE);

  // Ties go to the letter the person tapped first as something they enjoy.
  const order = [...enjoys, ...strengths, ...RIASEC];
  const hollandCode = RIASEC.filter((code) => scores[code] > 0)
    .sort((a, b) => scores[b] - scores[a] || order.indexOf(a) - order.indexOf(b))
    .slice(0, 3);

  const sourceQuestionIds: QuestionId[] = [];
  if (enjoys.length > 0) sourceQuestionIds.push('interest_pull');
  if (strengths.length > 0) sourceQuestionIds.push('strengths');

  return {
    scores,
    hollandCode,
    enjoys,
    strengths,
    // Two multi-selects are a hint, not the 60-item Interest Profiler. The low
    // ceiling is deliberate: the model should not treat this as a measured
    // Holland code. Answering both, and agreeing with yourself, earns a little more.
    confidence:
      sourceQuestionIds.length === 0
        ? 0
        : sourceQuestionIds.length === 1
          ? 0.45
          : enjoys.some((code) => strengths.includes(code))
            ? 0.65
            : 0.55,
    sourceQuestionIds,
  };
}

function deriveCauses(answers: AnswerMap): Inference<CauseTheme[]> {
  const themes = readList(answers, 'cause_pull').filter((theme): theme is CauseTheme =>
    (CAUSE_THEMES as string[]).includes(theme),
  );
  return inference(themes, themes.length === 0 ? 0 : 0.6, themes.length === 0 ? [] : ['cause_pull']);
}

/**
 * Only variety versus depth is asked. The other four style fields stay in the
 * profile shape but are never read from answers: they are fixed placeholders
 * with no source questions and the lowest confidence.
 */
function deriveWorkStyle(answers: AnswerMap): WorkStyle {
  const variety = scaleToPercent(answers, 'variety_vs_depth', 5);

  return {
    autonomy: inference(50, 0.1, []),
    variety:
      variety === null
        ? inference(50, 0.1, [])
        : inference(variety, 0.75, ['variety_vs_depth']),
    pace: inference('Mixed' as Pace, 0.1, []),
    challengeAppetite: inference('Neutral' as ChallengeAppetite, 0.1, []),
    teamShape: inference('SmallTeam' as TeamShape, 0.1, []),
  };
}

/**
 * The spend-100-points answer is the only source of priorities. The list is
 * renormalised to 100 so every weight stays comparable.
 */
function derivePriorities(answers: AnswerMap): PreferenceWeight[] {
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
  const payStance = (readString(answers, 'pay_stance') ?? 'flexible') as PayStance;
  const floorBand = readString(answers, 'pay_floor_band');

  return {
    payStance,
    minSalaryUsd: payStance === 'has_floor' && floorBand ? Number(floorBand) : null,
    // No deal-breaker question is asked, so nothing is ruled out on demands.
    exclusions: [],
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
  const causes = deriveCauses(answers);
  const workStyle = deriveWorkStyle(answers);
  const priorities = derivePriorities(answers);
  const workValues = deriveWorkValues(answers, priorities);
  const hardConstraints = deriveConstraints(answers);

  const profile: CareerProfile = {
    profileId: makeProfileId(),
    generatedAt: new Date().toISOString(),
    version: QUESTION_BANK_VERSION,
    narrativeSummary: '',
    stage,
    experienceBand: null,
    educationLevel: readString(answers, 'education') as EducationLevel | null,
    jobZone,
    focusArea: readString(answers, 'focus_area'),
    interests,
    causes,
    workStyle,
    priorities,
    workValues,
    hardConstraints,
    extraContext: null,
    skippedQuestionIds,
    completeness: completenessOf(answers),
  };

  profile.narrativeSummary = buildNarrative(profile);
  return profile;
}

export { EXCLUDED_ATTRIBUTES, PRIORITY_LABELS };
