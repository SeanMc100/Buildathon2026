// Pulls events from every source, keeps the Detroit-area ones that matter for a
// career, and writes them to data/events.json.
//
//   npm run ingest:events
//
// One source failing is reported and skipped; it never blocks the others.

import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';

import type { EventOpportunity } from '../../src/models';
import { assessEvent } from './enrich';
import { OUTPUT_PATH } from './paths';
import { SOURCES } from './sources';
import type { RawEvent } from './types';

/** Metro Detroit, as the cities the launch region should include. */
const METRO =
  /\b(Detroit|Dearborn|Ann Arbor|Southfield|Royal Oak|Ferndale|Hamtramck|Highland Park|Warren|Troy|Livonia|Pontiac|Farmington|Sterling Heights|Birmingham|Novi|Ypsilanti|Auburn Hills|Madison Heights|Oak Park|Taylor|Wayne)\b/i;

function inRegion(event: RawEvent): boolean {
  return event.isOnline || METRO.test(event.city ?? '');
}

function dedupeKey(event: RawEvent): string {
  const title = event.title.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
  return `${title}|${event.startsAt.slice(0, 10)}`;
}

async function main() {
  const now = new Date();
  const seen = new Set<string>();
  const kept: EventOpportunity[] = [];
  const dropped: Array<{ title: string; reason: string }> = [];

  console.log(`Ingesting events at ${now.toISOString()}\n`);

  for (const source of SOURCES) {
    let raw: RawEvent[];
    try {
      raw = await source.fetch();
    } catch (error) {
      console.log(`✗ ${source.name}: ${error instanceof Error ? error.message : String(error)}`);
      continue;
    }

    let accepted = 0;
    for (const event of raw) {
      if (!inRegion(event)) {
        dropped.push({ title: event.title, reason: `outside metro Detroit (${event.city ?? 'unknown'})` });
        continue;
      }
      const key = dedupeKey(event);
      if (seen.has(key)) {
        dropped.push({ title: event.title, reason: 'duplicate of an event from another source' });
        continue;
      }

      const result = assessEvent(event, now);
      if (!result.keep) {
        dropped.push({ title: event.title, reason: result.reason });
        continue;
      }

      seen.add(key);
      kept.push(result.opportunity);
      accepted += 1;
    }
    console.log(`✓ ${source.name}: ${raw.length} fetched, ${accepted} kept`);
  }

  kept.sort((a, b) => Date.parse(a.startsAt) - Date.parse(b.startsAt));

  // A recurring series (a monthly meetup) is one opportunity, not one per date.
  // Keep the soonest occurrence; the next run picks up the following one.
  const seriesSeen = new Set<string>();
  const upcoming = kept.filter((event) => {
    const series = `${event.organization}|${event.title.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()}`;
    if (seriesSeen.has(series)) {
      dropped.push({ title: event.title, reason: `later date of a recurring event (${event.startsAt.slice(0, 10)})` });
      return false;
    }
    seriesSeen.add(series);
    return true;
  });

  mkdirSync(dirname(OUTPUT_PATH), { recursive: true });
  writeFileSync(
    OUTPUT_PATH,
    `${JSON.stringify({ generatedAt: now.toISOString(), region: 'Detroit, MI', events: upcoming }, null, 2)}\n`,
  );

  console.log(`\nWrote ${upcoming.length} events to ${OUTPUT_PATH}`);
  if (dropped.length > 0) {
    console.log(`\nLeft out (${dropped.length}):`);
    for (const item of dropped) console.log(`  - ${item.title.slice(0, 64)} — ${item.reason}`);
  }
  if (upcoming.length === 0) process.exitCode = 1;
}

main();
