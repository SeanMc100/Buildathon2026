// Browse: the whole catalog, searchable, filterable and sortable. Screens slice.
//
// One screen covers jobs, internships, programs and research, because they are
// the same list with a different type filter, and four separate pages meant
// four places to look and no way to search across them. Events keep their own
// screen, where a date sort and a calendar reading order earn the separation.

import { useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp, NativeStackScreenProps } from '@react-navigation/native-stack';
import { useMemo, useState } from 'react';
import { FlatList, StyleSheet, Text, View } from 'react-native';

import {
  DEFAULT_FILTERS,
  activeFilterCount,
  audiencesFromAnswers,
  fitsAudience,
  matchesFilters,
  sortRows,
  type BrowseFilters,
} from '../catalog';
import { CATALOG } from '../content';
import { useIntake } from '../intake';
import { isVisible, rankKind } from '../matching';
import type { Opportunity, OpportunityMatch } from '../models';
import type { BrowseKind, RootStackParamList } from '../navigation/types';
import { colors, spacing, typography } from '../theme';
import { GRID_GAP, useLayout } from '../web/layout';
import { ChipGroup, SearchField, Segmented, type ChipOption } from './components/filters';
import { OpportunityCard } from './components/OpportunityCard';
import { SCORE_HELP } from './components/opportunityFacts';
import { Button, EmptyState, LinkButton } from './components/ui';

type Nav = NativeStackNavigationProp<RootStackParamList>;
type Row = { match: OpportunityMatch | null; item: Opportunity };

export const KIND_TITLES: Record<BrowseKind, string> = {
  all: 'Everything',
  job: 'Jobs',
  internship: 'Internships and apprenticeships',
  program: 'Programs',
  research: 'Research',
  mentorship: 'Mentorship',
};

const KIND_ORDER: BrowseKind[] = ['all', 'job', 'internship', 'program', 'research', 'mentorship'];

/**
 * Every listing, always. The profile changes the order and adds a score; it
 * never decides what exists. The one exception is mentorship, which is limited
 * to programs the visitor can join (with a way to see the rest). Hiding whatever clashed with a deal-breaker meant
 * Browse silently dropped most of the catalog and left people staring at a
 * short list with no way to find out what was missing.
 */
function useRows(everyAudience: boolean): { rows: Row[]; hiddenMentorships: number } {
  const { profile, answers } = useIntake();
  return useMemo(() => {
    const now = new Date();
    const audiences = audiencesFromAnswers(answers);
    const visible = CATALOG.filter((item) => item.kind !== 'event' && isVisible(item, now));
    const live = everyAudience ? visible : visible.filter((item) => fitsAudience(item, audiences));
    const hiddenMentorships = visible.length - live.length;
    if (!profile) return { rows: live.map((item) => ({ match: null, item })), hiddenMentorships };

    // The matcher only scores what clears the hard constraints, so anything
    // missing from this map is shown unscored rather than dropped.
    const scores = new Map<string, OpportunityMatch>();
    for (const kind of ['job', 'internship', 'program', 'research'] as const) {
      for (const match of rankKind(kind, profile, CATALOG)) scores.set(match.opportunityId, match);
    }

    const rows = live
      .map((item) => ({ item, match: scores.get(item.id) ?? null }))
      .sort((a, b) => (b.match?.matchScore ?? -1) - (a.match?.matchScore ?? -1));
    return { rows, hiddenMentorships };
  }, [profile, answers, everyAudience]);
}

