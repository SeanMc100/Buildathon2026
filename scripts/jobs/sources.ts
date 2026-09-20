// Job-data sources. Each one reads something a public agency publishes for
// anyone: a bulk database download, a published wage file, a public REST
// endpoint. Nothing here logs in, and nothing scrapes a job board — LinkedIn,
// Indeed and Glassdoor all restrict automated reads, and none of them answer
// the question this catalog asks anyway.
//
// Three measured sources plus one hand-checked list:
//   onet          what the work is like, per occupation (interests, job zone,
//                 education, work context, activities). The tags come from here.
//   bls-oews      what it pays in the Detroit metro, and how many jobs there are.
//   projections   where Michigan expects the work to go by 2034.
//   entry-routes  Detroit apprenticeships and internships with a real front
//                 door, typed in by hand because no public feed lists them.
//
// To add a source, add one entry to the exported list at the bottom.

import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { cachedDownload, getJson, USER_AGENT } from './cache';
import { parseCsv } from './csv';
import { ENTRY_ROUTE_SEEDS } from './entry-routes';
import { CACHE_DIR } from './paths';
import { sectorFor } from './sectors';
import { DETROIT_MSA, MICHIGAN_FIPS } from './region';
import type { EntryRouteSeed, JobSource, LocalWages, OnetOccupation, StateOutlook } from './types';
import { extractZipMember, listZipMembers, readSheetRecords } from './xlsx';

// ---- O*NET -------------------------------------------------------------------

/**
 * The release to read. O*NET bumps this roughly twice a year and keeps old
 * releases up, so pinning it means a re-run six months from now produces the
 * same numbers until someone deliberately moves it.
 */
export const ONET_RELEASE = 'db_31_0';

const ONET_BASE = `https://www.onetcenter.org/dl_files/database/${ONET_RELEASE}_csv`;

/** O*NET Online has a public page per occupation; that is the url on every card. */
export const onetOnlineUrl = (onetSocCode: string) => `https://www.onetonline.org/link/summary/${onetSocCode}`;

/**
 * Work Context elements this pipeline reads, by name.
 *
 * By name on purpose: release 31.0 renumbered the element ids (4.C.3.b.8 used
 * to be "Work Schedules" and is now "Determine Tasks, Priorities and Goals"),
 * so anything keyed on the id would have silently read the wrong column.
 */
export const CONTEXT_ELEMENTS = [
  'Contact With Others',
  'Work With or Contribute to a Work Group or Team',
  'Deal With External Customers or the Public in General',
  'Coordinate or Lead Others in Accomplishing Work Activities',
  'Health and Safety of Other Workers',
  'Work Outcomes and Results of Other Workers',
  'Freedom to Make Decisions',
  'Determine Tasks, Priorities and Goals',
  'Consequence of Error',
  'Impact of Decisions on Co-workers or Company Results',
  'Frequency of Decision Making',
  'Level of Competition',
  'Time Pressure',
  'Importance of Repeating Same Tasks',
  'Physical Proximity',
  // Categorical (CT/CTP) rather than a 1-5 mean; they fill scheduleShares and
  // weekLengthShares, which carry most of flexibility_and_balance.
  'Work Schedules',
  'Duration of Typical Work Week',
  'Spend Time Sitting',
  'Spend Time Standing',
  'Spend Time Walking or Running',
  'Spend Time Bending or Twisting Your Body',
  'Spend Time Climbing Ladders, Scaffolds, or Poles',
  'Exposed to Hazardous Conditions',
  'Exposed to Hazardous Equipment',
  'Exposed to Disease or Infections',
  'Outdoors, Exposed to All Weather Conditions',
  'In an Enclosed Vehicle or Operate Enclosed Equipment',
  'Conflict Situations',
] as const;

/** Work Activities importance ratings this pipeline reads, by name. */
export const ACTIVITY_ELEMENTS = [
  'Updating and Using Relevant Knowledge',
  'Assisting and Caring for Others',
  'Performing for or Working Directly with the Public',
  'Establishing and Maintaining Interpersonal Relationships',
  'Guiding, Directing, and Motivating Subordinates',
  'Coordinating the Work and Activities of Others',
  'Developing and Building Teams',
  'Selling or Influencing Others',
  'Performing General Physical Activities',
  'Handling and Moving Objects',
  'Operating Vehicles, Mechanized Devices, or Equipment',
  'Controlling Machines and Processes',
  'Working with Computers',
  'Training and Teaching Others',
  'Thinking Creatively',
  'Making Decisions and Solving Problems',
  'Organizing, Planning, and Prioritizing Work',
  'Communicating with People Outside the Organization',
  'Analyzing Data or Information',
  'Repairing and Maintaining Mechanical Equipment',
] as const;

