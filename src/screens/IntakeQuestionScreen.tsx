// One question, one screen. Screens slice.
//
// Forward and back both use replace, so the stack stays one deep and the
// hardware back button always means "leave the questionnaire" rather than
// unwinding seventeen frames.

import { useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp, NativeStackScreenProps } from '@react-navigation/native-stack';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { QUESTION_BANK, SECTIONS, questionById } from '../content';
import { canAdvance, isAnswered, nextQuestion, previousQuestion, progressFor, useIntake } from '../intake';
import type { AnswerValue } from '../models';
import type { RootStackParamList } from '../navigation/types';
import { colors, radius, spacing, typography } from '../theme';
import { QuestionInput } from './components/QuestionInput';
import { Button, ProgressBar } from './components/ui';

type Nav = NativeStackNavigationProp<RootStackParamList>;
type Route = NativeStackScreenProps<RootStackParamList, 'IntakeQuestion'>['route'];

/** How long a one-tap answer stays on screen before moving on. */
const AUTO_ADVANCE_MS = 260;

export function IntakeQuestionScreen() {
  const navigation = useNavigation<Nav>();
  const route = useRoute<Route>();
  const insets = useSafeAreaInsets();
  const { answers, state, setAnswer, skip, markComplete } = useIntake();

  const [showWhy, setShowWhy] = useState(false);
  const advanceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const questionId = route.params.questionId;
  const question = questionById(questionId);

  // Collapse the "why are you asking" panel when the question changes.
  useEffect(() => {
    setShowWhy(false);
  }, [questionId]);

  useEffect(
    () => () => {
      if (advanceTimer.current) clearTimeout(advanceTimer.current);
    },
    [],
  );

  const goTo = useCallback(
    (nextId: string) => {
      navigation.replace('IntakeQuestion', { questionId: nextId });
    },
    [navigation],
  );

  const finish = useCallback(() => {
    markComplete();
    navigation.replace('Profile');
  }, [markComplete, navigation]);

  const advance = useCallback(
    (from: string, currentAnswers = answers) => {
      const next = nextQuestion(QUESTION_BANK, currentAnswers, from);
      if (next) goTo(next.id);
      else finish();
    },
    [answers, goTo, finish],
  );

  // A question that fell off the path - e.g. the user went back and changed the
  // answer that opened it. Send them on rather than showing a dead screen.
  if (!question) {
    return (
      <View style={styles.missing}>
        <Text style={styles.missingText}>That question is no longer part of your path.</Text>
        <Button label="Continue" onPress={() => navigation.replace('Profile')} />
      </View>
    );
  }

  const value = answers[question.id];
  const wasAnswered = isAnswered(question, value);
  const section = SECTIONS[question.section];
  const progress = progressFor(QUESTION_BANK, answers, question.id);
  const previous = previousQuestion(QUESTION_BANK, answers, question.id);
  const ready = canAdvance(question, value, state.skipped);
  const isLast = nextQuestion(QUESTION_BANK, answers, question.id) === null;

  const handleChange = (next: AnswerValue) => {
    setAnswer(question.id, next);

    // One-tap formats move on by themselves, but only the first time a question
    // is answered. Coming back to change something leaves you where you are.
    const oneTap = question.kind === 'single' || question.kind === 'scale';
    if (oneTap && !wasAnswered) {
      if (advanceTimer.current) clearTimeout(advanceTimer.current);
      advanceTimer.current = setTimeout(() => {
        advance(question.id, { ...answers, [question.id]: next });
      }, AUTO_ADVANCE_MS);
    }
  };

  const handleSkip = () => {
    skip(question.id);
    const remaining = { ...answers };
    delete remaining[question.id];
    advance(question.id, remaining);
  };

  return (
    <KeyboardAvoidingView
      style={styles.screen}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={styles.header}>
        <ProgressBar ratio={progress.ratio} />
        <View style={styles.headerRow}>
          <Text style={styles.sectionLabel}>{section.title.toUpperCase()}</Text>
          <Text style={styles.counter}>
            {progress.index} of {progress.total}
          </Text>
        </View>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={styles.prompt}>{question.prompt}</Text>
        {question.help ? <Text style={styles.help}>{question.help}</Text> : null}

        {question.why ? (
          <View>
            <Pressable
              onPress={() => setShowWhy((current) => !current)}
              accessibilityRole="button"
              hitSlop={8}
            >
              <Text style={styles.whyToggle}>
                {showWhy ? 'Hide' : 'Why are you asking?'}
              </Text>
            </Pressable>
            {showWhy ? (
              <View style={styles.whyPanel}>
                <Text style={styles.whyText}>{question.why}</Text>
              </View>
            ) : null}
          </View>
        ) : null}

        <View style={styles.inputWrap}>
          <QuestionInput question={question} value={value} onChange={handleChange} />
        </View>
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: insets.bottom + spacing.md }]}>
        <View style={styles.footerRow}>
          <View style={styles.footerSide}>
            {previous ? (
              <Button label="Back" variant="ghost" onPress={() => goTo(previous.id)} />
            ) : null}
          </View>
          <View style={styles.footerSide}>
            {question.optional && !wasAnswered ? (
              <Button label="Skip" variant="ghost" onPress={handleSkip} />
            ) : null}
          </View>
        </View>
        <Button
          label={isLast ? 'See my profile' : 'Next'}
          onPress={() => advance(question.id)}
          disabled={!ready}
        />
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },

  header: { paddingHorizontal: spacing.lg, paddingTop: spacing.md, gap: spacing.sm },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  sectionLabel: { ...typography.label, color: colors.primary, letterSpacing: 0.8 },
  counter: { ...typography.caption, color: colors.textMuted },

  scroll: { flex: 1 },
  content: { padding: spacing.lg, gap: spacing.sm, paddingBottom: spacing.xl },
  prompt: { ...typography.title, color: colors.text, lineHeight: 30 },
  help: { ...typography.body, color: colors.textMuted, lineHeight: 21 },

  whyToggle: { ...typography.caption, color: colors.primary, fontWeight: '600' },
  whyPanel: {
    marginTop: spacing.sm,
    padding: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    borderLeftWidth: 3,
    borderLeftColor: colors.primary,
  },
  whyText: { ...typography.caption, color: colors.textMuted, lineHeight: 19 },

  inputWrap: { marginTop: spacing.md },

  footer: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    gap: spacing.xs,
    backgroundColor: colors.background,
  },
  footerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  footerSide: { minHeight: 40, justifyContent: 'center' },

  missing: {
    flex: 1,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.lg,
    gap: spacing.md,
  },
  missingText: { ...typography.body, color: colors.textMuted, textAlign: 'center' },
});
