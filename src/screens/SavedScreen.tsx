// The shortlist: everything put aside, newest first. Screens slice.
//
// Browsing 400 listings only helps if there is somewhere to put the handful
// worth a second look.

import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useMemo } from 'react';
import { FlatList, StyleSheet, Text, View } from 'react-native';

import { CATALOG } from '../content';
import { useIntake } from '../intake';
import { rankKind } from '../matching';
import type { Opportunity, OpportunityMatch } from '../models';
import type { RootStackParamList } from '../navigation/types';
import { useSaved } from '../saved';
import { colors, spacing, typography } from '../theme';
import { GRID_GAP, useLayout } from '../web/layout';
import { OpportunityCard } from './components/OpportunityCard';
import { EmptyState, LinkButton } from './components/ui';

type Nav = NativeStackNavigationProp<RootStackParamList>;
type Row = { match: OpportunityMatch | null; item: Opportunity };

const CATALOG_BY_ID = new Map<string, Opportunity>(CATALOG.map((item) => [item.id, item]));

export function SavedScreen() {
  const navigation = useNavigation<Nav>();
  const { profile } = useIntake();
  const { ids, count, clear } = useSaved();
  const { columns, cardWidth } = useLayout();

  const rows = useMemo<Row[]>(() => {
    // One ranking pass, reused for every saved item, so the scores here are the
    // same numbers the cards showed on the page they were saved from.
    const scores = new Map<string, OpportunityMatch>();
    if (profile) {
      for (const kind of ['job', 'program', 'research', 'event'] as const) {
        for (const match of rankKind(kind, profile, CATALOG)) {
          scores.set(match.opportunityId, match);
        }
      }
    }
    return ids.flatMap((id) => {
      const item = CATALOG_BY_ID.get(id);
      return item ? [{ item, match: scores.get(id) ?? null }] : [];
    });
  }, [ids, profile]);

  return (
    <FlatList
      // numColumns cannot change on a mounted list.
      key={columns}
      style={styles.screen}
      contentContainerStyle={styles.content}
      data={rows}
      numColumns={columns}
      columnWrapperStyle={columns > 1 ? styles.gridRow : undefined}
      keyExtractor={(row) => row.item.id}
      renderItem={({ item }) => (
        <OpportunityCard
          match={item.match}
          item={item.item}
          width={columns > 1 ? cardWidth : undefined}
        />
      )}
      ListEmptyComponent={
        <EmptyState
          title="Nothing saved yet"
          body="Tap Save on any opportunity and it lands here, so you can come back to a short list instead of the whole catalog."
          action={{ label: 'Browse opportunities', onPress: () => navigation.navigate('OpportunityList') }}
          secondaryAction={{ label: 'See Detroit events', onPress: () => navigation.navigate('Events') }}
        />
      }
      ListHeaderComponent={
        <View style={styles.header}>
          <Text style={styles.title} accessibilityRole="header">
            Saved
          </Text>
          <View style={styles.headerRow}>
            <Text style={styles.subtitle}>
              {count === 0
                ? 'Your shortlist is empty.'
                : `${count} ${count === 1 ? 'opportunity' : 'opportunities'}, most recently saved first.`}
            </Text>
            {count > 0 ? <LinkButton label="Clear all" tone="muted" onPress={clear} /> : null}
          </View>
        </View>
      }
    />
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.lg, gap: spacing.md, paddingBottom: spacing.xxl },
  gridRow: { gap: GRID_GAP, alignItems: 'stretch' },

  header: { gap: spacing.xs, marginBottom: spacing.sm },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  title: { ...typography.display, color: colors.text },
  subtitle: { ...typography.caption, color: colors.textMuted, lineHeight: 21, flex: 1 },
});
