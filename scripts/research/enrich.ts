// Turns a RawResearch into a ResearchItem: fills the match tags no programme
// page publishes — Holland code, the seven trait scores, job zone, the career
// stages it suits and the demands it makes.
//
// Every rule below reads off something the source actually recorded, so any tag
// can be explained out loud: "manager_support is 85 because the page says each
// participant is assigned a faculty mentor". It is a readable rule pass, like
// scripts/events/enrich.ts, and it is the piece to swap for an LLM call later:
// same input, same ResearchItem out, everything around it stays put.

import { createHash } from 'node:crypto';

import type { CareerStage, JobZone, PreferenceTrait, RiasecCode, WorkDemand } from '../../src/models';
import { metroCity } from '../events/region';
import type { RawResearch, ResearchItem, UrlStatus } from './types';

const clamp = (value: number) => Math.max(0, Math.min(100, Math.round(value)));

// ---- Interests ----------------------------------------------------------------------

/**
 * Matched against the field, the discipline tags and the summary. Research is
 * Investigative almost by definition, so I is seeded rather than earned; the
 * others have to show up in the words.
 */
const HOLLAND_KEYWORDS: Record<RiasecCode, RegExp> = {
  R: /manufactur|engineer|automotive|energy|field|monitor|sampling|lab(oratory)?|technician|hands-on|instrument|build/i,
  I: /research|science|scientific|analysis|analytic|data|experiment|stud(y|ies)|epidemiolog|genom|physic|chemi|biolog|math/i,
  A: /design|creative|writing|media|communicat|narrative|arts|humanities/i,
  S: /communit|health|public health|advoca|mentor|outreach|equity|disparit|social|education|care|patient|youth|neighbou?rhood|participatory/i,
  E: /polic(y|ies)|leadership|entrepreneur|management|advocacy|grant|proposal|programme? develop|translational/i,
  C: /coordinat|protocol|regulat|compliance|record|data collection|documentation|ethics|administrat/i,
};

function chooseHolland(raw: RawResearch): RiasecCode[] {
  const text = `${raw.field} ${raw.research.disciplines.join(' ')} ${raw.title} ${raw.description} ${raw.eligibility.join(' ')}`;
  const scores = (Object.keys(HOLLAND_KEYWORDS) as RiasecCode[]).map((code) => {
    const hits = (text.match(new RegExp(HOLLAND_KEYWORDS[code], 'gi')) ?? []).length;
    // Everything here is research, so I starts ahead and the rest must be earned.
    return { code, score: code === 'I' ? hits + 2 : hits };
  });

  return scores
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 3)
    .map((entry) => entry.code);
}

// ---- Traits ---------------------------------------------------------------------------

function chooseTraits(raw: RawResearch): Record<PreferenceTrait, number> {
  const { research } = raw;
  const paid = research.isPaid === true || (raw.stipendUsd ?? 0) > 0;
  const cohort = research.mentorshipModel === 'cohort_program';
  const mentored = research.mentorshipModel === 'faculty_lab' || research.mentorshipModel === 'clinical_team';

  return {
    // A stipend for a summer is money, but it is not job security.
    pay_and_security: clamp((paid ? 45 : 20) + (research.recurrence === 'rolling' && paid ? 15 : 0)),
    flexibility_and_balance: clamp((raw.isOnline ? 80 : 35) + (research.mentorshipModel === 'self_directed' ? 20 : 0)),
    // The whole point of every item here.
    growth_and_learning: clamp(75 + (cohort ? 10 : 0) + (mentored ? 10 : 0)),
    mission_and_impact: clamp(45 + (research.communityBased ? 35 : 0) + (/health|equity|disparit|justice|communit/i.test(`${raw.field} ${raw.description}`) ? 15 : 0)),
    people_and_team: clamp(
      45 + (cohort ? 25 : 0) + (research.mentorshipModel === 'community_partnership' ? 30 : 0) + (research.mentorshipModel === 'clinical_team' ? 20 : 0) - (research.mentorshipModel === 'self_directed' ? 25 : 0),
    ),
    // A named mentor is the single strongest signal of support on these pages.
    manager_support: clamp(mentored ? 85 : cohort ? 70 : research.mentorshipModel === 'community_partnership' ? 65 : 30),
    autonomy: clamp(research.mentorshipModel === 'self_directed' ? 85 : mentored ? 45 : 55),
  };
}

// ---- Preparation level ------------------------------------------------------------------

/**
 * O*NET job zones, read off what the programme requires rather than what it
 * teaches. A citizen-science project asks nothing (1); a summer REU assumes you
 * are partway through a degree (3); a postdoctoral fellowship assumes you
 * finished one (5).
 */
function chooseJobZone(raw: RawResearch): JobZone {
  switch (raw.research.enrollmentRequired) {
    case 'postdoc':
      return 5;
    case 'graduate':
      return 4;
    case 'undergraduate':
      return 3;
    case 'high_school':
      return 1;
    case 'none':
    default:
      if (raw.minEducation === 'postgraduate') return 5;
      if (raw.minEducation === 'bachelor') return 4;
      if (raw.minEducation === 'associate' || raw.minEducation === 'certificate') return 2;
      return raw.research.lowBarrier ? 1 : 2;
  }
}

// ---- Stages -------------------------------------------------------------------------------

