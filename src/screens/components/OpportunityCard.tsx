// One opportunity as a card. Shared by the matches page, Browse, Events and the
// shortlist. Screens slice.
//
// The whole card is the target, because a 400px card whose only action is a
// 14px link is a card people fail to open. It goes to the detail screen rather
// than straight off-site, so there is somewhere to read the full listing, see
// why it scored what it did, and save it.

import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { Opportunity, OpportunityMatch } from '../../models';
import type { RootStackParamList } from '../../navigation/types';
import { useSaved } from '../../saved';
import { colors, radius, spacing, typography } from '../../theme';
import { focusRing, isFocused } from '../../web/focus';
import { isHovered } from '../../web/hover';
import {
  deadlineLine,
  eventWhen,
  headlineFact,
  isDeadlineSoon,
  kindLabel,
  placeLine,
  scoreBand,
  supportingFacts,
} from './opportunityFacts';
import { PressableCard } from './ui';

type Nav = NativeStackNavigationProp<RootStackParamList>;

/** The fit badge: the number, and the word that says what the number means. */
export function ScoreBadge({ score, compact }: { score: number; compact?: boolean }) {
  const band = scoreBand(score);
  return (
    <View style={[styles.score, BADGE_FILL[band.tone], compact && styles.scoreCompact]}>
      <Text style={[styles.scoreValue, BADGE_TEXT[band.tone]]}>{score}</Text>
      <Text style={[styles.scoreLabel, BADGE_TEXT[band.tone]]} numberOfLines={1}>
        {band.label}
      </Text>
    </View>
  );
}

/** Save and unsave, without opening the card it sits on. */
export function SaveButton({ id, title }: { id: string; title: string }) {
  const { isSaved, toggle } = useSaved();
  const saved = isSaved(id);

  return (
    <Pressable
      onPress={() => toggle(id)}
      hitSlop={10}
      accessibilityRole="button"
      accessibilityState={{ selected: saved }}
      accessibilityLabel={saved ? `Remove ${title} from saved` : `Save ${title}`}
      style={(state) => [
        styles.save,
        saved && styles.saveOn,
        isHovered(state) && styles.saveHover,
        isFocused(state) && focusRing,
      ]}
    >
      <Text style={[styles.saveGlyph, saved && styles.saveGlyphOn]}>{saved ? '★' : '☆'}</Text>
      <Text style={[styles.saveText, saved && styles.saveTextOn]}>{saved ? 'Saved' : 'Save'}</Text>
    </Pressable>
  );
}

/**
 * Pass `width` inside a grid; leave it off to fill a vertical list.
 * Without a `match` (no profile yet) the card shows the listing alone, unscored.
 */
export function OpportunityCard({
  match,
  item,
  width,
  clash,
}: {
  match: OpportunityMatch | null;
  item: Opportunity;
  width?: number;
  /** There is a profile, but this listing sits outside one of its deal-breakers. */
  clash?: boolean;
}) {
  const navigation = useNavigation<Nav>();
  const headline = headlineFact(item);
  const deadline = deadlineLine(item);
  const soon = isDeadlineSoon(item);
  const where = placeLine(item);
  const when = eventWhen(item);
  // The date has moved to its own line above the title, so drop it from the
  // supporting facts rather than printing it twice.
  const facts = item.kind === 'event' ? supportingFacts(item).slice(1) : supportingFacts(item);

  return (
    <PressableCard
      onPress={() => navigation.navigate('OpportunityDetail', { id: item.id })}
      accessibilityLabel={`${item.title} at ${item.organization}${
        match ? `, ${scoreBand(match.matchScore).label}, ${match.matchScore} out of 100` : ''
      }`}
      style={[styles.card, width !== undefined && { width }]}
    >
      <View style={styles.top}>
        <View style={styles.titleBlock}>
          <View style={styles.tags}>
            <Text style={styles.kind}>{kindLabel(item).toUpperCase()}</Text>
            {item.isSample ? <Text style={styles.sample}>SAMPLE</Text> : null}
          </View>
          {/* An event is a date first and a title second. */}
          {when ? <Text style={styles.when}>{when}</Text> : null}
          <Text style={styles.title} numberOfLines={2}>
            {item.title}
          </Text>
          <Text style={styles.org} numberOfLines={1}>
            {item.organization}
          </Text>
          {where ? (
            <Text style={styles.place} numberOfLines={1}>
              {where}
            </Text>
          ) : null}
        </View>
        {match ? (
          <ScoreBadge score={match.matchScore} />
        ) : clash ? (
          <View style={styles.clash}>
            <Text style={styles.clashText}>Outside your limits</Text>
          </View>
        ) : null}
      </View>

      <Text style={styles.summary} numberOfLines={2}>
        {item.summary}
      </Text>

      {/* Pushed to the bottom so cards in a row line their footers up. */}
      <View style={styles.foot}>
        {headline ? <Text style={styles.headline}>{headline}</Text> : null}
        {facts.length > 0 ? (
          <Text style={styles.facts} numberOfLines={1}>
            {facts.join(' · ')}
          </Text>
        ) : null}

        {match?.whyItFits[0] ? (
          <Text style={styles.fit} numberOfLines={1}>
            ✓ {match.whyItFits[0]}
          </Text>
        ) : null}

        <View style={styles.actions}>
          <SaveButton id={item.id} title={item.title} />
          {deadline ? (
            <Text style={[styles.deadline, soon && styles.deadlineSoon]}>{deadline}</Text>
          ) : null}
        </View>
      </View>
    </PressableCard>
  );
}

