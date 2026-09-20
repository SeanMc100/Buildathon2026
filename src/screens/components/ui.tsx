// The shared kit every screen builds from: buttons, cards, chips, progress and
// empty states. Screens slice.
//
// Anything that appears on more than one screen belongs here, so a change to how
// a button feels is made once. Colours, sizes and shadows come from src/theme.

import { Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';

import { TOUCH_TARGET, colors, radius, shadow, spacing, typography } from '../../theme';
import { focusRing, isFocused } from '../../web/focus';
import { isHovered } from '../../web/hover';

/* ---------------------------------------------------------------- progress */

export function ProgressBar({ ratio, label }: { ratio: number; label?: string }) {
  const clamped = Math.min(1, Math.max(0, ratio));
  return (
    <View
      accessibilityRole="progressbar"
      accessibilityValue={{ now: Math.round(clamped * 100), min: 0, max: 100 }}
      accessibilityLabel={label}
    >
      <View style={styles.progressTrack}>
        <View style={[styles.progressFill, { width: `${clamped * 100}%` }]} />
      </View>
    </View>
  );
}

/* ----------------------------------------------------------------- buttons */

type ButtonProps = {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  /**
   * `auto` sizes the button to its label, which is what a button should do on a
   * wide screen. `block` fills the row, for the single main action at the foot
   * of a form or a phone screen.
   */
  width?: 'auto' | 'block';
  size?: 'md' | 'lg';
  /** Read out instead of the label, when the label alone is not explicit. */
  accessibilityLabel?: string;
};

export function Button({
  label,
  onPress,
  disabled,
  variant = 'primary',
  width = 'auto',
  size = 'md',
  accessibilityLabel,
}: ButtonProps) {
  const isGhost = variant === 'ghost';

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ disabled: !!disabled }}
      style={(state) => [
        styles.button,
        size === 'lg' && styles.buttonLg,
        width === 'block' ? styles.buttonBlock : styles.buttonAuto,
        variant === 'primary' && styles.buttonPrimary,
        variant === 'secondary' && styles.buttonSecondary,
        variant === 'danger' && styles.buttonDanger,
        isGhost && styles.buttonGhost,
        disabled && (isGhost ? styles.buttonGhostDisabled : styles.buttonDisabled),
        !disabled && isHovered(state) && HOVER[variant],
        !disabled && state.pressed && styles.pressed,
        isFocused(state) && focusRing,
      ]}
    >
      <Text
        style={[
          styles.buttonLabel,
          size === 'lg' && styles.buttonLabelLg,
          variant === 'primary' && styles.buttonLabelInverse,
          variant === 'danger' && styles.buttonLabelDanger,
          isGhost && styles.buttonLabelGhost,
          disabled && styles.buttonLabelDisabled,
        ]}
        numberOfLines={1}
      >
        {label}
      </Text>
    </Pressable>
  );
}

/** A text action that sits inline in a sentence or at the end of a row. */
export function LinkButton({
  label,
  onPress,
  tone = 'primary',
  accessibilityLabel,
}: {
  label: string;
  onPress: () => void;
  tone?: 'primary' | 'muted';
  accessibilityLabel?: string;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      hitSlop={12}
      style={(state) => [styles.linkButton, isFocused(state) && focusRing]}
    >
      {(state) => (
        <Text
          style={[
            styles.linkButtonLabel,
            tone === 'muted' && styles.linkButtonLabelMuted,
            isHovered(state) && styles.linkButtonLabelHover,
          ]}
        >
          {label}
        </Text>
      )}
    </Pressable>
  );
}

/* ------------------------------------------------------------------- chips */

export function Pill({
  text,
  tone = 'neutral',
}: {
  text: string;
  tone?: 'neutral' | 'accent' | 'positive' | 'caution';
}) {
  return (
    <View style={[styles.pill, PILL_FILL[tone]]}>
      <Text style={[styles.pillText, PILL_TEXT[tone]]}>{text}</Text>
    </View>
  );
}

/* ------------------------------------------------------------------- cards */

