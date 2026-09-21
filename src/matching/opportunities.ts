// Ranks the opportunity catalog against a profile. Matching slice.
//
// Two passes, mirroring the profile's own split:
//   1. Visibility and hard constraints eliminate. Nothing eliminated is ranked.
//   2. What survives is scored 0-100 from six components, and every score line
//      carries the answers that drove it.
//
// The components, and why each is shaped the way it is:
//   focus     What they typed they do or want to do, matched word-for-word
//             against the listing. The most direct evidence there is.
//   interest  What they enjoy blended with what they are good at (Holland
//             letters), scored against the catalog.
//   cause     The kind of problem they want their work to serve.
//   traits    Their 100-point priority budget against what each listing delivers.
//   level     Their preparation against what the listing assumes.
//   stage     Whether the listing is aimed at where they are.
//
// Two rules keep the numbers honest:
//   - Traits and interests are scored as a percentile *within the kind*. The raw
//     tags are not spread evenly (nearly every job scores high on "people and
//     team", every research item starts with the same Holland letter), so an
//     absolute score would rank almost everything alike. A percentile only
//     rewards being better than the rest, and a tag that never varies is neutral.
//   - A component with no input is dropped and the rest are renormalised, rather
//     than filled with a flattering default. Missing data on a listing is scored
//     as a coin flip (0.5), below a known good fit, so listings that say little
//     cannot crowd out ones that fit.
//
// Runs locally against a catalog, so results are always real catalog entries.
// An LLM can later be handed the top few per kind purely to word the "why".

import type {
  CareerProfile,
  EducationLevel,
  Opportunity,
  MatchedKind,
  OpportunityMatch,
  OpportunityResults,
  PreferenceTrait,
  QuestionId,
  RiasecCode,
} from '../models';
import { isEntryRoute } from '../catalog';
import { PRIORITY_LABELS, blendInterestScores } from './scoring';
import {
  CAUSE_LABELS,
  focusFit,
  focusMatch,
  parseFocus,
  themeStrengths,
  type FocusQuery,
} from './topics';

export const OPPORTUNITY_KINDS: MatchedKind[] = ['job', 'internship', 'program', 'event', 'research'];

/**
 * Which ranked section a listing competes in, or null if it is never ranked.
 * Internships and apprenticeships are jobs in the data but are scored against
 * each other, not against occupations: an employer's programme has no "typical
 * Detroit wage" to be a percentile of, and it should not crowd out (or be
 * crowded out by) the general roles.
 */
export function matchedKindOf(item: Opportunity): MatchedKind | null {
  if (item.kind === 'mentorship') return null;
  return isEntryRoute(item) ? 'internship' : item.kind;
}

/** How many matches each section on the results screen shows. */
const MAX_PER_KIND = 10;

const EDUCATION_RANK: Record<EducationLevel, number> = {
  none_required: 0,
  secondary: 1,
  certificate: 2,
  associate: 3,
  bachelor: 4,
  postgraduate: 5,
};

const RIASEC_LABELS: Record<RiasecCode, string> = {
  R: 'hands-on',
  I: 'investigative',
  A: 'creative',
  S: 'people-focused',
  E: 'enterprising',
  C: 'organised',
};

const DEMAND_LABELS: Record<string, string> = {
  night_shifts: 'nights or weekends',
  heavy_travel: 'regular travel',
  on_call: 'being on call',
  sales_targets: 'sales targets',
  managing_people: 'managing people',
  physical_work: 'physically demanding work',
  high_stakes: 'high-pressure work',
};

const KIND_RELAXED_NOTE: Record<MatchedKind, string> = {
  job: 'Every job involves something you ruled out, so these are the closest.',
  internship: 'Every internship and apprenticeship involves something you ruled out, so these are the closest.',
  program: 'Every program involves something you ruled out, so these are the closest.',
  event: 'Every upcoming event involves something you ruled out, so these are the closest.',
  research: 'Every research place involves something you ruled out, so these are the closest.',
};

/** Weight given to the first, second and third Holland letter of a listing. */
const HOLLAND_WEIGHTS = [3, 2, 1];

/** Weight given to a person's first, second and third cause. */
const CAUSE_RANK_WEIGHTS = [1, 0.85, 0.7];