const BADGE_FILL = {
  positive: { backgroundColor: colors.positiveSoft },
  accent: { backgroundColor: colors.primarySoft },
  neutral: { backgroundColor: colors.neutralSoft },
} as const;

const BADGE_TEXT = {
  positive: { color: colors.positive },
  accent: { color: colors.primary },
  neutral: { color: colors.textMuted },
} as const;

const styles = StyleSheet.create({
  card: { gap: spacing.sm, padding: spacing.md },

  top: { flexDirection: 'row', justifyContent: 'space-between', gap: spacing.md },
  titleBlock: { flex: 1, gap: 2 },
  tags: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: 2 },
  kind: { ...typography.label, color: colors.textMuted, letterSpacing: 0.8 },
  sample: { ...typography.label, color: colors.caution, letterSpacing: 0.8 },
  when: { ...typography.label, color: colors.primary, marginBottom: 2 },
  title: { ...typography.heading, color: colors.text, lineHeight: 24 },
  org: { ...typography.caption, color: colors.text },
  place: { ...typography.caption, color: colors.textMuted },

  score: {
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'flex-start',
    minWidth: 82,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.md,
  },
  scoreCompact: { minWidth: 70, paddingVertical: spacing.xs },
  scoreValue: { ...typography.title },
  scoreLabel: { ...typography.label },

  clash: {
    alignSelf: 'flex-start',
    maxWidth: 96,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.md,
    backgroundColor: colors.neutralSoft,
  },
  clashText: { ...typography.label, color: colors.textMuted, textAlign: 'center' },

  summary: { ...typography.caption, color: colors.textMuted, lineHeight: 21 },

  // `marginTop: auto` makes the footer sit on the bottom edge whatever the
  // title wrapped to, so a row of cards lines up.
  foot: { marginTop: 'auto', gap: spacing.xs, paddingTop: spacing.xs },
  headline: { ...typography.subheading, color: colors.text },
  facts: { ...typography.caption, color: colors.textMuted },
  fit: { ...typography.caption, color: colors.positive, lineHeight: 20 },

  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
    marginTop: spacing.xs,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  deadline: { ...typography.caption, color: colors.textMuted },
  deadlineSoon: { color: colors.caution, fontWeight: '600' },

  save: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    minHeight: 32,
    paddingHorizontal: spacing.sm,
    marginLeft: -spacing.sm,
    borderRadius: radius.pill,
  },
  saveOn: {},
  saveHover: { backgroundColor: colors.surface },
  saveGlyph: { fontSize: 16, lineHeight: 20, color: colors.textMuted },
  saveGlyphOn: { color: colors.primary },
  saveText: { ...typography.caption, fontWeight: '600', color: colors.textMuted },
  saveTextOn: { color: colors.primary },
});
