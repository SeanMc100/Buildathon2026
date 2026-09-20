// Turns a merged occupation record into a DetroitJobOpportunity: the match tags
// (Holland code, the seven trait scores, job zone, education, demands) plus the
// Detroit framing that makes the card worth reading.
//
// The events pipeline fills its tags with a keyword pass, because an event
// listing is a paragraph of prose and nothing more. Here we can do better:
// O*NET rates every occupation on the exact things the questionnaire asks
// about, so nearly every tag below is a rescaling of a measured number rather
// than a guess. Where that is not true — night shifts, on-call, travel, and the
// list of who hires here — the comment says so, and the item records it in
// `detroit.provenance`.
//
// Same shape as assessEvent: one input, one opportunity out, and swapping this
// for something smarter later leaves everything around it untouched.

import type { CareerStage, EducationLevel, PreferenceTrait, WorkArrangement, WorkDemand } from '../../src/models';
import { employersFor } from './sectors';
import { onetOnlineUrl, OEWS_VINTAGE } from './sources';
import type { DetroitJobOpportunity, EntryRouteSeed, LocalWages, OnetOccupation, StateOutlook, WageBand } from './types';

// ---- Scales -----------------------------------------------------------------

const clamp = (value: number) => Math.max(0, Math.min(100, Math.round(value)));

/** O*NET rates context and importance 1-5. The app's traits are 0-100. */
const fromFive = (value: number | undefined, fallback = 50) =>
  value === undefined ? fallback : clamp(((value - 1) / 4) * 100);

/** A category share that O*NET did not publish is 0, not unknown-and-skipped. */
const share = (shares: Record<number, number>, category: number) => shares[category] ?? 0;

/** Map a value in [low, high] onto 0-100, flat outside it. */
const scaleTo100 = (value: number, low: number, high: number) => clamp(((value - low) / (high - low)) * 100);

// ---- Context the enricher needs from the rest of the run --------------------

export type EnrichContext = {
  /** Every kept occupation's Detroit median wage, sorted. Sets the pay percentile. */
  wageScale: number[];
  /** 1 = strongest local demand. Keyed by SOC. */
  demandRanks: Map<string, number>;
  now: Date;
};

/** Where this occupation's local median sits against the rest of the catalog. */
function wagePercentile(median: number | null, scale: number[]): number {
  if (median === null || scale.length === 0) return 50;
  let below = 0;
  while (below < scale.length && (scale[below] as number) < median) below += 1;
  return clamp((below / scale.length) * 100);
}

// ---- Occupations that run around the clock ----------------------------------

/**
 * O*NET has no night-shift element. Its closest question, "Work Schedules",
 * asks whether the schedule is regular or irregular — and a permanent night
 * shift is a perfectly regular schedule, so a plant that runs three shifts
 * reports as regular. Reading nights off that field would be wrong.
 *
 * So this is a list, not a measurement: SOC families where round-the-clock
 * staffing is the norm in Detroit. It is the least evidenced tag in the file and
 * the first one a human should argue with.
 */
const ROUND_THE_CLOCK_GROUPS = ['33', '35', '51', '53'];

const ROUND_THE_CLOCK_SOCS = new Set([
  '29-1141', // Registered Nurses
  '29-1171', // Nurse Practitioners
  '29-2043', // Paramedics
  '29-2042', // Emergency Medical Technicians
  '29-2061', // Licensed Practical and Licensed Vocational Nurses
  '29-2055', // Surgical Technologists
  '29-2052', // Pharmacy Technicians
  '29-2034', // Radiologic Technologists
  '29-2032', // Diagnostic Medical Sonographers
  '29-2053', // Psychiatric Technicians
  '31-1131', // Nursing Assistants
  '31-1133', // Psychiatric Aides
  '31-9097', // Phlebotomists
  '37-2011', // Janitors and Cleaners
  '37-2012', // Maids and Housekeeping Cleaners
  '39-9011', // Childcare Workers
  '43-5032', // Public Safety Telecommunicators
  '49-3031', // Bus and Truck Mechanics and Diesel Engine Specialists
]);

const runsAroundTheClock = (socCode: string) =>
  ROUND_THE_CLOCK_GROUPS.includes(socCode.slice(0, 2)) || ROUND_THE_CLOCK_SOCS.has(socCode);

