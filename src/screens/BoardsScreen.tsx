// Directory of Metro Detroit boards: join or leave, open one. Screens slice.

import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { useBoard } from '../board';
import { BOARDS, BOARD_COPY, BOARD_REGION, ageBoardFor } from '../content';
import { useIntake } from '../intake';
import type { Board } from '../models';
import type { RootStackParamList } from '../navigation/types';
import { colors, spacing, typography } from '../theme';
import { Button, Card, Pill } from './components/ui';

type Nav = NativeStackNavigationProp<RootStackParamList>;

function BoardRow({ board, suggested }: { board: Board; suggested: boolean }) {
  const navigation = useNavigation<Nav>();
  const { isJoined, join, leave } = useBoard();
  const joined = isJoined(board.id);

  return (
    <Card style={styles.row}>
      <View style={styles.rowText}>
        <View style={styles.rowTitleLine}>
          <Text style={styles.rowTitle}>{board.name}</Text>
          {suggested && !joined ? <Pill text={BOARD_COPY.suggested} tone="accent" /> : null}
        </View>
        <Text style={styles.rowBlurb}>{board.blurb}</Text>
      </View>
      <View style={styles.rowActions}>
        {joined ? (
          <>
            <Pressable
              onPress={() => navigation.navigate('Board', { boardId: board.id })}
              hitSlop={8}
              accessibilityRole="button"
            >
              <Text style={styles.action}>Open</Text>
            </Pressable>
            <Pressable onPress={() => leave(board.id)} hitSlop={8} accessibilityRole="button">
              <Text style={styles.actionMuted}>Leave</Text>
            </Pressable>
          </>
        ) : (
          <Pressable onPress={() => join(board.id)} hitSlop={8} accessibilityRole="button">
            <Text style={styles.action}>Join</Text>
          </Pressable>
        )}
      </View>
    </Card>
  );
}

export function BoardsScreen() {
  const navigation = useNavigation<Nav>();
  const { answers } = useIntake();
  const suggestedId = ageBoardFor(answers.age_band)?.id ?? null;

  const ageBoards = BOARDS.filter((board) => board.category === 'age');
  const jobBoards = BOARDS.filter((board) => board.category === 'job');

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <Text style={styles.title}>{BOARD_REGION} boards</Text>
        <Text style={styles.body}>{BOARD_COPY.directoryBody}</Text>
        {suggestedId ? <Text style={styles.note}>{BOARD_COPY.suggestedNote}</Text> : null}
      </View>

      <View style={styles.group}>
        <Text style={styles.groupTitle}>
          {BOARD_COPY.ageHeading} <Text style={styles.groupHelp}>· {BOARD_COPY.ageHelp}</Text>
        </Text>
        {ageBoards.map((board) => (
          <BoardRow key={board.id} board={board} suggested={board.id === suggestedId} />
        ))}
      </View>

      <View style={styles.group}>
        <Text style={styles.groupTitle}>
          {BOARD_COPY.jobHeading} <Text style={styles.groupHelp}>· {BOARD_COPY.jobHelp}</Text>
        </Text>
        {jobBoards.map((board) => (
          <BoardRow key={board.id} board={board} suggested={false} />
        ))}
      </View>

      <Button label="Done" variant="secondary" onPress={() => navigation.goBack()} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.lg, gap: spacing.lg, paddingBottom: spacing.xxl },
  header: { gap: spacing.xs },
  title: { ...typography.display, color: colors.text },
  body: { ...typography.body, color: colors.textMuted, lineHeight: 21 },
  note: { ...typography.caption, color: colors.textMuted, lineHeight: 18 },

  group: { gap: spacing.sm },
  groupTitle: { ...typography.title, color: colors.text },
  groupHelp: { ...typography.caption, color: colors.textMuted },

  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  rowText: { flex: 1, gap: 2 },
  rowTitleLine: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: spacing.sm },
  rowTitle: { ...typography.heading, color: colors.text },
  rowBlurb: { ...typography.caption, color: colors.textMuted, lineHeight: 18 },
  rowActions: { alignItems: 'flex-end', gap: spacing.sm },
  action: { ...typography.body, color: colors.primary, fontWeight: '600' },
  actionMuted: { ...typography.caption, color: colors.textMuted },
});
