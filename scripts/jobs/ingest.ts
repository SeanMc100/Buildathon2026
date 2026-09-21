// Builds the Detroit jobs catalog and writes it to data/jobs.json.
//
//   npm run ingest:jobs
//
// What this produces is occupations, not postings. "CNC machinist in metro
// Detroit, $48k-$72k, apprenticeship is a normal way in, the suppliers and the
// plants hire for it" keeps being true next month; "Machinist II at Acme,
// posted 3 days ago" does not, and a catalog of those would be stale before the
// demo. The smaller second half of the file is the other kind of item: standing
// apprenticeships and internships with a real front door.
//
// One source failing is reported and skipped. O*NET and BLS are both large
// cached downloads, so a re-run on the same day does no network work at all and
// produces byte-identical ids.

import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';

import { isReachable } from './cache';
import { buildEntryRoute, buildOccupation, type EnrichContext } from './enrich';
import { OUTPUT_PATH } from './paths';
import { inRegion, REGION_LABEL } from './region';
import { buildCandidates, demandRanks, indexOnetBySoc, missingRoles } from './select';
import { blsSource, careerOneStopSource, entryRoutesSource, onetSource, projectionsSource } from './sources';
import type {
  DetroitJobOpportunity,
  EntryRouteSeed,
  JobSource,
  LocalWages,
  OnetOccupation,
  SourceReport,
  StateOutlook,
} from './types';

/** How many O*NET Online links to spot-check. They share one url pattern, so a
 *  handful proves the pattern; every curated sponsor link is checked in full. */
const URL_SPOT_CHECKS = 8;

const reports: SourceReport[] = [];
const dropped: Array<{ title: string; source: string; reason: string }> = [];

/** Run one source, record what it returned, and never let it take the run down. */
async function run<T>(source: JobSource<T>, empty: T): Promise<T> {
  try {
    const rows = await source.fetch();
    const fetched = Array.isArray(rows) ? rows.length : 0;
    reports.push({ name: source.name, fetched, kept: 0 });
    return rows;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    reports.push({ name: source.name, fetched: 0, kept: 0, error: message });
    console.log(`✗ ${source.name}: ${message}`);
    return empty;
  }
}

const setKept = (name: string, kept: number) => {
  const report = reports.find((entry) => entry.name === name);
  if (report) report.kept = kept;
};

/**
 * If BLS is down we still know which occupations Michigan projects, so the run
 * degrades to a catalog with no wages rather than no catalog. Every item then
 * carries provenance 'none' for wages and the app can say so.
 */
function wagesFromOutlooks(outlooks: StateOutlook[]): LocalWages[] {
  return outlooks.map((outlook) => ({
    socCode: outlook.socCode,
    title: outlook.title,
    employment: null,
    locationQuotient: null,
    pct10: null,
    pct25: null,
    median: null,
    pct75: null,
    pct90: null,
    annualOnly: false,
    topCoded: false,
  }));
}