/** Category numbers in O*NET's "Work Schedules" and "Duration of Typical Work Week". */
const SCHEDULE_REGULAR = 1;
const SCHEDULE_IRREGULAR = 2;
const SCHEDULE_SEASONAL = 3;
export const SCHEDULE_CATEGORIES = { SCHEDULE_REGULAR, SCHEDULE_IRREGULAR, SCHEDULE_SEASONAL };

/** RIASEC high-point categories, in O*NET's own order. */
const HIGH_POINT_CODES = ['R', 'I', 'A', 'S', 'E', 'C'] as const;

/** O*NET's 12 education categories, mapped onto the app's EducationLevel. */
const EDUCATION_BY_CATEGORY: Record<number, OnetOccupation['minEducation']> = {
  1: 'none_required',
  2: 'secondary',
  3: 'certificate',
  4: 'certificate',
  5: 'associate',
  6: 'bachelor',
  7: 'bachelor',
  8: 'postgraduate',
  9: 'postgraduate',
  10: 'postgraduate',
  11: 'postgraduate',
  12: 'postgraduate',
};

/**
 * The lowest education level at least this share of incumbents reported.
 * O*NET publishes a distribution, not a requirement; taking the modal category
 * would describe who is already in the job, which for a first-jobber overstates
 * the door. The lowest real cluster is the honest floor.
 */
const EDUCATION_FLOOR_SHARE = 25;

async function onetTable(name: string): Promise<string> {
  const path = await cachedDownload(`${ONET_BASE}/${name}`, `onet/${ONET_RELEASE}-${name}`, 120);
  return readFileSync(path, 'utf8');
}

/**
 * work_context.csv is 53 MB and work_activities.csv is 12 MB, and we want a few
 * dozen rows per occupation out of each. Neither file has newlines inside its
 * quoted fields, so dropping non-matching lines before the CSV parser sees them
 * is safe and keeps the whole run inside a normal heap.
 */
function keepLines(text: string, pattern: RegExp): string {
  const lines = text.split('\n');
  const header = lines[0] ?? '';
  return [header, ...lines.slice(1).filter((line) => pattern.test(line))].join('\n');
}

const escapeForRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const numberOrNull = (value: string): number | null => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

