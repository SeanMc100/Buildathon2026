// Program sources. Each one reads something a provider publishes for the public:
// a WordPress REST collection, a listing table, or a program page named in
// registry.ts. Nothing here logs in, and nothing touches Facebook, Eventbrite or
// LinkedIn, whose terms restrict automated reads.
//
// Three kinds of adapter cover everything we found:
//   wpSource            WordPress REST (wp/v2/pages, or a custom post type such as
//                       SER's program-service and Per Scholas's course). This is the
//                       real win: most Detroit workforce nonprofits run WordPress
//                       with the REST API left open, so their program pages arrive
//                       as structured JSON with title, link and body.
//   detroitAtWork       The one genuine listing table in the city: every WIOA-funded
//                       training Detroit at Work currently buys, with a link per row.
//   registrySource      A curated program page (registry.ts), re-read and re-checked
//                       on every run.
//
// To add a source, add one line to SOURCES.

import { htmlToText } from '../events/text';
import { mainContent, metaDescription } from './html';
import { get, getJson } from './http';
import { REGISTRY } from './registry';
import type { ProgramSource, RawProgram, SourceEntry } from './types';

// ---- WordPress REST ----------------------------------------------------------

type WpItem = {
  id: number;
  link: string;
  title?: { rendered?: string };
  content?: { rendered?: string };
  excerpt?: { rendered?: string };
};

type WpOptions = {
  /** Site root, no trailing slash. */
  base: string;
  /** rest_base of the collection: 'pages', 'posts', or a custom type. */
  collection: string;
  organization: string;
  city: string | null;
  location: string | null;
  /** Which entries are actually programmes. Runs on the public link and the title. */
  keep: (link: string, title: string) => boolean;
  sector?: RawProgram['sector'];
  audiences?: RawProgram['audiences'];
  statewide?: boolean;
  fragility?: ProgramSource['fragility'];
};

/**
 * `<site>/wp-json/wp/v2/<collection>` on an ordinary WordPress install. Worth
 * testing on every organisation before writing an HTML scraper: it gives the
 * body copy the same way the site's own editor sees it, so extraction is stable
 * even when the theme changes.
 */
function wpSource(name: string, options: WpOptions): ProgramSource {
  const endpoint = `${options.base}/wp-json/wp/v2/${options.collection}`;
  return {
    name,
    endpoint,
    fragility: options.fragility ?? 'low',
    async fetch() {
      const items: WpItem[] = [];
      // 100 is WordPress's ceiling per request; three pages is plenty for a
      // program list, and stops a huge site from turning into a crawl.
      for (let page = 1; page <= 3; page += 1) {
        const batch = await getJson<WpItem[]>(
          `${endpoint}?per_page=100&page=${page}&_fields=id,link,title,content,excerpt`,
        );
        if (!Array.isArray(batch)) throw new Error(`${endpoint} did not return a list`);
        items.push(...batch);
        if (batch.length < 100) break;
      }

      return items
        .map((item) => ({ item, title: htmlToText(item.title?.rendered ?? '') }))
        .filter(({ item, title }) => title.length > 0 && options.keep(item.link, title))
        .map(({ item, title }): RawProgram => ({
          source: name,
          // The WordPress post id is stable across title edits, so the opportunity id is too.
          sourceId: String(item.id),
          title,
          organization: options.organization,
          description: htmlToText(item.content?.rendered ?? item.excerpt?.rendered ?? ''),
          url: item.link,
          city: options.city,
          location: options.location,
          statewide: options.statewide,
          readAs: 'wp_rest',
          sector: options.sector,
          audiences: options.audiences,
        }));
    },
  };
}

/** Path of a WordPress link, for the `keep` predicates below. */
const path = (link: string) => {
  try {
    return new URL(link).pathname;
  } catch {
    return link;
  }
};

/** Index pages ("Our Programs", "Adult Programs & Services") are not programmes. */
const NOT_A_PROGRAM = /^(?:our |the )?(?:programs?|programs? (?:&|and) services|services|home|about|contact|news|events|resources|registration|apply)\b/i;

// ---- Detroit at Work training table -----------------------------------------

