import { matchOpportunities } from '../src/matching/opportunities';
import { buildProfile } from '../src/matching/scoring';
import { CATALOG, INGEST_RUNS } from '../src/content/catalog';
import type { AnswerMap, OpportunityKind } from '../src/models';

const KINDS: OpportunityKind[] = ['job', 'program', 'event', 'research'];
const byKind = (k: OpportunityKind) => CATALOG.filter((o) => o.kind === k).length;
console.log('catalog:', KINDS.map((k) => `${k} ${byKind(k)}`).join(' · '), '=', CATALOG.length);
console.log('samples remaining:', CATALOG.filter((o) => o.isSample).length, '\n');

const PERSONAS: Array<{ name: string; answers: AnswerMap }> = [
  { name: 'No diploma, needs pay + stability', answers: { stage: 'first_role', education: 'secondary', interest_pull: ['R', 'C'], priority_budget: { pay_and_security: 50, people_and_team: 20, growth_and_learning: 20, flexibility_and_balance: 10 }, arrangement: ['Onsite', 'Hybrid'] } },
  { name: 'Career changer into healthcare', answers: { stage: 'pivot', education: 'certificate', interest_pull: ['S', 'I'], priority_budget: { mission_and_impact: 40, growth_and_learning: 30, people_and_team: 20, pay_and_security: 10 }, arrangement: ['Onsite', 'Hybrid', 'Remote'] } },
  { name: 'Curious student, research-leaning', answers: { stage: 'first_role', education: 'bachelor', interest_pull: ['I', 'A'], priority_budget: { growth_and_learning: 45, mission_and_impact: 25, people_and_team: 20, pay_and_security: 10 }, arrangement: ['Onsite', 'Hybrid', 'Remote'] } },
];

for (const persona of PERSONAS) {
  const results = matchOpportunities(buildProfile(persona.answers), CATALOG);
  console.log(`■ ${persona.name}`);
  for (const kind of KINDS) {
    const top = results.byKind[kind]?.[0];
    const n = results.byKind[kind]?.length ?? 0;
    const title = top ? CATALOG.find((o) => o.id === top.opportunityId)?.title ?? '?' : '— nothing passed constraints';
    console.log(`   ${kind.padEnd(9)} ${String(n).padStart(3)} matched  ${top ? String(top.matchScore).padStart(3) : '   '}  ${title.slice(0, 58)}`);
  }
  if (results.unmetConstraints.length) console.log(`   unmet: ${results.unmetConstraints.join('; ')}`);
  console.log();
}
console.log('pulled:', KINDS.map((k) => `${k} ${INGEST_RUNS[k].pulledAt?.slice(0, 10) ?? 'never'}`).join(' · '));
