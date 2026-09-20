// Research sources. Three produce items; two only audit coverage.
//
//   registry            every curated programme page, re-fetched and re-read
//   nsf-reu-sites       live NSF REU Site awards in the metro region
//   nih-nrsa-fellowships  the NIH parent notices an individual really applies to
//
//   nsf-awards-coverage   which institutions hold live NSF money here
//   nih-reporter-coverage which hold live NIH money, and in which departments
//
// The two audits contribute no items on purpose — an award is not an opening.
// They exist so a scheduled run can say "Wayne State has 300 live NIH projects
// and we list four ways in", which is the honest measure of whether the
// registry has gone stale.

import { htmlToText } from '../events/text';
import {
  fetchIndividualFellowships,
  fetchNihCoverage,
  fetchNsfReuSites,
  isLiveMetroSite,
  weeksFromAbstract,
} from './discovery';
import { driftNotes, looksSuspended } from './extract';
import { classify, get, isSoft404 } from './http';
import { REGISTRY } from './registry';
import type { RawResearch, ResearchSource } from './types';

// ---- The curated registry -------------------------------------------------------

/**
 * Each entry is re-fetched so the run can say whether the page is still there
 * and still says what we recorded. The facts themselves are not overwritten
 * from the page: a regex is not a good enough reader to be trusted with a
 * stipend. Disagreements become drift notes for a human.
 */
const registrySource: ResearchSource = {
  name: 'registry',
  endpoint: 'scripts/research/registry.ts',
  async fetch() {
    const items: RawResearch[] = [];

    for (const entry of REGISTRY) {
      const drift: string[] = [];
      let status = classify({ status: 0, url: entry.url, body: '' });

      try {
        const response = await get(entry.url);
        status = classify(response);
        if (status === 'ok') {
          const text = htmlToText(response.body);
          if (isSoft404(text)) {
            status = 'dead';
            drift.push('the page returns 200 but reads as "page not found"');
          } else {
            if (looksSuspended(text)) drift.push('the page now reads as paused or closed to applications');
            drift.push(...driftNotes(text, entry));
          }
        } else if (status === 'dead') {
          drift.push(`the page returned ${response.status}; the programme may have moved`);
        } else {
          drift.push(`the host would not serve an automated request (${response.status}); the page was not read this run`);
        }
      } catch (error) {
        status = 'dead';
        drift.push(`the page could not be fetched: ${error instanceof Error ? error.message : String(error)}`);
      }

      items.push({
        source: 'registry',
        sourceId: entry.key,
        title: entry.title,
        organization: entry.organization,
        description: entry.summary,
        url: entry.url,
        city: entry.city,
        isOnline: entry.isOnline ?? false,
        field: entry.field,
        stipendUsd: entry.stipendUsd,
        durationWeeks: entry.durationWeeks,
        startsAt: entry.startsAt,
        applyBy: entry.applyBy,
        eligibility: entry.eligibility,
        minEducation: entry.minEducation,
        research: {
          institution: entry.institution,
          enrollmentRequired: entry.enrollmentRequired,
          citizenship: entry.citizenship,
          isPaid: entry.isPaid,
          mentorshipModel: entry.mentorshipModel,
          disciplines: entry.disciplines,
          applicationMethod: entry.applicationMethod,
          recurrence: entry.recurrence,
          nextWindowOpens: entry.nextWindowOpens ?? null,
          annualDeadline: entry.annualDeadline ?? null,
          communityBased: entry.communityBased,
          lowBarrier: entry.lowBarrier,
          factsFrom: entry.factsFrom,
          curatorNotes: entry.notes ?? [],
          driftNotes: drift,
        },
        urlStatusHint: status,
      });
    }

    return items;
  },
};

// ---- NSF REU sites ----------------------------------------------------------------

/** Award ids the registry already covers with a real application page. */
const registeredAwards = new Set(REGISTRY.map((entry) => entry.nsfAwardId).filter(Boolean) as string[]);

/** "REU Site: Summer Intensive Research Experiences in Neuroscience (SIREN)" -> the subject. */
function fieldFromTitle(title: string): string {
  const body = title.replace(/^(?:Center:\s*)?REU Site:\s*/i, '').replace(/\s*\([^)]*\)\s*$/, '').trim();
  return body.replace(/^(?:Research Experiences? for Undergraduates?\s+(?:in|at)\s+)/i, '').trim() || 'Interdisciplinary research';
}

