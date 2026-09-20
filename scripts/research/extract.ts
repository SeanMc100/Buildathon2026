// Reading numbers and dates back off a programme page.
//
// These are used for *drift detection*, not for filling fields. The registry
// carries what a human read off the page; on every run the page is fetched
// again and re-read here, and a disagreement becomes a drift note rather than a
// silent overwrite. A regex is not trustworthy enough to invent a stipend or a
// deadline with, and a wrong stipend on a card is worse than a missing one.

const MONTHS: Record<string, number> = {
  january: 1, february: 2, march: 3, april: 4, may: 5, june: 6,
  july: 7, august: 8, september: 9, october: 10, november: 11, december: 12,
  jan: 1, feb: 2, mar: 3, apr: 4, jun: 6, jul: 7, aug: 8, sep: 9, sept: 9, oct: 10, nov: 11, dec: 12,
};

const MONTH_NAMES = Object.keys(MONTHS).sort((a, b) => b.length - a.length).join('|');

/** "February 28, 2026" and "Feb 28 2026" -> "2026-02-28". Returns null for anything else. */
export function parseLooseDate(text: string): string | null {
  const match = new RegExp(`\\b(${MONTH_NAMES})\\.?\\s+(\\d{1,2})(?:st|nd|rd|th)?,?\\s+(\\d{4})\\b`, 'i').exec(text);
  if (!match) return null;
  const month = MONTHS[match[1].toLowerCase()];
  const day = Number(match[2]);
  const year = Number(match[3]);
  if (!month || day < 1 || day > 31 || year < 2000 || year > 2100) return null;
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

/** Every dollar figure on the page that reads like a stipend, largest first. */
export function findStipends(text: string): number[] {
  const found = new Set<number>();
  for (const match of text.matchAll(/\$\s?([\d,]{3,9})(?:\.\d{2})?/g)) {
    const value = Number(match[1].replace(/,/g, ''));
    // Below $300 is a fee or a meal allowance; above $200k is an award budget, not a person's pay.
    if (Number.isFinite(value) && value >= 300 && value <= 200000) found.add(value);
  }
  return [...found].sort((a, b) => b - a);
}

/**
 * Every "N-week" / "N weeks" figure on the page. A range ("10-12 weeks", which
 * programmes write constantly) yields both ends, so recording either one does
 * not read as drift.
 */
export function findWeeks(text: string): number[] {
  const found = new Set<number>();
  const add = (value: number) => {
    if (Number.isFinite(value) && value >= 1 && value <= 52) found.add(value);
  };

  for (const match of text.matchAll(/(\d{1,2})\s*(?:-|–|to)\s*(\d{1,2})\s*weeks?\b/gi)) {
    add(Number(match[1]));
    add(Number(match[2]));
  }
  for (const match of text.matchAll(/(\d{1,2})[-\s]?weeks?\b/gi)) add(Number(match[1]));
  return [...found].sort((a, b) => a - b);
}

/** Dates that sit next to deadline wording, so a start date is not read as a deadline. */
export function findDeadlines(text: string): string[] {
  const found = new Set<string>();
  const pattern = /(?:deadline|due|applications? (?:close|are due|must be)|apply by|closes)[^.\n]{0,80}/gi;
  for (const match of text.matchAll(pattern)) {
    const date = parseLooseDate(match[0]);
    if (date) found.add(date);
  }
  return [...found].sort();
}

/**
 * Compares what the registry recorded against what the page says now. Anything
 * the page no longer supports is reported, and a human decides what to do.
 */
export function driftNotes(
  text: string,
  recorded: { stipendUsd: number | null; durationWeeks: number | null; applyBy: string | null },
): string[] {
  const notes: string[] = [];
  const body = text.slice(0, 40000);

  if (recorded.stipendUsd !== null) {
    const stipends = findStipends(body);
    if (stipends.length > 0 && !stipends.includes(recorded.stipendUsd)) {
      notes.push(`recorded stipend $${recorded.stipendUsd} is no longer on the page (page shows ${stipends.slice(0, 3).map((value) => `$${value}`).join(', ')})`);
    }
  }
  if (recorded.durationWeeks !== null) {
    const weeks = findWeeks(body);
    if (weeks.length > 0 && !weeks.includes(recorded.durationWeeks)) {
      notes.push(`recorded ${recorded.durationWeeks} weeks is no longer on the page (page shows ${weeks.slice(0, 3).join(', ')} weeks)`);
    }
  }
  if (recorded.applyBy !== null) {
    const deadlines = findDeadlines(body);
    if (deadlines.length > 0 && !deadlines.includes(recorded.applyBy)) {
      notes.push(`recorded deadline ${recorded.applyBy} is no longer on the page (page shows ${deadlines.slice(0, 3).join(', ')})`);
    }
  }
  return notes;
}

/** A page that has quietly become a login wall or a "programme is paused" notice. */
const SUSPENDED = /program (?:is )?(?:currently )?(?:paused|suspended|on hold|not accepting)|no longer (?:accepting|offered|running)|applications are closed for/i;

export function looksSuspended(text: string): boolean {
  return SUSPENDED.test(text.slice(0, 20000));
}