/** Share of the blended score each component carries, before dropped ones are renormalised. */
const COMPONENT_WEIGHTS = {
  focus: 0.25,
  interest: 0.22,
  cause: 0.13,
  traits: 0.25,
  level: 0.1,
  stage: 0.05,
} as const;

type Component = keyof typeof COMPONENT_WEIGHTS;

/** What a component scores when the listing simply does not say. Below a known good fit on purpose. */
const UNKNOWN_FIT = 0.5;

/** Share of the score that must have real input behind it before the result is taken at face value. */
const FULL_CONFIDENCE_WEIGHT = 0.5;

/**
 * Renormalise the components we had input for, then pull the result toward a
 * coin flip when there was little to go on. Without this, a person who answered
 * almost nothing would get 100s: one surviving component renormalises to the
 * whole score.
 */
function shrinkToNeutral(blended: number, weightSum: number): number {
  if (weightSum === 0) return 0.5;
  const certainty = Math.min(1, weightSum / FULL_CONFIDENCE_WEIGHT);
  return 0.5 + (blended / weightSum - 0.5) * certainty;
}

// ---- Pass 1: visibility and hard constraints ------------------------------

/** Events vanish once they end; anything whose application deadline passed vanishes too. */
export function isVisible(opportunity: Opportunity, now: Date): boolean {
  const nowMs = now.getTime();

  if (opportunity.kind === 'event') {
    const endMs = Date.parse(opportunity.endsAt ?? opportunity.startsAt);
    if (endMs < nowMs) return false;
  }

  if ('applyBy' in opportunity && opportunity.applyBy) {
    // A deadline is inclusive of its whole day.
    const deadlineMs = Date.parse(opportunity.applyBy) + 24 * 60 * 60 * 1000;
    if (deadlineMs < nowMs) return false;
  }

  return true;
}

/**
 * The only thing that removes a listing is something the person said they will
 * not do (the `exclusions` list). Where and how someone wants to work, and the
 * pay floor, used to be filters too, and they emptied whole sections: the
 * catalog is occupation types, almost all full time and on site, so a person
 * who asked for something it does not hold saw nothing. Those are now scored
 * (see `payFloorGap`) and the person is told when a line is stretched.
 *
 * Even exclusions never empty a section: see `candidatesFor`.
 */
export function passesHardConstraints(opportunity: Opportunity, profile: CareerProfile): boolean {
  return !opportunity.demands.some((demand) => profile.hardConstraints.exclusions.includes(demand));
}

/** How much a listing whose pay tops out under the person's floor loses, out of 1. */
const PAY_FLOOR_PENALTY = 0.2;

/** True when the person set a floor and this job's pay range tops out below it. */
function belowPayFloor(opportunity: Opportunity, profile: CareerProfile): boolean {
  const floor = profile.hardConstraints.minSalaryUsd;
  return (
    floor !== null &&
    opportunity.kind === 'job' &&
    opportunity.payMaxUsd !== null &&
    opportunity.payMaxUsd < floor
  );
}

/**
 * Everything of one kind that is eligible to be ranked. If the person's
 * exclusions would leave nothing, fall back to the whole kind and say so: the
 * results must never come back with no recommendations.
 */
function candidatesFor(
  ofKind: Opportunity[],
  profile: CareerProfile,
): { items: Opportunity[]; relaxed: boolean } {
  const eligible = ofKind.filter((item) => passesHardConstraints(item, profile));
  if (eligible.length > 0 || ofKind.length === 0) return { items: eligible, relaxed: false };
  return { items: ofKind, relaxed: true };
}

// ---- Scoring context -------------------------------------------------------

/** Sorted values of one trait across every listing of a kind. */
type TraitScale = Record<PreferenceTrait, number[]>;

/** Everything a score needs that depends on the rest of the catalog, not just one listing. */
export type ScoringContext = {
  traitScale: TraitScale;
  /** Sorted raw interest scores across the kind, for this profile. */
  interestScale: number[];
  focus: FocusQuery | null;
};

const TRAITS: PreferenceTrait[] = [
  'pay_and_security',
  'flexibility_and_balance',
  'growth_and_learning',
  'mission_and_impact',
  'people_and_team',
  'manager_support',
  'autonomy',
];

