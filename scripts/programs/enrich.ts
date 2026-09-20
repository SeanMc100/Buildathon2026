// Turns a RawProgram into a ProgramRecord: reads the facts off the page (via
// extract.ts) and fills the match tags that no training provider publishes —
// Holland code, the seven trait scores, job zone, education floor, stages, demands.
//
// Same shape as scripts/events/enrich.ts, and the same promise: these are readable
// keyword rules, so every tag on every card can be explained out loud. Swap this
// for a model call later and nothing around it has to move.
//
// The one rule that matters: a fact that is not on the page is null. Never a guess.

import { createHash } from 'node:crypto';

import type { CareerStage, EducationLevel, JobZone, PreferenceTrait, RiasecCode, WorkDemand } from '../../src/models';
import {
  readApplicationMethod,
  readApplyBy,
  readCadence,
  readCost,
  readCredentials,
  readDelivery,
  readDurationWeeks,
  readEligibility,
  readFunding,
  readStartsAt,
  readStipend,
  readSupports,
} from './extract';
import type { FactSource, ProgramExtras, ProgramRecord, ProgramSector, RawProgram } from './types';

// ---- Sector -----------------------------------------------------------------

/** Ordered: the first match wins, so the specific patterns sit above the broad ones. */
const SECTOR_SIGNALS: Array<[ProgramSector, RegExp]> = [
  ['transport_logistics', /\bCDL\b|truck driv|logistics|supply chain|warehous|forklift|transportation pathway/i],
  ['healthcare', /nurse|nursing|medical assistant|patient care|pharmacy tech|dental|phlebotom|\bCNA\b|home health|caregiver|healthcare/i],
  ['skilled_trades', /carpent|electric|plumb|weld|\bHVAC\b|construction|skilled trades|pre[-\s]?apprentice|apprenticeship|solar|roofing|drywall|blight|builders? licen|heavy equipment|tree trim|millwright/i],
  ['manufacturing', /\bCNC\b|machining|manufactur|robotic|industrial|production worker|\bMIG\b|mobility engineering/i],
  ['tech', /\bIT\b|information technology|software|cyber|\bdata\b|developer|comptia|salesforce|\bAI\b|artificial intelligence|python|coding|computer|tech fundamentals|help desk|data center/i],
  ['creative', /creative|design|\bart\b|media|film|music|fashion|photograph|storytell/i],
  ['entrepreneurship', /entrepreneur|small business|startup|founder|business plan|capital|micro[-\s]?loan|retail boot ?camp|scale|incubat|accelerat/i],
  ['adult_education', /\bGED\b|adult education|literacy|\bESL\b|english language|high school completion|associate degree|scholarship|tuition|reconnect/i],
];

function chooseSector(text: string, hint: ProgramSector | undefined, fixed: boolean): ProgramSector {
  // A hand-picked sector is final. Otherwise a broad source-level hint (SER is
  // tagged general_workforce) gives way to what the page itself is about: its
  // YouthBuild page is plainly construction.
  if (fixed && hint) return hint;
  const found = SECTOR_SIGNALS.find(([, pattern]) => pattern.test(text))?.[0];
  if (found && (hint === undefined || hint === 'general_workforce')) return found;
  return hint ?? found ?? 'general_workforce';
}

// ---- Match tags --------------------------------------------------------------

const HOLLAND_BY_SECTOR: Record<ProgramSector, RiasecCode[]> = {
  skilled_trades: ['R'],
  manufacturing: ['R'],
  transport_logistics: ['R'],
  healthcare: ['S', 'R'],
  tech: ['I'],
  entrepreneurship: ['E'],
  creative: ['A'],
  adult_education: ['C'],
  general_workforce: [],
};

const HOLLAND_KEYWORDS: Record<RiasecCode, RegExp> = {
  R: /hands[-\s]?on|shop floor|tools|machine|equipment|build|install|repair|drive|weld|construction/i,
  I: /analy|research|troubleshoot|diagnos|data|code|engineering|problem[-\s]solving|lab\b/i,
  A: /design|creative|art|media|film|music|fashion|brand|content|storytell/i,
  S: /coach|mentor|support|community|care|teach|counsel|patient|client|case manage|serve/i,
  E: /business|pitch|lead|sell|negotiat|launch|grow your|revenue|customer|market/i,
  C: /record|compliance|documentation|schedul|billing|inventory|accurac|procedure|regulation|certif/i,
};

