// Small shared pieces for the intake screens. Screens slice.

import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, radius, spacing, typography } from '../../theme';

export function ProgressBar({ ratio }: { ratio: number }) {
  const clamped = Math.min(1, Math.max(0, ratio));
  return (
    <View style={styles.progressTrack} accessibilityRole="progressbar">
      <View style={[styles.progressFill, { width: `${clamped * 100}%` }]} />
    </View>
  );
}

type ButtonProps = {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  variant?: 'primary' | 'secondary' | 'ghost';
};

export function Button({ label, onPress, disabled, variant = 'primary' }: ButtonProps) {
  const isPrimary = variant === 'primary';
  const isGhost = variant === 'ghost';

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityState={{ disabled: !!disabled }}
      style={({ pressed }) => [
        styles.button,
        isPrimary && styles.buttonPrimary,
        variant === 'secondary' && styles.buttonSecondary,
        isGhost && styles.buttonGhost,
        disabled && styles.buttonDisabled,
        pressed && !disabled && styles.buttonPressed,
      ]}
    >
      <Text
        style={[
          styles.buttonLabel,
          isPrimary && styles.buttonLabelPrimary,
          isGhost && styles.buttonLabelGhost,
          disabled && styles.buttonLabelDisabled,
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

export function Pill({ text, tone = 'neutral' }: { text: string; tone?: 'neutral' | 'accent' }) {
  return (
    <View style={[styles.pill, tone === 'accent' && styles.pillAccent]}>
      <Text style={[styles.pillText, tone === 'accent' && styles.pillTextAccent]}>{text}</Text>
    </View>
  );
}

export function Card({ children, style }: { children: React.ReactNode; style?: object }) {
  return <View style={[styles.card, style]}>{children}</View>;
}

export function FieldLabel({ text }: { text: string }) {
  return <Text style={styles.fieldLabel}>{text.toUpperCase()}</Text>;
}

/** A confidence reading, shown next to anything the app inferred. */
export function ConfidenceDot({ value }: { value: number }) {
  const tone =
    value >= 0.7 ? colors.success : value >= 0.45 ? colors.warning : colors.textMuted;
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

const styles = StyleSheet.create({
  progressTrack: {
    height: 6,
    borderRadius: radius.pill,
    backgroundColor: colors.border,
    overflow: 'hidden',
  },
  progressFill: { height: 6, borderRadius: radius.pill, backgroundColor: colors.primary },

  button: {
    minHeight: 50,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
  },
  buttonPrimary: { backgroundColor: colors.primary },
  buttonSecondary: {
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.borderStrong,
  },
  buttonGhost: { backgroundColor: 'transparent', minHeight: 40 },
  buttonDisabled: { backgroundColor: colors.border },
  buttonPressed: { opacity: 0.75 },
  buttonLabel: { ...typography.heading, color: colors.text },
  buttonLabelPrimary: { color: colors.textInverse },
  buttonLabelGhost: { ...typography.body, color: colors.textMuted },
  buttonLabelDisabled: { color: colors.textMuted },

  pill: {
    alignSelf: 'flex-start',
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: 4,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
  },
  pillAccent: { backgroundColor: colors.primarySoft },
  pillText: { ...typography.label, color: colors.textMuted },
  pillTextAccent: { color: colors.primary },

  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },

  fieldLabel: { ...typography.label, color: colors.textMuted, letterSpacing: 0.6 },

  confidenceRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  dot: { width: 7, height: 7, borderRadius: radius.pill },
  confidenceText: { ...typography.caption, color: colors.textMuted },
});