/** Occupations where being called back outside your hours is part of the job. */
const ON_CALL_SOCS = new Set([
  '29-1141', '29-1171', '29-2043', '29-2042', '29-2061', '29-1051', '29-1122',
  '47-2111', '47-2152', '49-9021', '49-9041', '49-9051', '49-9071', '49-3031',
  '15-1244', '15-1231', '15-1212', '33-2011', '33-3051', '33-1021',
]);

// ---- Tags -------------------------------------------------------------------

function chooseTraits(
  occupation: OnetOccupation,
  wages: LocalWages | null,
  outlook: StateOutlook | null,
  context: EnrichContext,
): Record<PreferenceTrait, number> {
  const ctx = occupation.context;
  const act = occupation.activities;

  const regularSchedule = share(occupation.scheduleShares, 1);
  const shortOrStandardWeek = share(occupation.weekLengthShares, 1) + share(occupation.weekLengthShares, 2);
  const growth = outlook?.percentChange ?? null;

  return {
    // Two halves: what it pays here against the rest of this catalog, and
    // whether Michigan expects the work to still be there in ten years.
    pay_and_security: clamp(
      0.7 * wagePercentile(wages?.median ?? null, context.wageScale) +
        0.3 * (growth === null ? 50 : scaleTo100(growth, -12, 15)),
    ),

    // A regular schedule you can plan around, and a week that ends.
    flexibility_and_balance: clamp(
      0.45 * regularSchedule + 0.35 * shortOrStandardWeek + 0.2 * fromFive(act['Working with Computers']),
    ),

    // How much the job itself makes you keep learning, plus the room to move up.
    growth_and_learning: clamp(
      0.5 * fromFive(act['Updating and Using Relevant Knowledge']) +
        0.2 * ((occupation.jobZone ?? 3) / 5) * 100 +
        0.3 * (growth === null ? 50 : scaleTo100(growth, -8, 20)),
    ),

    // Care work, public-facing work, and responsibility for other people's safety.
    mission_and_impact: clamp(
      0.5 * fromFive(act['Assisting and Caring for Others']) +
        0.25 * fromFive(act['Performing for or Working Directly with the Public']) +
        0.25 * fromFive(ctx['Health and Safety of Other Workers']),
    ),

    people_and_team: clamp(
      0.4 * fromFive(ctx['Work With or Contribute to a Work Group or Team']) +
        0.3 * fromFive(ctx['Contact With Others']) +
        0.3 * fromFive(act['Establishing and Maintaining Interpersonal Relationships']),
    ),

    // Nothing measures "does your manager back you up". The nearest honest proxy
    // is how much structure the work comes with: someone else sets the tasks and
    // the standards, which is what a person asking for support is asking for.
    manager_support: clamp(
      0.45 * (100 - fromFive(ctx['Determine Tasks, Priorities and Goals'])) +
        0.3 * (100 - fromFive(ctx['Freedom to Make Decisions'])) +
        0.25 * ((occupation.jobZone ?? 3) <= 2 ? 100 : (occupation.jobZone ?? 3) === 3 ? 60 : 35),
    ),

    autonomy: clamp(
      0.6 * fromFive(ctx['Freedom to Make Decisions']) + 0.4 * fromFive(ctx['Determine Tasks, Priorities and Goals']),
    ),
  };
}

