export const colors = {
  background: '#ffffff',
  surface: '#f7f7fb',
  surfaceAlt: '#eef0fb',
  border: '#e2e3ec',
  borderStrong: '#c9cbdb',
  text: '#111111',
  textMuted: '#666666',
  textInverse: '#ffffff',
  primary: '#4f46e5',
  primarySoft: '#eceafd',
  success: '#0f9d58',
  warning: '#b7791f',
  danger: '#c0392b',
} as const;

export const spacing = {
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

export const typography = {
  display: { fontSize: 30, fontWeight: '700' },
  title: { fontSize: 22, fontWeight: '700' },
  heading: { fontSize: 17, fontWeight: '600' },
  body: { fontSize: 15, fontWeight: '400' },
  caption: { fontSize: 13, fontWeight: '400' },
  label: { fontSize: 12, fontWeight: '600' },
} as const;