/** Sector first, then whatever the page's own words add, capped at three. */
function chooseHolland(text: string, sector: ProgramSector): RiasecCode[] {
  const scored = (Object.keys(HOLLAND_KEYWORDS) as RiasecCode[])
    .map((code) => ({ code, hits: (text.match(new RegExp(HOLLAND_KEYWORDS[code], 'gi')) ?? []).length }))
    // One stray "media" in a page does not make a programme artistic.
    .filter((entry) => entry.hits >= 2)
    .sort((a, b) => b.hits - a.hits)
    .map((entry) => entry.code);

  const ranked = [...HOLLAND_BY_SECTOR[sector], ...scored];
  return [...new Set(ranked)].slice(0, 3);
}

const clamp = (value: number) => Math.max(0, Math.min(100, Math.round(value)));

function chooseTraits(
  text: string,
  extras: Pick<ProgramExtras, 'sector' | 'delivery' | 'funding' | 'supports' | 'credentials'>,
): Record<PreferenceTrait, number> {
  const paid = extras.funding === 'paid_training' || extras.supports.includes('stipend');
  const free = extras.funding === 'free_to_participant' || extras.funding === 'wioa_funded';
  const placement = extras.supports.includes('job_placement');
  const coached = /mentor|coach|advisor|case manage|one[-\s]on[-\s]one|navigator/i.test(text);
  const cohort = /cohort|classmates|peers|community of|network/i.test(text);

  return {
    // A free programme that ends in a credential and walks you to a job is the
    // strongest thing this catalog has to offer on pay and security.
    pay_and_security: clamp(35 + (free ? 20 : 0) + (paid ? 20 : 0) + (placement ? 15 : 0) + (extras.credentials.length > 0 ? 10 : 0)),
    flexibility_and_balance: clamp(
      (extras.delivery === 'online' ? 80 : extras.delivery === 'hybrid' ? 65 : 35) +
        (/evening|weekend|part[-\s]time|self[-\s]paced|flexible schedul/i.test(text) ? 15 : 0),
    ),
    // Everything in this catalog is training, so the floor is high by definition.
    growth_and_learning: clamp(70 + (extras.credentials.length > 0 ? 15 : 0) + (/degree|certificat|licen[cs]e/i.test(text) ? 10 : 0)),
    mission_and_impact: clamp(
      30 + (/community|nonprofit|neighbo|equity|barrier|underserved|social impact|give back/i.test(text) ? 30 : 0) + (extras.sector === 'healthcare' ? 15 : 0),
    ),
    people_and_team: clamp(40 + (cohort ? 25 : 0) + (coached ? 15 : 0) + (extras.sector === 'entrepreneurship' ? 10 : 0)),
    manager_support: clamp(35 + (coached ? 35 : 0) + (extras.supports.includes('job_placement') ? 10 : 0)),
    // Cohorts and apprenticeships are structured; running your own business is not.
    autonomy: extras.sector === 'entrepreneurship' ? 80 : /self[-\s]paced|at your own pace/i.test(text) ? 65 : 40,
  };
}

const HS_REQUIRED = /high school (?:diploma|graduate|equivalency)|\bGED\b (?:required|or equivalent)|diploma or (?:GED|equivalent)/i;
const DEGREE_REQUIRED = /bachelor'?s degree (?:is )?(?:required|preferred)|must hold a bachelor/i;
const PRIOR_KNOWLEDGE = /prior experience|foundational (?:coding|programming) knowledge|some experience (?:is )?(?:required|needed)|intermediate|experienced (?:founders?|operators?)|existing business|already (?:have|run) a business/i;
const NO_EXPERIENCE = /no (?:prior )?experience (?:is )?(?:required|necessary|needed)|beginner|start from scratch|open to all levels|all levels welcome/i;

/** Only what the page states. A programme that says nothing is open to anyone. */
function chooseEducation(text: string, sector: ProgramSector): EducationLevel {
  // A programme that hands you a GED cannot be requiring one.
  if (sector === 'adult_education' && /\bGED\b|high school completion|literacy/i.test(text)) return 'none_required';
  if (DEGREE_REQUIRED.test(text)) return 'bachelor';
  if (HS_REQUIRED.test(text)) return 'secondary';
  return 'none_required';
}

