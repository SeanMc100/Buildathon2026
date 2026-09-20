// The three keyless federal APIs.
//
// Two of them describe *money*, not openings: an NSF or NIH award is a grant to
// an institution, and nobody applies to one. Those are used to ground coverage
// — which institutions, departments and fields are actually funded and active
// in metro Detroit right now — and to audit the registry, so a new REU site or
// a whole institution we have missed shows up in the run report.
//
// The exception is an NSF *REU Site* award, which funds precisely the programme
// undergraduates apply to. Those become items: the award gives the institution,
// the official title and, from the abstract, the length of the summer. It never
// gives a stipend, so stipendUsd stays null unless the registry supplies one.

import { getOk, postJson } from './http';
import { metroCity } from '../events/region';

const NSF_AWARDS = 'https://api.nsf.gov/services/v1/awards.json';
const NIH_PROJECTS = 'https://api.reporter.nih.gov/v2/projects/search';
const GRANTS_SEARCH = 'https://api.grants.gov/v1/api/search2';

// ---- NSF awards ---------------------------------------------------------------

export type NsfAward = {
  id: string;
  title: string;
  institution: string;
  city: string;
  /** ISO date. */
  startDate: string;
  /** ISO date the funding runs out. A site past this is not running. */
  expDate: string;
  abstract: string;
  /** The public award page. Reachable, unlike NSF's own REU search. */
  url: string;
};

type NsfResponse = {
  response?: {
    award?: Array<{
      id?: string;
      title?: string;
      awardeeName?: string;
      awardeeCity?: string;
      startDate?: string;
      expDate?: string;
      abstractText?: string;
    }>;
  };
};

/** The API sends "04/01/2024". */
function usDate(value: string | undefined): string | null {
  const match = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(value ?? '');
  return match ? `${match[3]}-${match[1]}-${match[2]}` : null;
}

const WORD_NUMBERS: Record<string, number> = {
  four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12,
};

/**
 * "a 10-week summer program" / "an eight-week residential experience". The
 * abstract is the proposal NSF funded, so this is the length of the programme
 * as the award describes it. Nothing else in the record carries it.
 */
export function weeksFromAbstract(abstract: string): number | null {
  const match = /\b(\d{1,2}|four|five|six|seven|eight|nine|ten|eleven|twelve)[-\s]weeks?\b/i.exec(abstract);
  if (!match) return null;
  const token = match[1].toLowerCase();
  const weeks = /^\d+$/.test(token) ? Number(token) : WORD_NUMBERS[token];
  return weeks !== undefined && weeks >= 4 && weeks <= 16 ? weeks : null;
}

/**
 * Every Michigan award whose title marks it an REU Site. Paged, because the API
 * caps a response at 25 and a keyword search runs to a few hundred.
 */
export async function fetchNsfReuSites(pages = 6): Promise<NsfAward[]> {
  const found = new Map<string, NsfAward>();

  for (let page = 0; page < pages; page += 1) {
    const query = new URLSearchParams({
      awardeeStateCode: 'MI',
      keyword: '"REU Site"',
      rpp: '25',
      offset: String(page * 25 + 1),
      printFields: 'id,title,awardeeName,awardeeCity,startDate,expDate,abstractText',
    });
    const body = JSON.parse(await getOk(`${NSF_AWARDS}?${query}`)) as NsfResponse;
    const awards = body.response?.award ?? [];
    if (awards.length === 0) break;

    for (const award of awards) {
      const id = award.id;
      const title = award.title ?? '';
      const expDate = usDate(award.expDate);
      const startDate = usDate(award.startDate);
      // "RET Site" and plain research awards come back on the same keyword.
      if (!id || !/\bREU Site\b/i.test(title) || !expDate || !startDate) continue;
      found.set(id, {
        id,
        title: title.replace(/\s+/g, ' ').trim(),
        institution: (award.awardeeName ?? '').replace(/\s+-\s*$/, '').trim(),
        city: award.awardeeCity ?? '',
        startDate,
        expDate,
        abstract: (award.abstractText ?? '').replace(/\s+/g, ' ').trim(),
        url: `https://www.nsf.gov/awardsearch/showAward?AWD_ID=${id}`,
      });
    }
  }
  return [...found.values()];
}

