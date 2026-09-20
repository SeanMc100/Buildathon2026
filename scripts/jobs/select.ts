// Which occupations make the catalog.
//
// BLS publishes about 700 detailed occupations for the Detroit metro. All 700
// would drown the app, and the top 150 by pay would be a list of doctors and
// executives — useless to most of the people this is for. So the cut is made
// per sector, with a quota each (scripts/jobs/sectors.ts), and inside a sector
// by local demand: how many of these jobs exist here, how many open up each
// year, and how concentrated the work is in Detroit compared with the country.
//
// Two guardrails on top of that: every sector that a user might be coming from
// keeps a place even if it is small, and a floor of low-barrier occupations is
// held back so a person with no diploma never opens the app to a wall of
// bachelor's degrees.

import { SECTOR_QUOTAS, sectorFor } from './sectors';
import type { LocalWages, OnetOccupation, StateOutlook } from './types';

/** Below this many jobs in the metro, an occupation is not really a local option. */
const MIN_LOCAL_EMPLOYMENT = 300;

/** At least this many of the kept occupations must be open at job zone 1 or 2. */
const LOW_BARRIER_FLOOR = 45;

export type Candidate = {
  socCode: string;
  occupation: OnetOccupation;
  wages: LocalWages;
  outlook: StateOutlook | null;
  sector: string;
  /** Tags came from a sibling O*NET-SOC because the SOC has no .00 detail row. */
  viaRelatedSoc: boolean;
  /** 0-1, blended local demand. Sets demandRank and the order inside a sector. */
  demandScore: number;
};

/**
 * One O*NET record per 6-digit SOC.
 *
 * O*NET splits some SOCs into several detailed occupations (15-1252 Software
 * Developers is one code in BLS and several in O*NET). BLS prices the SOC, so
 * the SOC is the unit here; the `.00` record describes it when there is one,
 * and otherwise the lowest-numbered sibling stands in, flagged.
 */
export function indexOnetBySoc(occupations: OnetOccupation[]): Map<string, { occupation: OnetOccupation; viaRelatedSoc: boolean }> {
  const bySoc = new Map<string, OnetOccupation[]>();
  for (const occupation of occupations) {
    const list = bySoc.get(occupation.socCode);
    if (list) list.push(occupation);
    else bySoc.set(occupation.socCode, [occupation]);
  }

  const index = new Map<string, { occupation: OnetOccupation; viaRelatedSoc: boolean }>();
  for (const [socCode, list] of bySoc) {
    const exact = list.find((entry) => entry.onetSocCode.endsWith('.00'));
    const sorted = [...list].sort((a, b) => a.onetSocCode.localeCompare(b.onetSocCode));
    const chosen = exact ?? sorted[0];
    if (chosen) index.set(socCode, { occupation: chosen, viaRelatedSoc: exact === undefined });
  }
  return index;
}

/** Rank-normalise a list of numbers to 0-1, so one huge value cannot dominate. */
function rankScores(values: Array<number | null>): number[] {
  const ordered = values
    .map((value, index) => ({ value: value ?? -1, index }))
    .sort((a, b) => a.value - b.value);
  const scores = new Array<number>(values.length).fill(0);
  ordered.forEach((entry, position) => {
    scores[entry.index] = values.length === 1 ? 1 : position / (values.length - 1);
  });
  return scores;
}

export function buildCandidates(
  wages: LocalWages[],
  onetIndex: Map<string, { occupation: OnetOccupation; viaRelatedSoc: boolean }>,
  outlooks: Map<string, StateOutlook>,
): Candidate[] {
  const eligible = wages.filter(
    (row) => (row.employment ?? 0) >= MIN_LOCAL_EMPLOYMENT && onetIndex.has(row.socCode) && row.socCode !== '00-0000',
  );

  const employmentScores = rankScores(eligible.map((row) => row.employment));
  const openingScores = rankScores(eligible.map((row) => outlooks.get(row.socCode)?.annualOpenings ?? null));
  const quotientScores = rankScores(eligible.map((row) => row.locationQuotient));

  return eligible.map((row, index) => {
    const entry = onetIndex.get(row.socCode);
    if (!entry) throw new Error(`no O*NET record for ${row.socCode}`); // unreachable: filtered above
    return {
      socCode: row.socCode,
      occupation: entry.occupation,
      wages: row,
      outlook: outlooks.get(row.socCode) ?? null,
      sector: sectorFor(row.socCode),
      viaRelatedSoc: entry.viaRelatedSoc,
      demandScore:
        0.55 * (employmentScores[index] ?? 0) + 0.3 * (openingScores[index] ?? 0) + 0.15 * (quotientScores[index] ?? 0),
    };
  });
}

/** 1 = strongest local demand, across every candidate rather than per sector. */
export function demandRanks(candidates: Candidate[]): Map<string, number> {
  const ranks = new Map<string, number>();
  [...candidates]
    .sort((a, b) => b.demandScore - a.demandScore)
    .forEach((candidate, index) => ranks.set(candidate.socCode, index + 1));
  return ranks;
}

export type Selection = { kept: Candidate[]; droppedBySector: Map<string, number> };

export function selectCandidates(candidates: Candidate[]): Selection {
  const bySector = new Map<string, Candidate[]>();
  for (const candidate of candidates) {
    const list = bySector.get(candidate.sector);
    if (list) list.push(candidate);
    else bySector.set(candidate.sector, [candidate]);
  }

  const kept: Candidate[] = [];
  const droppedBySector = new Map<string, number>();
  const taken = new Set<string>();

  for (const [sector, list] of bySector) {
    const quota = SECTOR_QUOTAS[sector] ?? 3;
    const ordered = [...list].sort((a, b) => b.demandScore - a.demandScore);
    for (const candidate of ordered.slice(0, quota)) {
      kept.push(candidate);
      taken.add(candidate.socCode);
    }
    droppedBySector.set(sector, Math.max(0, list.length - quota));
  }

  // Top up the low-barrier end. The quotas are set by sector, not by job zone,
  // so a run where every sector's busiest occupations happen to need a degree
  // would leave a first-jobber with nothing. Fill from the strongest remaining
  // job-zone-1-and-2 occupations until the floor is met.
  const lowBarrier = (candidate: Candidate) => (candidate.occupation.jobZone ?? 3) <= 2;
  let lowBarrierCount = kept.filter(lowBarrier).length;
  if (lowBarrierCount < LOW_BARRIER_FLOOR) {
    const spare = candidates
      .filter((candidate) => !taken.has(candidate.socCode) && lowBarrier(candidate))
      .sort((a, b) => b.demandScore - a.demandScore);
    for (const candidate of spare) {
      if (lowBarrierCount >= LOW_BARRIER_FLOOR) break;
      kept.push(candidate);
      taken.add(candidate.socCode);
      lowBarrierCount += 1;
      droppedBySector.set(candidate.sector, Math.max(0, (droppedBySector.get(candidate.sector) ?? 0) - 1));
    }
  }

  return { kept, droppedBySector };
}