const traitScaleCache = new WeakMap<Opportunity[], Map<string, TraitScale>>();

function traitScaleFor(kind: string, ofKind: Opportunity[], catalog: Opportunity[]): TraitScale {
  let byKind = traitScaleCache.get(catalog);
  if (!byKind) {
    byKind = new Map();
    traitScaleCache.set(catalog, byKind);
  }

  const cached = byKind.get(kind);
  if (cached) return cached;

  const scale = {} as TraitScale;
  for (const trait of TRAITS) {
    scale[trait] = ofKind.map((item) => item.traits[trait]).sort((a, b) => a - b);
  }
  byKind.set(kind, scale);
  return scale;
}

/** Where `value` falls among `sorted`, 0..1. A value shared with everything scores 0.5. */
function percentile(sorted: number[], value: number): number {
  if (sorted.length === 0) return 0.5;
  let below = 0;
  let equal = 0;
  for (const item of sorted) {
    if (item < value) below += 1;
    else if (item === value) equal += 1;
  }
  return (below + 0.5 * equal) / sorted.length;
}

/** Ranked overlap between a listing's Holland letters and the profile's blended scores. */
function interestRaw(opportunity: Opportunity, profile: CareerProfile): number {
  return opportunity.hollandCode.reduce(
    (sum, letter, index) => sum + (HOLLAND_WEIGHTS[index] ?? 1) * (profile.interests.scores[letter] / 100),
    0,
  );
}

export function buildContext(
  kind: MatchedKind,
  profile: CareerProfile,
  catalog: Opportunity[],
): ScoringContext {
  const ofKind = catalog.filter((item) => matchedKindOf(item) === kind);
  return {
    traitScale: traitScaleFor(kind, ofKind, catalog),
    interestScale: ofKind.map((item) => interestRaw(item, profile)).sort((a, b) => a - b),
    focus: parseFocus(profile.focusArea),
  };
}

// ---- Pass 2: scoring -------------------------------------------------------

/** Weighted share of the priorities this listing delivers, as percentiles, 0..1. Null with no priorities. */
function traitFit(opportunity: Opportunity, profile: CareerProfile, context: ScoringContext): number | null {
  let total = 0;
  let weighted = 0;

  for (const priority of profile.priorities) {
    // Low-confidence priorities count for less, but never nothing.
    const weight = priority.weight * (0.5 + 0.5 * priority.confidence);
    total += weight;
    weighted += weight * percentile(context.traitScale[priority.trait], opportunity.traits[priority.trait]);
  }

  return total === 0 ? null : weighted / total;
}

function interestFit(opportunity: Opportunity, profile: CareerProfile, context: ScoringContext): number | null {
  if (profile.interests.hollandCode.length === 0) return null;
  return percentile(context.interestScale, interestRaw(opportunity, profile));
}

/** Best of the person's causes, weighted by the order they picked them. Null when none were picked. */
function causeFit(opportunity: Opportunity, profile: CareerProfile): number | null {
  const causes = profile.causes.value;
  if (causes.length === 0) return null;

  const strengths = themeStrengths(opportunity);
  return Math.max(...causes.map((theme, index) => (CAUSE_RANK_WEIGHTS[index] ?? 0.6) * strengths[theme]));
}

/** Closeness of preparation level, 0..1. Open-to-any-level listings score as unknown. */
function levelFit(opportunity: Opportunity, profile: CareerProfile): number {
  if (opportunity.jobZone === null) return UNKNOWN_FIT;
  return 1 - Math.abs(opportunity.jobZone - profile.jobZone.value) / 4;
}

function stageFit(opportunity: Opportunity, profile: CareerProfile): number {
  if (opportunity.suitableStages.length === 0) return UNKNOWN_FIT;
  return opportunity.suitableStages.includes(profile.stage.value) ? 1 : 0.3;
}

function educationGap(opportunity: Opportunity, profile: CareerProfile): number {
  if (!profile.educationLevel) return 0;
  return Math.max(0, EDUCATION_RANK[opportunity.minEducation] - EDUCATION_RANK[profile.educationLevel]);
}

function sourcesFor(profile: CareerProfile, trait: PreferenceTrait): QuestionId[] {
  return profile.priorities.find((item) => item.trait === trait)?.sourceQuestionIds ?? [];
}

