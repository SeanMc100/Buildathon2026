// Read-only views of a derived profile. Screens slice.
// Each block shows the value, how sure the app is, and which question produced
// it - provenance is the point, not decoration.

import { StyleSheet, Text, View } from 'react-native';

import { questionById } from '../../content';
import type {
  CareerProfile,
  Inference,
  PreferenceWeight,
  QuestionId,
  RiasecCode,
} from '../../models';
import { colors, radius, spacing, typography } from '../../theme';
import { ConfidenceDot } from './ui';

const RIASEC_LABELS: Record<RiasecCode, string> = {
  R: 'Hands-on',
  I: 'Investigative',
  A: 'Creative',
  S: 'People-focused',
  E: 'Enterprising',
  C: 'Organising',
};

const EXCLUSION_LABELS: Record<string, string> = {
  night_shifts: 'Nights or weekends',
  heavy_travel: 'Regular travel',
  on_call: 'On call',
  sales_targets: 'Sales targets',
  managing_people: 'Managing people',
  physical_work: 'Physically demanding work',
  high_stakes: 'High-pressure environments',
};

function sourceLine(ids: QuestionId[]): string | null {
  if (ids.length === 0) return null;
  const prompts = ids
    .map((id) => questionById(id)?.prompt)
    .filter((prompt): prompt is string => !!prompt)
    .map((prompt) => (prompt.length > 48 ? `${prompt.slice(0, 45)}…` : prompt));
  if (prompts.length === 0) return null;
  return `From: ${prompts.join(' · ')}`;
}

export function ProfileBlock({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <View style={styles.block}>
      <Text style={styles.blockTitle}>{title}</Text>
      {children}
    </View>
  );
}

export function PriorityBars({ priorities }: { priorities: PreferenceWeight[] }) {
  if (priorities.length === 0) {
    return <Text style={styles.empty}>Not enough answers yet to rank what matters.</Text>;
  }
  const top = priorities[0].weight || 1;

  return (
    <View style={styles.stack}>
      {priorities.map((item) => (
        <View key={item.trait} style={styles.barRow}>
          <View style={styles.barHeader}>
            <Text style={styles.barLabel}>{item.label}</Text>
            <Text style={styles.barValue}>{item.weight}</Text>
          </View>
          <View style={styles.barTrack}>
            <View style={[styles.barFill, { width: `${(item.weight / top) * 100}%` }]} />
          </View>
          <View style={styles.metaRow}>
            <ConfidenceDot value={item.confidence} />
          </View>
          {sourceLine(item.sourceQuestionIds) ? (
            <Text style={styles.source}>{sourceLine(item.sourceQuestionIds)}</Text>
          ) : null}
        </View>
      ))}
    </View>
  );
}

export function DialRow({
  label,
  lowLabel,
  highLabel,
  inference,
}: {
  label: string;
  lowLabel: string;
  highLabel: string;
  inference: Inference<number>;
}) {
  return (
    <View style={styles.dialRow}>
      <View style={styles.barHeader}>
        <Text style={styles.barLabel}>{label}</Text>
        <ConfidenceDot value={inference.confidence} />
      </View>
      <View style={styles.dialTrack}>
        <View style={[styles.dialMarker, { left: `${inference.value}%` }]} />
      </View>
      <View style={styles.dialLabels}>
        <Text style={styles.dialEnd}>{lowLabel}</Text>
        <Text style={styles.dialEnd}>{highLabel}</Text>
      </View>
    </View>
  );
}

export function FactRow({
  label,
  value,
  confidence,
  sources,
}: {
  label: string;
  value: string;
  confidence?: number;
  sources?: QuestionId[];
}) {
  const source = sources ? sourceLine(sources) : null;
  return (
    <View style={styles.factRow}>
      <View style={styles.factTop}>
        <Text style={styles.factLabel}>{label}</Text>
        <Text style={styles.factValue}>{value}</Text>
      </View>
      {confidence !== undefined ? <ConfidenceDot value={confidence} /> : null}
      {source ? <Text style={styles.source}>{source}</Text> : null}
    </View>
  );
}

