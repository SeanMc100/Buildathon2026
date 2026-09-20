// Every listing of one kind (jobs, internships, programs or research), not just the top few. Screens slice.
// Ranked best fit first once there is a profile; the plain catalog until then.
// Events have their own screen because they add a date sort; see EventsScreen.tsx.

import { useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp, NativeStackScreenProps } from '@react-navigation/native-stack';
import { useMemo } from 'react';
import { FlatList, StyleSheet, Text, View } from 'react-native';

import { CATALOG } from '../content';
import { useIntake } from '../intake';
import { isVisible, rankKind } from '../matching';
import type { Opportunity, OpportunityKind, OpportunityMatch } from '../models';
import type { ListKind, RootStackParamList } from '../navigation/types';
import { colors, spacing, typography } from '../theme';
import { GRID_GAP, useLayout } from '../web/layout';
import { OpportunityCard } from './components/OpportunityCard';
import { Button } from './components/ui';

export const KIND_TITLES: Record<OpportunityKind, string> = {
  job: 'Jobs and internships',
  program: 'Programs',
  event: 'Events',
  research: 'Research programs',
};

const LIST_TITLES: Record<ListKind, string> = {
  job: 'Jobs',
  internship: 'Internships',
  program: 'Programs',
  research: 'Research programs',
};

const CATALOG_BY_ID = new Map<string, Opportunity>(CATALOG.map((item) => [item.id, item]));

export function isInternship(item: Opportunity): boolean {
  return item.kind === 'job' && item.employmentType === 'Internship';
}

/** Whether a listing belongs on the given list. Internships are carved out of the jobs. */
function belongsTo(kind: ListKind, item: Opportunity): boolean {
  if (kind === 'internship') return isInternship(item);
  if (kind === 'job') return item.kind === 'job' && !isInternship(item);
  return item.kind === kind;
}

/** The catalog kind a list draws from, which is what the matcher ranks. */
function catalogKind(kind: ListKind): Exclude<OpportunityKind, 'event'> {
  return kind === 'internship' ? 'job' : kind;
}

type Row = { match: OpportunityMatch | null; item: Opportunity };

export function OpportunityListScreen() {
  const { params } = useRoute<NativeStackScreenProps<RootStackParamList, 'OpportunityList'>['route']>();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { profile } = useIntake();
  const { columns, cardWidth } = useLayout();
  const { kind } = params;

  // With a profile the matches come first, best fit first. Anything the matcher
  // ruled out (a hard line such as work arrangement or pay) follows, unscored, so
  // a menu link never lands on an empty page.
  const { rows, matched } = useMemo(() => {
    const now = new Date();
    const everything = CATALOG.filter((item) => belongsTo(kind, item) && isVisible(item, now));
    if (!profile) {
      return { rows: everything.map((item): Row => ({ match: null, item })), matched: 0 };
    }

    const ranked = rankKind(catalogKind(kind), profile, CATALOG).flatMap((match): Row[] => {
      const item = CATALOG_BY_ID.get(match.opportunityId);
      return item && belongsTo(kind, item) ? [{ match, item }] : [];
    });
    const rankedIds = new Set(ranked.map((row) => row.item.id));
    const rest = everything.filter((item) => !rankedIds.has(item.id)).map((item): Row => ({ match: null, item }));
    return { rows: [...ranked, ...rest], matched: ranked.length };
  }, [profile, kind]);
  const unmatched = rows.length - matched;

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
        <OpportunityCard match={item.match} item={item.item} width={columns > 1 ? cardWidth : undefined} />
      )}
      initialNumToRender={8}
      ListEmptyComponent={<Text style={styles.emptyText}>Nothing here yet.</Text>}
      ListHeaderComponent={
        <View style={styles.header}>
          <Text style={styles.title}>{LIST_TITLES[kind]}</Text>
          <Text style={styles.subtitle}>
            {!profile
              ? `${rows.length} listings.`
              : unmatched === 0
                ? `${matched} matches, best fit first.`
                : matched === 0
                  ? `None of these meet your requirements, so they are shown without a score.`
                  : `${matched} ${matched === 1 ? 'match' : 'matches'}, best fit first. The ${unmatched} without a score do not meet your requirements.`}
          </Text>
          {profile ? null : (
            <View style={styles.prompt}>
              <Text style={styles.promptText}>Answer a few questions to rank these by how well they fit you.</Text>
              <Button label="Build my profile" onPress={() => navigation.navigate('IntakeIntro')} />
            </View>
          )}
        </View>
      }
    />
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.lg, gap: spacing.md, paddingBottom: spacing.xxl },
  gridRow: { gap: GRID_GAP },

  header: { gap: spacing.xs, marginBottom: spacing.sm },
  title: { ...typography.display, color: colors.text },
  subtitle: { ...typography.caption, color: colors.textMuted, lineHeight: 18 },
  prompt: { gap: spacing.sm, marginTop: spacing.sm, maxWidth: 360 },
  promptText: { ...typography.body, color: colors.textMuted, lineHeight: 21 },

  emptyText: { ...typography.body, color: colors.textMuted, textAlign: 'center', padding: spacing.lg },
});