export function OpportunityListScreen() {
  const { params } = useRoute<NativeStackScreenProps<RootStackParamList, 'OpportunityList'>['route']>();
  const navigation = useNavigation<Nav>();
  const { profile } = useIntake();
  const { columns, cardWidth, isCompact } = useLayout();

  const [everyAudience, setEveryAudience] = useState(false);
  const { rows, hiddenMentorships } = useRows(everyAudience);
  const [filters, setFilters] = useState<BrowseFilters>({
    ...DEFAULT_FILTERS,
    kind: params?.kind ?? 'all',
    sort: profile ? 'match' : 'az',
  });

  const set = <K extends keyof BrowseFilters>(key: K, value: BrowseFilters[K]) =>
    setFilters((current) => ({ ...current, [key]: value }));

  // Counts are of what the other filters allow, so a chip never promises rows
  // that the current search would hide.
  const kindOptions = useMemo<ChipOption<BrowseKind>[]>(() => {
    return KIND_ORDER.map((kind) => ({
      value: kind,
      label: KIND_TITLES[kind],
      count: rows.filter((row) => matchesFilters(row.item, { ...filters, kind }, row.match !== null))
        .length,
    }));
  }, [rows, filters.query, filters.money, filters.entry, filters.fit]);

  const visible = useMemo(
    () =>
      sortRows(
        rows.filter((row) => matchesFilters(row.item, filters, row.match !== null)),
        filters.sort,
      ),
    [rows, filters],
  );

  const active = activeFilterCount(filters);
  // The mixed list leaves mentorships out, so "all" counts everything else.
  const inMentorship = filters.kind === 'mentorship';
  const scopeTotal = rows.filter((row) => (row.item.kind === 'mentorship') === inMentorship).length;
  const audienceNote =
    inMentorship && (hiddenMentorships > 0 || everyAudience) ? (
      <View style={styles.audienceNote}>
        <Text style={styles.audienceText}>
          {everyAudience
            ? 'Showing every program, including ones with eligibility rules you may not meet.'
            : `Showing programs open to you. ${hiddenMentorships} hidden because of who they are for.`}
        </Text>
        <LinkButton
          label={everyAudience ? 'Only programs open to me' : 'Show all'}
          onPress={() => setEveryAudience((current) => !current)}
        />
      </View>
    ) : null;
  const clearAll = () =>
    setFilters({ ...DEFAULT_FILTERS, sort: profile ? 'match' : 'az', kind: 'all' });

  return (
    <FlatList
      // numColumns cannot change on a mounted list.
      key={columns}
      style={styles.screen}
      contentContainerStyle={styles.content}
      data={visible}
      numColumns={columns}
      columnWrapperStyle={columns > 1 ? styles.gridRow : undefined}
      keyExtractor={(row) => row.item.id}
      renderItem={({ item }) => (
        <OpportunityCard
          match={item.match}
          item={item.item}
          clash={profile !== null && item.match === null && item.item.kind !== 'mentorship'}
          width={columns > 1 ? cardWidth : undefined}
        />
      )}
      initialNumToRender={12}
      keyboardShouldPersistTaps="handled"
      ListEmptyComponent={
        <EmptyState
          title="Nothing matches those filters"
          body="Try a shorter search, or widen one of the filters above."
          action={{ label: 'Clear filters', onPress: clearAll }}
        />
      }
      ListHeaderComponent={
        <View style={styles.header}>
          <View style={styles.intro}>
            <Text style={styles.title} accessibilityRole="header">
              Browse opportunities
            </Text>
            <Text style={styles.subtitle}>
              {rows.filter((row) => row.item.kind !== 'mentorship').length} jobs, internships,
              programs and research places across metro Detroit, plus mentorship programs run by
              other organisations.
              {profile ? ` ${SCORE_HELP} Anything that clashes with a deal-breaker is shown without a score.` : ''}
            </Text>
          </View>

          <SearchField
            value={filters.query}
            onChange={(next) => set('query', next)}
            placeholder="Search by title, employer or place"
            accessibilityLabel="Search opportunities"
          />

          <ChipGroup
            label="Type"
            options={kindOptions}
            value={filters.kind}
            onChange={(next) => set('kind', next)}
          />

          <View style={[styles.controls, isCompact && styles.controlsStacked]}>
            <Segmented
              label="Money"
              value={filters.money}
              onChange={(next) => set('money', next)}
              options={[
                { value: 'any', label: 'Any' },
                { value: 'paid', label: 'Pays me' },
                { value: 'free', label: 'Costs nothing' },
              ]}
            />
            <Segmented
              label="Entry"
              value={filters.entry}
              onChange={(next) => set('entry', next)}
              options={[
                { value: 'any', label: 'Any' },
                { value: 'no_degree', label: 'No degree needed' },
              ]}
            />
            {profile ? (
              <Segmented
                label="Deal-breakers"
                value={filters.fit}
                onChange={(next) => set('fit', next)}
                options={[
                  { value: 'any', label: 'Show everything' },
                  { value: 'fits', label: 'Only what fits' },
                ]}
              />
            ) : null}
            <Segmented
              label="Sort by"
              value={filters.sort}
              onChange={(next) => set('sort', next)}
              options={[
                ...(profile ? ([{ value: 'match', label: 'Best fit' }] as const) : []),
                { value: 'az', label: 'A–Z' },
                { value: 'pay', label: 'Highest paid' },
              ]}
            />
          </View>

          <View style={styles.resultBar}>
            <Text style={styles.resultCount}>
              {visible.length === scopeTotal
                ? `Showing all ${scopeTotal}`
                : `${visible.length} of ${scopeTotal}`}
              {profile && filters.sort === 'match' ? ', best fit first' : ''}
            </Text>
            {active > 0 ? <LinkButton label="Clear filters" onPress={clearAll} /> : null}
          </View>

          {audienceNote}

          {profile ? null : (
            <View style={styles.prompt}>
              <Text style={styles.promptText}>
                Answer a few questions and every listing here gets a fit score, best first.
              </Text>
              <Button
                label="Build my profile"
                onPress={() => navigation.navigate('IntakeIntro')}
              />
            </View>
          )}
        </View>
      }
      ListFooterComponent={
        visible.length > 0 ? (
          <View style={styles.footer}>
            <Text style={styles.footerText}>Looking for something happening soon?</Text>
            <LinkButton label="See Detroit events →" onPress={() => navigation.navigate('Events')} />
          </View>
        ) : null
      }
    />
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.lg, gap: spacing.md, paddingBottom: spacing.xxl },
  gridRow: { gap: GRID_GAP, alignItems: 'stretch' },

  header: { gap: spacing.lg, marginBottom: spacing.sm },
  intro: { gap: spacing.xs },
  title: { ...typography.display, color: colors.text },
  subtitle: { ...typography.caption, color: colors.textMuted, lineHeight: 21, maxWidth: 680 },

  controls: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.lg },
  controlsStacked: { flexDirection: 'column', gap: spacing.md },

  resultBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  resultCount: { ...typography.caption, fontWeight: '600', color: colors.text },

  audienceNote: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  audienceText: { ...typography.caption, color: colors.textMuted, flexShrink: 1, lineHeight: 21 },

  prompt: {
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: 12,
    backgroundColor: colors.primarySoft,
  },
  promptText: { ...typography.caption, color: colors.text, lineHeight: 21 },

  footer: {
    alignItems: 'center',
    gap: spacing.xs,
    marginTop: spacing.lg,
    paddingTop: spacing.lg,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  footerText: { ...typography.caption, color: colors.textMuted },
});
