// Read-only views of a derived profile. Screens slice.
// The default view is short and plain. Confidence and the question each value
// came from are one tap away on any row - provenance stays, it just stops
// competing with the answer.

import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { questionById } from '../../content';
import { CAUSE_LABELS } from '../../matching/topics';
import type {
  CareerProfile,
  Inference,
  PreferenceWeight,
  QuestionId,
  RiasecCode,
} from '../../models';
import { colors, gradient, radius, spacing, typography } from '../../theme';
import { Card, ConfidenceDot } from './ui';

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

const TOP_PRIORITIES = 3;

/** 'EarlyCareer' -> 'Early career', 'night_shifts' -> 'Night shifts'. */
export function humanize(value: string): string {
  const spaced = value
    .replace(/_/g, ' ')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .toLowerCase();
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

function sourceLine(ids: QuestionId[]): string | null {
  const prompts = ids
    .map((id) => questionById(id)?.prompt)
    .filter((prompt): prompt is string => !!prompt)
    .map((prompt) => (prompt.length > 60 ? `${prompt.slice(0, 57)}…` : prompt));
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
      <Card style={styles.blockCard}>{children}</Card>
    </View>
  );
}

/**
 * Wraps a row so tapping it reveals how sure we are and which answers it came
 * from. Rows with nothing to explain render as plain views.
 */
function Explainable({
  confidence,
  sources,
  note,
  children,
}: {
  confidence?: number;
  sources?: QuestionId[];
  note?: string;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const source = sources ? sourceLine(sources) : null;

  if (confidence === undefined && !source && !note) {
    return <View style={styles.row}>{children}</View>;
  }

  return (
    <Pressable
      onPress={() => setOpen((current) => !current)}
      accessibilityRole="button"
      accessibilityHint="Shows why we think this"
      accessibilityState={{ expanded: open }}
      style={styles.row}
    >
      {children}
      {open ? (
        <View style={styles.why}>
          {confidence !== undefined ? <ConfidenceDot value={confidence} /> : null}
          {source ? <Text style={styles.whyText}>{source}</Text> : null}
          {note ? <Text style={styles.whyText}>{note}</Text> : null}
        </View>
      ) : null}
    </Pressable>
  );
}

export function PriorityList({ priorities }: { priorities: PreferenceWeight[] }) {
  const [showAll, setShowAll] = useState(false);

  if (priorities.length === 0) {
    return <Text style={styles.empty}>Not enough answers yet to rank what matters.</Text>;
  }

  const top = priorities[0].weight || 1;
  const visible = showAll ? priorities : priorities.slice(0, TOP_PRIORITIES);
  const hidden = priorities.length - visible.length;

  return (
    <View style={styles.stack}>
      {visible.map((item, index) => (
        <Explainable
          key={item.trait}
          confidence={item.confidence}
          sources={item.sourceQuestionIds}
        >
          <View style={styles.rankRow}>
            <View style={[styles.rank, index === 0 && styles.rankLead]}>
              <Text style={[styles.rankText, index === 0 && styles.rankTextLead]}>
                {index + 1}
              </Text>
            </View>
            <View style={styles.rankBody}>
              <Text style={styles.rankLabel}>{item.label}</Text>
              <View style={styles.barTrack}>
                <View style={[styles.barFill, { width: `${(item.weight / top) * 100}%` }]} />
              </View>
            </View>
          </View>
        </Explainable>
      ))}
      {priorities.length > TOP_PRIORITIES ? (
        <Pressable onPress={() => setShowAll((current) => !current)} hitSlop={8}>
          <Text style={styles.link}>
            {showAll ? 'Show fewer' : `See ${hidden} more`}
          </Text>
        </Pressable>
      ) : null}
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
    <Explainable confidence={inference.confidence} sources={inference.sourceQuestionIds}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.dialTrack}>
        <View style={[styles.dialMarker, { left: `${inference.value}%` }]} />
      </View>
      <View style={styles.dialLabels}>
        <Text style={styles.dialEnd}>{lowLabel}</Text>
        <Text style={styles.dialEnd}>{highLabel}</Text>
      </View>
    </Explainable>
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
  return (
    <Explainable confidence={confidence} sources={sources}>
      <View style={styles.factTop}>
        <Text style={styles.factLabel}>{label}</Text>
        <Text style={styles.factValue}>{value}</Text>
      </View>
    </Explainable>
  );
}

function ChipGroup({ label, chips }: { label: string; chips: string[] }) {
  return (
    <>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.chipWrap}>
        {chips.map((chip, index) => (
          <View key={chip} style={[styles.chip, index === 0 && styles.chipLead]}>
            <Text style={[styles.chipText, index === 0 && styles.chipTextLead]}>{chip}</Text>
          </View>
        ))}
      </View>
    </>
  );
}