/** Funded today and hosted in the metro region. A lapsed award is not a programme. */
export function isLiveMetroSite(award: NsfAward, now: Date): boolean {
  return Date.parse(award.expDate) >= now.getTime() && metroCity(award.city) !== null;
}

// ---- NIH RePORTER --------------------------------------------------------------

export type NihCoverage = {
  /** Institution name as NIH writes it. */
  institution: string;
  city: string;
  /** How many funded projects. A rough measure of how much research happens there. */
  projects: number;
  /** The departments NIH money actually lands in, commonest first. */
  departments: string[];
};

type NihResponse = {
  results?: Array<{ organization?: { org_name?: string; org_city?: string; dept_type?: string } }>;
};

/**
 * Which Detroit-area institutions hold live NIH funding, and in what
 * departments. Used to check the registry is not missing a whole employer, and
 * to keep the discipline vocabulary honest about what is really funded here.
 */
export async function fetchNihCoverage(cities = ['DETROIT', 'ANN ARBOR', 'DEARBORN', 'ROCHESTER', 'SOUTHFIELD', 'YPSILANTI'], pages = 4): Promise<NihCoverage[]> {
  const byOrg = new Map<string, { city: string; projects: number; departments: Map<string, number> }>();

  for (let page = 0; page < pages; page += 1) {
    const body = JSON.parse(
      await postJson(NIH_PROJECTS, {
        criteria: { org_states: ['MI'], org_cities: cities },
        include_fields: ['Organization'],
        limit: 500,
        offset: page * 500,
      }),
    ) as NihResponse;

    const results = body.results ?? [];
    if (results.length === 0) break;

    for (const { organization } of results) {
      const name = organization?.org_name;
      if (!name) continue;
      const entry = byOrg.get(name) ?? { city: organization?.org_city ?? '', projects: 0, departments: new Map() };
      entry.projects += 1;
      const department = organization?.dept_type;
      if (department) entry.departments.set(department, (entry.departments.get(department) ?? 0) + 1);
      byOrg.set(name, entry);
    }
  }

  return [...byOrg.entries()]
    .map(([institution, entry]) => ({
      institution,
      city: entry.city,
      projects: entry.projects,
      departments: [...entry.departments.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5).map(([name]) => name),
    }))
    .sort((a, b) => b.projects - a.projects);
}

// ---- Grants.gov ----------------------------------------------------------------

export type GrantsOpportunity = {
  id: string;
  number: string;
  title: string;
  agency: string;
  /** ISO date. Null when the notice has no close date. */
  closeDate: string | null;
  url: string;
};

type GrantsResponse = {
  data?: {
    oppHits?: Array<{ id?: string; number?: string; title?: string; agency?: string; closeDate?: string }>;
  };
};

/**
 * Grants.gov is mostly institutions applying for money, which is no use here.
 * The exception is the NIH NRSA "Parent" notices, where the applicant really is
 * one person. `numbers` is an allowlist, because filtering by keyword alone
 * drags in hundreds of institutional programme announcements.
 */
export async function fetchIndividualFellowships(numbers: string[]): Promise<GrantsOpportunity[]> {
  const wanted = new Set(numbers.map((value) => value.toUpperCase()));
  const body = JSON.parse(
    await postJson(GRANTS_SEARCH, {
      rows: 100,
      keyword: 'Kirschstein National Research Service Award Individual Fellowship',
      oppStatuses: 'posted',
    }),
  ) as GrantsResponse;

  const found: GrantsOpportunity[] = [];
  for (const hit of body.data?.oppHits ?? []) {
    if (!hit.id || !hit.number || !wanted.has(hit.number.toUpperCase())) continue;
    found.push({
      id: hit.id,
      number: hit.number,
      // The feed sends HTML entities in titles.
      title: (hit.title ?? '').replace(/&ndash;/g, '–').replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim(),
      agency: hit.agency ?? 'National Institutes of Health',
      closeDate: usDate(hit.closeDate),
      url: `https://www.grants.gov/search-results-detail/${hit.id}`,
    });
  }
  return found;
}
