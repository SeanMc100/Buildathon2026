// One ranked opportunity as a card. Shared by the results carousels and the "see all" lists. Screens slice.

import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';

import type { Opportunity, OpportunityMatch } from '../../models';
import { colors, radius, spacing, typography } from '../../theme';
import { Card } from './ui';

const dateFormat = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' });

function formatDate(iso: string): string {
  return dateFormat.format(new Date(iso));
}

function money(value: number): string {
  return `$${value.toLocaleString('en-US')}`;
}

function humanize(value: string): string {
  return value
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/_/g, ' ')
    .toLowerCase()
    .replace(/^./, (first) => first.toUpperCase());
}

/** One short line of the facts that differ by kind. */
function factLine(item: Opportunity): string {
  switch (item.kind) {
    case 'job': {
      const pay =
        item.payMinUsd !== null && item.payMaxUsd !== null
          ? `${money(item.payMinUsd)}–${money(item.payMaxUsd)}`
          : null;
      return [humanize(item.employmentType), pay].filter(Boolean).join(' · ');
    }
    case 'program': {
      const cost = item.costUsd === 0 ? 'Free' : item.costUsd !== null ? money(item.costUsd) : null;
      const weeks = item.durationWeeks ? `${item.durationWeeks} weeks` : null;
      const stipend = item.stipendUsd ? `${money(item.stipendUsd)} stipend` : null;
      return [cost, weeks, stipend].filter(Boolean).join(' · ');
    }
    case 'event': {
      const cost = item.costUsd === 0 ? 'Free' : item.costUsd !== null ? money(item.costUsd) : null;
      return [formatDate(item.startsAt), humanize(item.format), cost].filter(Boolean).join(' · ');
    }
    case 'research': {
      const weeks = item.durationWeeks ? `${item.durationWeeks} weeks` : null;
      const stipend = item.stipendUsd ? `${money(item.stipendUsd)} stipend` : null;
      return [item.field, weeks, stipend].filter(Boolean).join(' · ');
    }
  }
}

function deadlineLine(item: Opportunity): string | null {
  return 'applyBy' in item && item.applyBy ? `Apply by ${formatDate(item.applyBy)}` : null;
}

/** Pass `width` inside a horizontal carousel; leave it off to fill a vertical list. */
export function OpportunityCard({
  match,
  item,
  width,
}: {
  match: OpportunityMatch;
  item: Opportunity;
  width?: number;
}) {
  const deadline = deadlineLine(item);
  const where = [item.location, item.arrangement].filter(Boolean).join(' · ');

  return (
    <Card style={[styles.card, width !== undefined && { width }]}>
      <View style={styles.cardTop}>
        <View style={styles.cardTitleBlock}>
          <Text style={styles.cardTitle}>{item.title}</Text>
          <Text style={styles.org}>{item.organization}</Text>
          <Text style={styles.org}>{where}</Text>
        </View>
        <View style={styles.score}>
          <Text style={styles.scoreValue}>{match.matchScore}</Text>
          <Text style={styles.scoreLabel}>match</Text>
        </View>
      </View>

      <Text style={styles.summary} numberOfLines={2}>
        {item.summary}
      </Text>
      <Text style={styles.facts}>{[factLine(item), deadline].filter(Boolean).join(' · ')}</Text>

      <View style={styles.reasons}>
        {match.whyItFits.slice(0, 1).map((line) => (
          <Text key={line} style={styles.fit}>
            ✓ {line}
          </Text>
        ))}
        {match.gaps.slice(0, 1).map((line) => (
          <Text key={line} style={styles.gap}>
            – {line}
          </Text>
        ))}
      </View>

      <Pressable onPress={() => Linking.openURL(item.url)} hitSlop={8} accessibilityRole="link">
        <Text style={styles.link}>View details</Text>
      </Pressable>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { gap: spacing.sm },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', gap: spacing.md },
  cardTitleBlock: { flex: 1, gap: 2 },
  cardTitle: { ...typography.heading, color: colors.text },
  org: { ...typography.caption, color: colors.textMuted },
  score: {
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 56,
    paddingVertical: spacing.xs,
    borderRadius: radius.md,
    backgroundColor: colors.primarySoft,
  },
  scoreValue: { ...typography.title, color: colors.primary },
  scoreLabel: { ...typography.label, color: colors.primary },

  summary: { ...typography.body, color: colors.text, lineHeight: 21 },
  facts: { ...typography.caption, color: colors.textMuted },

  reasons: { gap: spacing.xs, marginTop: spacing.xs },
  fit: { ...typography.caption, color: colors.success, lineHeight: 18 },
  gap: { ...typography.caption, color: colors.textMuted, lineHeight: 18 },
  link: { ...typography.caption, color: colors.primary, fontWeight: '600' },
});
