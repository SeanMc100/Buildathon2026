// Which occupations make the catalog.
//
// BLS publishes about 700 detailed occupations for the Detroit metro. All 700
// would drown the app, and any cut by headcount or pay surfaces the wrong
// things: the top by pay is a list of doctors and executives, and the top by
// demand still lets in Allergists and Regulatory Affairs Managers. So the cut is
// editorial: `COMMON_ROLES` names the roles a person would recognise, and only
// those are kept. Local demand then orders them (`demandRank`), it does not
// decide whether they exist.
//
// The list spans every sector and every level of preparation on purpose, so a
// person with no diploma and a person with a graduate degree both open the app
// to roles they have heard of.

import { COMMON_ROLES } from './common-roles';
import { sectorFor } from './sectors';
import type { LocalWages, OnetOccupation, StateOutlook } from './types';

/** Below this many jobs in the metro, even a common role is not really a local option. */
const MIN_LOCAL_EMPLOYMENT = 300;


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
    (row) =>
      (row.employment ?? 0) >= MIN_LOCAL_EMPLOYMENT &&
      onetIndex.has(row.socCode) &&
      row.socCode !== '00-0000' &&
      row.socCode in COMMON_ROLES,
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

/** Roles on the common list that the sources did not produce this run, so a drop is noticed. */
export function missingRoles(candidates: Candidate[]): string[] {
  const found = new Set(candidates.map((candidate) => candidate.socCode));
  return Object.entries(COMMON_ROLES)
    .filter(([socCode]) => !found.has(socCode))
    .map(([socCode, title]) => `${title} (${socCode})`);
}
