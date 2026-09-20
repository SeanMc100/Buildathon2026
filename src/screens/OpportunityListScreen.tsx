// Every match of one kind (jobs, programs or research), not just the top few. Screens slice.
// Events have their own screen because they add a date sort; see EventsScreen.tsx.

import { useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp, NativeStackScreenProps } from '@react-navigation/native-stack';
import { useMemo } from 'react';
import { FlatList, StyleSheet, Text, View } from 'react-native';

import { CATALOG } from '../content';
import { useIntake } from '../intake';
import { rankKind } from '../matching';
import type { Opportunity, OpportunityKind, OpportunityMatch } from '../models';
import type { RootStackParamList } from '../navigation/types';
import { colors, spacing, typography } from '../theme';
import { OpportunityCard } from './components/OpportunityCard';
import { Button } from './components/ui';

export const KIND_TITLES: Record<OpportunityKind, string> = {
  job: 'Jobs and internships',
  program: 'Programs',
  event: 'Events',
  research: 'Research programs',
};

const CATALOG_BY_ID = new Map<string, Opportunity>(CATALOG.map((item) => [item.id, item]));

type Row = { match: OpportunityMatch; item: Opportunity };

export function OpportunityListScreen() {
  const { params } = useRoute<NativeStackScreenProps<RootStackParamList, 'OpportunityList'>['route']>();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { profile } = useIntake();
  const { kind } = params;

  const rows = useMemo<Row[]>(() => {
    if (!profile) return [];
    return rankKind(kind, profile, CATALOG).flatMap((match) => {
      const item = CATALOG_BY_ID.get(match.opportunityId);
      return item ? [{ match, item }] : [];
    });
  }, [profile, kind]);

  if (!profile) {
    return (
      <View style={styles.empty}>
        <Text style={styles.emptyText}>Answer a few questions to see matches.</Text>
        <Button label="Start the questionnaire" onPress={() => navigation.replace('IntakeIntro')} />
      </View>
    );
  }

  return (
    <FlatList
      style={styles.screen}
      contentContainerStyle={styles.content}
      data={rows}
      keyExtractor={(row) => row.match.opportunityId}
      renderItem={({ item }) => <OpportunityCard match={item.match} item={item.item} />}
      initialNumToRender={8}
      ListHeaderComponent={
        <View style={styles.header}>
          <Text style={styles.title}>{KIND_TITLES[kind]}</Text>
          <Text style={styles.subtitle}>{rows.length} matches, best fit first.</Text>
        </View>
      }
    />
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.lg, gap: spacing.md, paddingBottom: spacing.xxl },

  header: { gap: spacing.xs, marginBottom: spacing.sm },
  title: { ...typography.display, color: colors.text },
  subtitle: { ...typography.caption, color: colors.textMuted, lineHeight: 18 },

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