/** Preparation the programme assumes of an applicant. Null = it says it assumes none. */
function chooseJobZone(text: string): JobZone | null {
  if (DEGREE_REQUIRED.test(text)) return 4;
  if (PRIOR_KNOWLEDGE.test(text)) return 3;
  if (HS_REQUIRED.test(text)) return 2;
  if (NO_EXPERIENCE.test(text)) return 1;
  return null;
}

function chooseStages(extras: Pick<ProgramExtras, 'sector' | 'audiences'>, text: string): CareerStage[] {
  const stages = new Set<CareerStage>();
  if (extras.audiences.includes('youth') || extras.audiences.includes('young_adults')) stages.add('FirstRole');
  if (extras.audiences.includes('returning_citizens') || extras.audiences.includes('veterans')) {
    stages.add('Returner');
    stages.add('Pivot');
  }
  if (extras.audiences.includes('older_workers') || /return(?:ing)? to (?:work|school)|career change|changing careers|second chance|start over/i.test(text)) {
    stages.add('Returner');
    stages.add('Pivot');
  }
  if (extras.sector === 'entrepreneurship') {
    stages.add('Pivot');
    stages.add('SteppingUp');
  }
  if (/new to (?:tech|the (?:trades|field))|no experience|entry[-\s]level|first job/i.test(text)) stages.add('FirstRole');
  // Empty means "suitable for all", which is the right default for open training.
  return [...stages];
}

function chooseDemands(text: string, sector: ProgramSector): WorkDemand[] {
  const demands = new Set<WorkDemand>();
  if (['skilled_trades', 'manufacturing', 'transport_logistics'].includes(sector)) demands.add('physical_work');
  if (/physically demanding|lift(?:ing)? \d+ ?(?:lbs|pounds)|stand for long|outdoor work|on your feet/i.test(text)) demands.add('physical_work');
  if (/evening (?:class|session|cohort)|night (?:class|shift)|after[-\s]work schedule|classes are held in the evening/i.test(text)) demands.add('night_shifts');
  if (/patient care|emergency|life[-\s]saving|safety[-\s]critical|high[-\s]stakes/i.test(text)) demands.add('high_stakes');
  if (/manage a team|managing (?:people|staff|a crew)|supervis(?:e|ing) (?:staff|employees|a crew)|step into a leadership role/i.test(text)) {
    demands.add('managing_people');
  }
  if (/sales targets?|sales quota|commission[-\s]based|pitch to (?:customers|investors)|grow(?:ing)? revenue|revenue goals/i.test(text)) {
    demands.add('sales_targets');
  }
  return [...demands];
}

// ---- Summary ------------------------------------------------------------------

const NAV_LINE = /^(?:home|menu|search|skip to|apply now|donate|contact|read more|learn more|sign up|log ?in|register|share this|copyright|privacy|terms)\b/i;
const SCHEDULE_LINE = /^(?:[A-Za-z]+day,?\s+)?[A-Za-z.]+\s+\d{1,2}(?:,\s*\d{4})?\s*(?:[|–-].*)?$/;

/**
 * The first sentence of the first paragraph that reads like prose about the
 * programme. Only run on WordPress body copy: a whole HTML page still carries
 * enough menu and banner text ("You are using an outdated browser") to produce a
 * nonsense card, so a curated line wins there.
 */
function summarize(raw: RawProgram, fallback: string): string {
  if (raw.readAs !== 'wp_rest') return fallback;
  const body = raw.description
    .split(/\n+/)
    .map((line) => line.replace(/\s+/g, ' ').trim())
    .map((line) => (line.startsWith(raw.title) ? line.slice(raw.title.length).replace(/^[\s|:–—-]+/, '') : line))
    .find(
      (line) =>
        line.length >= 60 &&
        line.length <= 600 &&
        !NAV_LINE.test(line) &&
        !SCHEDULE_LINE.test(line) &&
        // A wall of link text has no full stops and plenty of capitals.
        /[a-z]{4}\s+[a-z]{3}/.test(line),
    );

  if (body) {
    const sentence = /^(.{50,240}?(?<!\bU\.S|\bSept|\bInc|\bDr|\bMr|\bMs|\bSt|\bvs|\bNo)[.!?])(\s|$)/.exec(body)?.[1];
    if (sentence) return sentence;
    return body.length > 220 ? `${body.slice(0, 220).trimEnd()}…` : body;
  }
  return fallback;
}

// ---- Public --------------------------------------------------------------------

