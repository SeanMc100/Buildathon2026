// The matches page: the best of each kind for this profile, with a way through
// to the whole list. Screens slice.
// Scoring runs locally against the catalog (live events plus samples); see
// src/matching/opportunities.ts.

import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useMemo } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { CATALOG } from '../content';
import { useIntake } from '../intake';
import { OPPORTUNITY_KINDS, matchOpportunities, rankKind } from '../matching';
import type { Opportunity, OpportunityKind, OpportunityMatch } from '../models';
import type { BrowseKind, RootStackParamList } from '../navigation/types';
import { colors, spacing, typography } from '../theme';
import { GRID_GAP, useLayout } from '../web/layout';
import { BulletinBoardSection } from './components/BulletinBoardSection';
import { OpportunityCard } from './components/OpportunityCard';
import { SCORE_HELP } from './components/opportunityFacts';
import { Button, EmptyState, LinkButton, SectionHeading } from './components/ui';

type Nav = NativeStackNavigationProp<RootStackParamList>;

const CATALOG_BY_ID = new Map<string, Opportunity>(CATALOG.map((item) => [item.id, item]));

const SECTION_TITLES: Record<OpportunityKind, string> = {
  job: 'Jobs and internships',
  program: 'Programs',
  event: 'Events',
  research: 'Research places',
};

/** Where "see all" goes for each kind. Events have their own screen. */
const SECTION_BROWSE: Record<Exclude<OpportunityKind, 'event'>, BrowseKind> = {
  job: 'job',
  program: 'program',
  research: 'research',
};

/** Events read best as a calendar: the top matches, soonest first. */
function inDateOrder(matches: OpportunityMatch[]): OpportunityMatch[] {
  const start = (match: OpportunityMatch) => {
    const item = CATALOG_BY_ID.get(match.opportunityId);
    return item?.kind === 'event' ? Date.parse(item.startsAt) : 0;
  };
  return [...matches].sort((a, b) => start(a) - start(b));
}

/** How many cards a section previews before handing over to the full list. */
const PREVIEW_ROWS = 2;

export function ResultsScreen() {
  const navigation = useNavigation<Nav>();
  const { profile } = useIntake();
  const layout = useLayout();
  const columns = layout.columns;
  const perSection = columns * PREVIEW_ROWS;

  const results = useMemo(
    () => (profile ? matchOpportunities(profile, CATALOG) : null),
    [profile],
  );

  // What each section is a preview *of*. The header used to count the capped
  // preview lists while the "see all" buttons counted the full ones, so the
  // page contradicted itself; both now come from here.
  const totals = useMemo(
    () =>
      Object.fromEntries(
        OPPORTUNITY_KINDS.map((kind) => [
          kind,
          profile ? rankKind(kind, profile, CATALOG).length : 0,
        ]),
      ) as Record<OpportunityKind, number>,
    [profile],
  );

  if (!profile || !results) {
    return (
      <View style={styles.gate}>
        <EmptyState
          title="Answer a few questions first"
          body="Matches are scored against what you tell us matters. It takes about four minutes, and you can skip anything."
          action={{ label: 'Start the questionnaire', onPress: () => navigation.replace('IntakeIntro') }}
          secondaryAction={{
            label: 'Browse without a profile',
            onPress: () => navigation.navigate('OpportunityList'),
          }}
        />
      </View>
    );
  }

  const grandTotal = OPPORTUNITY_KINDS.reduce((sum, kind) => sum + totals[kind], 0);

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <Text style={styles.title} accessibilityRole="header">
          Your matches
        </Text>
        <Text style={styles.subtitle}>
          {grandTotal} opportunities scored against your answers. {SCORE_HELP}
        </Text>
        <View style={styles.headerActions}>
          <Button
            label="Browse and filter everything"
            variant="secondary"
            onPress={() => navigation.navigate('OpportunityList')}
          />
          <Button
            label="Change an answer"
            variant="ghost"
            onPress={() => navigation.navigate('Profile')}
          />
        </View>
      </View>

      {results.unmetConstraints.length > 0 ? (
        <EmptyState
          tone="caution"
          title="Some kinds came back empty"
          body={results.unmetConstraints.join(' ')}
          action={{ label: 'Change an answer', onPress: () => navigation.navigate('Profile') }}
          secondaryAction={{
            label: 'Browse without your limits',
            onPress: () => navigation.navigate('OpportunityList'),
          }}
        />
      ) : null}

      {OPPORTUNITY_KINDS.map((kind, index) => {
        const all = results.byKind[kind];
        if (all.length === 0) return null;
        const ordered = kind === 'event' ? inDateOrder(all) : all;
        const shown = ordered.slice(0, perSection);
        const total = totals[kind];
        const seeAll =
          kind === 'event'
            ? { label: `See all ${total} Detroit events`, onPress: () => navigation.navigate('Events') }
            : {
                label: `See all ${total} ${SECTION_TITLES[kind].toLowerCase()}`,
                onPress: () =>
                  navigation.navigate('OpportunityList', { kind: SECTION_BROWSE[kind] }),
              };

        return (
          <View key={kind}>
            <View style={styles.section}>
              <SectionHeading
                title={SECTION_TITLES[kind]}
                count={total}
                help={
                  total > shown.length
                    ? `The best ${shown.length}. ${total - shown.length} more in the full list.`
                    : undefined
                }
              />
              <View style={styles.grid}>
                {shown.map((match) => {
                  const item = CATALOG_BY_ID.get(match.opportunityId);
                  return item ? (
                    <OpportunityCard
                      key={match.opportunityId}
                      match={match}
                      item={item}
                      width={columns > 1 ? layout.cardWidth : undefined}
                    />
                  ) : null;
                })}
              </View>
              {total > shown.length ? (
                <LinkButton label={`${seeAll.label} →`} onPress={seeAll.onPress} />
              ) : null}
            </View>

            {/* After the first section, so the page opens on matches rather than
                on the community, but still well above the fold. */}
            {index === 0 ? <BulletinBoardSection /> : null}
          </View>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.lg, gap: spacing.xl, paddingBottom: spacing.xxl },
  gate: { flex: 1, justifyContent: 'center', padding: spacing.lg },

  header: { gap: spacing.sm },
  title: { ...typography.display, color: colors.text },
  subtitle: { ...typography.caption, color: colors.textMuted, lineHeight: 21, maxWidth: 680 },
  headerActions: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.xs },

  section: { gap: spacing.md },
  grid: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'stretch', gap: GRID_GAP },
});
