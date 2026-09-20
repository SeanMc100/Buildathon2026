// What counts as "Detroit" for wage and demand data.
//
// scripts/events/region.ts answers a different question — does this address sit
// in metro Detroit — and we reuse it for the curated entry routes. Statistical
// data is published by area code rather than by address, so that lives here.

import { metroCity } from '../events/region';

/** BLS/OMB code for the Detroit-Warren-Dearborn, MI metropolitan statistical area. */
export const DETROIT_MSA = '19820';

export const DETROIT_MSA_TITLE = 'Detroit-Warren-Dearborn, MI';

/** FIPS code for Michigan, used by the Projections Central state endpoint. */
export const MICHIGAN_FIPS = '26';

/** What goes in the snapshot header and on every card. */
export const REGION_LABEL = 'Detroit, MI';

/**
 * True when a curated sponsor's address is inside the launch region. Entry
 * routes with no city (a metro-wide sponsor, a statewide union) are kept.
 */
export function inRegion(city: string | null): boolean {
  return city === null || metroCity(city) !== null;
}

export { metroCity };