export type Assessment =
  | { keep: true; record: ProgramRecord }
  | { keep: false; reason: string };

/**
 * `handEntered` lists the fields registry.ts supplied rather than the page, so the
 * run report can print them and a human can re-check them before a demo.
 */
export function assessProgram(raw: RawProgram, now: Date): Assessment {
  // Curated eligibility lines are facts about the programme too, so they feed the
  // tagging pass alongside the page text.
  const text = `${raw.title}\n${raw.description}\n${(raw.facts?.eligibility ?? []).join('\n')}`;
  if (raw.title.trim().length < 3) return { keep: false, reason: 'no title' };

  const facts = raw.facts ?? {};
  const has = <K extends keyof typeof facts>(key: K) => facts[key] !== undefined;
  const from = (key: keyof typeof facts, pageValue: unknown): FactSource =>
    has(key) ? 'registry' : pageValue === null || pageValue === undefined ? 'absent' : 'page';

  const cost = readCost(text);
  const stipend = readStipend(text);
  const starts = readStartsAt(text, now);
  const applyBy = readApplyBy(text, now);
  const pageDuration = readDurationWeeks(text);
  const pageEligibility = readEligibility(text);

  const costUsd = has('costUsd') ? facts.costUsd ?? null : cost.amountUsd;
  const stipendUsd = has('stipendUsd') ? facts.stipendUsd ?? null : stipend.amountUsd;
  const durationWeeks = has('durationWeeks') ? facts.durationWeeks ?? null : pageDuration;
  const startsAt = has('startsAt') ? facts.startsAt ?? null : starts.value;
  const deadline = has('applyBy') ? facts.applyBy ?? null : applyBy.value;
  const eligibility = facts.eligibility ?? pageEligibility;

  const sector = chooseSector(text, raw.sector, raw.sectorFixed ?? false);
  const audiences = raw.audiences ?? [];
  const supports = readSupports(text);
  const credentials = facts.credentials ?? readCredentials(text);
  const delivery = facts.delivery ?? readDelivery(text);
  const funding = facts.funding ?? readFunding(text, costUsd);

  const extras: ProgramExtras = {
    sector,
    audiences,
    delivery,
    funding,
    credentials,
    supports,
    applicationMethod: facts.applicationMethod ?? readApplicationMethod(text),
    cadence: facts.cadence ?? readCadence(text),
    scheduleNote: starts.note ?? applyBy.note,
    costNote: costUsd === null ? cost.note : null,
    statewide: raw.statewide ?? false,
    readAs: raw.readAs,
    provenance: {
      costUsd: from('costUsd', cost.amountUsd),
      durationWeeks: from('durationWeeks', pageDuration),
      startsAt: from('startsAt', starts.value),
      applyBy: from('applyBy', applyBy.value),
      stipendUsd: from('stipendUsd', stipend.amountUsd),
      eligibility: facts.eligibility ? 'registry' : pageEligibility.length > 0 ? 'page' : 'absent',
    },
    contentHash: createHash('sha1').update(raw.description).digest('hex').slice(0, 12),
    sourcePage: raw.sourcePage ?? raw.url,
  };

  const digest = createHash('sha1').update(`${raw.source}:${raw.sourceId}`).digest('hex').slice(0, 10);

  const record: ProgramRecord = {
    id: `program-${raw.source}-${digest}`,
    kind: 'program',
    title: raw.title,
    organization: raw.organization,
    summary: summarize(raw, raw.summary ?? `${raw.title}, run by ${raw.organization}.`),
    url: raw.url,
    location: delivery === 'online' ? null : raw.location,
    arrangement: delivery === 'online' ? 'Remote' : delivery === 'hybrid' ? 'Hybrid' : 'Onsite',
    hollandCode: chooseHolland(text, sector),
    traits: chooseTraits(text, { sector, delivery, funding, supports, credentials }),
    jobZone: chooseJobZone(text),
    minEducation: chooseEducation(text, sector),
    suitableStages: chooseStages({ sector, audiences }, text),
    demands: chooseDemands(text, sector),
    // Honest: the date this run fetched the page and confirmed the link answered.
    verifiedOn: now.toISOString().slice(0, 10),
    isSample: false,
    costUsd,
    stipendUsd,
    durationWeeks,
    startsAt,
    applyBy: deadline,
    eligibility,
    program: extras,
  };

  return { keep: true, record };
}
