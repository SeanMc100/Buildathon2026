// One board: group chat and member-shared opportunities. Screens slice.
// Only members can read or write; everyone else sees a join prompt.

import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp, NativeStackScreenProps } from '@react-navigation/native-stack';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import {
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { LIMITS, useBoard } from '../board';
import { BOARDS_BY_ID, BOARD_COPY, POST_KINDS } from '../content';
import type { BoardMessage, BoardPost } from '../models';
import type { RootStackParamList } from '../navigation/types';
import { colors, gradient, radius, spacing, typography } from '../theme';
import { openExternal } from '../web/links';
import { timeAgo } from './components/BoardParts';
import { Button, Card, Pill } from './components/ui';

type Props = NativeStackScreenProps<RootStackParamList, 'Board'>;
type Nav = NativeStackNavigationProp<RootStackParamList>;
type Tab = 'chat' | 'posts';

const KIND_LABELS = Object.fromEntries(POST_KINDS.map((kind) => [kind.value, kind.label]));

function MessageBubble({ message, mine }: { message: BoardMessage; mine: boolean }) {
  return (
    <View style={[styles.bubbleWrap, mine && styles.bubbleWrapMine]}>
      <View style={[styles.bubble, mine && styles.bubbleMine]}>
        <Text style={[styles.bubbleMeta, mine && styles.bubbleMetaMine]}>
          {mine ? 'You' : message.authorHandle} · {timeAgo(message.postedAt)}
          {message.isSample ? ' · sample' : ''}
        </Text>
        <Text style={[styles.bubbleText, mine && styles.bubbleTextMine]}>{message.body}</Text>
      </View>
    </View>
  );
}

function PostCard({ post }: { post: BoardPost }) {
  return (
    <Card style={styles.post}>
      <View style={styles.pills}>
        <Pill text={KIND_LABELS[post.kind] ?? 'Other'} tone="accent" />
        <Pill text={post.city} />
        {post.isSample ? <Pill text="Sample listing" /> : null}
      </View>
      <Text style={styles.postTitle}>{post.title}</Text>
      <Text style={styles.postOrg}>{post.organization}</Text>
      <Text style={styles.postDetails}>{post.details}</Text>
      <View style={styles.postFoot}>
        <Text style={styles.postMeta}>
          Shared by {post.authorHandle} · {timeAgo(post.postedAt)}
        </Text>
        {post.url ? (
          <Pressable
            onPress={() => openExternal(post.url as string)}
            hitSlop={8}
            accessibilityRole="link"
          >
            <Text style={styles.link}>Open link</Text>
          </Pressable>
        ) : null}
      </View>
    </Card>
  );
}

export function BoardScreen({ route }: Props) {
  const navigation = useNavigation<Nav>();
  const insets = useSafeAreaInsets();
  const board = BOARDS_BY_ID.get(route.params.boardId);
  const { hydrated, memberId, isJoined, join, messagesFor, postsFor, sendMessage } = useBoard();
  const [tab, setTab] = useState<Tab>('chat');
  const [draft, setDraft] = useState('');
  const listRef = useRef<FlatList<BoardMessage>>(null);

  useLayoutEffect(() => {
    navigation.setOptions({ title: board?.name ?? 'Board' });
  }, [navigation, board]);

  const messages = board ? messagesFor(board.id) : [];
  const posts = board ? postsFor(board.id) : [];

  // Keep the newest message in view as the chat grows.
  useEffect(() => {
    if (tab !== 'chat' || messages.length === 0) return;
    const timer = setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 50);
    return () => clearTimeout(timer);
  }, [messages.length, tab]);

  if (!board) {
    return (
      <View style={styles.gate}>
        <Text style={styles.gateText}>That board does not exist.</Text>
        <Button label="See all boards" onPress={() => navigation.replace('Boards')} />
      </View>
    );
  }

  if (!hydrated) return <View style={styles.gate} />;

  if (!isJoined(board.id)) {
    return (
      <View style={styles.gate}>
        <Text style={styles.gateTitle}>{board.name}</Text>
        <Text style={styles.gateText}>{board.blurb} Join to read the chat and leads.</Text>
        <Button label="Join board" onPress={() => join(board.id)} />
        <Button label="Back to all boards" variant="ghost" onPress={() => navigation.replace('Boards')} />
      </View>
    );
  }

  const send = () => {
    if (sendMessage(board.id, draft)) setDraft('');
  };

  const bottomPad = Math.max(insets.bottom, spacing.md);

  return (
    <KeyboardAvoidingView
      style={styles.screen}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={styles.tabs} accessibilityRole="tablist">
        {(
          [
            ['chat', 'Chat'],
            ['posts', `Opportunities (${posts.length})`],
          ] as const
        ).map(([key, label]) => (
          <Pressable
            key={key}
            onPress={() => setTab(key)}
            accessibilityRole="tab"
            accessibilityState={{ selected: tab === key }}
            style={[styles.tab, tab === key && styles.tabActive]}
          >
            <Text style={[styles.tabText, tab === key && styles.tabTextActive]}>{label}</Text>
          </Pressable>
        ))}
      </View>

      <Text style={styles.notice}>
        {BOARD_COPY.demoNote} {BOARD_COPY.safetyNote}
      </Text>

      {tab === 'chat' ? (
        <>
          <FlatList
            ref={listRef}
            data={messages}
            keyExtractor={(message) => message.id}
            renderItem={({ item }) => <MessageBubble message={item} mine={item.authorId === memberId} />}
            contentContainerStyle={styles.list}
            ListEmptyComponent={
              <Text style={styles.empty}>No messages yet. Say hello.</Text>
            }
            keyboardShouldPersistTaps="handled"
          />
          <View style={[styles.composer, { paddingBottom: bottomPad }]}>
            <TextInput
              value={draft}
              onChangeText={setDraft}
              placeholder={`Message ${board.name}`}
              placeholderTextColor={colors.textMuted}
              maxLength={LIMITS.message}
              multiline
              style={styles.input}
              accessibilityLabel="Message"
            />
            <Pressable
              onPress={send}
              disabled={!draft.trim()}
              accessibilityRole="button"
              accessibilityLabel="Send message"
              style={[styles.send, !draft.trim() && styles.sendDisabled]}
            >
              <Text style={[styles.sendText, !draft.trim() && styles.sendTextDisabled]}>Send</Text>
            </Pressable>
          </View>
        </>
      ) : (
        <>
          <FlatList
            data={posts}
            keyExtractor={(post) => post.id}
            renderItem={({ item }) => <PostCard post={item} />}
            contentContainerStyle={styles.list}
            ListEmptyComponent={
              <Text style={styles.empty}>No leads yet. Add the first.</Text>
            }
          />
          <View style={[styles.bar, { paddingBottom: bottomPad }]}>
            <Text style={styles.barText}>{BOARD_COPY.shareBody}</Text>
            <Button
              label={BOARD_COPY.shareTitle}
              onPress={() => navigation.navigate('BoardSubmit', { boardId: board.id })}
            />
          </View>
        </>
      )}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },

  gate: {
    flex: 1,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.lg,
    gap: spacing.md,
  },
  gateTitle: { ...typography.title, color: colors.text, textAlign: 'center' },
  gateText: { ...typography.body, color: colors.textMuted, textAlign: 'center', lineHeight: 21 },

  tabs: {
    flexDirection: 'row',
    marginHorizontal: spacing.lg,
    marginTop: spacing.sm,
    padding: 3,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
  },
  tab: { flex: 1, minHeight: 40, alignItems: 'center', justifyContent: 'center', borderRadius: radius.sm },
  tabActive: { backgroundColor: colors.background, borderWidth: 1, borderColor: colors.border },
  tabText: { ...typography.caption, color: colors.textMuted, fontWeight: '600' },
  tabTextActive: { color: colors.primary },

  notice: {
    ...typography.caption,
    color: colors.textMuted,
    lineHeight: 18,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
  },

  list: { padding: spacing.lg, gap: spacing.sm, flexGrow: 1 },
  empty: { ...typography.body, color: colors.textMuted, textAlign: 'center', marginTop: spacing.xl },

  bubbleWrap: { alignItems: 'flex-start' },
  bubbleWrapMine: { alignItems: 'flex-end' },
  bubble: {
    maxWidth: '85%',
    padding: spacing.sm + 4,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    gap: 2,
  },
  bubbleMine: { backgroundColor: colors.primary },
  bubbleMeta: { ...typography.label, color: colors.textMuted },
  bubbleMetaMine: { color: colors.primarySoft },
  bubbleText: { ...typography.body, color: colors.text, lineHeight: 21 },
  bubbleTextMine: { color: colors.textInverse },

  composer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.background,
  },
  input: {
    flex: 1,
    minHeight: 44,
    maxHeight: 120,
    paddingHorizontal: spacing.md,
    paddingTop: 12,
    paddingBottom: 12,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    ...typography.body,
    color: colors.text,
  },
  send: {
    minHeight: 44,
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
    borderRadius: radius.lg,
    ...gradient.horizontal,
  },
  sendDisabled: { backgroundColor: colors.border, ...gradient.none },
  sendText: { ...typography.heading, color: colors.textInverse },
  sendTextDisabled: { color: colors.textMuted },

  post: { gap: spacing.xs },
  pills: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  postTitle: { ...typography.heading, color: colors.text, marginTop: spacing.xs },
  postOrg: { ...typography.caption, color: colors.textMuted },
  postDetails: { ...typography.body, color: colors.text, lineHeight: 21, marginTop: spacing.xs },
  postFoot: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: spacing.md,
    marginTop: spacing.xs,
  },
  postMeta: { ...typography.caption, color: colors.textMuted, flex: 1 },
  link: { ...typography.caption, color: colors.primary, fontWeight: '600' },

  bar: {
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.background,
  },
  barText: { ...typography.caption, color: colors.textMuted, lineHeight: 18 },
});
