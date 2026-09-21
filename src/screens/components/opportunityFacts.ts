// Turning catalog fields into the short strings a card and a detail page show.
// Screens slice. One place, so a card and the page it opens never disagree.

import type { Opportunity } from '../../models';

const dayFormat = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' });
const longDayFormat = new Intl.DateTimeFormat('en-US', {
  weekday: 'short',
  month: 'short',
  day: 'numeric',
});
const timeFormat = new Intl.DateTimeFormat('en-US', {
  weekday: 'short',
  month: 'short',
  day: 'numeric',
  hour: 'numeric',
  minute: '2-digit',
});

export function formatDay(iso: string): string {
  return dayFormat.format(new Date(iso));
}

export function formatLongDay(iso: string): string {
  return longDayFormat.format(new Date(iso));
}

export function money(value: number): string {
  return `$${value.toLocaleString('en-US')}`;
}

/** 'FullTime' and 'night_shifts' both become readable prose. */
export function humanize(value: string): string {
  return value
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/_/g, ' ')
    .toLowerCase()
    .replace(/^./, (first) => first.toUpperCase());
}

export const KIND_LABELS = {
  job: 'Job',
  program: 'Program',
  event: 'Event',
  research: 'Research',
  mentorship: 'Mentorship',
} as const;

/** 'Job', or 'Internship' / 'Apprenticeship' where that is the more useful word. */
export function kindLabel(item: Opportunity): string {
  if (item.kind === 'job' && item.employmentType === 'Internship') return 'Internship';
  if (item.kind === 'job' && item.employmentType === 'Apprenticeship') return 'Apprenticeship';
  return KIND_LABELS[item.kind];
}

/** Where it is, in one string. */
export function placeLine(item: Opportunity): string {
  return item.location ?? '';
}

/**
 * The single most useful fact about an opportunity: what it pays, what it
 * costs, or when it happens. Shown on its own line, not buried in a list.
 */
export function headlineFact(item: Opportunity): string | null {
  switch (item.kind) {
    case 'job': {
      if (item.payMinUsd !== null && item.payMaxUsd !== null) {
        return `${money(item.payMinUsd)}–${money(item.payMaxUsd)} a year`;
      }
      if (item.payMinUsd !== null) return `From ${money(item.payMinUsd)} a year`;
      return null;
    }
    case 'program': {
      if (item.stipendUsd) return `${money(item.stipendUsd)} stipend`;
      if (item.costUsd === 0) return 'Free to take part';
      if (item.costUsd !== null) return `${money(item.costUsd)} to take part`;
      return null;
    }
    case 'research':
      return item.stipendUsd ? `${money(item.stipendUsd)} stipend` : null;
    case 'event': {
      if (item.costUsd === 0) return 'Free to attend';
      return item.costUsd !== null ? `${money(item.costUsd)} to attend` : null;
    }
    case 'mentorship':
      return item.costUsd === 0 ? 'Free to join' : null;
  }
}

/** The remaining facts, in reading order, already joined. */
export function supportingFacts(item: Opportunity): string[] {
  switch (item.kind) {
    case 'job':
      return [humanize(item.employmentType), item.detroit?.sector ?? ''].filter(Boolean);
    case 'program':
      return [
        item.durationWeeks ? `${item.durationWeeks} weeks` : '',
        item.costUsd === 0 && item.stipendUsd ? 'Free to take part' : '',
        item.program?.cadence && item.program.cadence !== 'unknown'
          ? humanize(item.program.cadence)
          : '',
      ].filter(Boolean);
    case 'research':
      return [item.field, item.durationWeeks ? `${item.durationWeeks} weeks` : ''].filter(Boolean);
    case 'event':
      return [timeFormat.format(new Date(item.startsAt)), humanize(item.format)].filter(Boolean);
    case 'mentorship':
      return [item.format, item.schedule ?? ''].filter(Boolean);
  }
}

/** 'Apply by Nov 3', when there is a date to hold to. */
export function deadlineLine(item: Opportunity): string | null {
  return 'applyBy' in item && item.applyBy ? `Apply by ${formatDay(item.applyBy)}` : null;
}

/** True when the deadline is inside the next fortnight, so it is worth flagging. */
export function isDeadlineSoon(item: Opportunity, now = new Date()): boolean {
  if (!('applyBy' in item) || !item.applyBy) return false;
  const days = (Date.parse(item.applyBy) - now.getTime()) / 86_400_000;
  return days >= 0 && days <= 14;
}

/** "Tue, Oct 6, 6:00 PM", plus the end day when the event runs across several. */
export function eventWhen(item: Opportunity): string | null {
  if (item.kind !== 'event') return null;
  const start = new Date(item.startsAt);
  const line = timeFormat.format(start);
  if (!item.endsAt) return line;
  const end = new Date(item.endsAt);
  return end.toDateString() === start.toDateString() ? line : `${line} – ${formatDay(item.endsAt)}`;
}

/* ------------------------------------------------------------ match scores */

export type ScoreBand = { label: string; tone: 'positive' | 'accent' | 'neutral' };

/**
 * A number on its own does not say whether 62 is good. Every score is shown
 * with the word for its band, and the bands are explained once per list.
 */
export function scoreBand(score: number): ScoreBand {
  if (score >= 70) return { label: 'Strong fit', tone: 'positive' };
  if (score >= 55) return { label: 'Good fit', tone: 'accent' };
  if (score >= 40) return { label: 'Possible fit', tone: 'neutral' };
  return { label: 'Long shot', tone: 'neutral' };
}

export const SCORE_HELP =
  'Fit is scored out of 100 against your answers: 70 and above is a strong fit, 55 to 69 good, 40 to 54 possible.';
