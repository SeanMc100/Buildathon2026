// Ranked opportunities for the current profile, grouped by kind. Screens slice.
// Scoring runs locally against the catalog (live events plus samples); see src/matching/opportunities.ts.

import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useMemo } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { CATALOG } from '../content';
import { useIntake } from '../intake';
import { OPPORTUNITY_KINDS, matchOpportunities, rankKind } from '../matching';
import type { Opportunity, OpportunityKind, OpportunityMatch } from '../models';
import type { RootStackParamList } from '../navigation/types';
import { colors, spacing, typography } from '../theme';
import { GRID_GAP, useLayout } from '../web/layout';
import { BulletinBoardSection } from './components/BulletinBoardSection';
import { OpportunityCard } from './components/OpportunityCard';
import { Button } from './components/ui';
import { KIND_TITLES, isInternship } from './OpportunityListScreen';

type Nav = NativeStackNavigationProp<RootStackParamList>;

const CATALOG_BY_ID = new Map<string, Opportunity>(CATALOG.map((item) => [item.id, item]));

/** Events read best as a calendar: the top matches, soonest first. */
function inDateOrder(matches: OpportunityMatch[]): OpportunityMatch[] {
  const start = (match: OpportunityMatch) => {
    const item = CATALOG_BY_ID.get(match.opportunityId);
    return item?.kind === 'event' ? Date.parse(item.startsAt) : 0;
  };
  return [...matches].sort((a, b) => start(a) - start(b));
}

/** Leaves the next card peeking in so it is obvious the row scrolls. */
const CARD_PEEK = spacing.xl;
const CARD_GAP = spacing.sm + 4;
/** Where the row scrolls sideways there is room for every match; a grid shows this many rows, then links to the full list. */
const GRID_PREVIEW_ROWS = 2;

export function ResultsScreen() {
  const navigation = useNavigation<Nav>();
  const { profile } = useIntake();
  const layout = useLayout();
  // Phones scroll each kind sideways; wider windows lay the cards out in a grid.
  const isGrid = layout.columns > 1;
  const cardWidth = isGrid ? layout.cardWidth : layout.width - spacing.lg * 2 - CARD_PEEK;

  const results = useMemo(
    () => (profile ? matchOpportunities(profile, CATALOG) : null),
    [profile],
  );
  // Each section shows only the top matches; this is how many exist in all.
  const totals = useMemo(
    () =>
      Object.fromEntries(
        OPPORTUNITY_KINDS.map((kind) => [kind, profile ? rankKind(kind, profile, CATALOG).length : 0]),
      ) as Record<OpportunityKind, number>,
    [profile],
  );
  // The jobs section covers two lists: internships have their own page.
  const internshipTotal = useMemo(
    () =>
      profile
        ? rankKind('job', profile, CATALOG).filter((match) => {
            const item = CATALOG_BY_ID.get(match.opportunityId);
            return item !== undefined && isInternship(item);
          }).length
        : 0,
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

  /** Buttons under a section that open the full list, shown when the section is only a preview. */
  const seeAllLinks = (kind: OpportunityKind): { label: string; onPress: () => void }[] => {
    const shown = Math.min(
      isGrid ? layout.columns * GRID_PREVIEW_ROWS : Infinity,
      results.byKind[kind].length,
    );
    if (kind === 'job') {
      const jobs = totals.job - internshipTotal;
      const links: { label: string; onPress: () => void }[] = [];
      if (jobs > 0 && totals.job > shown) {
        links.push({ label: `See all ${jobs} jobs`, onPress: () => navigation.navigate('OpportunityList', { kind: 'job' }) });
      }
      if (internshipTotal > 0) {
        links.push({
          label: `See all ${internshipTotal} internships`,
          onPress: () => navigation.navigate('OpportunityList', { kind: 'internship' }),
        });
      }
      return links;
    }
    if (totals[kind] <= shown) return [];
    if (kind === 'event') {
      return [{ label: `See all ${totals.event} Detroit events`, onPress: () => navigation.navigate('Events') }];
    }
    return [
      {
        label: `See all ${totals[kind]} ${KIND_TITLES[kind].toLowerCase()}`,
        onPress: () => navigation.navigate('OpportunityList', { kind }),
      },
    ];
  };

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
        const all = results.byKind[kind];
        if (all.length === 0) return null;
        const ordered = kind === 'event' ? inDateOrder(all) : all;
        const matches = isGrid ? ordered.slice(0, layout.columns * GRID_PREVIEW_ROWS) : ordered;
        const cards = matches.map((match) => {
          const item = CATALOG_BY_ID.get(match.opportunityId);
          return item ? (
            <OpportunityCard key={match.opportunityId} match={match} item={item} width={cardWidth} />
          ) : null;
        });
        const seeAll = seeAllLinks(kind);
        return (
          <View key={kind} style={styles.section}>
            <Text style={[styles.sectionTitle, styles.inset]}>{KIND_TITLES[kind]}</Text>
            {isGrid ? (
              <View style={[styles.grid, styles.inset]}>{cards}</View>
            ) : (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                snapToInterval={cardWidth + CARD_GAP}
                snapToAlignment="start"
                decelerationRate="fast"
                contentContainerStyle={styles.carousel}
              >
                {cards}
              </ScrollView>
            )}
            {seeAll.length > 0 ? (
              <View style={[styles.inset, isGrid && styles.seeAll]}>
                {seeAll.map((link) => (
                  <Button
                    key={link.label}
                    label={link.label}
                    variant={isGrid ? 'secondary' : 'ghost'}
                    onPress={link.onPress}
                  />
                ))}
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
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: GRID_GAP },
  seeAll: { alignItems: 'flex-start' },

  header: { gap: spacing.xs },
  title: { ...typography.display, color: colors.text },
  subtitle: { ...typography.caption, color: colors.textMuted, lineHeight: 18 },
  note: { ...typography.caption, color: colors.warning, lineHeight: 18 },

  section: { gap: spacing.sm },
  sectionTitle: { ...typography.title, color: colors.text },

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