async function main() {
  const now = new Date();
  console.log(`Ingesting Detroit job data at ${now.toISOString()}\n`);

  const [onet, wages, outlooks, seeds, sponsorExtras] = await Promise.all([
    run<OnetOccupation[]>(onetSource, []),
    run<LocalWages[]>(blsSource, []),
    run<StateOutlook[]>(projectionsSource, []),
    run<EntryRouteSeed[]>(entryRoutesSource, []),
    run<EntryRouteSeed[]>(careerOneStopSource, []),
  ]);

  if (onet.length === 0) {
    console.log('\nO*NET produced nothing, so there are no match tags to build on. Stopping.');
    process.exitCode = 1;
    return;
  }

  const onetIndex = indexOnetBySoc(onet);
  const outlookIndex = new Map(outlooks.map((outlook) => [outlook.socCode, outlook]));

  // ---- Occupations ----------------------------------------------------------

  const wageRows = wages.length > 0 ? wages : wagesFromOutlooks(outlooks);
  if (wages.length === 0 && wageRows.length > 0) {
    console.log('⚠ No BLS wages this run; falling back to the projections list with no pay data.\n');
  }

  const candidates = buildCandidates(wageRows, onetIndex, outlookIndex);
  const ranks = demandRanks(candidates);
  const selected = candidates;

  const context: EnrichContext = {
    wageScale: selected
      .map((candidate) => candidate.wages.median)
      .filter((value): value is number => value !== null)
      .sort((a, b) => a - b),
    demandRanks: ranks,
    now,
  };

  const items: DetroitJobOpportunity[] = selected.map((candidate) =>
    buildOccupation(
      {
        occupation: candidate.occupation,
        wages: candidate.wages,
        outlook: candidate.outlook,
        sector: candidate.sector,
        viaRelatedSoc: candidate.viaRelatedSoc,
      },
      context,
    ),
  );
  setKept(onetSource.name, items.length);
  setKept(blsSource.name, wages.length === 0 ? 0 : items.filter((item) => item.detroit.wage !== null).length);
  setKept(projectionsSource.name, items.filter((item) => item.detroit.outlook !== null).length);

  for (const title of missingRoles(candidates)) {
    dropped.push({ title, source: 'select', reason: 'on the common-roles list but missing from BLS or O*NET this run' });
  }

  // ---- Entry routes ---------------------------------------------------------

  const routeSeeds = [...seeds, ...sponsorExtras];
  let routesKept = 0;
  let sponsorsKept = 0;

  for (const seed of routeSeeds) {
    const fromCareerOneStop = sponsorExtras.includes(seed);
    const label = fromCareerOneStop ? careerOneStopSource.name : entryRoutesSource.name;

    if (!inRegion(seed.city)) {
      dropped.push({ title: seed.title, source: label, reason: `outside metro Detroit (${seed.city ?? 'unknown'})` });
      continue;
    }
    // A front door nobody can open is worse than no listing at all.
    if (!(await isReachable(seed.url))) {
      dropped.push({ title: seed.title, source: label, reason: `url is not reachable (${seed.url})` });
      continue;
    }

    const socCode = seed.socCodes[0] ?? '';
    const entry = socCode ? onetIndex.get(socCode) : undefined;
    items.push(
      buildEntryRoute(
        {
          seed,
          occupation: entry?.occupation ?? null,
          wages: wageRows.find((row) => row.socCode === socCode) ?? null,
          outlook: outlookIndex.get(socCode) ?? null,
        },
        context,
      ),
    );
    routesKept += 1;
    if (fromCareerOneStop) sponsorsKept += 1;
  }
  setKept(entryRoutesSource.name, routesKept - sponsorsKept);
  setKept(careerOneStopSource.name, sponsorsKept);

  // ---- Spot-check the generated links ---------------------------------------

  const occupationLinks = items.filter((item) => item.id.startsWith('job-onet-'));
  const step = Math.max(1, Math.floor(occupationLinks.length / URL_SPOT_CHECKS));
  let deadLinks = 0;
  for (let i = 0; i < occupationLinks.length; i += step) {
    const item = occupationLinks[i];
    if (item && !(await isReachable(item.url))) {
      deadLinks += 1;
      console.log(`⚠ ${item.id} link did not answer: ${item.url}`);
    }
  }

  // ---- Write ----------------------------------------------------------------

  // Standing apprenticeships and internships first — they are the only items a
  // person can act on today — then occupations by local demand. Deterministic,
  // so re-running produces the same file when the data has not moved.
  items.sort((a, b) => {
    const actionable = Number(a.employmentType === 'FullTime') - Number(b.employmentType === 'FullTime');
    if (actionable !== 0) return actionable;
    const rank = (a.detroit.demandRank ?? Number.MAX_SAFE_INTEGER) - (b.detroit.demandRank ?? Number.MAX_SAFE_INTEGER);
    return rank !== 0 ? rank : a.id.localeCompare(b.id);
  });

  mkdirSync(dirname(OUTPUT_PATH), { recursive: true });
  writeFileSync(
    OUTPUT_PATH,
    `${JSON.stringify({ generatedAt: now.toISOString(), region: REGION_LABEL, sources: reports, items }, null, 2)}\n`,
  );

  // ---- Report ---------------------------------------------------------------

  console.log();
  for (const report of reports) {
    if (report.error) continue;
    console.log(`✓ ${report.name.padEnd(20)} ${String(report.fetched).padStart(5)} fetched, ${String(report.kept).padStart(4)} kept`);
  }

  const bySector = new Map<string, number>();
  const byType = new Map<string, number>();
  for (const item of items) {
    bySector.set(item.detroit.sector, (bySector.get(item.detroit.sector) ?? 0) + 1);
    byType.set(item.employmentType, (byType.get(item.employmentType) ?? 0) + 1);
  }

  console.log(`\nWrote ${items.length} items to ${OUTPUT_PATH}`);
  console.log(`  with Detroit wage data: ${items.filter((item) => item.detroit.wage !== null).length}`);
  console.log(`  with a Michigan outlook: ${items.filter((item) => item.detroit.outlook !== null).length}`);
  console.log(`  open at job zone 1-2:    ${items.filter((item) => (item.jobZone ?? 3) <= 2).length}`);
  console.log(`  employment type:         ${[...byType].map(([type, count]) => `${type} ${count}`).join(', ')}`);
  console.log('\nBy sector:');
  for (const [sector, count] of [...bySector].sort((a, b) => b[1] - a[1])) {
    console.log(`  ${sector.padEnd(32)} ${count}`);
  }

  if (deadLinks > 0) console.log(`\n⚠ ${deadLinks} of ${URL_SPOT_CHECKS} spot-checked O*NET links did not answer.`);
  if (dropped.length > 0) {
    console.log(`\nLeft out (${dropped.length}):`);
    for (const item of dropped) console.log(`  - [${item.source}] ${item.title.slice(0, 70)} — ${item.reason}`);
  }
  if (items.length === 0) process.exitCode = 1;
}

main();
