// Proof that ingested events reach the matcher and rank differently for
// different people. Runs the real scoring code against data/events.json.
//
//   npm run ingest:events && npm run verify:events

import { readFileSync } from 'node:fs';

import { matchOpportunities, rankKind } from '../../src/matching/opportunities';
import { buildProfile } from '../../src/matching/scoring';
import type { AnswerMap, EventOpportunity } from '../../src/models';
import { OUTPUT_PATH } from './paths';

type Persona = { name: string; answers: AnswerMap };

const PERSONAS: Persona[] = [
  {
    name: 'Early-career builder (wants to learn, meet people)',
    answers: {
      stage: 'first_role',
      education: 'bachelor',
      interest_pull: ['I', 'R', 'E'],
      priority_budget: {
        growth_and_learning: 40,
        people_and_team: 30,
        mission_and_impact: 10,
        pay_and_security: 10,
        flexibility_and_balance: 10,
      },
      arrangement: ['Remote', 'Hybrid', 'Onsite'],
    },
  },
  {
    name: 'Career changer (mission-driven, values flexibility)',
    answers: {
      stage: 'pivot',
      education: 'certificate',
      interest_pull: ['S', 'A'],
      priority_budget: {
        mission_and_impact: 40,
        flexibility_and_balance: 35,
        people_and_team: 15,
        growth_and_learning: 5,
        pay_and_security: 5,
      },
      arrangement: ['Remote', 'Hybrid', 'Onsite'],
    },
  },
  {
    name: 'Would-be founder (pay and connections)',
    answers: {
      stage: 'early',
      education: 'associate',
      interest_pull: ['E', 'C'],
      priority_budget: {
        pay_and_security: 40,
        people_and_team: 30,
        growth_and_learning: 20,
        mission_and_impact: 5,
        flexibility_and_balance: 5,
      },
      arrangement: ['Hybrid', 'Onsite'],
    },
  },
];

function main() {
  const { generatedAt, events } = JSON.parse(readFileSync(OUTPUT_PATH, 'utf8')) as {
    generatedAt: string;
    events: EventOpportunity[];
  };
  const now = new Date();
  const byId = new Map(events.map((event) => [event.id, event]));

  console.log(`${events.length} ingested events (pulled ${generatedAt})\n`);

  const rankings: Record<string, string[]> = {};

  for (const persona of PERSONAS) {
    const profile = buildProfile(persona.answers);
    // The same two calls the app makes: the top section, and the full listing.
    const top = matchOpportunities(profile, events, now).byKind.event;
    const all = rankKind('event', profile, events, now);

    rankings[persona.name] = top.map((match) => match.opportunityId);

    console.log(`■ ${persona.name}`);
    console.log(`  interests ${profile.interests.hollandCode.join('') || '—'} · top ${top.length} of ${all.length} events (one per recurring series)`);
    for (const match of top) {
      const event = byId.get(match.opportunityId)!;
      console.log(`  ${String(match.matchScore).padStart(3)}  ${event.startsAt.slice(5, 10)}  ${event.title.slice(0, 50).padEnd(50)}  ${match.whyItFits[0] ?? ''}`);
    }
    console.log('');
  }

  // The claim being tested: different people get meaningfully different top lists.
  const lists = Object.values(rankings);
  const firstPlaces = new Set(lists.map((list) => list[0]));
  console.log(`Distinct #1 picks across ${lists.length} personas: ${firstPlaces.size}`);
  if (firstPlaces.size < 2) {
    console.log('Warning: every persona got the same top event, so the tags are not discriminating.');
    process.exitCode = 1;
  }
}

main();
