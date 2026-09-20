// Pulls research opportunities from every source and writes the Detroit-area
// ones to data/research.json, which the app loads.
//
//   npm run ingest:research
//
// One source failing is reported and skipped; it never blocks the others. The
// run is idempotent: ids are a hash of source and source id, items come out in
// a stable order, and re-running over an unchanged web produces the same file
// apart from the timestamps.
//
// Two things are deliberately kept rather than dropped:
//   - a programme whose deadline has passed but which runs again next year, and
//   - a page on a host that refuses automated requests.
// Both are flagged instead, so the app can decide and a human can check.

import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';

import { metroCity } from '../events/region';
import { assessResearch } from './enrich';
import { classify, get, isSoft404 } from './http';
import { OUTPUT_PATH } from './paths';
import { AUDITS, SOURCES } from './sources';
import type { RawResearch, ResearchItem, SourceReport, UrlStatus } from './types';

/**
 * Remote items and nationwide fellowships have no city and are kept. Anything
 * with a city must have a metro one.
 */
function inRegion(raw: RawResearch): boolean {
  if (raw.isOnline || raw.city === null) return true;
  return metroCity(raw.city) !== null;
}

/** The same programme reached two ways, e.g. a registry page and its NSF award. */
function dedupeKey(raw: RawResearch): string {
  const title = raw.title
    .toLowerCase()
    .replace(/^(?:center:\s*)?reu site:\s*/, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
  return `${raw.research.institution.toLowerCase().slice(0, 24)}|${title}`;
}

async function checkUrl(raw: RawResearch): Promise<UrlStatus> {
  if (raw.urlStatusHint) return raw.urlStatusHint;
  try {
    const response = await get(raw.url);
    const status = classify(response);
    return status === 'ok' && isSoft404(response.body) ? 'dead' : status;
  } catch {
    return 'dead';
  }
}

async function main() {
  const now = new Date();
  const seen = new Set<string>();
  const kept: ResearchItem[] = [];
  const reports: SourceReport[] = [];
  const dropped: Array<{ title: string; source: string; reason: string }> = [];

  console.log(`Ingesting research opportunities at ${now.toISOString()}\n`);

  for (const { source, mayBeEmpty } of SOURCES) {
    let raws: RawResearch[];
    try {
      raws = await source.fetch();
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      reports.push({ name: source.name, fetched: 0, kept: 0, error: message });
      console.log(`✗ ${source.name}: ${message}`);
      continue;
    }

    let accepted = 0;
    for (const raw of raws) {
      const drop = (reason: string) => dropped.push({ title: raw.title, source: source.name, reason });

      if (!inRegion(raw)) {
        drop(`outside metro Detroit (${raw.city ?? 'unknown'})`);
        continue;
      }
      const key = dedupeKey(raw);
      if (seen.has(key)) {
        drop('already listed from another source');
        continue;
      }

      const result = assessResearch(raw, now, await checkUrl(raw));
      if (!result.keep) {
        drop(result.reason);
        continue;
      }

      seen.add(key);
      kept.push(result.item);
      accepted += 1;
    }

    reports.push({ name: source.name, fetched: raws.length, kept: accepted });
    const flag = raws.length === 0 && !mayBeEmpty ? '  ⚠ returned nothing; has the source changed shape?' : '';
    console.log(`✓ ${source.name.padEnd(24)} ${String(raws.length).padStart(3)} fetched, ${String(accepted).padStart(3)} kept${flag}`);
  }

  // Coverage audits. These contribute no items on purpose: an award is money to
  // an institution, not an opening. They answer "is the registry still a fair
  // picture of research in this region?"
  for (const audit of AUDITS) {
    try {
      const { checked, lines } = await audit.run();
      reports.push({ name: audit.name, fetched: checked, kept: 0 });
      console.log(`\n${audit.name} (${checked} checked, coverage only):`);
      for (const line of lines) console.log(line);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      reports.push({ name: audit.name, fetched: 0, kept: 0, error: message });
      console.log(`✗ ${audit.name}: ${message}`);
    }
  }

  // Stable order: soonest deadline first, then everything without one, by id.
  kept.sort((a, b) => {
    const left = a.applyBy === null ? Number.POSITIVE_INFINITY : Date.parse(a.applyBy);
    const right = b.applyBy === null ? Number.POSITIVE_INFINITY : Date.parse(b.applyBy);
    return left === right ? a.id.localeCompare(b.id) : left - right;
  });

  mkdirSync(dirname(OUTPUT_PATH), { recursive: true });
  writeFileSync(
    OUTPUT_PATH,
    `${JSON.stringify({ generatedAt: now.toISOString(), region: 'Detroit, MI', sources: reports, items: kept }, null, 2)}\n`,
  );

  // ---- What the run found ----------------------------------------------------
  const paid = kept.filter((item) => item.research.isPaid === true).length;
  const noDegree = kept.filter((item) => item.research.lowBarrier).length;
  const community = kept.filter((item) => item.research.communityBased).length;
  const blocked = kept.filter((item) => item.research.urlStatus === 'blocked');
  const passed = kept.filter((item) => item.research.deadlinePassed);
  const drifted = kept.filter((item) => item.research.driftNotes.length > 0);

  console.log(`\nWrote ${kept.length} research opportunities to ${OUTPUT_PATH}`);
  console.log(`  paid: ${paid}   open without a degree: ${noDegree}   community-based: ${community}`);
  console.log(`  deadline passed but recurring: ${passed.length}   host blocked our request: ${blocked.length}`);

  if (passed.length > 0) {
    console.log(`\nRecurring, current deadline gone (kept and flagged):`);
    for (const item of passed) console.log(`  - ${item.title.slice(0, 70)} — was ${item.applyBy}`);
  }
  if (blocked.length > 0) {
    console.log(`\nCould not read the page this run (kept, facts left null):`);
    for (const item of blocked) console.log(`  - ${item.title.slice(0, 70)} — ${item.url}`);
  }
  if (drifted.length > 0) {
    console.log(`\nChanged since the registry was written (${drifted.length}):`);
    for (const item of drifted) {
      for (const note of item.research.driftNotes) console.log(`  - [${item.research.institution.slice(0, 22)}] ${item.title.slice(0, 44)}: ${note}`);
    }
  }
  if (dropped.length > 0) {
    console.log(`\nLeft out (${dropped.length}):`);
    for (const item of dropped) console.log(`  - [${item.source}] ${item.title.slice(0, 60)} — ${item.reason}`);
  }

  if (kept.length === 0) process.exitCode = 1;
}

main();