/** A panel you read. Flat, because nothing here is clickable. */
export function Card({
  children,
  style,
}: {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  return <View style={[styles.card, style]}>{children}</View>;
}

/**
 * A card you act on: the whole surface is the target, it lifts under the
 * pointer, and it carries a shadow so it reads as raised rather than inset.
 */
export function PressableCard({
  children,
  onPress,
  accessibilityLabel,
  accessibilityRole = 'button',
  style,
}: {
  children: React.ReactNode;
  onPress: () => void;
  accessibilityLabel: string;
  accessibilityRole?: 'button' | 'link';
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole={accessibilityRole}
      accessibilityLabel={accessibilityLabel}
      style={(state) => [
        styles.card,
        styles.cardRaised,
        style,
        isHovered(state) && styles.cardHover,
        state.pressed && styles.cardPressed,
        isFocused(state) && focusRing,
      ]}
    >
      {children}
    </Pressable>
  );
}

/* ------------------------------------------------------------------ labels */

export function FieldLabel({ text }: { text: string }) {
  return <Text style={styles.fieldLabel}>{text.toUpperCase()}</Text>;
}

/** The heading above a group of cards or rows, with an optional count. */
export function SectionHeading({
  title,
  count,
  help,
}: {
  title: string;
  count?: number;
  help?: string;
}) {
  return (
    <View style={styles.sectionHeading}>
      <View style={styles.sectionHeadingRow}>
        <Text style={styles.sectionTitle} accessibilityRole="header">
          {title}
        </Text>
        {count !== undefined ? (
          <View style={styles.countChip}>
            <Text style={styles.countChipText}>{count}</Text>
          </View>
        ) : null}
      </View>
      {help ? <Text style={styles.sectionHelp}>{help}</Text> : null}
    </View>
  );
}

/** A confidence reading, shown next to anything the app inferred. */
export function ConfidenceDot({ value }: { value: number }) {
  const tone = value >= 0.7 ? colors.positive : value >= 0.45 ? colors.caution : colors.textMuted;
  const label = value >= 0.7 ? 'strong' : value >= 0.45 ? 'moderate' : 'weak';
  return (
    <View style={styles.confidenceRow}>
      <View style={[styles.dot, { backgroundColor: tone }]} />
      <Text style={styles.confidenceText}>
        {label} · {Math.round(value * 100)}%
      </Text>
    </View>
  );
}

/* ------------------------------------------------------------ empty states */

/**
 * Nothing to show. Always says what happened and offers the one thing worth
 * doing about it, because a dead end is where people leave.
 */
export function EmptyState({
  title,
  body,
  action,
  secondaryAction,
  tone = 'neutral',
}: {
  title: string;
  body?: string;
  action?: { label: string; onPress: () => void };
  secondaryAction?: { label: string; onPress: () => void };
  tone?: 'neutral' | 'caution';
}) {
  return (
    <View style={[styles.empty, tone === 'caution' && styles.emptyCaution]}>
      <Text style={styles.emptyTitle}>{title}</Text>
      {body ? <Text style={styles.emptyBody}>{body}</Text> : null}
      {action || secondaryAction ? (
        <View style={styles.emptyActions}>
          {action ? <Button label={action.label} onPress={action.onPress} /> : null}
          {secondaryAction ? (
            <Button label={secondaryAction.label} variant="secondary" onPress={secondaryAction.onPress} />
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

/* ------------------------------------------------------------------ styles */

const HOVER = {
  primary: { backgroundColor: colors.primaryHover },
  secondary: { backgroundColor: colors.surface, borderColor: colors.borderStrong },
  danger: { backgroundColor: colors.dangerSoft },
  ghost: { backgroundColor: colors.surface },
} as const;

const PILL_FILL = {
  neutral: { backgroundColor: colors.neutralSoft },
  accent: { backgroundColor: colors.primarySoft },
  positive: { backgroundColor: colors.positiveSoft },
  caution: { backgroundColor: colors.cautionSoft },
} as const;

const PILL_TEXT = {
  neutral: { color: colors.textMuted },
  accent: { color: colors.primary },
  positive: { color: colors.positive },
  caution: { color: colors.caution },
} as const;

const styles = StyleSheet.create({
  progressTrack: {
    height: 6,
    borderRadius: radius.pill,
    backgroundColor: colors.border,
    overflow: 'hidden',
  },
  progressFill: { height: 6, borderRadius: radius.pill, backgroundColor: colors.primary },

  button: {
    minHeight: TOUCH_TARGET,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
  },
  buttonLg: { minHeight: 52, paddingHorizontal: spacing.xl },
  buttonAuto: { alignSelf: 'flex-start' },
  buttonBlock: { alignSelf: 'stretch' },
  buttonPrimary: { backgroundColor: colors.primary },
  buttonSecondary: {
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.borderStrong,
  },
  buttonDanger: { backgroundColor: colors.background, borderWidth: 1, borderColor: colors.danger },
  buttonGhost: { backgroundColor: 'transparent', paddingHorizontal: spacing.md },
  buttonDisabled: { backgroundColor: colors.border, borderColor: colors.border },
  buttonGhostDisabled: { opacity: 0.45 },
  pressed: { opacity: 0.85 },

  buttonLabel: { ...typography.subheading, color: colors.text },
  buttonLabelLg: { ...typography.heading },
  buttonLabelInverse: { color: colors.textInverse },
  buttonLabelDanger: { color: colors.danger },
  buttonLabelGhost: { color: colors.textMuted },
  buttonLabelDisabled: { color: colors.textMuted },

  linkButton: { alignSelf: 'flex-start', borderRadius: radius.sm },
  linkButtonLabel: { ...typography.caption, fontWeight: '600', color: colors.primary },
  linkButtonLabelMuted: { color: colors.textMuted },
  linkButtonLabelHover: { textDecorationLine: 'underline' },

  pill: {
    alignSelf: 'flex-start',
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: 4,
    borderRadius: radius.pill,
  },
  pillText: { ...typography.label },

  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  cardRaised: { backgroundColor: colors.background, ...shadow.sm },
  cardHover: { borderColor: colors.primaryBorder, ...shadow.md },
  cardPressed: { backgroundColor: colors.surface },

  fieldLabel: { ...typography.label, color: colors.textMuted, letterSpacing: 0.6 },

  sectionHeading: { gap: spacing.xxs },
  sectionHeadingRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  sectionTitle: { ...typography.title, color: colors.text },
  countChip: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radius.pill,
    backgroundColor: colors.neutralSoft,
  },
  countChipText: { ...typography.label, color: colors.textMuted },
  sectionHelp: { ...typography.caption, color: colors.textMuted, lineHeight: 20 },

  confidenceRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  dot: { width: 7, height: 7, borderRadius: radius.pill },
  confidenceText: { ...typography.caption, color: colors.textMuted },

  empty: {
    alignItems: 'flex-start',
    gap: spacing.sm,
    padding: spacing.lg,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  emptyCaution: { borderColor: colors.cautionSoft, backgroundColor: colors.cautionSoft },
  emptyTitle: { ...typography.heading, color: colors.text },
  emptyBody: { ...typography.body, color: colors.textMuted, lineHeight: 24 },
  emptyActions: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.xs },
});