function chooseDemands(occupation: OnetOccupation): WorkDemand[] {
  const ctx = occupation.context;
  const act = occupation.activities;
  const demands: WorkDemand[] = [];

  const irregular = share(occupation.scheduleShares, 2);
  const longWeek = share(occupation.weekLengthShares, 3);
  const healthSafety = ctx['Health and Safety of Other Workers'] ?? 0;

  // Measured: O*NET asks directly how much of the day is spent on your feet
  // moving things about.
  if (
    (act['Performing General Physical Activities'] ?? 0) >= 3.5 ||
    (act['Handling and Moving Objects'] ?? 0) >= 3.5 ||
    (ctx['Spend Time Standing'] ?? 0) >= 4.0
  ) {
    demands.push('physical_work');
  }

  // Measured.
  if (
    (act['Guiding, Directing, and Motivating Subordinates'] ?? 0) >= 3.5 ||
    (act['Coordinating the Work and Activities of Others'] ?? 0) >= 3.8 ||
    (ctx['Coordinate or Lead Others in Accomplishing Work Activities'] ?? 0) >= 4.2
  ) {
    demands.push('managing_people');
  }

  // Measured: selling importance, backed by how competitive the work is.
  if ((act['Selling or Influencing Others'] ?? 0) >= 3.0 || (ctx['Level of Competition'] ?? 0) >= 3.8) {
    demands.push('sales_targets');
  }

  // Measured: what happens when you get it wrong.
  if (
    (ctx['Consequence of Error'] ?? 0) >= 3.8 ||
    (ctx['Impact of Decisions on Co-workers or Company Results'] ?? 0) >= 4.2 ||
    healthSafety >= 4.0
  ) {
    demands.push('high_stakes');
  }

  // Approximated: see ROUND_THE_CLOCK_GROUPS above. Irregular hours are a real
  // O*NET reading and count on their own; the family list catches shift work
  // that O*NET records as a regular schedule.
  if (irregular >= 25 || runsAroundTheClock(occupation.socCode)) demands.push('night_shifts');

  // Approximated: a long week plus responsibility for someone's safety is the
  // shape of on-call work, but O*NET never asks the question.
  if (ON_CALL_SOCS.has(occupation.socCode) || (irregular >= 30 && longWeek >= 35 && healthSafety >= 3.5)) {
    demands.push('on_call');
  }

  // Approximated: O*NET measures time in a vehicle, not distance from home.
  // Driving all day and selling to people outside the company are the two
  // shapes of the job that a person who ruled out travel means.
  if (
    (ctx['In an Enclosed Vehicle or Operate Enclosed Equipment'] ?? 0) >= 4.0 ||
    ((act['Selling or Influencing Others'] ?? 0) >= 3.5 && (act['Communicating with People Outside the Organization'] ?? 0) >= 4.0)
  ) {
    demands.push('heavy_travel');
  }

  return demands;
}

/**
 * Onsite unless the work is plainly a desk and a computer. Never Remote: no
 * source here knows whether a given Detroit employer allows it, and claiming it
 * would send someone to an interview under a false idea of the job.
 */
function chooseArrangement(occupation: OnetOccupation, demands: WorkDemand[]): WorkArrangement {
  const deskBound =
    (occupation.context['Spend Time Sitting'] ?? 0) >= 4.0 && (occupation.activities['Working with Computers'] ?? 0) >= 4.0;
  return deskBound && !demands.includes('physical_work') ? 'Hybrid' : 'Onsite';
}

function chooseStages(occupation: OnetOccupation, demands: WorkDemand[]): CareerStage[] {
  const zone = occupation.jobZone ?? 3;
  const stages: CareerStage[] =
    zone <= 2
      ? ['FirstRole', 'EarlyCareer', 'Pivot', 'Returner']
      : zone === 3
        ? ['EarlyCareer', 'MidCareer', 'Pivot', 'Returner']
        : zone === 4
          ? ['EarlyCareer', 'MidCareer', 'SteppingUp']
          : ['MidCareer', 'SteppingUp'];
  if (demands.includes('managing_people') && !stages.includes('SteppingUp')) stages.push('SteppingUp');
  return stages;
}

// ---- Wording ----------------------------------------------------------------

const EDUCATION_PHRASES: Record<EducationLevel, string> = {
  none_required: 'No diploma required to start',
  secondary: 'A high school diploma or GED is the usual floor',
  certificate: 'A short certificate or some college is the usual floor',
  associate: 'An associate degree or a two-year programme is the usual floor',
  bachelor: "A bachelor's degree is the usual floor",
  postgraduate: 'A graduate or professional degree is required',
};

const JOB_ZONE_PHRASES: Record<number, string> = {
  1: 'Employers train you on the job; people start with no experience',
  2: 'A few weeks to a few months of on-the-job training',
  3: 'Vocational training, an apprenticeship or an associate degree',
  4: 'Several years of study or equivalent experience',
  5: 'Extensive preparation: a graduate degree or a licence plus years in the field',
};

/**
 * O*NET's "Job-related Apprenticeship" importance covers residencies and
 * clinical internships as well as trade apprenticeships — pediatricians score
 * higher on it than electricians do — so the rating alone would put
 * "apprenticeship" on a doctor. Gating it on the trades, construction and
 * production groups keeps the strong claim where it is true and gives everyone
 * else the weaker, accurate one.
 */
