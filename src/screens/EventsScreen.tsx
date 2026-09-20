// Every upcoming Detroit event, searchable and sortable. Screens slice.
//
// Soonest (the default) is a plain calendar; Best fit puts the events that suit
// this profile first. Same card, search and filter grammar as Browse, so the
// two pages are one thing to learn rather than two.

import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useMemo, useState } from 'react';
import { FlatList, StyleSheet, Text, View } from 'react-native';

import { CATALOG, EVENTS_PULLED_AT, EVENT_SOURCES } from '../content';
import { useIntake } from '../intake';
import { rankKind } from '../matching';
import type { EventOpportunity, OpportunityMatch } from '../models';
import type { RootStackParamList } from '../navigation/types';
import { colors, spacing, typography } from '../theme';
import { GRID_GAP, useLayout } from '../web/layout';
import { OpportunityCard } from './components/OpportunityCard';
import { SearchField, Segmented } from './components/filters';
import { formatDay } from './components/opportunityFacts';
import { EmptyState, LinkButton } from './components/ui';

type Nav = NativeStackNavigationProp<RootStackParamList>;
type SortMode = 'date' | 'match';
type CostMode = 'any' | 'free';
type Row = { event: EventOpportunity; match: OpportunityMatch | null };

/** Everything a search should look at on an event. */
function haystack(event: EventOpportunity): string {
  return [event.title, event.organization, event.summary, event.location ?? '', event.format]
    .join(' ')
    .toLowerCase();
}

export function EventsScreen() {
  const navigation = useNavigation<Nav>();
  const { profile } = useIntake();
  const { columns, cardWidth, isCompact } = useLayout();
  const [query, setQuery] = useState('');
  const [cost, setCost] = useState<CostMode>('any');
  const [sort, setSort] = useState<SortMode>('date');

  const all = useMemo<Row[]>(() => {
    const byId = new Map(CATALOG.map((item) => [item.id, item]));
    const now = new Date();

    // Every upcoming event, whether or not it clears the profile's limits. The
    // profile adds a score and an order; it does not decide what is on.
    const upcoming = CATALOG.flatMap((item) =>
      item.kind === 'event' && Date.parse(item.endsAt ?? item.startsAt) >= now.getTime()
        ? [item]
        : [],
    );

    const scores = new Map<string, OpportunityMatch>();
    if (profile) {
      for (const match of rankKind('event', profile, CATALOG, now)) {
        if (byId.has(match.opportunityId)) scores.set(match.opportunityId, match);
      }
    }

    return upcoming.map((event) => ({ event, match: scores.get(event.id) ?? null }));
  }, [profile]);

  const rows = useMemo<Row[]>(() => {
    const terms = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
    const filtered = all.filter((row) => {
      if (cost === 'free' && row.event.costUsd !== 0 && row.event.costUsd !== null) return false;
      if (terms.length === 0) return true;
      const text = haystack(row.event);
      return terms.every((term) => text.includes(term));
    });

    return sort === 'date'
      ? [...filtered].sort((a, b) => Date.parse(a.event.startsAt) - Date.parse(b.event.startsAt))
      : [...filtered].sort((a, b) => (b.match?.matchScore ?? -1) - (a.match?.matchScore ?? -1));
  }, [all, query, cost, sort]);

  const pulled = EVENTS_PULLED_AT ? formatDay(EVENTS_PULLED_AT) : null;
  const filtered = rows.length !== all.length;

  return (
    <FlatList
      // numColumns cannot change on a mounted list.
      key={columns}
      style={styles.screen}
      contentContainerStyle={styles.content}
      data={rows}
      numColumns={columns}
      columnWrapperStyle={columns > 1 ? styles.gridRow : undefined}
      keyExtractor={(row) => row.event.id}
      renderItem={({ item }) => (
        <OpportunityCard
          match={item.match}
          item={item.event}
          clash={profile !== null && item.match === null}
          width={columns > 1 ? cardWidth : undefined}
        />
      )}
      initialNumToRender={12}
      keyboardShouldPersistTaps="handled"
      ListEmptyComponent={
        <EmptyState
          title="No events match that"
          body="Try a shorter search, or clear the cost filter."
          action={{
            label: 'Show all events',
            onPress: () => {
              setQuery('');
              setCost('any');
            },
          }}
        />
      }
      ListHeaderComponent={
        <View style={styles.header}>
          <View style={styles.intro}>
            <Text style={styles.title} accessibilityRole="header">
              Detroit events
            </Text>
            <Text style={styles.subtitle}>
              {all.length} coming up
              {EVENT_SOURCES.length > 0 ? ` from ${EVENT_SOURCES.length} sources` : ''}
              {pulled ? `, checked ${pulled}` : ''}. These are live listings, not samples.
            </Text>
          </View>

          <SearchField
            value={query}
            onChange={setQuery}
            placeholder="Search by title, host or place"
            accessibilityLabel="Search events"
          />

          <View style={[styles.controls, isCompact && styles.controlsStacked]}>
            <Segmented
              label="Cost"
              value={cost}
              onChange={setCost}
              options={[
                { value: 'any', label: 'Any' },
                { value: 'free', label: 'Free' },
              ]}
            />
            <Segmented
              label="Sort by"
              value={sort}
              onChange={setSort}
              options={[
                { value: 'date', label: 'Soonest' },
                ...(profile ? ([{ value: 'match', label: 'Best fit' }] as const) : []),
              ]}
            />
          </View>

          <View style={styles.resultBar}>
            <Text style={styles.resultCount}>
              {filtered ? `${rows.length} of ${all.length}` : `Showing all ${all.length}`}
              {sort === 'date' ? ', soonest first' : ', best fit first'}
            </Text>
            {filtered ? (
              <LinkButton
                label="Clear filters"
                onPress={() => {
                  setQuery('');
                  setCost('any');
                }}
              />
            ) : null}
          </View>
        </View>
      }
      ListFooterComponent={
        rows.length > 0 ? (
          <View style={styles.footer}>
            <Text style={styles.footerText}>Looking for something longer term?</Text>
            <LinkButton
              label="Browse jobs, programs and research →"
              onPress={() => navigation.navigate('OpportunityList')}
            />
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
