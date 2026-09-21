// The front door of the questionnaire. Screens slice.

import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { INTRO_COPY, QUESTION_BANK } from '../content';
import { useIntake } from '../intake';
import type { RootStackParamList } from '../navigation/types';
import { colors, radius, spacing, typography } from '../theme';
import { Button, Card, Pill, ProgressBar } from './components/ui';

type Nav = NativeStackNavigationProp<RootStackParamList>;

export function IntakeIntroScreen() {
  const navigation = useNavigation<Nav>();
  const insets = useSafeAreaInsets();
  const { state, path, hydrated, reset, profile } = useIntake();

  const answeredCount = path.filter((question) => state.answers[question.id] !== undefined).length;
  const inProgress = state.status !== 'not_started' && answeredCount > 0;
  const firstUnanswered =
    path.find(
      (question) =>
        state.answers[question.id] === undefined && !state.skipped.includes(question.id),
    ) ?? path[0];

  const open = (questionId: string) => navigation.navigate('IntakeQuestion', { questionId });

  const startFresh = () => {
    reset();
    open(QUESTION_BANK[0].id);
  };

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + spacing.xl }]}
    >
      <Pill text={INTRO_COPY.eyebrow} tone="accent" />
      <Text style={styles.title}>{INTRO_COPY.title}</Text>
      <Text style={styles.body}>{INTRO_COPY.body}</Text>

      <View style={styles.bullets}>
        {INTRO_COPY.bullets.map((bullet) => (
          <View key={bullet} style={styles.bulletRow}>
            <View style={styles.bulletDot} />
            <Text style={styles.bulletText}>{bullet}</Text>
          </View>
        ))}
      </View>

      <Card style={styles.privacyCard}>
        <Text style={styles.privacyHeading}>{INTRO_COPY.privacyHeading}</Text>
        <Text style={styles.privacyBody}>{INTRO_COPY.privacyBody}</Text>
      </Card>

      {inProgress ? (
        <View style={styles.resumeBlock}>
          <ProgressBar
            ratio={answeredCount / Math.max(1, path.length)}
            label={`${answeredCount} of ${path.length} answered`}
          />
          <Text style={styles.resumeText}>
            {answeredCount} of {path.length} answered
          </Text>
        </View>
      ) : null}

      <View style={styles.actions}>
        {inProgress ? (
          <>
            <Button
              label={INTRO_COPY.resume}
              size="lg"
              onPress={() => firstUnanswered && open(firstUnanswered.id)}
              disabled={!hydrated || !firstUnanswered}
            />
            {profile ? (
              <Button
                label={INTRO_COPY.viewProfile}
                variant="secondary"
                size="lg"
                onPress={() => navigation.navigate('Profile')}
              />
            ) : null}
            <Button label="Start over" variant="ghost" onPress={startFresh} />
          </>
        ) : (
          <Button label={INTRO_COPY.start} size="lg" onPress={startFresh} disabled={!hydrated} />
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.lg, gap: spacing.md },
  title: { ...typography.display, color: colors.text, marginTop: spacing.xs },
  body: { ...typography.body, color: colors.textMuted, lineHeight: 22 },

  bullets: { gap: spacing.sm, marginTop: spacing.xs },
  bulletRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  bulletDot: {
    width: 6,
    height: 6,
    borderRadius: radius.pill,
    backgroundColor: colors.primary,
  },
  bulletText: { ...typography.body, color: colors.text, flex: 1 },

  privacyCard: { marginTop: spacing.sm, gap: spacing.xs },
  privacyHeading: { ...typography.heading, color: colors.text },
  privacyBody: { ...typography.caption, color: colors.textMuted, lineHeight: 19 },

  resumeBlock: { gap: spacing.xs, marginTop: spacing.sm },
  resumeText: { ...typography.caption, color: colors.textMuted },

  actions: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: spacing.sm, marginTop: spacing.md },
});
