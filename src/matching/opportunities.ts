// Ranks the opportunity catalog against a profile. Matching slice.
//
// Two passes, mirroring the profile's own split:
//   1. Visibility and hard constraints eliminate. Nothing eliminated is ranked.
//   2. What survives is scored 0-100 from soft preferences, interests, level
//      and stage, and every score line carries the answers that drove it.
//
// Runs locally against a catalog, so results are always real catalog entries.
// An LLM can later be handed the top few per kind purely to word the "why".

import type {
  CareerProfile,
  EducationLevel,
  Opportunity,
  OpportunityKind,
  OpportunityMatch,
  OpportunityResults,
  PreferenceTrait,
  QuestionId,
  RiasecCode,
} from '../models';
import { PRIORITY_LABELS } from './scoring';

export const OPPORTUNITY_KINDS: OpportunityKind[] = ['job', 'program', 'event', 'research'];

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

const KIND_EMPTY_NOTE: Record<OpportunityKind, string> = {
  job: 'No jobs or internships fit your hard lines right now.',
  program: 'No programs fit your hard lines right now.',
  event: 'No upcoming events fit your hard lines right now.',
  research: 'No research programs fit your hard lines right now.',
};

/** Weight given to the first, second and third Holland letters. */
const HOLLAND_WEIGHTS = [3, 2, 1];

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
 * Only constraints an opportunity actually has a field for are applied: an
 * event with no salary is not dropped by a pay floor. Commute is not checked
 * because the catalog has no distances.
 *
 * Events skip the arrangement check. That question is about how someone wants
 * to work, and an event is a one-off they can choose to attend, so a remote-only
 * person should still see local events. Without this, real (in-person) events
 * vanish for anyone who did not pick "on site".
 */
export function passesHardConstraints(opportunity: Opportunity, profile: CareerProfile): boolean {
  const constraints = profile.hardConstraints;

  if (opportunity.kind !== 'event' && !constraints.arrangements.includes(opportunity.arrangement)) {
    return false;
  }
  if (opportunity.demands.some((demand) => constraints.exclusions.includes(demand))) return false;

  if (opportunity.kind === 'job') {
    if (!constraints.employmentTypes.includes(opportunity.employmentType)) return false;
    if (
      constraints.minSalaryUsd !== null &&
      opportunity.payMaxUsd !== null &&
      opportunity.payMaxUsd < constraints.minSalaryUsd
    ) {
      return false;
    }
  }

  return true;
}

// ---- Pass 2: scoring -------------------------------------------------------

/** Share of the profile's priorities this opportunity delivers, 0..1. */
function traitFit(opportunity: Opportunity, profile: CareerProfile): number {
  let total = 0;
  let weighted = 0;

  for (const priority of profile.priorities) {
    // Low-confidence priorities count for less, but never nothing.
    const weight = priority.weight * (0.5 + 0.5 * priority.confidence);
    total += weight;
    weighted += weight * (opportunity.traits[priority.trait] / 100);
  }

  return total === 0 ? 0.5 : weighted / total;
}

/** Ranked Holland-letter overlap, 0..1. Neutral when the profile has no code. */
function interestFit(opportunity: Opportunity, profile: CareerProfile): number {
  const wanted = profile.interests.hollandCode;
  if (wanted.length === 0) return 0.5;

  let overlap = 0;
  let best = 0;
  wanted.forEach((letter, index) => {
    const mine = HOLLAND_WEIGHTS[index] ?? 1;
    best += mine * mine;
    const position = opportunity.hollandCode.indexOf(letter);
    if (position !== -1) overlap += mine * (HOLLAND_WEIGHTS[position] ?? 1);
  });

  return best === 0 ? 0.5 : overlap / best;
}

/** Closeness of preparation level, 0..1. Open-to-any-level entries score neutral. */
function levelFit(opportunity: Opportunity, profile: CareerProfile): number {
  if (opportunity.jobZone === null) return 0.75;
  return 1 - Math.abs(opportunity.jobZone - profile.jobZone.value) / 4;
}

function stageFit(opportunity: Opportunity, profile: CareerProfile): number {
  if (opportunity.suitableStages.length === 0) return 0.7;
  return opportunity.suitableStages.includes(profile.stage.value) ? 1 : 0.35;
}

function educationGap(opportunity: Opportunity, profile: CareerProfile): number {
  if (!profile.educationLevel) return 0;
  return Math.max(0, EDUCATION_RANK[opportunity.minEducation] - EDUCATION_RANK[profile.educationLevel]);
}