/**
 * https://detroitatwork.com/training publishes the list of training the city is
 * currently buying with WIOA money: one row per provider and course, each linking
 * to that provider's own training bio. It is the closest thing Detroit has to an
 * Eligible Training Provider List you can actually read.
 *
 * Fragile by nature: it is an HTML table, not an API. If the markup changes this
 * adapter returns nothing and the run report says so rather than inventing rows.
 * Note the page also carries a block of cohort dates that is commented out of the
 * published HTML; unpublished content is not fact, so we do not read it.
 */
function detroitAtWorkSource(): ProgramSource {
  const url = 'https://detroitatwork.com/training';
  return {
    name: 'detroit-at-work',
    endpoint: url,
    fragility: 'high',
    async fetch() {
      const html = await get(url);
      const table = /<table[\s\S]*?<\/table>/i.exec(html)?.[0];
      if (!table) throw new Error('no training table on detroitatwork.com/training — has the page changed?');

      const seen = new Set<string>();
      const rows: RawProgram[] = [];

      for (const row of table.matchAll(/<tr>([\s\S]*?)<\/tr>/gi)) {
        const cells = [...row[1].matchAll(/<td[^>]*>([\s\S]*?)<\/td>/gi)].map((cell) => ({
          text: htmlToText(cell[1]),
          href: /href="([^"]+)"/i.exec(cell[1])?.[1] ?? null,
        }));
        if (cells.length < 2) continue;

        const provider = cells[0].text.replace(/\s+/g, ' ').trim();
        const program = cells[1].text.replace(/\s+/g, ' ').trim();
        if (!provider || !program || /^training provider$/i.test(provider)) continue;

        // The provider cell sometimes carries a mangled link; the program cell's is the reliable one.
        const href = cells[1].href ?? cells[0].href;
        if (!href) continue;
        let link: string;
        try {
          link = new URL(href, url).toString();
        } catch {
          continue;
        }

        // The table repeats a few courses with an older bio attached; keep the first.
        const key = `${provider}|${program}`.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
        if (seen.has(key)) continue;
        seen.add(key);

        rows.push({
          source: 'detroit-at-work',
          sourceId: key,
          title: program,
          organization: provider,
          description: '',
          // The row links to the provider's training bio; the listing page is where we read it.
          url: link,
          sourcePage: url,
          city: 'Detroit',
          location: 'Through a Detroit at Work career center',
          readAs: 'html_table',
          summary: `${program}, offered by ${provider} and paid for by Detroit at Work for eligible Detroiters.`,
          facts: {
            // Stated at the top of the page: "Free job training opportunities for Detroiters".
            costUsd: 0,
            funding: 'wioa_funded',
            // The page tells you to call (313) 962-9675 to start.
            applicationMethod: 'phone',
          },
        });
      }

      return rows;
    },
  };
}

// ---- The curated registry -----------------------------------------------------

/**
 * Each registry entry is fetched fresh: the ingest confirms the URL still answers,
 * re-reads the page for cost, length, dates and eligibility, and hashes the text so
 * the next run can report what changed.
 */
function registrySource(): ProgramSource {
  return {
    name: 'registry',
    endpoint: 'scripts/programs/registry.ts',
    fragility: 'medium',
    async fetch() {
      const programs: RawProgram[] = [];
      for (const entry of REGISTRY) {
        let description = '';
        let published: string | null = null;
        try {
          const html = await get(entry.url);
          description = mainContent(html);
          published = metaDescription(html);
        } catch {
          // A page we cannot read is still a program we can list, as long as the
          // link works; ingest checks that separately and drops it if it does not.
          description = '';
        }
        programs.push({
          source: 'registry',
          sourceId: entry.key,
          title: entry.title,
          organization: entry.organization,
          description,
          url: entry.url,
          city: entry.city,
          location: entry.location,
          statewide: entry.statewide,
          readAs: 'html_page',
          sector: entry.sector,
          audiences: entry.audiences,
          facts: entry.facts,
          // A curated line beats a sentence pulled out of a page we only half
          // understand; the page's own meta description is the tie-breaker.
          summary: entry.summary || published || '',
          sectorFixed: true,
        });
      }
      return programs;
    },
  };
}

// ---- The list -----------------------------------------------------------------