export function InterestRow({ profile }: { profile: CareerProfile }) {
  const { interests } = profile;
  if (interests.hollandCode.length === 0) {
    return <Text style={styles.empty}>Interests were skipped.</Text>;
  }

  return (
    <View style={styles.stack}>
      <View style={styles.chipWrap}>
        {interests.hollandCode.map((code, index) => (
          <View key={code} style={[styles.chip, index === 0 && styles.chipLead]}>
            <Text style={[styles.chipText, index === 0 && styles.chipTextLead]}>
              {RIASEC_LABELS[code]}
            </Text>
          </View>
        ))}
      </View>
      <ConfidenceDot value={interests.confidence} />
      <Text style={styles.caveat}>
        This comes from a single question, not a full interest inventory. It is sent as a hint and
        the model is told to treat it as one.
      </Text>
    </View>
  );
}

export function ConstraintList({ profile }: { profile: CareerProfile }) {
  const c = profile.hardConstraints;
  const lines: string[] = [];

  lines.push(`Would take: ${c.arrangements.join(', ')}`);
  lines.push(`Arrangement: ${c.employmentTypes.join(', ')}`);
  if (c.maxCommuteMinutes !== null) lines.push(`Travel limit: ${c.maxCommuteMinutes} minutes`);
  if (c.openToRelocation) lines.push('Open to relocating');
  if (c.minSalaryUsd !== null) {
    lines.push(`Pay floor: ${Math.round(c.minSalaryUsd / 1000)}k`);
  } else {
    lines.push(`Pay stance: ${c.payStance.replace(/_/g, ' ')}`);
  }

  return (
    <View style={styles.stack}>
      {lines.map((line) => (
        <View key={line} style={styles.constraintRow}>
          <Text style={styles.constraintText}>{line}</Text>
        </View>
      ))}
      {c.exclusions.length > 0 ? (
        <View style={styles.exclusionBox}>
          <Text style={styles.exclusionTitle}>Ruled out</Text>
          <View style={styles.chipWrap}>
            {c.exclusions.map((key) => (
              <View key={key} style={styles.chipDanger}>
                <Text style={styles.chipDangerText}>{EXCLUSION_LABELS[key] ?? key}</Text>
              </View>
            ))}
          </View>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  block: { gap: spacing.sm },
  blockTitle: { ...typography.label, color: colors.textMuted, letterSpacing: 0.8 },
  stack: { gap: spacing.md },
  empty: { ...typography.caption, color: colors.textMuted, fontStyle: 'italic' },

  barRow: { gap: spacing.xs },
  barHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  barLabel: { ...typography.body, color: colors.text, fontWeight: '600', flex: 1 },
  barValue: { ...typography.body, color: colors.primary, fontWeight: '700' },
  barTrack: { height: 8, borderRadius: radius.pill, backgroundColor: colors.border },
  barFill: { height: 8, borderRadius: radius.pill, backgroundColor: colors.primary },
  metaRow: { flexDirection: 'row', alignItems: 'center' },
  source: { ...typography.caption, color: colors.textMuted, fontSize: 11, lineHeight: 15 },

  dialRow: { gap: spacing.xs },
  dialTrack: {
    height: 8,
    borderRadius: radius.pill,
    backgroundColor: colors.border,
    justifyContent: 'center',
  },
  dialMarker: {
    position: 'absolute',
    width: 14,
    height: 14,
    marginLeft: -7,
    borderRadius: radius.pill,
    backgroundColor: colors.primary,
    borderWidth: 2,
    borderColor: colors.background,
  },
  dialLabels: { flexDirection: 'row', justifyContent: 'space-between' },
  dialEnd: { ...typography.caption, color: colors.textMuted, fontSize: 11 },

  factRow: { gap: spacing.xs, paddingVertical: spacing.xs },
  factTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: spacing.sm },
  factLabel: { ...typography.body, color: colors.textMuted },
  factValue: { ...typography.body, color: colors.text, fontWeight: '600', flexShrink: 1, textAlign: 'right' },

  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  chip: {
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: 6,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceAlt,
  },
  chipLead: { backgroundColor: colors.primary },
  chipText: { ...typography.caption, color: colors.text, fontWeight: '600' },
  chipTextLead: { color: colors.textInverse },
  chipDanger: {
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: 6,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.borderStrong,
  },
  chipDangerText: { ...typography.caption, color: colors.danger, fontWeight: '600' },

  caveat: { ...typography.caption, color: colors.textMuted, fontSize: 11, lineHeight: 16 },

  constraintRow: { paddingVertical: 2 },
  constraintText: { ...typography.body, color: colors.text },
  exclusionBox: { gap: spacing.xs, marginTop: spacing.xs },
  exclusionTitle: { ...typography.label, color: colors.textMuted },
});
