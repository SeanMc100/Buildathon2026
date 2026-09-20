// How the app works, what stays private, and how to reach us. Screens slice.

import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { FAQ, SUPPORT_COPY, SUPPORT_EMAIL } from '../content';
import { colors, spacing, typography } from '../theme';
import { isHovered } from '../web/hover';
import { openExternal } from '../web/links';
import { Button, Card } from './components/ui';

function FaqRow({ question, answer }: { question: string; answer: string }) {
  const [open, setOpen] = useState(false);

  return (
    <Card style={styles.faq}>
      <Pressable
        onPress={() => setOpen((value) => !value)}
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        style={(state) => [styles.faqHead, isHovered(state) && styles.faqHeadHover]}
      >
        <Text style={styles.question}>{question}</Text>
        <Text style={styles.chevron}>{open ? '–' : '+'}</Text>
      </Pressable>
      {open ? <Text style={styles.answer}>{answer}</Text> : null}
    </Card>
  );
}

export function SupportScreen() {
  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <Text style={styles.title}>{SUPPORT_COPY.title}</Text>
        <Text style={styles.body}>{SUPPORT_COPY.intro}</Text>
      </View>

      <View style={styles.group}>
        <Text style={styles.groupTitle}>{SUPPORT_COPY.faqHeading}</Text>
        {FAQ.map((item) => (
          <FaqRow key={item.id} question={item.question} answer={item.answer} />
        ))}
      </View>

      <View style={styles.group}>
        <Text style={styles.groupTitle}>{SUPPORT_COPY.contactHeading}</Text>
        {SUPPORT_EMAIL ? (
          <>
            <Text style={styles.body}>{SUPPORT_COPY.contactBody}</Text>
            <Button
              label={SUPPORT_COPY.contactButton}
              onPress={() => openExternal(`mailto:${SUPPORT_EMAIL}`)}
            />
          </>
        ) : (
          <Text style={styles.body}>{SUPPORT_COPY.contactMissing}</Text>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.lg, gap: spacing.lg, paddingBottom: spacing.xxl },
  header: { gap: spacing.xs },
  title: { ...typography.display, color: colors.text },
  body: { ...typography.body, color: colors.textMuted, lineHeight: 21 },

  group: { gap: spacing.sm },
  groupTitle: { ...typography.title, color: colors.text },

  faq: { padding: 0, overflow: 'hidden' },
  faqHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
    padding: spacing.md,
  },
  faqHeadHover: { backgroundColor: colors.surfaceAlt },
  question: { ...typography.heading, color: colors.text, flex: 1 },
  chevron: { ...typography.title, color: colors.primary },
  answer: {
    ...typography.body,
    color: colors.textMuted,
    lineHeight: 22,
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.md,
  },
});