function explain(opportunity: Opportunity, profile: CareerProfile, context: ScoringContext) {
  const whyItFits: string[] = [];
  const gaps: string[] = [];
  const cited = new Set<QuestionId>();

  // What they said they do, then what they want it to serve: the two most
  // specific things a person tells us, so they lead.
  if (context.focus) {
    const { words, theme } = focusMatch(opportunity, context.focus);
    if (words >= 0.5) {
      whyItFits.push('Matches what you said you do.');
      cited.add('focus_area');
    } else if (theme >= 0.5) {
      whyItFits.push('Related to what you said you do.');
      cited.add('focus_area');
    }
  }

  const strengths = themeStrengths(opportunity);
  const cause = profile.causes.value.find((theme) => strengths[theme] >= 0.5);
  if (cause) {
    whyItFits.push(`Works on ${CAUSE_LABELS[cause]}.`);
    cited.add('cause_pull');
  }

  // Where what they enjoy and what they are good at overlap is worth saying.
  const { enjoys, strengths: skills } = profile.interests;
  const both = opportunity.hollandCode.filter((l) => enjoys.includes(l) && skills.includes(l));
  const enjoyed = opportunity.hollandCode.filter((l) => enjoys.includes(l) && !skills.includes(l));
  const skilled = opportunity.hollandCode.filter((l) => skills.includes(l) && !enjoys.includes(l));
  if (both.length > 0) {
    whyItFits.push(`Something you enjoy and are good at: ${RIASEC_LABELS[both[0]]} work.`);
    cited.add('interest_pull');
    cited.add('strengths');
  } else if (enjoyed.length > 0) {
    whyItFits.push(`Fits your ${RIASEC_LABELS[enjoyed[0]]} side.`);
    cited.add('interest_pull');
  } else if (skilled.length > 0) {
    whyItFits.push(`Uses your ${RIASEC_LABELS[skilled[0]]} strengths.`);
    cited.add('strengths');
  }

  // Priorities are already highest-weight first. "Strong" and "light" are
  // relative to the rest of this kind, the same yardstick the score uses.
  for (const priority of profile.priorities.slice(0, 3)) {
    const rank = percentile(context.traitScale[priority.trait], opportunity.traits[priority.trait]);
    const label = PRIORITY_LABELS[priority.trait].toLowerCase();
    if (rank >= 0.75 && whyItFits.length < 4) {
      whyItFits.push(`Strong on ${label}.`);
      sourcesFor(profile, priority.trait).forEach((id) => cited.add(id));
    } else if (rank <= 0.25 && gaps.length < 2) {
      gaps.push(`Light on ${label}.`);
      sourcesFor(profile, priority.trait).forEach((id) => cited.add(id));
    }
  }

  if (opportunity.suitableStages.includes(profile.stage.value) && whyItFits.length < 4) {
    whyItFits.push('Right for your stage.');
    profile.stage.sourceQuestionIds.forEach((id) => cited.add(id));
  }

  if (opportunity.jobZone !== null && opportunity.jobZone > profile.jobZone.value + 1) {
    gaps.push('Needs more preparation than you listed.');
    profile.jobZone.sourceQuestionIds.forEach((id) => cited.add(id));
  }

  if (educationGap(opportunity, profile) > 0) {
    gaps.push('Needs more education than you listed.');
    cited.add('education');
  }

  if (
    opportunity.suitableStages.length > 0 &&
    !opportunity.suitableStages.includes(profile.stage.value)
  ) {
    gaps.push('Not aimed at your stage.');
    profile.stage.sourceQuestionIds.forEach((id) => cited.add(id));
  }

  // Any demand the profile excluded was already filtered out. What is left is
  // worth flagging.
  for (const demand of opportunity.demands) {
    gaps.push(`Involves ${DEMAND_LABELS[demand] ?? demand.replace(/_/g, ' ')}.`);
  }

  // A stretched pay floor leads: it is the one line the person set that a
  // listing can miss without being removed.
  if (belowPayFloor(opportunity, profile)) {
    gaps.unshift('The top of the pay range is under your floor.');
    cited.add('pay_floor_band');
  }

  if (whyItFits.length === 0) whyItFits.push('A reasonable overall fit.');

  return { whyItFits, gaps: gaps.slice(0, 3), citedQuestionIds: Array.from(cited) };
}