export const SOURCES: SourceEntry[] = [
  {
    source: wpSource('techtown', {
      base: 'https://techtowndetroit.org',
      collection: 'pages',
      organization: 'TechTown Detroit',
      city: 'Detroit',
      location: 'TechTown, 440 Burroughs St, Detroit',
      sector: 'entrepreneurship',
      audiences: ['detroit_residents'],
      // Programme pages live two levels under /what-we-do/; deeper pages are
      // booking forms and mentor bios, and the middle level is an index.
      keep: (link, title) =>
        /^\/what-we-do\/[a-z0-9-]+\/[a-z0-9-]+\/$/.test(path(link)) &&
        // aae is a booking page for one-off advice and first-thursdays is a
        // recurring event; both belong to the events pipeline, not this one.
        !/tech-portfolio|our-experts|our-strategists|first-thursdays|\/aae\/$/.test(path(link)) &&
        !NOT_A_PROGRAM.test(title),
    }),
  },
  {
    source: wpSource('ser-metro', {
      base: 'https://sermetro.org',
      collection: 'program-service',
      organization: 'SER Metro-Detroit',
      city: 'Detroit',
      location: 'SER Metro-Detroit',
      sector: 'general_workforce',
      audiences: ['spanish_speakers', 'low_income'],
      // Career centers are a place to walk into, not a programme to enrol in.
      keep: (link, title) =>
        !/registration|career-centers|^\/program-service\/(youth|adult-programs-services|youth-programs-services)\/$/.test(
          path(link),
        ) && !NOT_A_PROGRAM.test(title),
    }),
  },
  {
    source: wpSource('focus-hope', {
      base: 'https://focushope.edu',
      collection: 'pages',
      organization: 'Focus: HOPE',
      city: 'Detroit',
      location: 'Focus: HOPE, 1400 Oakman Blvd, Detroit',
      sector: 'general_workforce',
      audiences: ['detroit_residents', 'low_income'],
      keep: (link) => /^\/programs\/job-training\/.+/.test(path(link)) && !/employee-partners/.test(path(link)),
    }),
    // Focus: HOPE describes most of its pathways through Detroit at Work rather
    // than on its own site, so one or two pages here is the normal state.
    mayBeEmpty: true,
  },
  {
    source: wpSource('per-scholas-detroit', {
      base: 'https://perscholas.org',
      collection: 'course',
      organization: 'Per Scholas Detroit',
      city: 'Detroit',
      location: 'Per Scholas Detroit',
      sector: 'tech',
      audiences: ['low_income'],
      // Per Scholas lists every city's course on one national site; keep Detroit's.
      keep: (link, title) => /detroit/i.test(link) || /detroit/i.test(title),
    }),
  },
  {
    source: wpSource('build-institute', {
      base: 'https://www.buildinstitute.org',
      collection: 'pages',
      organization: 'Build Institute',
      city: 'Detroit',
      location: 'Build Institute, Detroit',
      sector: 'entrepreneurship',
      audiences: ['detroit_residents', 'women'],
      keep: (link) =>
        /^\/(?:learn|connect)\/build-[a-z0-9-]+\/$/.test(path(link)) && !/class-registration/.test(path(link)),
    }),
  },
  {
    source: wpSource('prosperus-detroit', {
      base: 'https://prosperusdetroit.org',
      collection: 'pages',
      organization: 'ProsperUS Detroit',
      city: 'Detroit',
      location: 'ProsperUS Detroit',
      sector: 'entrepreneurship',
      audiences: ['detroit_residents', 'immigrants', 'low_income'],
      keep: (link) =>
        /^\/(training|detroit-creative-futures|amanah|financial-coaching)\/$/.test(path(link)),
    }),
  },
  {
    source: wpSource('goodwill-detroit', {
      base: 'https://www.goodwilldetroit.org',
      collection: 'pages',
      organization: 'Goodwill Industries of Greater Detroit',
      city: 'Detroit',
      location: 'Goodwill Industries of Greater Detroit',
      sector: 'general_workforce',
      audiences: ['returning_citizens', 'low_income'],
      keep: (link) =>
        /^\/the-good-we-do\/(career-academy|flip-the-script|green-works|surge-center|a-place-of-our-own|supported-employment|life-skills)\/$/.test(
          path(link),
        ),
    }),
  },
  { source: detroitAtWorkSource() },
  { source: registrySource() },
];
