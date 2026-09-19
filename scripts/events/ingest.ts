// Pulls events from every source and writes the Detroit-area ones to
// data/events.json. Nothing is filtered for relevance: every event that has not
// ended is kept, and the matcher decides what to put first.
//
//   npm run ingest:events
//
// One source failing is reported and skipped; it never blocks the others.

import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';

import type { EventOpportunity } from '../../src/models';
import { assessEvent } from './enrich';
import { OUTPUT_PATH } from './paths';
import { metroCity } from './region';
import { SOURCES } from './sources';
import type { RawEvent } from './types';

function inRegion(event: RawEvent, localOrganizer: boolean): boolean {
  if (event.isOnline || metroCity(event.city) !== null) return true;
  // No address at all: trust a Detroit-based organiser, but not an unknown one.
  return localOrganizer && !event.city;
}

/** The same event listed by two sources (a Luma page and the organiser's own feed). */
function dedupeKey(event: RawEvent): string {
  const title = event.title.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
  return `${title}|${event.startsAt.slice(0, 10)}`;
}

type SourceReport = { name: string; fetched: number; kept: number; error?: string };

async function main() {
  const now = new Date();
  const seen = new Set<string>();
  const kept: EventOpportunity[] = [];
  const reports: SourceReport[] = [];
  const dropped: Array<{ title: string; source: string; reason: string }> = [];
  let careerRelevant = 0;

  console.log(`Ingesting events at ${now.toISOString()}\n`);

  for (const { source, mayBeEmpty, localOrganizer = false } of SOURCES) {
    let raw: RawEvent[];
    try {
      raw = await source.fetch();
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      reports.push({ name: source.name, fetched: 0, kept: 0, error: message });
      console.log(`✗ ${source.name}: ${message}`);
      continue;
    }

    let accepted = 0;
    for (const event of raw) {
      const drop = (reason: string) => dropped.push({ title: event.title, source: source.name, reason });

      if (!inRegion(event, localOrganizer)) {
        drop(`outside metro Detroit (${event.city ?? 'unknown'})`);
        continue;
      }
      const key = dedupeKey(event);
      if (seen.has(key)) {
        drop('same event already listed by another source');
        continue;
      }
      const result = assessEvent(event, now);
      if (!result.keep) {
        drop(result.reason);
        continue;
      }

      seen.add(key);
      kept.push(result.opportunity);
      if (result.careerRelevant) careerRelevant += 1;
      accepted += 1;
    }

    reports.push({ name: source.name, fetched: raw.length, kept: accepted });
    // A source that normally has events and now has none has probably changed shape.
    const flag = raw.length === 0 && !mayBeEmpty ? '  ⚠ returned nothing; has the feed changed?' : '';
    console.log(`✓ ${source.name.padEnd(28)} ${String(raw.length).padStart(3)} fetched, ${String(accepted).padStart(3)} kept${flag}`);
  }

  kept.sort((a, b) => Date.parse(a.startsAt) - Date.parse(b.startsAt));

  mkdirSync(dirname(OUTPUT_PATH), { recursive: true });
  writeFileSync(
    OUTPUT_PATH,
    `${JSON.stringify({ generatedAt: now.toISOString(), region: 'Detroit, MI', sources: reports, events: kept }, null, 2)}\n`,
  );

  console.log(`\nWrote ${kept.length} events (${careerRelevant} career-relevant) to ${OUTPUT_PATH}`);
  if (dropped.length > 0) {
    console.log(`\nLeft out (${dropped.length}):`);
    for (const item of dropped) console.log(`  - [${item.source}] ${item.title.slice(0, 60)} — ${item.reason}`);
  }
  if (kept.length === 0) process.exitCode = 1;
}

main();