export function scoreOpportunity(
  opportunity: Opportunity,
  profile: CareerProfile,
  context: ScoringContext,
): OpportunityMatch {
  const parts: Record<Component, number | null> = {
    focus: context.focus ? focusFit(opportunity, context.focus) : null,
    interest: interestFit(opportunity, profile, context),
    cause: causeFit(opportunity, profile),
    traits: traitFit(opportunity, profile, context),
    level: levelFit(opportunity, profile),
    stage: stageFit(opportunity, profile),
  };

  // Drop what we have no input for and renormalise, so a skipped question
  // neither helps nor hurts.
  let weightSum = 0;
  let blended = 0;
  for (const key of Object.keys(COMPONENT_WEIGHTS) as Component[]) {
    const value = parts[key];
    if (value === null) continue;
    weightSum += COMPONENT_WEIGHTS[key];
    blended += COMPONENT_WEIGHTS[key] * value;
  }
  const base = shrinkToNeutral(blended, weightSum);

  // Missing education is a real barrier, so it costs more than a nudge. So does
  // a pay range that never reaches the person's floor.
  const penalty =
    Math.min(0.3, educationGap(opportunity, profile) * 0.12) +
    (belowPayFloor(opportunity, profile) ? PAY_FLOOR_PENALTY : 0);
  const matchScore = Math.round(Math.max(0, Math.min(1, base - penalty)) * 100);

  return {
    opportunityId: opportunity.id,
    kind: opportunity.kind,
    matchScore,
    ...explain(opportunity, profile, context),
  };
}

function startMs(opportunity: Opportunity): number {
  return 'startsAt' in opportunity && opportunity.startsAt ? Date.parse(opportunity.startsAt) : 0;
}

/** Best match first; among equal scores, the event that happens soonest. */
function rank(items: Opportunity[], profile: CareerProfile, context: ScoringContext): OpportunityMatch[] {
  return items
    .map((item) => ({ item, match: scoreOpportunity(item, profile, context) }))
    .sort((a, b) => b.match.matchScore - a.match.matchScore || startMs(a.item) - startMs(b.item))
    .map(({ match }) => match);
}

/**
 * A recurring event (a monthly meetup) is one opportunity, not one per date.
 * Keeps the soonest occurrence so the top of the list is not four copies of the
 * same thing. The full listing still shows every date.
 */
function nextPerSeries(items: Opportunity[]): Opportunity[] {
  // "IT Networking @ Royal Oak" and "IT Networking @ Ann Arbor" are one series:
  // only the part before an @, | or : names it.
  const seriesKey = (item: Opportunity) =>
    `${item.organization}|${item.title.split(/\s@\s|\s\|\s|:\s/)[0].toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()}`;

  const soonest = new Map<string, Opportunity>();
  for (const item of items) {
    const current = soonest.get(seriesKey(item));
    if (!current || startMs(item) < startMs(current)) soonest.set(seriesKey(item), item);
  }
  return items.filter((item) => soonest.get(seriesKey(item)) === item);
}

/**
 * Every visible opportunity of one kind that passes the hard constraints, best
 * match first, with nothing capped or merged. Backs the "see all" screens.
 */
export function rankKind(
  kind: MatchedKind,
  profile: CareerProfile,
  catalog: Opportunity[],
  now: Date = new Date(),
): OpportunityMatch[] {
  const visible = catalog.filter((item) => matchedKindOf(item) === kind && isVisible(item, now));
  return rank(candidatesFor(visible, profile).items, profile, buildContext(kind, profile, catalog));
}