const DISCIPLINE_WORDS: Array<[RegExp, string]> = [
  [/neuro/i, 'neuroscience'],
  [/semiconductor|photonic|optic/i, 'semiconductors and optics'],
  [/physic|astro/i, 'physics'],
  [/math|discrete|analysis/i, 'mathematics'],
  [/biophys|protein|genom|biolog/i, 'biology'],
  [/chem/i, 'chemistry'],
  [/climate|space|watershed|environment|ecolog/i, 'environmental science'],
  [/comput|cyber|software|data/i, 'computing'],
  [/engineer|manufactur|automotive|electrical/i, 'engineering'],
  [/cognit|development|psycholog/i, 'psychology'],
  [/crime|justice|social|communit/i, 'social science'],
];

function disciplinesFor(text: string): string[] {
  const found = DISCIPLINE_WORDS.filter(([pattern]) => pattern.test(text)).map(([, name]) => name);
  return found.length > 0 ? [...new Set(found)] : ['interdisciplinary'];
}

/**
 * An REU Site award funds exactly the thing an undergraduate applies to, so
 * unlike every other award these do become items. The award record carries the
 * institution, the official title and, from the abstract, how many weeks the
 * summer runs. It never carries a stipend or a deadline, and those stay null.
 *
 * The url is NSF's own award page, which is reachable; NSF's REU search, which
 * would be the better link, sits behind a WAF challenge.
 */
const nsfReuSource: ResearchSource = {
  name: 'nsf-reu-sites',
  endpoint: 'https://api.nsf.gov/services/v1/awards.json?keyword="REU Site"&awardeeStateCode=MI',
  async fetch() {
    const now = new Date();
    const awards = await fetchNsfReuSites();

    return awards
      .filter((award) => isLiveMetroSite(award, now) && !registeredAwards.has(award.id))
      .map((award): RawResearch => {
        const field = fieldFromTitle(award.title);
        const weeks = weeksFromAbstract(award.abstract);
        return {
          source: 'nsf-reu-sites',
          sourceId: award.id,
          title: award.title,
          organization: award.institution,
          description:
            `An NSF-funded Research Experiences for Undergraduates site at ${award.institution}, funded through ${award.expDate}. ` +
            'Undergraduates spend a paid summer on a research project with a faculty mentor.',
          url: award.url,
          city: award.city,
          isOnline: false,
          field,
          // NSF publishes what it awarded the institution, never what a student is paid.
          stipendUsd: null,
          durationWeeks: weeks,
          startsAt: null,
          applyBy: null,
          eligibility: [
            'Undergraduate students; REU sites are normally limited to U.S. citizens and permanent residents',
            `Funded by NSF award ${award.id} through ${award.expDate}`,
            'Apply through the host department — the NSF award page names the principal investigator',
          ],
          minEducation: 'secondary',
          research: {
            institution: award.institution,
            enrollmentRequired: 'undergraduate',
            // NSF's own rule for REU sites, not something this award page states.
            citizenship: 'us_citizen_or_pr',
            isPaid: true,
            mentorshipModel: 'faculty_lab',
            disciplines: disciplinesFor(`${award.title} ${award.abstract.slice(0, 600)}`),
            applicationMethod: 'contact_program',
            recurrence: 'annual_summer',
            nextWindowOpens: null,
            annualDeadline: null,
            communityBased: false,
            lowBarrier: false,
            factsFrom: 'api',
            curatorNotes: [
              'Discovered from the NSF award record, not from a programme page. The application page, stipend and deadline still need finding by hand.',
            ],
            driftNotes: [],
          },
        };
      });
  },
};

// ---- NIH individual fellowships ------------------------------------------------------

/**
 * The NRSA "Parent" notices, where the applicant is a person rather than an
 * institution. Kept to an allowlist: a keyword search of Grants.gov otherwise
 * returns hundreds of institutional programme announcements nobody can apply to
 * on their own.
 */
const NRSA_PARENTS = ['PA-25-422', 'PA-25-423', 'PA-25-424', 'PA-25-425', 'PA-25-426'];