function sourcesFor(profile: CareerProfile, trait: PreferenceTrait): QuestionId[] {
  return profile.priorities.find((item) => item.trait === trait)?.sourceQuestionIds ?? [];
}

function explain(opportunity: Opportunity, profile: CareerProfile) {
  const whyItFits: string[] = [];
  const gaps: string[] = [];
  const cited = new Set<QuestionId>();

  // Priorities are already highest-weight first.
  const topPriorities = profile.priorities.slice(0, 3);

  for (const priority of topPriorities) {
    const score = opportunity.traits[priority.trait];
    const label = PRIORITY_LABELS[priority.trait].toLowerCase();
    if (score >= 70 && whyItFits.length < 2) {
      whyItFits.push(`Strong on ${label}.`);
      sourcesFor(profile, priority.trait).forEach((id) => cited.add(id));
    } else if (score < 45 && gaps.length < 2) {
      gaps.push(`Light on ${label}.`);
      sourcesFor(profile, priority.trait).forEach((id) => cited.add(id));
    }
  }

  const shared = opportunity.hollandCode.filter((letter) => profile.interests.hollandCode.includes(letter));
  if (shared.length > 0) {
    const names = shared.slice(0, 2).map((letter) => RIASEC_LABELS[letter]);
    whyItFits.push(`Fits your ${names.join(' and ')} side.`);
    profile.interests.sourceQuestionIds.forEach((id) => cited.add(id));
  }

  if (opportunity.suitableStages.includes(profile.stage.value)) {
    whyItFits.push('Right for your stage.');
    profile.stage.sourceQuestionIds.forEach((id) => cited.add(id));
  }

  if (opportunity.jobZone !== null && opportunity.jobZone > profile.jobZone.value + 1) {
    gaps.push('Needs more preparation than you listed.');
    profile.jobZone.sourceQuestionIds.forEach((id) => cited.add(id));
  }

  const missing = educationGap(opportunity, profile);
  if (missing > 0) {
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

  if (whyItFits.length === 0) whyItFits.push('A reasonable overall fit.');

  return { whyItFits, gaps: gaps.slice(0, 3), citedQuestionIds: Array.from(cited) };
}

export function scoreOpportunity(opportunity: Opportunity, profile: CareerProfile): OpportunityMatch {
  const blended =
    0.5 * traitFit(opportunity, profile) +
    0.25 * interestFit(opportunity, profile) +
    0.15 * levelFit(opportunity, profile) +
    0.1 * stageFit(opportunity, profile);

  // Missing education is a real barrier, so it costs more than a nudge.
  const penalty = Math.min(0.3, educationGap(opportunity, profile) * 0.12);
  const matchScore = Math.round(Math.max(0, Math.min(1, blended - penalty)) * 100);

  return {
    opportunityId: opportunity.id,
    kind: opportunity.kind,
    matchScore,
    ...explain(opportunity, profile),
  };
}

function startMs(opportunity: Opportunity): number {
  return 'startsAt' in opportunity && opportunity.startsAt ? Date.parse(opportunity.startsAt) : 0;
}

/** Best match first; among equal scores, the event that happens soonest. */
function rank(items: Opportunity[], profile: CareerProfile): OpportunityMatch[] {
  return items
    .map((item) => ({ item, match: scoreOpportunity(item, profile) }))
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
  kind: OpportunityKind,
  profile: CareerProfile,
  catalog: Opportunity[],
  now: Date = new Date(),
): OpportunityMatch[] {
  return rank(
    catalog.filter(
      (item) => item.kind === kind && isVisible(item, now) && passesHardConstraints(item, profile),
    ),
    profile,
  );
}

export function matchOpportunities(
  profile: CareerProfile,
  catalog: Opportunity[],
  now: Date = new Date(),
): OpportunityResults {
  const byKind: OpportunityResults['byKind'] = { job: [], program: [], event: [], research: [] };
  const unmetConstraints: string[] = [];

  const live = catalog.filter((item) => isVisible(item, now));

  for (const kind of OPPORTUNITY_KINDS) {
    const ofKind = live.filter((item) => item.kind === kind);
    const eligible = ofKind.filter((item) => passesHardConstraints(item, profile));
    const candidates = kind === 'event' ? nextPerSeries(eligible) : eligible;

    byKind[kind] = rank(candidates, profile).slice(0, MAX_PER_KIND);

    if (ofKind.length > 0 && eligible.length === 0) unmetConstraints.push(KIND_EMPTY_NOTE[kind]);
  }

  return {
    profileId: profile.profileId,
    generatedAt: now.toISOString(),
    byKind,
    unmetConstraints,
  };
}
