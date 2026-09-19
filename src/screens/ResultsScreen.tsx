// Ranked opportunities for the current profile, grouped by kind. Screens slice.
// Scoring runs locally against the catalog (live events plus samples); see src/matching/opportunities.ts.

import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useMemo } from 'react';
import { Linking, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';

import { CATALOG } from '../content';
import { useIntake } from '../intake';
import { OPPORTUNITY_KINDS, matchOpportunities, rankKind } from '../matching';
import type { Opportunity, OpportunityKind, OpportunityMatch } from '../models';
import type { RootStackParamList } from '../navigation/types';
import { colors, radius, spacing, typography } from '../theme';
import { BulletinBoardSection } from './components/BulletinBoardSection';
import { Button, Card } from './components/ui';

type Nav = NativeStackNavigationProp<RootStackParamList>;

const KIND_TITLES: Record<OpportunityKind, string> = {
  job: 'Jobs and internships',
  program: 'Programs',
  event: 'Events',
  research: 'Research programs',
};

const CATALOG_BY_ID = new Map<string, Opportunity>(CATALOG.map((item) => [item.id, item]));

const dateFormat = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' });

function formatDate(iso: string): string {
  return dateFormat.format(new Date(iso));
}

function money(value: number): string {
  return `$${value.toLocaleString('en-US')}`;
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

function humanize(value: string): string {
  return value
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/_/g, ' ')
    .toLowerCase()
    .replace(/^./, (first) => first.toUpperCase());
}

function deadlineLine(item: Opportunity): string | null {
  return 'applyBy' in item && item.applyBy ? `Apply by ${formatDate(item.applyBy)}` : null;
}

/** Leaves the next card peeking in so it is obvious the row scrolls. */
const CARD_PEEK = spacing.xl;
const CARD_GAP = spacing.sm + 4;

function MatchCard({
  match,
  item,
  width,
}: {
  match: OpportunityMatch;
  item: Opportunity;
  width: number;
}) {
  const deadline = deadlineLine(item);
  const where = [item.location, item.arrangement].filter(Boolean).join(' · ');

  return (
    <Card style={[styles.card, { width }]}>
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

export function ResultsScreen() {
  const navigation = useNavigation<Nav>();
  const { profile } = useIntake();
  const { width: screenWidth } = useWindowDimensions();
  const cardWidth = screenWidth - spacing.lg * 2 - CARD_PEEK;

  const results = useMemo(
    () => (profile ? matchOpportunities(profile, CATALOG) : null),
    [profile],
  );
  // The section shows the top matches; this is how many events exist in all.
  const totalEvents = useMemo(
    () => (profile ? rankKind('event', profile, CATALOG).length : 0),
    [profile],
  );

  if (!profile || !results) {
    return (
      <View style={styles.empty}>
        <Text style={styles.emptyText}>Answer a few questions to see matches.</Text>
        <Button label="Start the questionnaire" onPress={() => navigation.replace('IntakeIntro')} />
      </View>
    );
  }

  const total = OPPORTUNITY_KINDS.reduce((sum, kind) => sum + results.byKind[kind].length, 0);

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <View style={[styles.header, styles.inset]}>
        <Text style={styles.title}>Your matches</Text>
        <Text style={styles.subtitle}>
          {total} matches. Events are live Detroit listings; the rest are samples for the demo.
        </Text>
      </View>

      {/* Sits above every opportunity so people find their community first. */}
      <BulletinBoardSection />

      {results.unmetConstraints.map((note) => (
        <Text key={note} style={[styles.note, styles.inset]}>
          {note}
        </Text>
      ))}

      {OPPORTUNITY_KINDS.map((kind) => {
        const matches = results.byKind[kind];
        if (matches.length === 0) return null;
        return (
          <View key={kind} style={styles.section}>
            <Text style={[styles.sectionTitle, styles.inset]}>{KIND_TITLES[kind]}</Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              snapToInterval={cardWidth + CARD_GAP}
              snapToAlignment="start"
              decelerationRate="fast"
              contentContainerStyle={styles.carousel}
            >
              {matches.map((match) => {
                const item = CATALOG_BY_ID.get(match.opportunityId);
                return item ? (
                  <MatchCard key={match.opportunityId} match={match} item={item} width={cardWidth} />
                ) : null;
              })}
            </ScrollView>
            {kind === 'event' && totalEvents > matches.length ? (
              <View style={styles.inset}>
                <Button
                  label={`See all ${totalEvents} Detroit events`}
                  variant="ghost"
                  onPress={() => navigation.navigate('Events')}
                />
              </View>
            ) : null}
          </View>
        );
      })}

      <View style={styles.inset}>
        <Button label="Back to my profile" variant="ghost" onPress={() => navigation.goBack()} />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  // Horizontal padding lives on `inset` and `carousel` so each carousel can scroll
  // edge to edge instead of being clipped by the page padding.
  content: { paddingVertical: spacing.lg, gap: spacing.lg, paddingBottom: spacing.xxl },
  inset: { paddingHorizontal: spacing.lg },
  carousel: { paddingHorizontal: spacing.lg, gap: CARD_GAP },

  header: { gap: spacing.xs },
  title: { ...typography.display, color: colors.text },
  subtitle: { ...typography.caption, color: colors.textMuted, lineHeight: 18 },
  note: { ...typography.caption, color: colors.warning, lineHeight: 18 },

  section: { gap: spacing.sm },
  sectionTitle: { ...typography.title, color: colors.text },

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

  empty: {
    flex: 1,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.lg,
    gap: spacing.md,
  },
  emptyText: { ...typography.body, color: colors.textMuted, textAlign: 'center' },
});
