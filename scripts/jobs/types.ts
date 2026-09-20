// Shapes shared by the job ingestion scripts.
//
// The catalog item this pipeline emits is a JobOpportunity plus a `detroit`
// block. The shared model (src/models/opportunity.ts, owned by Sean) has no
// room for wage percentiles, local employment, growth outlook or entry routes,
// and this slice does not edit shared files — so the extra fields live in
// DetroitContext below. docs/job-sources.md lists them for promotion into the
// shared model.

import type { EducationLevel, JobOpportunity, JobZone, RiasecCode } from '../../src/models';

/** A named source, so one failing never stops the others. */
export type JobSource<T> = {
  name: string;
  /** What we fetch, shown in the run report. */
  endpoint: string;
  /** One line on what this source contributes. */
  role: string;
  fetch: () => Promise<T>;
};

export type SourceReport = { name: string; fetched: number; kept: number; error?: string };

// ---- What each source hands back --------------------------------------------

/** O*NET, per O*NET-SOC code. Everything here is measured, not keyword-guessed. */
export type OnetOccupation = {
  /** 8-digit O*NET-SOC, e.g. '51-4041.00'. */
  onetSocCode: string;
  /** 6-digit SOC, e.g. '51-4041'. The join key to BLS and the projections. */
  socCode: string;
  title: string;
  description: string;
  jobZone: JobZone | null;
  /** Top three RIASEC codes, ranked, from O*NET's own interest high-points. */
  hollandCode: RiasecCode[];
  /** 1-7 per dimension, O*NET Occupational Interests scale. */
  interestScores: Partial<Record<RiasecCode, number>>;
  /** Lowest education level a real share of incumbents reported. */
  minEducation: EducationLevel;
  /** Share of incumbents at each of the 12 education categories. */
  educationShares: Record<number, number>;
  /** Work Context elements, 1-5 means, keyed by element id. */
  context: Record<string, number>;
  /** Work Context "Work Schedules", share of incumbents per category 1-3. */
  scheduleShares: Record<number, number>;
  /** Work Context "Duration of Typical Work Week", share per category 1-3. */
  weekLengthShares: Record<number, number>;
  /** Work Activities importance, 1-5, keyed by element id. */
  activities: Record<string, number>;
  /** 'Job-related Apprenticeship' importance, 1-5. Null when not rated. */
  apprenticeshipImportance: number | null;
};

/** BLS OEWS, one row per SOC for the Detroit-Warren-Dearborn MSA. */
export type LocalWages = {
  socCode: string;
  title: string;
  /** Jobs in the metro. Null when BLS suppressed it. */
  employment: number | null;
  /** Concentration versus the national average. 1.0 = same as the US. */
  locationQuotient: number | null;
  /** Annual USD. Null where BLS suppressed or did not publish the percentile. */
  pct10: number | null;
  pct25: number | null;
  median: number | null;
  pct75: number | null;
  pct90: number | null;
  /** True when BLS reports this occupation annually only (wages are not hourly). */
  annualOnly: boolean;
  /** True when the top figure is BLS's '#' cap rather than a real number. */
  topCoded: boolean;
};

/** Projections Central, Michigan statewide long-term projections. */
export type StateOutlook = {
  socCode: string;
  title: string;
  baseYear: number;
  projectedYear: number;
  baseEmployment: number | null;
  projectedEmployment: number | null;
  percentChange: number | null;
  annualOpenings: number | null;
};

/** A hand-checked Detroit-area apprenticeship or internship with a real front door. */
export type EntryRouteSeed = {
  /** Stable slug used in the item id. */
  slug: string;
  title: string;
  organization: string;
  summary: string;
  url: string;
  /** City in metro Detroit, or null when the sponsor is metro-wide. */
  city: string | null;
  employmentType: 'Apprenticeship' | 'Internship';
  sector: string;
  /** SOC codes this route leads into. The first one supplies the match tags. */
  socCodes: string[];
  /** Plain-language front door, e.g. 'Apply through the union hall each spring'. */
  entryRoutes: string[];
  /** Employers or sponsors behind the route. */
  hiringHere: string[];
  /** Annual USD while training, when the sponsor publishes it. */
  payMinUsd: number | null;
  payMaxUsd: number | null;
  /** ISO date this link and its details were read by a person. */
  verifiedOn: string;
};

// ---- What this pipeline emits ------------------------------------------------

export type WageBand = {
  pct10: number | null;
  pct25: number | null;
  median: number | null;
  pct75: number | null;
  pct90: number | null;
};

export type GrowthOutlook = {
  /** The geography the projection covers. Statewide today; there is no MSA series. */
  area: string;
  baseYear: number;
  projectedYear: number;
  percentChange: number | null;
  annualOpenings: number | null;
};

/**
 * Everything this pipeline knows that JobOpportunity has no field for.
 * Sean promotes these into src/models/opportunity.ts; until then they ride here.
 */
export type DetroitContext = {
  /** 6-digit SOC. The join key across every source in this pipeline. */
  socCode: string;
  /** 8-digit O*NET-SOC the match tags came from. Null for curated entry routes. */
  onetSocCode: string | null;
  /** Plain-language sector, e.g. 'Skilled trades'. See scripts/jobs/sectors.ts. */
  sector: string;
  /** Jobs in the Detroit metro. Null when BLS suppressed the cell. */
  localEmployment: number | null;
  /** How concentrated the work is here versus the US. 1.0 = the national rate. */
  locationQuotient: number | null;
  /** Annual USD percentiles for the Detroit metro. Null when BLS published none. */
  wage: WageBand | null;
  /** Which release the wages came from, so a stale snapshot is obvious. */
  wageVintage: string | null;
  /** True when the top of the band is BLS's '#' cap (>= $239,200), not a number. */
  wageTopCoded: boolean;
  outlook: GrowthOutlook | null;
  /** How someone actually gets in, front door first. */
  entryRoutes: string[];
  /** Who employs this work in the Detroit metro. */
  hiringHere: string[];
  /** 1 = highest local demand in this snapshot. */
  demandRank: number | null;
  /** Where every soft number came from, so nothing looks more certain than it is. */
  provenance: {
    wages: 'bls-oews-detroit-msa' | 'sponsor-published' | 'none';
    tags: 'onet-measured' | 'onet-measured-via-related-soc' | 'none';
    outlook: 'projections-central-michigan' | 'none';
    hiringHere: 'curated-by-sector' | 'curated-by-sponsor';
  };
};

export type DetroitJobOpportunity = JobOpportunity & { detroit: DetroitContext };
