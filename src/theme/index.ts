// The design tokens every screen builds from. Sean owns this file.
//
// Two rules keep the app looking like one product:
//   1. No screen hard-codes a colour, a font size or a shadow. If something is
//      missing here, add it here.
//   2. Every colour that carries text has been checked against its background
//      for WCAG AA (4.5:1 at our text sizes). The ratios are noted below, so a
//      future change can be checked the same way.

export const colors = {
  /** The page itself, and the fill of a raised card. */
  background: '#ffffff',
  /** Quiet panels and rows inside a page. */
  surface: '#f7f7fb',
  /** A panel one step quieter still: toggles, code blocks, table stripes. */
  surfaceAlt: '#eef0fb',
  /** Outside the content column on a wide window, so the page reads as a page. */
  surfaceSunken: '#f2f2f7',

  border: '#e2e3ec',
  borderStrong: '#c9cbdb',

  /** 18.9:1 on white. */
  text: '#111111',
  /** 6.6:1 on white, 6.2:1 on surface. Safe down to our smallest text. */
  textMuted: '#5c5c66',
  textInverse: '#ffffff',

  /** 6.3:1 on white. The brand, and the only colour used for "this is the action". */
  primary: '#4f46e5',
  /** Hover and pressed states of a primary surface. */
  primaryHover: '#4338ca',
  /** 5.3:1 for primary text on top of it. */
  primarySoft: '#eceafd',
  primaryBorder: '#c7c2f5',

  /** Something that fits, a match strength, a success. 6.2:1 on white. */
  positive: '#0a7040',
  positiveSoft: '#e6f4ec',
  /** A gap, a caveat, a deadline closing in. 6.6:1 on white. */
  caution: '#845209',
  cautionSoft: '#fdf3e2',
  /** An error, a destructive action. 6.5:1 on white. */
  danger: '#b3261e',
  dangerSoft: '#fdeceb',

  /** A neutral highlight for counts and metadata chips. */
  neutralSoft: '#eeeef3',
} as const;

export const spacing = {
  xxs: 2,
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
} as const;

export const radius = {
  sm: 8,
  md: 12,
  lg: 18,
  pill: 999,
} as const;

/**
 * One step per level of importance, with no gap wide enough that two levels
 * have to share a size. `body` and `caption` carry real information — pay,
 * dates, why something fits — so neither drops below 14.
 */
export const typography = {
  /** Page titles. */
  display: { fontSize: 30, fontWeight: '700' },
  /** Section titles within a page. */
  title: { fontSize: 22, fontWeight: '700' },
  /** Card titles, button labels, the heading of a panel. */
  heading: { fontSize: 18, fontWeight: '600' },
  /** A label above a group, or a card title in a dense list. */
  subheading: { fontSize: 15, fontWeight: '600' },
  /** Default running text. */
  body: { fontSize: 16, fontWeight: '400' },
  /** Supporting facts. Small, never decorative. */
  caption: { fontSize: 14, fontWeight: '400' },
  /** Uppercase micro-labels and chips. */
  label: { fontSize: 12, fontWeight: '600' },
} as const;

/**
 * Depth separates what you can act on from what you can only read: a raised
 * card is clickable, a flat panel is not. `boxShadow` works on every platform
 * we ship to.
 */
export const shadow = {
  /** A card at rest. */
  sm: { boxShadow: '0 1px 2px rgba(17, 17, 27, 0.06)' },
  /** A card under the pointer. */
  md: { boxShadow: '0 4px 12px rgba(17, 17, 27, 0.10)' },
  /** Something floating over the page: a menu, a sheet. */
  lg: { boxShadow: '0 12px 28px rgba(17, 17, 27, 0.14)' },
} as const;

/**
 * Smallest comfortable target for a finger. Anything a person taps gets at
 * least this in both directions, with `hitSlop` if the paint is smaller.
 */
export const TOUCH_TARGET = 44;
