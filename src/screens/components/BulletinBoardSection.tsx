// The Metro Detroit bulletin board, as it appears on the matches page: the
// latest leads members shared, and a way into the room that fits. Screens slice.
//
// This used to be drawn as cork and rotated sticky notes in a handwriting font.
// It was the loudest thing on the page and the least informative: three notes
// filled 600px of a phone screen and truncated every one of them to "Summer
// trades exploration …". It is now a compact list in the same visual language
// as the rest of the app, which fits more, reads at a glance, and does not look
// like it was borrowed from a different product.

import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { StyleSheet, Text, View } from 'react-native';

import { useBoard } from '../../board';
import { BOARDS_BY_ID, BOARD_COPY } from '../../content';
import { useIntake } from '../../intake';
import type { BoardPost, BoardPostKind } from '../../models';
import type { RootStackParamList } from '../../navigation/types';
import { colors, radius, spacing, typography } from '../../theme';
import { chatBoardFor, timeAgo } from './BoardParts';
import { Button, LinkButton, PressableCard, Pill, SectionHeading } from './ui';

type Nav = NativeStackNavigationProp<RootStackParamList>;

/** How many leads the section previews before handing over to the boards. */
const LEAD_COUNT = 3;

const KIND_LABELS: Record<BoardPostKind, string> = {
  job: 'Job',
  research: 'Research',
  program: 'Program',
  event: 'Event',
  other: 'Lead',
};

function LeadRow({ post, boardName, onPress }: { post: BoardPost; boardName: string | null; onPress: () => void }) {
  return (
    <PressableCard
      onPress={onPress}
      accessibilityLabel={`${post.title} at ${post.organization}, shared in ${boardName ?? 'a board'}`}
      style={styles.lead}
    >
      <View style={styles.leadTags}>
        <Pill text={KIND_LABELS[post.kind]} tone="accent" />
        <Text style={styles.leadCity}>{post.city}</Text>
      </View>
      <Text style={styles.leadTitle} numberOfLines={2}>
        {post.title}
      </Text>
      <Text style={styles.leadOrg} numberOfLines={1}>
        {post.organization}
      </Text>
      <Text style={styles.leadMeta} numberOfLines={1}>
        {post.authorHandle} · {timeAgo(post.postedAt)}
        {boardName ? ` · ${boardName}` : ''}
      </Text>
    </PressableCard>
  );
}

export function BulletinBoardSection() {
  const navigation = useNavigation<Nav>();
  const { profile } = useIntake();
  const { joined, postsFor } = useBoard();

  const chatBoard = chatBoardFor(profile, joined);

  // Leads from the rooms the member is in first, then from their suggested
  // room, then anything at all so the section never sits empty.
  const seen = new Set<string>();
  const roomIds = [...joined, ...(chatBoard ? [chatBoard.id] : [])];
  const allIds = [...roomIds, ...[...BOARDS_BY_ID.keys()]];
  const posts: BoardPost[] = [];
  for (const boardId of allIds) {
    for (const post of postsFor(boardId)) {
      if (seen.has(post.id)) continue;
      seen.add(post.id);
      posts.push(post);
    }
    if (posts.length >= LEAD_COUNT) break;
  }

  const openChat = () =>
    chatBoard
      ? navigation.navigate('Board', { boardId: chatBoard.id })
      : navigation.navigate('Boards');

  return (
    <View style={styles.section}>
      <SectionHeading title={BOARD_COPY.sectionTitle} help={BOARD_COPY.sectionBlurb} />

      <View style={styles.leads}>
        {posts.slice(0, LEAD_COUNT).map((post) => (
          <LeadRow
            key={post.id}
            post={post}
            boardName={BOARDS_BY_ID.get(post.boardId)?.name ?? null}
            onPress={() => navigation.navigate('Board', { boardId: post.boardId })}
          />
        ))}
        {posts.length === 0 ? (
          <Text style={styles.empty}>No leads on the wall yet. Yours could be the first.</Text>
        ) : null}
      </View>

      <View style={styles.actions}>
        <Button
          label={chatBoard ? `Open ${chatBoard.name}` : 'Find your board'}
          variant="secondary"
          onPress={openChat}
        />
        <LinkButton label="All boards →" onPress={() => navigation.navigate('Boards')} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },

  // Three across on a wide window, stacking on a narrow one, without needing
  // to measure anything: each lead takes a third and will not go below 220.
  leads: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'stretch', gap: spacing.sm },
  lead: { flexGrow: 1, flexBasis: 220, gap: 2, padding: spacing.sm + 4 },
  leadTags: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.xs },
  leadCity: { ...typography.label, color: colors.textMuted },
  leadTitle: { ...typography.subheading, color: colors.text, lineHeight: 21 },
  leadOrg: { ...typography.caption, color: colors.textMuted },
  leadMeta: { ...typography.label, color: colors.textMuted, marginTop: spacing.xs },
  empty: { ...typography.caption, color: colors.textMuted },

  actions: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: spacing.md },
});