const nihFellowshipSource: ResearchSource = {
  name: 'nih-nrsa-fellowships',
  endpoint: 'https://api.grants.gov/v1/api/search2',
  async fetch() {
    const opportunities = await fetchIndividualFellowships(NRSA_PARENTS);

    return opportunities.map((opportunity): RawResearch => {
      const postdoctoral = /Postdoctoral|Senior Fellowship/i.test(opportunity.title);
      return {
        source: 'nih-nrsa-fellowships',
        sourceId: opportunity.number,
        title: opportunity.title,
        organization: opportunity.agency,
        description:
          'A National Institutes of Health fellowship an individual applies for directly, through the institution where they will do the research. ' +
          'Detroit-area universities and health systems sponsor these every year.',
        url: opportunity.url,
        // Applied for from wherever you already are, so no city of its own.
        city: null,
        isOnline: false,
        field: 'Biomedical and health research',
        stipendUsd: null,
        durationWeeks: null,
        startsAt: null,
        applyBy: opportunity.closeDate,
        eligibility: [
          postdoctoral
            ? 'Postdoctoral researchers, applying with a sponsoring institution and mentor'
            : 'Doctoral or dual-degree students, applying with a sponsoring institution and mentor',
          'A U.S. institution must sponsor the application',
          `Funding opportunity number ${opportunity.number}`,
        ],
        minEducation: 'postgraduate',
        research: {
          institution: 'National Institutes of Health',
          enrollmentRequired: postdoctoral ? 'postdoc' : 'graduate',
          citizenship: 'us_citizen_or_pr',
          isPaid: true,
          mentorshipModel: 'faculty_lab',
          disciplines: ['biomedical science', 'health research'],
          applicationMethod: 'online_form',
          // These notices stay open for years with several receipt dates inside them.
          recurrence: 'rolling',
          nextWindowOpens: null,
          annualDeadline: null,
          communityBased: false,
          lowBarrier: false,
          factsFrom: 'api',
          curatorNotes: [
            'The close date is the expiry of the notice, not a single deadline; NIH runs standard receipt dates inside it.',
          ],
          driftNotes: [],
        },
      };
    });
  },
};

// ---- Coverage audits -------------------------------------------------------------------

export type Audit = {
  name: string;
  endpoint: string;
  /** Lines for the run report. */
  run: () => Promise<{ checked: number; lines: string[] }>;
};

/** Institutions with live NIH funding here, and whether the registry lists a way in. */
const nihCoverageAudit: Audit = {
  name: 'nih-reporter-coverage',
  endpoint: 'https://api.reporter.nih.gov/v2/projects/search',
  async run() {
    const coverage = await fetchNihCoverage();
    const listed = new Set(REGISTRY.map((entry) => entry.institution.toLowerCase()));
    const lines = coverage.slice(0, 12).map((entry) => {
      const covered = [...listed].some((name) => entry.institution.toLowerCase().includes(name) || name.includes(entry.institution.toLowerCase()));
      return `${covered ? '  ' : '  ⚠ no registry entry — '}${entry.institution} (${entry.city}), ${entry.projects} live projects: ${entry.departments.join(', ')}`;
    });
    return { checked: coverage.length, lines };
  },
};

/** REU sites funded here right now, and whether each has a real application page. */
const nsfCoverageAudit: Audit = {
  name: 'nsf-awards-coverage',
  endpoint: 'https://api.nsf.gov/services/v1/awards.json',
  async run() {
    const now = new Date();
    const live = (await fetchNsfReuSites()).filter((award) => isLiveMetroSite(award, now));
    const lines = live.map((award) => {
      const covered = registeredAwards.has(award.id);
      return `  ${covered ? '✓ registry page' : '· award page only'}  ${award.institution} — ${award.title.slice(0, 66)} (to ${award.expDate})`;
    });
    return { checked: live.length, lines };
  },
};

// ---- The lists ---------------------------------------------------------------------------

export type SourceEntry = {
  source: ResearchSource;
  /** True when having no items is normal. Anything else that returns nothing is flagged. */
  mayBeEmpty?: boolean;
};

export const SOURCES: SourceEntry[] = [
  { source: registrySource },
  { source: nsfReuSource },
  { source: nihFellowshipSource },
];

export const AUDITS: Audit[] = [nsfCoverageAudit, nihCoverageAudit];