function chooseStages(raw: RawResearch): CareerStage[] {
  const { research } = raw;
  const stages = new Set<CareerStage>();

  if (research.enrollmentRequired === 'high_school') stages.add('FirstRole');
  if (research.enrollmentRequired === 'undergraduate') {
    stages.add('FirstRole');
    stages.add('EarlyCareer');
  }
  if (research.enrollmentRequired === 'graduate' || research.enrollmentRequired === 'postdoc') {
    stages.add('EarlyCareer');
    stages.add('SteppingUp');
  }
  // Nothing to enrol in and nothing to have studied: the routes that are open to
  // someone changing direction or coming back to work.
  if (research.enrollmentRequired === 'none' && research.lowBarrier) {
    stages.add('FirstRole');
    stages.add('Pivot');
    stages.add('Returner');
  }
  if (research.communityBased && research.lowBarrier) stages.add('Pivot');

  return [...stages];
}

// ---- Demands --------------------------------------------------------------------------------

function chooseDemands(raw: RawResearch): WorkDemand[] {
  const text = `${raw.title} ${raw.field} ${raw.description} ${raw.research.disciplines.join(' ')}`;
  const demands = new Set<WorkDemand>();

  if (/clinical|patient|hospital|oncolog|surgery|medicine|trial/i.test(text)) demands.add('high_stakes');
  if (/field|monitor|sampling|lab(oratory)?|manufactur|technician|patrol|outdoor|canvass/i.test(text)) demands.add('physical_work');
  if (raw.research.mentorshipModel === 'community_partnership' && /organis|organiz|outreach|advoca/i.test(text)) {
    // Community work runs on evenings and weekends, when residents are home.
    demands.add('night_shifts');
  }

  return [...demands];
}

// ---- Summary ---------------------------------------------------------------------------------

/** One or two sentences for the card. Sources already write prose, so this only trims it. */
function summarize(raw: RawResearch): string {
  const text = raw.description.replace(/\s+/g, ' ').trim();
  if (text.length <= 240) return text;
  const sentence = /^(.{60,240}?(?<!\bU\.S|\bInc|\bDr|\bMr|\bMs|\bSt|\bvs|\bNo)[.!?])(\s|$)/.exec(text)?.[1];
  return sentence ?? `${text.slice(0, 237).trimEnd()}…`;
}

function shortLocation(raw: RawResearch): string | null {
  if (raw.isOnline) return null;
  return metroCity(raw.city) ?? raw.city ?? null;
}

// ---- Public ------------------------------------------------------------------------------------

export type Assessment =
  | { keep: true; item: ResearchItem }
  | { keep: false; reason: string };

export function assessResearch(raw: RawResearch, now: Date, urlStatus: UrlStatus): Assessment {
  // A page that has gone gives the person nowhere to apply, so it is dropped
  // rather than shown. A host that merely refuses robots is kept: the page is
  // still there for anyone with a browser.
  if (urlStatus === 'dead') return { keep: false, reason: 'the page it links to is gone' };

  const applyBy = raw.applyBy;
  const deadlinePassed = applyBy !== null && Date.parse(applyBy) < now.getTime();

  // Almost every research programme is annual: the deadline passing means the
  // next cohort has not opened yet, not that the programme is over. Those are
  // kept and flagged, and the app decides whether to show them as "opens again".
  const oneShot = raw.research.recurrence === 'one_time' || raw.research.recurrence === 'unknown';
  if (deadlinePassed && oneShot) {
    return { keep: false, reason: `deadline ${applyBy} has passed and it is not a recurring programme` };
  }

  const digest = createHash('sha1').update(`${raw.source}:${raw.sourceId}`).digest('hex').slice(0, 10);
  const driftNotes = [...(raw.research.driftNotes ?? [])];
  if (deadlinePassed) {
    driftNotes.push(`the ${applyBy} deadline has passed; this programme runs again (${raw.research.recurrence.replace(/_/g, ' ')})`);
  }

  const item: ResearchItem = {
    id: `research-${raw.source}-${digest}`,
    kind: 'research',
    title: raw.title,
    organization: raw.organization,
    summary: summarize(raw),
    url: raw.url,
    location: shortLocation(raw),

    hollandCode: chooseHolland(raw),
    traits: chooseTraits(raw),
    jobZone: chooseJobZone(raw),
    minEducation: raw.minEducation,
    suitableStages: chooseStages(raw),
    demands: chooseDemands(raw),

    verifiedOn: now.toISOString().slice(0, 10),
    isSample: false,

    field: raw.field,
    stipendUsd: raw.stipendUsd,
    durationWeeks: raw.durationWeeks,
    startsAt: raw.startsAt,
    applyBy: raw.applyBy,
    eligibility: raw.eligibility,

    research: {
      institution: raw.research.institution,
      enrollmentRequired: raw.research.enrollmentRequired,
      citizenship: raw.research.citizenship,
      isPaid: raw.research.isPaid,
      mentorshipModel: raw.research.mentorshipModel,
      disciplines: raw.research.disciplines,
      applicationMethod: raw.research.applicationMethod,
      recurrence: raw.research.recurrence,
      deadlinePassed,
      nextWindowOpens: raw.research.nextWindowOpens,
      annualDeadline: raw.research.annualDeadline,
      communityBased: raw.research.communityBased,
      lowBarrier: raw.research.lowBarrier,
      factsFrom: raw.research.factsFrom,
      urlStatus,
      lastCheckedAt: now.toISOString(),
      curatorNotes: raw.research.curatorNotes ?? [],
      driftNotes,
    },
  };

  return { keep: true, item };
}