const APPRENTICESHIP_GROUPS = ['47', '49', '51'];
const APPRENTICESHIP_IN_TRADES = 2.3;
const STRUCTURED_TRAINING_ANYWHERE = 3.5;

function deriveEntryRoutes(occupation: OnetOccupation): string[] {
  const routes: string[] = [];
  const importance = occupation.apprenticeshipImportance ?? 0;
  if (APPRENTICESHIP_GROUPS.includes(occupation.socCode.slice(0, 2)) && importance >= APPRENTICESHIP_IN_TRADES) {
    routes.push('A registered apprenticeship is a normal way in');
  } else if (importance >= STRUCTURED_TRAINING_ANYWHERE) {
    routes.push('Structured training on the job — a residency, internship or apprenticeship — is part of getting in');
  }
  routes.push(EDUCATION_PHRASES[occupation.minEducation]);
  const zonePhrase = JOB_ZONE_PHRASES[occupation.jobZone ?? 3];
  if (zonePhrase) routes.push(zonePhrase);
  return routes;
}

const money = (value: number) => `$${Math.round(value / 1000)}k`;

/** The first sentence of O*NET's description, which is written as a definition. */
function leadSentence(description: string): string {
  const text = description.replace(/\s+/g, ' ').trim();
  const sentence = /^(.{40,240}?(?<!\be\.g|\bi\.e|\bU\.S|\bInc|\bDr|\betc)\.)(\s|$)/.exec(text)?.[1];
  if (sentence) return sentence;
  return text.length > 220 ? `${text.slice(0, 220).trimEnd()}…` : text;
}

function localSentence(wages: LocalWages | null, outlook: StateOutlook | null): string {
  const parts: string[] = [];
  if (wages?.employment) parts.push(`About ${wages.employment.toLocaleString('en-US')} of these jobs in metro Detroit`);
  if (wages?.pct25 && wages.pct75) parts.push(`the middle half earn ${money(wages.pct25)}–${money(wages.pct75)}`);
  if (outlook?.annualOpenings) parts.push(`roughly ${outlook.annualOpenings.toLocaleString('en-US')} openings a year statewide`);
  return parts.length === 0 ? '' : `${parts.join(', ')}.`;
}

function wageBand(wages: LocalWages | null): WageBand | null {
  if (!wages) return null;
  const { pct10, pct25, median, pct75, pct90 } = wages;
  if ([pct10, pct25, median, pct75, pct90].every((value) => value === null)) return null;
  return { pct10, pct25, median, pct75, pct90 };
}

// ---- Public -----------------------------------------------------------------

export type OccupationInput = {
  occupation: OnetOccupation;
  wages: LocalWages | null;
  outlook: StateOutlook | null;
  sector: string;
  /** True when the tags come from a sibling O*NET-SOC rather than the .00 code. */
  viaRelatedSoc: boolean;
};

export function buildOccupation(input: OccupationInput, context: EnrichContext): DetroitJobOpportunity {
  const { occupation, wages, outlook, sector } = input;
  const traits = chooseTraits(occupation, wages, outlook, context);
  const demands = chooseDemands(occupation);
  const band = wageBand(wages);
  const local = localSentence(wages, outlook);

  return {
    id: `job-onet-${occupation.socCode}`,
    kind: 'job',
    title: occupation.title,
    organization: 'Metro Detroit employers',
    summary: [leadSentence(occupation.description), local].filter(Boolean).join(' '),
    url: onetOnlineUrl(occupation.onetSocCode),
    location: 'Detroit metro',
    arrangement: chooseArrangement(occupation, demands),
    hollandCode: occupation.hollandCode,
    traits,
    jobZone: occupation.jobZone,
    minEducation: occupation.minEducation,
    suitableStages: chooseStages(occupation, demands),
    demands,
    verifiedOn: context.now.toISOString().slice(0, 10),
    isSample: false,
    employmentType: 'FullTime',
    // The 25th and 75th percentile, not the 10th and 90th: the band a person
    // should actually expect, rather than the extremes of the whole occupation.
    payMinUsd: wages?.pct25 ?? null,
    payMaxUsd: wages?.pct75 ?? null,
    applyBy: null,
    detroit: {
      socCode: occupation.socCode,
      onetSocCode: occupation.onetSocCode,
      sector,
      localEmployment: wages?.employment ?? null,
      locationQuotient: wages?.locationQuotient ?? null,
      wage: band,
      wageVintage: band ? OEWS_VINTAGE : null,
      wageTopCoded: wages?.topCoded ?? false,
      outlook: outlook
        ? {
            area: 'Michigan',
            baseYear: outlook.baseYear,
            projectedYear: outlook.projectedYear,
            percentChange: outlook.percentChange,
            annualOpenings: outlook.annualOpenings,
          }
        : null,
      entryRoutes: deriveEntryRoutes(occupation),
      hiringHere: employersFor(sector),
      demandRank: context.demandRanks.get(occupation.socCode) ?? null,
      provenance: {
        wages: band ? 'bls-oews-detroit-msa' : 'none',
        tags: input.viaRelatedSoc ? 'onet-measured-via-related-soc' : 'onet-measured',
        outlook: outlook ? 'projections-central-michigan' : 'none',
        hiringHere: 'curated-by-sector',
      },
    },
  };
}

