// The Metro Detroit bulletin board that sits above the matched opportunities on
// the Results screen: three pinned sticky notes carrying leads members shared,
// and a chat button into the room that fits the member's field. Screens slice.

import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Platform, Pressable, StyleSheet, type StyleProp, type ViewStyle, Text, View } from 'react-native';

import { useBoard } from '../../board';
import { BOARDS_BY_ID, BOARD_COPY } from '../../content';
import { useIntake } from '../../intake';
import type { BoardPost, BoardPostKind } from '../../models';
import type { RootStackParamList } from '../../navigation/types';
import { colors, radius, spacing, typography } from '../../theme';
import { useLayout } from '../../web/layout';
import { chatBoardFor, timeAgo } from './BoardParts';

type Nav = NativeStackNavigationProp<RootStackParamList>;

const NOTE_COUNT = 3;

const KIND_STICKERS: Record<BoardPostKind, string> = {
  job: '💼 JOB',
  research: '🔬 RESEARCH',
  program: '🎓 PROGRAM',
  event: '🎉 EVENT',
  other: '📌 LEAD',
};

/** Handwritten-looking faces that ship with each OS, so no font download. */
const HAND = Platform.select({
  ios: { regular: 'Noteworthy-Light', bold: 'Noteworthy-Bold' },
  android: { regular: 'cursive', bold: 'cursive' },
  default: { regular: '"Comic Sans MS", cursive', bold: '"Comic Sans MS", cursive' },
});

const NOTE_YELLOW = '#fff176';
const NOTE_YELLOW_DEEP = '#ffe94f';
const NOTE_INK = '#3b2f00';
const CORK = '#d4a96a';
const PIN_RED = '#e53935';

/** Where each note sits on the wall, as fractions so it scales with the width. */
const NOTE_LAYOUT = [
  { left: 0.0, top: 0, height: 124, rotate: '-5deg', z: 1 },
  { left: 0.5, top: 10, height: 124, rotate: '4deg', z: 2 },
  { left: 0.25, top: 122, height: 146, rotate: '-1.5deg', z: 3 },
] as const;

/** Only the front note is fully visible, so only it carries the byline and a longer org line. */
const FRONT_NOTE = 2;

const WALL_PAD = spacing.md;
const WALL_BORDER = 6;
const WALL_HEIGHT = 122 + 146 + WALL_PAD * 2 + WALL_BORDER * 2;
/** On wide screens the wall stops growing here, or the notes turn into billboards. */
const WALL_MAX_WIDTH = 640;

function Pin() {
  return (
    <View style={styles.pinWrap} pointerEvents="none">
      <View style={styles.pinShadow} />
      <View style={styles.pinHead}>
        <View style={styles.pinShine} />
      </View>
    </View>
  );
}

function StickyNote({
  post,
  boardName,
  showFoot,
  onPress,
  style,
}: {
  post: BoardPost | null;
  showFoot: boolean;
  boardName: string | null;
  onPress: () => void;
  style: StyleProp<ViewStyle>;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={
        post ? `${post.title} at ${post.organization}. Open ${boardName ?? 'board'}` : 'Open chat'
      }
      style={[styles.note, style]}
    >
      <Pin />
      {post ? (
        <>
          <Text style={styles.sticker}>{KIND_STICKERS[post.kind]}</Text>
          <Text style={styles.noteTitle} numberOfLines={2}>
            {post.title}
          </Text>
          <Text style={styles.noteOrg} numberOfLines={showFoot ? 2 : 1}>
            {post.organization} · {post.city}
          </Text>
          {showFoot ? (
            <Text style={styles.noteFoot} numberOfLines={1}>
              {post.authorHandle} · {timeAgo(post.postedAt)}
            </Text>
          ) : null}
        </>
      ) : (
        <>
          <Text style={styles.sticker}>✏️ YOUR TURN</Text>
          <Text style={styles.noteTitle}>Spot a lead? Pin it here!</Text>
          <Text style={styles.noteFoot}>Jobs, programs, events…</Text>
        </>
      )}
    </Pressable>
  );
}