function buildOnetOccupations(tables: Record<string, string[][]>): OnetOccupation[] {
  const occupations = new Map<string, OnetOccupation>();

  for (const row of (tables.occupation ?? []).slice(1)) {
    const [onetSocCode, title, description] = row;
    if (!onetSocCode || !title) continue;
    occupations.set(onetSocCode, {
      onetSocCode,
      socCode: onetSocCode.slice(0, 7),
      title,
      description: description ?? '',
      jobZone: null,
      hollandCode: [],
      interestScores: {},
      minEducation: 'none_required',
      educationShares: {},
      context: {},
      scheduleShares: {},
      weekLengthShares: {},
      activities: {},
      apprenticeshipImportance: null,
    });
  }

  for (const row of (tables.jobZones ?? []).slice(1)) {
    const occupation = occupations.get(row[0] ?? '');
    const zone = Number(row[2]);
    if (occupation && zone >= 1 && zone <= 5) occupation.jobZone = zone as OnetOccupation['jobZone'];
  }

  // Interests: O*NET publishes both the 1-7 scores and its own ranked top three.
  for (const row of (tables.interests ?? []).slice(1)) {
    const occupation = occupations.get(row[0] ?? '');
    if (!occupation) continue;
    const scale = row[4];
    const value = numberOrNull(row[6] ?? '');
    if (value === null) continue;

    if (scale === 'OI') {
      const code = HIGH_POINT_CODES[['Realistic', 'Investigative', 'Artistic', 'Social', 'Enterprising', 'Conventional'].indexOf(row[3] ?? '')];
      if (code) occupation.interestScores[code] = value;
    } else if (scale === 'IH') {
      const rank = ['First Interest High-Point', 'Second Interest High-Point', 'Third Interest High-Point'].indexOf(row[3] ?? '');
      const code = HIGH_POINT_CODES[value - 1];
      // Category 0 means "no second/third high-point", which O*NET does emit.
      if (rank >= 0 && code) occupation.hollandCode[rank] = code;
    }
  }
  for (const occupation of occupations.values()) {
    occupation.hollandCode = occupation.hollandCode.filter(Boolean).slice(0, 3);
  }

  for (const row of (tables.education ?? []).slice(1)) {
    const occupation = occupations.get(row[0] ?? '');
    if (!occupation || row[4] !== 'RL') continue;
    const category = Number(row[6]);
    const share = numberOrNull(row[7] ?? '');
    if (category >= 1 && category <= 12 && share !== null) occupation.educationShares[category] = share;
  }
  for (const occupation of occupations.values()) {
    const categories = Object.entries(occupation.educationShares)
      .filter(([, share]) => share >= EDUCATION_FLOOR_SHARE)
      .map(([category]) => Number(category))
      .sort((a, b) => a - b);
    const floor = categories[0];
    if (floor !== undefined) occupation.minEducation = EDUCATION_BY_CATEGORY[floor] ?? 'none_required';
  }

  for (const row of (tables.training ?? []).slice(1)) {
    const occupation = occupations.get(row[0] ?? '');
    if (occupation && row[3] === 'Job-related Apprenticeship' && row[4] === 'IM') {
      occupation.apprenticeshipImportance = numberOrNull(row[7] ?? '');
    }
  }

  for (const row of (tables.context ?? []).slice(1)) {
    const occupation = occupations.get(row[0] ?? '');
    if (!occupation) continue;
    const name = row[3] ?? '';
    const scale = row[4];
    const value = numberOrNull(row[7] ?? '');
    if (value === null) continue;

    if (scale === 'CX') {
      occupation.context[name] = value;
    } else if (scale === 'CTP') {
      const category = Number(row[6]);
      if (!Number.isFinite(category)) continue;
      if (name === 'Work Schedules') occupation.scheduleShares[category] = value;
      if (name === 'Duration of Typical Work Week') occupation.weekLengthShares[category] = value;
    }
  }

  for (const row of (tables.activities ?? []).slice(1)) {
    const occupation = occupations.get(row[0] ?? '');
    if (!occupation || row[4] !== 'IM') continue;
    const value = numberOrNull(row[6] ?? '');
    if (value !== null) occupation.activities[row[3] ?? ''] = value;
  }

  // An occupation with no interest ratings has nothing to match on.
  return [...occupations.values()].filter((occupation) => occupation.hollandCode.length > 0);
}

export const onetSource: JobSource<OnetOccupation[]> = {
  name: 'onet',
  endpoint: `${ONET_BASE}/*.csv`,
  role: 'What the work is like: interests, job zone, education, work context, activities',
  async fetch() {
    const wantedContext = new RegExp(CONTEXT_ELEMENTS.map(escapeForRegExp).join('|'));
    const wantedActivities = new RegExp(ACTIVITY_ELEMENTS.map(escapeForRegExp).join('|'));

    const [occupation, jobZones, interests, education, training, context, activities] = await Promise.all([
      onetTable('occupation_data.csv'),
      onetTable('job_zones.csv'),
      onetTable('career_interest_types.csv'),
      onetTable('education.csv'),
      onetTable('training_and_experience.csv'),
      onetTable('work_context.csv').then((text) => keepLines(text, wantedContext)),
      onetTable('work_activities.csv').then((text) => keepLines(text, wantedActivities)),
    ]);

    return buildOnetOccupations({
      occupation: parseCsv(occupation),
      jobZones: parseCsv(jobZones),
      interests: parseCsv(interests),
      education: parseCsv(education),
      training: parseCsv(training),
      context: parseCsv(context),
      activities: parseCsv(activities),
    });
  },
};

// ---- BLS OEWS ----------------------------------------------------------------

/**
 * The OEWS release to read, and the label that goes on every wage band so a
 * stale snapshot is visible in the app rather than only in this file.
 *
 * BLS publishes one metro file per year; bump both lines together when the next
 * one lands (they appear on https://www.bls.gov/oes/tables.htm).
 */
export const OEWS_RELEASE = 'oesm25ma';
export const OEWS_VINTAGE = 'BLS OEWS, May 2025 estimates, Detroit-Warren-Dearborn MI metro area';

/** BLS caps the top of the range here and prints '#' instead of a number. */
const BLS_TOP_CODE = 239_200;

const HOURS_PER_YEAR = 2080;

/** '*' not released, '**' not available, '#' at or above the cap, '~' below. */
function blsNumber(value: string): number | null {
  const cleaned = value.replace(/[$,]/g, '').trim();
  if (cleaned === '' || cleaned.startsWith('*') || cleaned === '~') return null;
  if (cleaned === '#') return BLS_TOP_CODE;
  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? parsed : null;
}

