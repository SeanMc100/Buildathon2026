// Form for sharing a job, research spot, program or event that is not on the
// platform. Posts to one board. Screens slice.

import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp, NativeStackScreenProps } from '@react-navigation/native-stack';
import { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { LIMITS, validatePost, useBoard } from '../board';
import type { PostDraft, PostErrors } from '../board';
import { BOARDS_BY_ID, BOARD_COPY, BOARD_REGION, DETROIT_CITIES, POST_KINDS } from '../content';
import type { RootStackParamList } from '../navigation/types';
import { colors, radius, spacing, typography } from '../theme';
import { ChipGroup } from './components/BoardParts';
import { Button, FieldLabel } from './components/ui';

type Props = NativeStackScreenProps<RootStackParamList, 'BoardSubmit'>;
type Nav = NativeStackNavigationProp<RootStackParamList>;

const CITY_OPTIONS = DETROIT_CITIES.map((city) => ({ value: city, label: city }));

const EMPTY_DRAFT: PostDraft = {
  kind: null,
  title: '',
  organization: '',
  city: null,
  url: '',
  details: '',
};

function Field({
  label,
  error,
  children,
}: {
  label: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <View style={styles.field}>
      <FieldLabel text={label} />
      {children}
      {error ? <Text style={styles.error}>{error}</Text> : null}
    </View>
  );
}

export function BoardSubmitScreen({ route }: Props) {
  const navigation = useNavigation<Nav>();
  const insets = useSafeAreaInsets();
  const board = BOARDS_BY_ID.get(route.params.boardId);
  const { isJoined, submitPost } = useBoard();
  const [draft, setDraft] = useState<PostDraft>(EMPTY_DRAFT);
  const [errors, setErrors] = useState<PostErrors>({});

  const set = <K extends keyof PostDraft>(key: K, value: PostDraft[K]) => {
    setDraft((current) => ({ ...current, [key]: value }));
    setErrors((current) => ({ ...current, [key]: undefined }));
  };

  if (!board || !isJoined(board.id)) {
    return (
      <View style={styles.gate}>
        <Text style={styles.gateText}>Join a board before sharing to it.</Text>
        <Button label="See all boards" onPress={() => navigation.replace('Boards')} />
      </View>
    );
  }

  const submit = () => {
    const result = validatePost(draft);
    setErrors(result.errors);
    if (!result.input) return;
    if (submitPost(board.id, result.input)) navigation.goBack();
  };

  return (
    <KeyboardAvoidingView
      style={styles.screen}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
      >
        <View style={styles.header}>
          <Text style={styles.title}>{BOARD_COPY.shareTitle}</Text>
          <Text style={styles.body}>
            Posting to {board.name} · {BOARD_REGION}. Only share what you have seen yourself.
          </Text>
        </View>

        <Field label="What is it?" error={errors.kind}>
          <ChipGroup
            label="Kind of opportunity"
            options={POST_KINDS}
            value={draft.kind}
            onChange={(value) => set('kind', value)}
          />
        </Field>

        <Field label="Title" error={errors.title}>
          <TextInput
            value={draft.title}
            onChangeText={(text) => set('title', text)}
            placeholder="e.g. Welding apprentice"
            placeholderTextColor={colors.textMuted}
            maxLength={LIMITS.title}
            style={styles.input}
            accessibilityLabel="Title"
          />
        </Field>

        <Field label="Who is offering it?" error={errors.organization}>
          <TextInput
            value={draft.organization}
            onChangeText={(text) => set('organization', text)}
            placeholder="Company, lab, school or group"
            placeholderTextColor={colors.textMuted}
            maxLength={LIMITS.organization}
            style={styles.input}
            accessibilityLabel="Organization"
          />
        </Field>

        <Field label="Where?" error={errors.city}>
          <ChipGroup
            label="City"
            options={CITY_OPTIONS}
            value={draft.city}
            onChange={(value) => set('city', value)}
          />
        </Field>

        <Field label="Link (optional)" error={errors.url}>
          <TextInput
            value={draft.url}
            onChangeText={(text) => set('url', text)}
            placeholder="example.org/careers"
            placeholderTextColor={colors.textMuted}
            maxLength={LIMITS.url}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="url"
            style={styles.input}
            accessibilityLabel="Link"
          />
        </Field>

        <Field label="Details" error={errors.details}>
          <TextInput
            value={draft.details}
            onChangeText={(text) => set('details', text)}
            placeholder="What it is, who it is for, when to apply"
            placeholderTextColor={colors.textMuted}
            maxLength={LIMITS.details}
            multiline
            style={[styles.input, styles.inputMultiline]}
            accessibilityLabel="Details"
          />
          <Text style={styles.count}>
            {draft.details.length} / {LIMITS.details}
          </Text>
        </Field>

        <Text style={styles.safety}>{BOARD_COPY.safetyNote}</Text>
      </ScrollView>

      <View style={[styles.bar, { paddingBottom: Math.max(insets.bottom, spacing.md) }]}>
        <Button label="Post to board" onPress={submit} />
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.lg, gap: spacing.lg, paddingBottom: spacing.xl },
  header: { gap: spacing.xs },
  title: { ...typography.display, color: colors.text },
  body: { ...typography.body, color: colors.textMuted, lineHeight: 21 },

  field: { gap: spacing.sm },
  input: {
    minHeight: 48,
    paddingHorizontal: spacing.md,
    paddingVertical: 12,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    backgroundColor: colors.background,
    ...typography.body,
    color: colors.text,
  },
  inputMultiline: { minHeight: 110, textAlignVertical: 'top' },
  count: { ...typography.caption, color: colors.textMuted, alignSelf: 'flex-end' },
  error: { ...typography.caption, color: colors.danger },
  safety: { ...typography.caption, color: colors.textMuted, lineHeight: 18 },

  bar: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.background,
  },

  gate: {
    flex: 1,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.lg,
    gap: spacing.md,
  },
  gateText: { ...typography.body, color: colors.textMuted, textAlign: 'center' },
});