export function BulletinBoardSection() {
  const navigation = useNavigation<Nav>();
  const { width: columnWidth } = useLayout();
  const { profile } = useIntake();
  const { joined, postsFor } = useBoard();

  const wallWidth = Math.min(columnWidth - spacing.lg * 2, WALL_MAX_WIDTH);
  const innerWidth = wallWidth - WALL_BORDER * 2 - WALL_PAD * 2;
  const noteWidth = Math.round(innerWidth * 0.5);

  const chatBoard = chatBoardFor(profile, joined);

  // Leads from the rooms the member is in first, then from their suggested room,
  // then anything on the wall so it never sits empty.
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
    if (posts.length >= NOTE_COUNT) break;
  }

  const openChat = () => {
    if (chatBoard) navigation.navigate('Board', { boardId: chatBoard.id });
    else navigation.navigate('Boards');
  };

  return (
    // Header, wall and chat button share one width, so they line up when the wall is capped.
    <View style={[styles.section, { width: wallWidth + spacing.lg * 2, maxWidth: '100%' }]}>
      <View style={styles.inset}>
        <Text style={styles.title}>{BOARD_COPY.sectionTitle}</Text>
        <Text style={styles.blurb}>{BOARD_COPY.sectionBlurb}</Text>
      </View>

      <View style={[styles.wall, { marginHorizontal: spacing.lg, width: wallWidth, height: WALL_HEIGHT }]}>
        {NOTE_LAYOUT.map((slot, index) => {
          const post = posts[index] ?? null;
          const board = post ? BOARDS_BY_ID.get(post.boardId) : undefined;
          return (
            <StickyNote
              key={post?.id ?? `empty-${index}`}
              post={post}
              boardName={board?.name ?? null}
              showFoot={index === FRONT_NOTE}
              onPress={() =>
                post
                  ? navigation.navigate('Board', { boardId: post.boardId })
                  : openChat()
              }
              style={{
                position: 'absolute',
                width: noteWidth,
                height: slot.height,
                left: WALL_PAD + Math.min(slot.left * innerWidth, innerWidth - noteWidth),
                top: WALL_PAD + slot.top,
                zIndex: slot.z,
                transform: [{ rotate: slot.rotate }],
              }}
            />
          );
        })}
      </View>

      <View style={[styles.inset, styles.chatRow]}>
        <Pressable
          onPress={openChat}
          accessibilityRole="button"
          accessibilityLabel={chatBoard ? `Chat with ${chatBoard.name}` : 'Find a chat'}
          style={({ pressed }) => [styles.chatButton, pressed && styles.chatButtonPressed]}
        >
          <Text style={styles.chatIcon}>💬</Text>
          <View style={styles.chatText}>
            <Text style={styles.chatLabel}>Chat</Text>
            <Text style={styles.chatSub} numberOfLines={1}>
              {chatBoard ? chatBoard.name : 'Find your people'}
            </Text>
          </View>
        </Pressable>
        <Pressable
          onPress={() => navigation.navigate('Boards')}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel="Browse all boards"
        >
          <Text style={styles.browse}>All boards</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  section: { gap: spacing.sm },
  inset: { paddingHorizontal: spacing.lg, gap: spacing.xs },
  title: { ...typography.title, color: colors.text },
  blurb: { ...typography.caption, color: colors.textMuted, lineHeight: 18 },

  wall: {
    backgroundColor: CORK,
    borderRadius: radius.md,
    borderWidth: WALL_BORDER,
    borderColor: '#8d6335',
    overflow: 'hidden',
  },

  note: {
    backgroundColor: NOTE_YELLOW,
    borderBottomRightRadius: 22,
    borderTopWidth: 14,
    borderTopColor: NOTE_YELLOW_DEEP,
    paddingHorizontal: spacing.sm + 4,
    paddingTop: spacing.sm,
    paddingBottom: spacing.sm,
    gap: 2,
    shadowColor: '#000',
    shadowOpacity: 0.28,
    shadowRadius: 5,
    shadowOffset: { width: 2, height: 4 },
    elevation: 5,
  },
  sticker: {
    fontFamily: HAND?.bold,
    fontSize: 11,
    letterSpacing: 1,
    color: '#b23a00',
  },
  noteTitle: {
    fontFamily: HAND?.bold,
    fontSize: 15,
    lineHeight: 19,
    color: NOTE_INK,
  },
  noteOrg: {
    fontFamily: HAND?.regular,
    fontSize: 13,
    color: NOTE_INK,
    textDecorationLine: 'underline',
    textDecorationStyle: 'dotted',
  },
  noteFoot: {
    fontFamily: HAND?.regular,
    fontSize: 11,
    color: '#6b5a1a',
    marginTop: 'auto',
  },

  pinWrap: {
    position: 'absolute',
    top: -20,
    alignSelf: 'center',
    width: 22,
    height: 26,
    alignItems: 'center',
    zIndex: 10,
  },
  pinShadow: {
    position: 'absolute',
    top: 14,
    left: 6,
    width: 16,
    height: 8,
    borderRadius: 8,
    backgroundColor: 'rgba(0,0,0,0.25)',
  },
  pinHead: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: PIN_RED,
    borderWidth: 1,
    borderColor: '#a52020',
    shadowColor: '#000',
    shadowOpacity: 0.35,
    shadowRadius: 2,
    shadowOffset: { width: 1, height: 2 },
    elevation: 3,
  },
  pinShine: {
    position: 'absolute',
    top: 3,
    left: 4,
    width: 5,
    height: 5,
    borderRadius: 3,
    backgroundColor: 'rgba(255,255,255,0.75)',
  },

  chatRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.md },
  chatButton: {
    flex: 1,
    minHeight: 52,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radius.lg,
    backgroundColor: colors.primary,
  },
  chatButtonPressed: { opacity: 0.85 },
  chatIcon: { fontSize: 22 },
  chatText: { flex: 1 },
  chatLabel: { ...typography.heading, color: colors.textInverse },
  chatSub: { ...typography.caption, color: colors.primarySoft },
  browse: { ...typography.caption, color: colors.primary, fontWeight: '600' },
});