/** Prefer the published annual figure; fall back to the hourly one annualised. */
function annualWage(row: Record<string, string>, annualKey: string, hourlyKey: string): number | null {
  const annual = blsNumber(row[annualKey] ?? '');
  if (annual !== null) return annual;
  const hourly = blsNumber(row[hourlyKey] ?? '');
  return hourly === null ? null : Math.round(hourly * HOURS_PER_YEAR);
}

export const blsSource: JobSource<LocalWages[]> = {
  name: 'bls-oews',
  endpoint: `https://www.bls.gov/oes/special-requests/${OEWS_RELEASE}.zip`,
  role: 'What it pays here, and how many of these jobs the Detroit metro has',
  async fetch() {
    const path = await cachedDownload(
      `https://www.bls.gov/oes/special-requests/${OEWS_RELEASE}.zip`,
      `bls/${OEWS_RELEASE}.zip`,
      120,
    );

    // The zip holds one .xlsx per geography level. Find the metro workbook by
    // shape rather than by name, so next year's file does not need a code change.
    const members = await listZipMembers(path);
    const member = members.find((name) => /(^|\/)MSA_[^/]*\.xlsx$/i.test(name));
    if (!member) throw new Error(`${OEWS_RELEASE}.zip has no MSA workbook (found ${members.join(', ')})`);

    const workbook = join(CACHE_DIR, `bls/${OEWS_RELEASE}-msa.xlsx`);
    if (!existsSync(workbook)) await extractZipMember(path, member, workbook);

    const rows: LocalWages[] = [];
    // 600k+ rows cover every metro in the country. Drop all but ours before the
    // record is even built.
    const keep = (cells: string[], header: string[]) => cells[header.indexOf('AREA')] === DETROIT_MSA;

    for await (const row of readSheetRecords(workbook, { keep })) {
      if (row.O_GROUP !== 'detailed') continue;
      const socCode = (row.OCC_CODE ?? '').trim();
      if (!/^\d{2}-\d{4}$/.test(socCode)) continue;

      const pct90 = annualWage(row, 'A_PCT90', 'H_PCT90');
      rows.push({
        socCode,
        title: row.OCC_TITLE ?? '',
        employment: blsNumber(row.TOT_EMP ?? ''),
        locationQuotient: blsNumber(row.LOC_QUOTIENT ?? ''),
        pct10: annualWage(row, 'A_PCT10', 'H_PCT10'),
        pct25: annualWage(row, 'A_PCT25', 'H_PCT25'),
        median: annualWage(row, 'A_MEDIAN', 'H_MEDIAN'),
        pct75: annualWage(row, 'A_PCT75', 'H_PCT75'),
        pct90,
        annualOnly: (row.ANNUAL ?? '').toUpperCase() === 'TRUE',
        topCoded: (row.A_PCT90 ?? '').trim() === '#' || pct90 === BLS_TOP_CODE,
      });
    }
    return rows;
  },
};

// ---- Projections Central -----------------------------------------------------

type ProjectionRow = {
  Title?: string;
  OccCode?: string;
  Base?: string;
  Projected?: string;
  PercentChange?: string;
  AvgAnnualOpenings?: string;
  BaseYear?: string;
  ProjYear?: string;
};

const PROJECTIONS_BASE = 'https://public.projectionscentral.org/Projections/LongTermRestJson';

export const projectionsSource: JobSource<StateOutlook[]> = {
  name: 'projections-central',
  endpoint: `${PROJECTIONS_BASE}/${MICHIGAN_FIPS}`,
  role: 'Where Michigan expects each occupation to go, and how many openings a year',
  async fetch() {
    const rows: StateOutlook[] = [];
    const seen = new Set<string>();

    // The endpoint pages 100 at a time and clamps to the last page instead of
    // returning nothing, so stop when a page adds no new occupation.
    for (let page = 1; page <= 30; page += 1) {
      const body = await getJson<{ rows?: ProjectionRow[] }>(`${PROJECTIONS_BASE}/${MICHIGAN_FIPS}?page=${page}`);
      const batch = body.rows ?? [];
      if (batch.length === 0) break;

      let added = 0;
      for (const row of batch) {
        const socCode = (row.OccCode ?? '').trim();
        if (!/^\d{2}-\d{4}$/.test(socCode) || seen.has(socCode)) continue;
        seen.add(socCode);
        added += 1;
        rows.push({
          socCode,
          title: row.Title ?? '',
          baseYear: Number(row.BaseYear) || 0,
          projectedYear: Number(row.ProjYear) || 0,
          baseEmployment: numberOrNull(row.Base ?? ''),
          projectedEmployment: numberOrNull(row.Projected ?? ''),
          percentChange: numberOrNull(row.PercentChange ?? ''),
          annualOpenings: numberOrNull(row.AvgAnnualOpenings ?? ''),
        });
      }
      if (added === 0) break;
    }
    return rows;
  },
};