/** The three answerable Ikigai circles: what you love, what you are good at, what you want it to serve. */
export function InterestRow({ profile }: { profile: CareerProfile }) {
  const { interests, causes } = profile;
  if (interests.hollandCode.length === 0 && causes.value.length === 0) {
    return <Text style={styles.empty}>Interests were skipped.</Text>;
  }

  return (
    <Explainable
      confidence={Math.max(interests.confidence, causes.confidence)}
      sources={[...interests.sourceQuestionIds, ...causes.sourceQuestionIds]}
      note="From what you enjoy, what you are good at and what you want your work to serve. Used to rank matches."
    >
      {interests.enjoys.length > 0 ? (
        <ChipGroup label="What you love" chips={interests.enjoys.map((code) => RIASEC_LABELS[code])} />
      ) : null}
      {interests.strengths.length > 0 ? (
        <ChipGroup
          label="What you are good at"
          chips={interests.strengths.map((code) => RIASEC_LABELS[code])}
        />
      ) : null}
      {causes.value.length > 0 ? (
        <ChipGroup label="What you want to serve" chips={causes.value.map((theme) => CAUSE_LABELS[theme])} />
      ) : null}
    </Explainable>
  );
}

export function ConstraintList({ profile }: { profile: CareerProfile }) {
  const c = profile.hardConstraints;
  const rows: Array<{ label: string; value: string }> = [];
  rows.push(
    c.minSalaryUsd !== null
      ? { label: 'Pay floor', value: `$${Math.round(c.minSalaryUsd / 1000)}k` }
      : { label: 'Pay', value: humanize(c.payStance) },
  );

  return (
    <View style={styles.stack}>
      {rows.map((row) => (
        <View key={row.label} style={styles.factTop}>
          <Text style={styles.factLabel}>{row.label}</Text>
          <Text style={styles.factValue}>{row.value}</Text>
        </View>
      ))}
      {c.exclusions.length > 0 ? (
        <View style={styles.exclusionBox}>
          <Text style={styles.factLabel}>Ruled out</Text>
          <View style={styles.chipWrap}>
            {c.exclusions.map((key) => (
              <View key={key} style={styles.chipDanger}>
                <Text style={styles.chipDangerText}>{EXCLUSION_LABELS[key] ?? humanize(key)}</Text>
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
  blockTitle: { ...typography.heading, color: colors.text },
  blockCard: { gap: spacing.md },
  stack: { gap: spacing.md },
  row: { gap: spacing.xs },
  empty: { ...typography.caption, color: colors.textMuted, fontStyle: 'italic' },
  label: { ...typography.body, color: colors.text, fontWeight: '600' },
  link: { ...typography.caption, color: colors.primary, fontWeight: '600' },

  why: {
    gap: spacing.xs,
    padding: spacing.sm,
    borderRadius: radius.sm,
    backgroundColor: colors.background,
  },
  whyText: { ...typography.caption, color: colors.textMuted, fontSize: 12, lineHeight: 17 },

  rankRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm + 2 },
  rank: {
    width: 28,
    height: 28,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceAlt,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rankLead: { backgroundColor: colors.primary },
  rankText: { ...typography.label, color: colors.primary },
  rankTextLead: { color: colors.textInverse },
  rankBody: { flex: 1, gap: 6 },
  rankLabel: { ...typography.body, color: colors.text, fontWeight: '600' },
  barTrack: { height: 6, borderRadius: radius.pill, backgroundColor: colors.border },
  barFill: { height: 6, borderRadius: radius.pill, ...gradient.horizontal },

  dialTrack: {
    height: 8,
    borderRadius: radius.pill,
    backgroundColor: colors.border,
    justifyContent: 'center',
    marginTop: spacing.xs,
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
  dialEnd: { ...typography.caption, color: colors.textMuted, fontSize: 12 },

  factTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: spacing.md,
  },
  factLabel: { ...typography.body, color: colors.textMuted },
  factValue: {
    ...typography.body,
    color: colors.text,
    fontWeight: '600',
    flexShrink: 1,
    textAlign: 'right',
  },

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

  exclusionBox: { gap: spacing.xs },
});
