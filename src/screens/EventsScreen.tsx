// Every upcoming event we have, not just the top matches. Screens slice.
// Soonest (the default) is a plain calendar; Best match puts the events that fit this profile first.

import { useMemo, useState } from 'react';
import { FlatList, Linking, Pressable, StyleSheet, Text, View } from 'react-native';

import { CATALOG, EVENTS_PULLED_AT, EVENT_SOURCES } from '../content';
import { useIntake } from '../intake';
import { rankKind } from '../matching';
import type { EventOpportunity, OpportunityMatch } from '../models';
import { colors, radius, spacing, typography } from '../theme';
import { Card } from './components/ui';

type SortMode = 'match' | 'date';

type Row = { event: EventOpportunity; match: OpportunityMatch | null };

const startFormat = new Intl.DateTimeFormat('en-US', {
  weekday: 'short',
  month: 'short',
  day: 'numeric',
  hour: 'numeric',
  minute: '2-digit',
});
const dayFormat = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' });

function humanize(value: string): string {
  return value.replace(/_/g, ' ').replace(/^./, (first) => first.toUpperCase());
}

/** "Tue, Oct 6, 6:00 PM", plus the end day when the event runs across several. */
function whenLine(event: EventOpportunity): string {
  const start = new Date(event.startsAt);
  const line = startFormat.format(start);
  if (!event.endsAt) return line;
  const end = new Date(event.endsAt);
  return end.toDateString() === start.toDateString() ? line : `${line} – ${dayFormat.format(end)}`;
}

function costLine(event: EventOpportunity): string | null {
  if (event.costUsd === null) return null;
  return event.costUsd === 0 ? 'Free' : `$${event.costUsd.toLocaleString('en-US')}`;
}

function EventRow({ event, match }: Row) {
  const where = event.location ?? (event.arrangement === 'Remote' ? 'Online' : null);
  const facts = [humanize(event.format), costLine(event)].filter(Boolean).join(' · ');

  return (
    <Card style={styles.card}>
      <View style={styles.cardTop}>
        <View style={styles.cardTitleBlock}>
          <Text style={styles.when}>{whenLine(event)}</Text>
          <Text style={styles.cardTitle}>{event.title}</Text>
          <Text style={styles.org}>{[event.organization, where].filter(Boolean).join(' · ')}</Text>
        </View>
        {match ? (
          <View style={styles.score}>
            <Text style={styles.scoreValue}>{match.matchScore}</Text>
            <Text style={styles.scoreLabel}>match</Text>
          </View>
        ) : null}
      </View>

      <Text style={styles.summary} numberOfLines={2}>
        {event.summary}
      </Text>
      <Text style={styles.facts}>{facts}</Text>
      {match?.whyItFits[0] ? <Text style={styles.fit}>✓ {match.whyItFits[0]}</Text> : null}

      <Pressable onPress={() => Linking.openURL(event.url)} hitSlop={8} accessibilityRole="link">
        <Text style={styles.link}>View details</Text>
      </Pressable>
    </Card>
  );
}

export function EventsScreen() {
  const { profile } = useIntake();
  const [sort, setSort] = useState<SortMode>('date');

  const rows = useMemo<Row[]>(() => {
    const byId = new Map(CATALOG.map((item) => [item.id, item]));
    const now = new Date();

    let list: Row[];
    if (profile) {
      list = rankKind('event', profile, CATALOG, now).flatMap((match) => {
        const item = byId.get(match.opportunityId);
        return item?.kind === 'event' ? [{ event: item, match }] : [];
      });
    } else {
      // No profile yet: still show everything, just without scores.
      list = CATALOG.flatMap((item) =>
        item.kind === 'event' && Date.parse(item.endsAt ?? item.startsAt) >= now.getTime()
          ? [{ event: item, match: null }]
          : [],
      );
    }

    return sort === 'date'
      ? [...list].sort((a, b) => Date.parse(a.event.startsAt) - Date.parse(b.event.startsAt))
      : list;
  }, [profile, sort]);

  const sourceCount = EVENT_SOURCES.length;
  const pulled = EVENTS_PULLED_AT ? dayFormat.format(new Date(EVENTS_PULLED_AT)) : null;

  return (
    <FlatList
      style={styles.screen}
      contentContainerStyle={styles.content}
      data={rows}
      keyExtractor={(row) => row.event.id}
      renderItem={({ item }) => <EventRow {...item} />}
      initialNumToRender={8}
      ListHeaderComponent={
        <View style={styles.header}>
          <Text style={styles.title}>Detroit events</Text>
          <Text style={styles.subtitle}>
            {rows.length} upcoming
            {sourceCount > 0 ? ` from ${sourceCount} sources` : ''}
            {pulled ? `. Updated ${pulled}.` : '.'}
          </Text>

          {profile ? (
            <View style={styles.toggle} accessibilityRole="tablist">
              {(['date', 'match'] as const).map((mode) => (
                <Pressable
                  key={mode}
                  onPress={() => setSort(mode)}
                  style={[styles.toggleItem, sort === mode && styles.toggleItemActive]}
                  accessibilityRole="tab"
                  accessibilityState={{ selected: sort === mode }}
                >
                  <Text style={[styles.toggleText, sort === mode && styles.toggleTextActive]}>
                    {mode === 'match' ? 'Best match' : 'Soonest'}
                  </Text>
                </Pressable>
              ))}
            </View>
          ) : null}
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

  toggle: {
    flexDirection: 'row',
    alignSelf: 'flex-start',
    marginTop: spacing.sm,
    padding: 3,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceAlt,
  },
  toggleItem: { paddingVertical: 6, paddingHorizontal: spacing.md, borderRadius: radius.pill },
  toggleItemActive: { backgroundColor: colors.background },
  toggleText: { ...typography.label, color: colors.textMuted },
  toggleTextActive: { color: colors.primary },

  card: { gap: spacing.sm },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', gap: spacing.md },
  cardTitleBlock: { flex: 1, gap: 2 },
  when: { ...typography.label, color: colors.primary },
  cardTitle: { ...typography.heading, color: colors.text },
  org: { ...typography.caption, color: colors.textMuted },
  score: {
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 56,
    alignSelf: 'flex-start',
    paddingVertical: spacing.xs,
    borderRadius: radius.md,
    backgroundColor: colors.primarySoft,
  },
  scoreValue: { ...typography.title, color: colors.primary },
  scoreLabel: { ...typography.label, color: colors.primary },

  summary: { ...typography.body, color: colors.text, lineHeight: 21 },
  facts: { ...typography.caption, color: colors.textMuted },
  fit: { ...typography.caption, color: colors.success, lineHeight: 18 },
  link: { ...typography.caption, color: colors.primary, fontWeight: '600' },
});