// ---- Entry routes ------------------------------------------------------------

/**
 * Apprenticeship.gov publishes its sponsor list only through a Tableau embed and
 * its job finder through the CareerOneStop API, which needs a key. Neither is
 * usable keyless tonight, so these are typed in by hand from the sponsors' own
 * public pages. The adapter re-checks every url on each run.
 */
export const entryRoutesSource: JobSource<EntryRouteSeed[]> = {
  name: 'entry-routes',
  endpoint: 'scripts/jobs/entry-routes.ts (hand-checked sponsor pages)',
  role: 'Detroit apprenticeships and internships with a real front door',
  async fetch() {
    return ENTRY_ROUTE_SEEDS;
  },
};

// ---- CareerOneStop (optional, needs a free key) ------------------------------

/**
 * The one source here that would genuinely be better with a key.
 *
 * apprenticeship.gov's sponsor data is served through CareerOneStop, a free API
 * from the Department of Labor that anyone can register for. With a key this
 * would replace most of entry-routes.ts with live sponsor records. Without one
 * the source reports "skipped" and the run carries on with the hand-checked
 * list, which is why nothing below is allowed to throw on a missing key.
 *
 * Register at https://www.careeronestop.org/Developers/WebAPI/registration.aspx
 * and set CAREERONESTOP_USER_ID and CAREERONESTOP_TOKEN.
 *
 * Untested: no key was available when this was written, so the response mapping
 * is written from the published API shape and needs a first run to confirm.
 */
type CareerOneStopSponsor = {
  Name?: string;
  City?: string;
  State?: string;
  Occupation?: string;
  OccupationCode?: string;
  URL?: string;
  Url?: string;
  Description?: string;
};

export const careerOneStopSource: JobSource<EntryRouteSeed[]> = {
  name: 'careeronestop',
  endpoint: 'https://api.careeronestop.org/v1/apprenticeship/{userId}/Detroit,MI/25',
  role: 'Registered apprenticeship sponsors near Detroit (optional; needs a free key)',
  async fetch() {
    const userId = process.env.CAREERONESTOP_USER_ID;
    const token = process.env.CAREERONESTOP_TOKEN;
    if (!userId || !token) {
      console.log('· careeronestop: skipped (set CAREERONESTOP_USER_ID and CAREERONESTOP_TOKEN to enable)');
      return [];
    }

    const url = `https://api.careeronestop.org/v1/apprenticeship/${encodeURIComponent(userId)}/Detroit,MI/25?sortColumns=0&sortDirections=0&startRecord=0&limit=100`;
    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${token}`, 'User-Agent': USER_AGENT, Accept: 'application/json' },
      signal: AbortSignal.timeout(60_000),
    });
    if (!response.ok) throw new Error(`careeronestop returned ${response.status}`);

    const body = (await response.json()) as { SponsorList?: CareerOneStopSponsor[] };
    const today = new Date().toISOString().slice(0, 10);

    return (body.SponsorList ?? [])
      .map((sponsor): EntryRouteSeed | null => {
        const link = sponsor.URL ?? sponsor.Url;
        const name = sponsor.Name;
        if (!link || !name) return null;
        const socCode = (sponsor.OccupationCode ?? '').slice(0, 7);
        return {
          slug: `cos-${name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}`,
          title: sponsor.Occupation ? `${sponsor.Occupation} apprenticeship` : `Apprenticeship — ${name}`,
          organization: name,
          summary: sponsor.Description ?? `Registered apprenticeship sponsored by ${name}.`,
          url: link,
          city: sponsor.City ?? null,
          employmentType: 'Apprenticeship',
          sector: socCode ? sectorFor(socCode) : 'Other',
          socCodes: /^\d{2}-\d{4}$/.test(socCode) ? [socCode] : [],
          entryRoutes: ['Contact the sponsor directly', 'Registered with the US Department of Labor'],
          hiringHere: [name],
          payMinUsd: null,
          payMaxUsd: null,
          verifiedOn: today,
        };
      })
      .filter((seed): seed is EntryRouteSeed => seed !== null);
  },
};

export const SOURCES = { onetSource, blsSource, projectionsSource, entryRoutesSource, careerOneStopSource };
