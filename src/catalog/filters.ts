// Querying the catalog: search, filter and sort, independent of scoring.
// Sean owns this folder.
//
// The matching slice decides how well something fits a person. This decides
// what is on screen at all. Keeping them apart means the same filters work
// before the questionnaire has been answered, when there is nothing to rank by.

import type { Opportunity } from '../models';
import type { BrowseKind } from '../navigation/types';

export type MoneyFilter = 'any' | 'paid' | 'free';
export type FitFilter = 'any' | 'fits';
export type EntryFilter = 'any' | 'no_degree';
export type SortMode = 'match' | 'az' | 'pay';

export type BrowseFilters = {
  /** Free text, matched against the title, organisation, summary and place. */
  query: string;
  kind: BrowseKind;
  /** `paid` means it pays you; `free` means it costs you nothing to take part. */
  money: MoneyFilter;
  entry: EntryFilter;
  /** `fits` hides anything that clashes with a deal-breaker from the questionnaire. */
  fit: FitFilter;
  sort: SortMode;
};

export const DEFAULT_FILTERS: BrowseFilters = {
  query: '',
  kind: 'all',
  money: 'any',
  entry: 'any',
  fit: 'any',
  sort: 'match',
};

/**
 * An internship or apprenticeship: an employer's or union's own way in, not a
 * kind of work. They are jobs in the data (they have pay, a place and an
 * employer) but they are listed and recommended apart from the occupations.
 */
export function isEntryRoute(item: Opportunity): boolean {
  return item.kind === 'job' && (item.employmentType === 'Internship' || item.employmentType === 'Apprenticeship');
}

/** Which browse list a catalog item belongs on. Internships and apprenticeships are carved out of the jobs. */
export function belongsToKind(kind: BrowseKind, item: Opportunity): boolean {
  // Events and mentorships each have their own page, so the mixed list skips them.
  if (kind === 'all') return item.kind !== 'event' && item.kind !== 'mentorship';
  if (kind === 'internship') return isEntryRoute(item);
  if (kind === 'job') return item.kind === 'job' && !isEntryRoute(item);
  return item.kind === kind;
}

/** Everything a free-text search should look at, lowercased once per item. */
function haystack(item: Opportunity): string {
  const extra: string[] = [];
  if (item.kind === 'research') extra.push(item.field);
  if (item.kind === 'mentorship') extra.push(item.format, ...item.eligibility);
  if (item.kind === 'job') extra.push(item.employmentType, item.detroit?.sector ?? '');
  if (item.kind === 'program') extra.push(...(item.program?.credentials ?? []));
  return [item.title, item.organization, item.summary, item.location ?? '', ...extra]
    .join(' ')
    .toLowerCase();
}

/** Every word in the query has to appear somewhere, in any order. */
function matchesQuery(item: Opportunity, query: string): boolean {
  const terms = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  if (terms.length === 0) return true;
  const text = haystack(item);
  return terms.every((term) => text.includes(term));
}

/** True when the opportunity puts money in your pocket rather than taking it. */
export function isPaid(item: Opportunity): boolean {
  switch (item.kind) {
    case 'job':
      return item.payMinUsd !== null || item.payMaxUsd !== null;
    case 'program':
      return (item.stipendUsd ?? 0) > 0;
    case 'research':
      return (item.stipendUsd ?? 0) > 0;
    case 'event':
    case 'mentorship':
      return false;
  }
}

/** True when taking part costs nothing. A job never costs you anything. */
export function isFree(item: Opportunity): boolean {
  switch (item.kind) {
    case 'job':
      return true;
    case 'program':
    case 'event':
    case 'mentorship':
      return item.costUsd === 0 || item.costUsd === null;
    case 'research':
      return true;
  }
}

/** True when no degree is asked for. */
export function isOpenEntry(item: Opportunity): boolean {
  return item.minEducation === 'none_required' || item.minEducation === 'secondary';
}

/** The top of an item's pay range, for sorting. Items with no figure sort last. */
function payCeiling(item: Opportunity): number {
  if (item.kind === 'job') return item.payMaxUsd ?? item.payMinUsd ?? -1;
  if (item.kind === 'program' || item.kind === 'research') return item.stipendUsd ?? -1;
  return -1;
}

/**
 * `scored` is whether the matcher gave this item a score, which it only does
 * for items that clear the profile's hard constraints. Browse shows everything
 * either way; this filter is how someone chooses to narrow to what fits.
 */
export function matchesFilters(
  item: Opportunity,
  filters: BrowseFilters,
  scored = true,
): boolean {
  // Mentorships are listed by audience and never scored, so the fit filter does not apply.
  if (filters.fit === 'fits' && !scored && item.kind !== 'mentorship') return false;
  if (!belongsToKind(filters.kind, item)) return false;
  if (filters.money === 'paid' && !isPaid(item)) return false;
  if (filters.money === 'free' && !isFree(item)) return false;
  if (filters.entry === 'no_degree' && !isOpenEntry(item)) return false;
  return matchesQuery(item, filters.query);
}

/**
 * Sorts in place on a copy. `match` keeps whatever order the caller supplied,
 * which is the matcher's ranking when there is a profile and the catalog's own
 * order when there is not.
 */
export function sortRows<T extends { item: Opportunity }>(rows: T[], sort: SortMode): T[] {
  if (sort === 'match') return rows;
  const sorted = [...rows];
  if (sort === 'az') {
    sorted.sort((a, b) => a.item.title.localeCompare(b.item.title));
  } else {
    sorted.sort((a, b) => payCeiling(b.item) - payCeiling(a.item));
  }
  return sorted;
}

/** How many filters are doing something, for the "clear" affordance. */
export function activeFilterCount(filters: BrowseFilters): number {
  let count = 0;
  if (filters.query.trim()) count += 1;
  if (filters.kind !== 'all') count += 1;
  if (filters.money !== 'any') count += 1;
  if (filters.entry !== 'any') count += 1;
  if (filters.fit !== 'any') count += 1;
  return count;
}