export type EntryRouteInput = {
  seed: EntryRouteSeed;
  /** The occupation the route leads into, when one is named. Supplies the tags. */
  occupation: OnetOccupation | null;
  wages: LocalWages | null;
  outlook: StateOutlook | null;
};

/**
 * An entry route borrows its match tags from the occupation it leads into —
 * an electrical apprenticeship feels like electrical work, because it is — with
 * the stage and education tags reset to the door rather than the destination.
 */
export function buildEntryRoute(input: EntryRouteInput, context: EnrichContext): DetroitJobOpportunity {
  const { seed, occupation, wages, outlook } = input;
  const traits = occupation
    ? chooseTraits(occupation, wages, outlook, context)
    : ({
        pay_and_security: 50,
        flexibility_and_balance: 50,
        growth_and_learning: 70,
        mission_and_impact: 50,
        people_and_team: 55,
        manager_support: 70,
        autonomy: 40,
      } satisfies Record<PreferenceTrait, number>);

  const demands = occupation ? chooseDemands(occupation) : [];
  const band = wageBand(wages);

  return {
    id: `job-route-${seed.slug}`,
    kind: 'job',
    title: seed.title,
    organization: seed.organization,
    summary: seed.summary,
    url: seed.url,
    location: seed.city ?? 'Detroit metro',
    arrangement: 'Onsite',
    hollandCode: occupation?.hollandCode ?? [],
    traits,
    // The door, not the destination: an apprenticeship is open to someone with
    // none of the preparation the finished occupation assumes.
    jobZone: null,
    minEducation: 'none_required',
    suitableStages: ['FirstRole', 'EarlyCareer', 'Pivot', 'Returner'],
    demands,
    verifiedOn: seed.verifiedOn,
    isSample: false,
    employmentType: seed.employmentType,
    // Where the sponsor publishes nothing, show what the work pays here once you
    // are in — apprentices start below this, which the summary says.
    payMinUsd: seed.payMinUsd ?? wages?.pct25 ?? null,
    payMaxUsd: seed.payMaxUsd ?? wages?.pct75 ?? null,
    applyBy: null,
    detroit: {
      socCode: seed.socCodes[0] ?? '',
      onetSocCode: occupation?.onetSocCode ?? null,
      sector: seed.sector,
      localEmployment: wages?.employment ?? null,
      locationQuotient: wages?.locationQuotient ?? null,
      wage: band,
      wageVintage: band ? OEWS_VINTAGE : null,
      wageTopCoded: wages?.topCoded ?? false,
      outlook: outlook
        ? {
            area: 'Michigan',
            baseYear: outlook.baseYear,
            projectedYear: outlook.projectedYear,
            percentChange: outlook.percentChange,
            annualOpenings: outlook.annualOpenings,
          }
        : null,
      entryRoutes: seed.entryRoutes,
      hiringHere: seed.hiringHere,
      demandRank: context.demandRanks.get(seed.socCodes[0] ?? '') ?? null,
      provenance: {
        wages: seed.payMinUsd !== null ? 'sponsor-published' : band ? 'bls-oews-detroit-msa' : 'none',
        tags: occupation ? 'onet-measured' : 'none',
        outlook: outlook ? 'projections-central-michigan' : 'none',
        hiringHere: 'curated-by-sponsor',
      },
    },
  };
}