export function matchOpportunities(
  profile: CareerProfile,
  catalog: Opportunity[],
  now: Date = new Date(),
): OpportunityResults {
  const byKind: OpportunityResults['byKind'] = { job: [], internship: [], program: [], event: [], research: [] };
  const unmetConstraints: string[] = [];

  const live = catalog.filter((item) => isVisible(item, now));

  for (const kind of OPPORTUNITY_KINDS) {
    const ofKind = live.filter((item) => matchedKindOf(item) === kind);
    const { items: eligible, relaxed } = candidatesFor(ofKind, profile);
    const candidates = kind === 'event' ? nextPerSeries(eligible) : eligible;

    byKind[kind] = rank(candidates, profile, buildContext(kind, profile, catalog)).slice(0, MAX_PER_KIND);

    if (relaxed) unmetConstraints.push(KIND_RELAXED_NOTE[kind]);
  }

  // A pay floor is a nudge, not a filter. Say so when it is doing real work.
  if (profile.hardConstraints.minSalaryUsd !== null) {
    const jobs = live.filter((item) => matchedKindOf(item) === 'job');
    const reaching = jobs.filter((item) => !belowPayFloor(item, profile)).length;
    if (jobs.length > 0 && reaching < MAX_PER_KIND) {
      unmetConstraints.push(
        `Only ${reaching} job${reaching === 1 ? '' : 's'} reach your pay floor, so the rest are ranked lower instead of hidden.`,
      );
    }
  }

  return {
    profileId: profile.profileId,
    generatedAt: now.toISOString(),
    byKind,
    growthPaths: growthPaths(
      profile,
      catalog,
      now,
      new Set(byKind.job.map((match) => match.opportunityId)),
    ),
    unmetConstraints,
  };
}

// ---- Growth paths -----------------------------------------------------------
//
// The sections above answer "what fits me now". This answers "what could I grow
// into". It is aptitude-led, so it ignores the education and level penalties
// that rightly hold back a today-match, and it looks one or two steps up rather
// than at the whole ladder. Every entry says what the step takes and the way in.

/** Skills say more about where someone can go than what they like doing today. */
const GROWTH_ENJOY_SHARE = 0.4;
const GROWTH_STRENGTH_SHARE = 0.6;

const GROWTH_WEIGHTS = { interest: 0.34, cause: 0.2, traits: 0.2, focus: 0.1, reach: 0.16 } as const;

/**
 * How reachable a jump is. One step up is the sweet spot; a long leap is a plan,
 * not a next move. Staying at the same level scores lower but is not ruled out:
 * for someone already at the top of the education ladder, or with a strong
 * field, the real next step is a senior or managing role at their own level.
 */
function reachFit(stretch: number): number {
  if (stretch <= 0) return 0.45;
  if (stretch === 1) return 1;
  if (stretch === 2) return 0.8;
  if (stretch === 3) return 0.45;
  return 0.25;
}

function growthContext(profile: CareerProfile, catalog: Opportunity[]): ScoringContext {
  const base = buildContext('job', profile, catalog);
  const scores = blendInterestScores(
    profile.interests.enjoys,
    profile.interests.strengths,
    GROWTH_ENJOY_SHARE,
    GROWTH_STRENGTH_SHARE,
  );
  const raw = (item: Opportunity) =>
    item.hollandCode.reduce((sum, letter, index) => sum + (HOLLAND_WEIGHTS[index] ?? 1) * (scores[letter] / 100), 0);

  return {
    ...base,
    interestScale: catalog
      .filter((item) => matchedKindOf(item) === 'job')
      .map(raw)
      .sort((a, b) => a - b),
  };
}

