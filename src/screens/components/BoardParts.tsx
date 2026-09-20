// Small pieces shared by the bulletin board screens. Screens slice.

import { Pressable, StyleSheet, Text, View } from 'react-native';

import { BOARDS_BY_ID } from '../../content';
import type { Board, CareerProfile, RiasecCode } from '../../models';
import { colors, radius, spacing, typography } from '../../theme';

const MINUTE = 60 * 1000;

/** Words in the free-text "what do you do" answer that point at a field board. */
const FIELD_KEYWORDS: [boardId: string, pattern: RegExp][] = [
  ['job-healthcare', /nurs|health|medic|clinic|patient|pharm|dental|therap/i],
  ['job-tech', /software|develop|program|coding|\bcode\b|data|\bit\b|cyber|computer|web|\bai\b/i],
  ['job-automotive', /auto|car\b|vehicle|\bev\b|mobility|engine/i],
  ['job-manufacturing', /manufactur|weld|machin|electric|plumb|hvac|trade|assembl|logistic|warehouse/i],
  ['job-business', /financ|bank|account|insur|sales|business|operations|analyst|manager/i],
  ['job-education', /teach|tutor|coach|school|educat|youth/i],
  ['job-creative', /design|market|film|music|writ|media|art\b|video/i],
  ['job-public', /government|public|nonprofit|non-profit|community|civic|social work/i],
  ['job-research', /research|lab\b|scien|stem|biolog|chemi|physic/i],
];

/** Fallback when the free text says nothing: the strongest Holland interest. */
const HOLLAND_BOARD: Record<RiasecCode, string> = {
  R: 'job-manufacturing',
  I: 'job-research',
  A: 'job-creative',
  S: 'job-healthcare',
  E: 'job-business',
  C: 'job-business',
};

/**
 * The room a member should land in for chat: a field board they already joined,
 * else the one their answers point at, else null (send them to the directory).
 */
export function chatBoardFor(profile: CareerProfile | null, joined: string[]): Board | null {
  for (const id of joined) {
    const board = BOARDS_BY_ID.get(id);
    if (board?.category === 'job') return board;
  }

  const focus = profile?.focusArea ?? '';
  const byText = FIELD_KEYWORDS.find(([, pattern]) => pattern.test(focus));
  if (byText) return BOARDS_BY_ID.get(byText[0]) ?? null;

  const top = profile?.interests.hollandCode[0];
  if (top) return BOARDS_BY_ID.get(HOLLAND_BOARD[top]) ?? null;

  // No field signal at all; an age board they joined is still a real room.
  for (const id of joined) {
    const board = BOARDS_BY_ID.get(id);
    if (board) return board;
  }
  return null;
}

/** "just now", "5m ago", "3h ago", then a short date. */
export function timeAgo(iso: string): string {
  const elapsed = Date.now() - new Date(iso).getTime();
  if (elapsed < MINUTE) return 'just now';
  if (elapsed < 60 * MINUTE) return `${Math.floor(elapsed / MINUTE)}m ago`;
  if (elapsed < 24 * 60 * MINUTE) return `${Math.floor(elapsed / (60 * MINUTE))}h ago`;
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

type ChipGroupProps<T extends string> = {
  options: readonly { value: T; label: string }[];
  value: T | null;
  onChange: (value: T) => void;
  label: string;
};

/** Single-select chips. Wraps onto several lines. */
export function ChipGroup<T extends string>({ options, value, onChange, label }: ChipGroupProps<T>) {
  return (
    <View style={styles.chips} accessibilityRole="radiogroup" accessibilityLabel={label}>
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <Pressable
            key={option.value}
            onPress={() => onChange(option.value)}
            accessibilityRole="radio"
            accessibilityState={{ selected }}
            style={[styles.chip, selected && styles.chipSelected]}
          >
            <Text style={[styles.chipText, selected && styles.chipTextSelected]}>{option.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  chip: {
    minHeight: 40,
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    backgroundColor: colors.background,
  },
  chipSelected: { backgroundColor: colors.primarySoft, borderColor: colors.primary },
  chipText: { ...typography.caption, color: colors.text },
  chipTextSelected: { color: colors.primary, fontWeight: '600' },
});