function scoreGrowth(opportunity: Opportunity, profile: CareerProfile, context: ScoringContext): OpportunityMatch {
  const stretch = (opportunity.jobZone ?? profile.jobZone.value) - profile.jobZone.value;
  const scores = blendInterestScores(
    profile.interests.enjoys,
    profile.interests.strengths,
    GROWTH_ENJOY_SHARE,
    GROWTH_STRENGTH_SHARE,
  );
  const interestRawValue = opportunity.hollandCode.reduce(
    (sum, letter, index) => sum + (HOLLAND_WEIGHTS[index] ?? 1) * (scores[letter] / 100),
    0,
  );

  const parts: Record<keyof typeof GROWTH_WEIGHTS, number | null> = {
    interest: profile.interests.hollandCode.length === 0 ? null : percentile(context.interestScale, interestRawValue),
    cause: causeFit(opportunity, profile),
    traits: traitFit(opportunity, profile, context),
    focus: context.focus ? focusFit(opportunity, context.focus) : null,
    reach: reachFit(stretch),
  };

  let weightSum = 0;
  let blended = 0;
  for (const key of Object.keys(GROWTH_WEIGHTS) as Array<keyof typeof GROWTH_WEIGHTS>) {
    const value = parts[key];
    if (value === null) continue;
    weightSum += GROWTH_WEIGHTS[key];
    blended += GROWTH_WEIGHTS[key] * value;
  }

  const { enjoys, strengths: skills } = profile.interests;
  const both = opportunity.hollandCode.filter((l) => enjoys.includes(l) && skills.includes(l));
  const skilled = opportunity.hollandCode.filter((l) => skills.includes(l));
  const enjoyed = opportunity.hollandCode.filter((l) => enjoys.includes(l));

  const whyItFits: string[] = [];
  const cited = new Set<QuestionId>();
  if (both.length > 0) {
    whyItFits.push(`Builds on something you enjoy and are good at: ${RIASEC_LABELS[both[0]]} work.`);
    cited.add('interest_pull');
    cited.add('strengths');
  } else if (skilled.length > 0) {
    whyItFits.push(`Builds on your ${RIASEC_LABELS[skilled[0]]} strengths.`);
    cited.add('strengths');
  } else if (enjoyed.length > 0) {
    whyItFits.push(`Fits your ${RIASEC_LABELS[enjoyed[0]]} side.`);
    cited.add('interest_pull');
  }

  const strengthsByTheme = themeStrengths(opportunity);
  const cause = profile.causes.value.find((theme) => strengthsByTheme[theme] >= 0.5);
  if (cause) {
    whyItFits.push(`Works on ${CAUSE_LABELS[cause]}.`);
    cited.add('cause_pull');
  }
  if (whyItFits.length === 0) {
    whyItFits.push(
      profile.interests.hollandCode.length > 0
        ? 'Suits your interests and strengths.'
        : 'Worth exploring as a next step.',
    );
  }

  // The step itself, then the way in. Entry routes are Detroit-specific and
  // already say what the usual floor is, so the education line is not repeated.
  const gaps: string[] = [];
  if (stretch >= 1) {
    gaps.push('A step up from where you are today.');
    profile.jobZone.sourceQuestionIds.forEach((id) => cited.add(id));
  } else {
    gaps.push('About your current level, so a natural next move.');
  }
  const route = opportunity.kind === 'job' ? opportunity.detroit?.entryRoutes[0] : undefined;
  if (route) gaps.push(`Way in: ${route}.`);
  else if (educationGap(opportunity, profile) > 0) gaps.push('Needs more education than you listed.');

  return {
    opportunityId: opportunity.id,
    kind: opportunity.kind,
    matchScore: Math.round(Math.max(0, Math.min(1, shrinkToNeutral(blended, weightSum))) * 100),
    whyItFits: whyItFits.slice(0, 3),
    gaps,
    citedQuestionIds: Array.from(cited),
  };
}

/**
 * Roles the person could grow into, best first. Anything at or above their
 * level competes on one score, where aptitude, cause and priorities lead and
 * reachability nudges toward the next step rather than the far one. Falls back
 * to any job not already shown, so the list is never empty.
 */
export function growthPaths(
  profile: CareerProfile,
  catalog: Opportunity[],
  now: Date = new Date(),
  exclude: Set<string> = new Set(),
  limit: number = MAX_PER_KIND,
): OpportunityMatch[] {
  const jobs = candidatesFor(
    catalog.filter((item) => matchedKindOf(item) === 'job' && isVisible(item, now)),
    profile,
  ).items;
  const level = profile.jobZone.value;

  const tiers: Array<(item: Opportunity) => boolean> = [
    (item) => item.jobZone !== null && item.jobZone >= level,
    () => true,
  ];

  const context = growthContext(profile, catalog);
  const chosen = new Map<string, OpportunityMatch>();

  for (const inTier of tiers) {
    const ranked = jobs
      .filter((item) => !exclude.has(item.id) && !chosen.has(item.id) && inTier(item))
      .map((item) => scoreGrowth(item, profile, context))
      .sort((a, b) => b.matchScore - a.matchScore);
    for (const match of ranked) {
      if (chosen.size >= limit) break;
      chosen.set(match.opportunityId, match);
    }
    if (chosen.size >= limit) break;
  }

  return Array.from(chosen.values());
}
