// The controls that sit above a list: search, filter chips and sort.
// Screens slice.
//
// Shared by Browse and Events so both feel like the same page with a different
// catalog behind them.

import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { TOUCH_TARGET, colors, radius, spacing, typography } from '../../theme';
import { focusRing, isFocused } from '../../web/focus';
import { isHovered } from '../../web/hover';

/* ------------------------------------------------------------------ search */

export function SearchField({
  value,
  onChange,
  placeholder,
  accessibilityLabel,
}: {
  value: string;
  onChange: (next: string) => void;
  placeholder: string;
  accessibilityLabel: string;
}) {
  return (
    <View style={styles.search}>
      <Text style={styles.searchGlyph}>⌕</Text>
      <TextInput
        value={value}
        onChangeText={onChange}
        placeholder={placeholder}
        placeholderTextColor={colors.textMuted}
        accessibilityLabel={accessibilityLabel}
        style={styles.searchInput}
        returnKeyType="search"
        autoCorrect={false}
      />
      {value ? (
        <Pressable
          onPress={() => onChange('')}
          hitSlop={10}
          accessibilityRole="button"
          accessibilityLabel="Clear search"
          style={(state) => [
            styles.clear,
            isHovered(state) && styles.clearHover,
            isFocused(state) && focusRing,
          ]}
        >
          <Text style={styles.clearGlyph}>×</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

/* ------------------------------------------------------------------- chips */

export type ChipOption<T extends string> = { value: T; label: string; count?: number };

/**
 * One row of mutually exclusive choices. Used for the type filter, where being
 * able to see every option at once matters more than saving space.
 */
export function ChipGroup<T extends string>({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: ChipOption<T>[];
  value: T;
  onChange: (next: T) => void;
}) {
  return (
    <View style={styles.group}>
      <Text style={styles.groupLabel}>{label}</Text>
      <View style={styles.chips} accessibilityRole="radiogroup" accessibilityLabel={label}>
        {options.map((option) => {
          const selected = option.value === value;
          return (
            <Pressable
              key={option.value}
              onPress={() => onChange(option.value)}
              accessibilityRole="radio"
              accessibilityState={{ selected }}
              accessibilityLabel={
                option.count === undefined ? option.label : `${option.label}, ${option.count}`
              }
              style={(state) => [
                styles.chip,
                selected && styles.chipSelected,
                !selected && isHovered(state) && styles.chipHover,
                isFocused(state) && focusRing,
              ]}
            >
              <Text style={[styles.chipText, selected && styles.chipTextSelected]}>
                {option.label}
              </Text>
              {option.count !== undefined ? (
                <Text style={[styles.chipCount, selected && styles.chipCountSelected]}>
                  {option.count}
                </Text>
              ) : null}
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

/* ------------------------------------------------------------------ toggle */

/** A compact segmented control, for a choice with two or three short options. */
export function Segmented<T extends string>({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: { value: T; label: string }[];
  value: T;
  onChange: (next: T) => void;
}) {
  return (
    <View style={styles.segmentedWrap}>
      <Text style={styles.groupLabel}>{label}</Text>
      <View style={styles.segmented} accessibilityRole="radiogroup" accessibilityLabel={label}>
        {options.map((option) => {
          const selected = option.value === value;
          return (
            <Pressable
              key={option.value}
              onPress={() => onChange(option.value)}
              accessibilityRole="radio"
              accessibilityState={{ selected }}
              style={(state) => [
                styles.segment,
                selected && styles.segmentSelected,
                isFocused(state) && focusRing,
              ]}
            >
              <Text style={[styles.segmentText, selected && styles.segmentTextSelected]}>
                {option.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

/* ------------------------------------------------------------------ styles */

const styles = StyleSheet.create({
  search: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    minHeight: TOUCH_TARGET + 4,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    backgroundColor: colors.background,
  },
  searchGlyph: { fontSize: 20, color: colors.textMuted },
  // `outlineStyle` is react-native-web's; the field draws its own border instead.
  searchInput: {
    flex: 1,
    ...typography.body,
    color: colors.text,
    paddingVertical: spacing.sm,
    ...({ outlineStyle: 'none' } as object),
  },
  clear: {
    width: 28,
    height: 28,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  clearHover: { backgroundColor: colors.surface },
  clearGlyph: { fontSize: 20, lineHeight: 22, color: colors.textMuted },

  group: { gap: spacing.sm },
  groupLabel: { ...typography.label, color: colors.textMuted, letterSpacing: 0.6 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    minHeight: 38,
    paddingHorizontal: spacing.md,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.background,
  },
  chipHover: { borderColor: colors.borderStrong, backgroundColor: colors.surface },
  chipSelected: { borderColor: colors.primary, backgroundColor: colors.primarySoft },
  chipText: { ...typography.caption, fontWeight: '600', color: colors.textMuted },
  chipTextSelected: { color: colors.primary },
  chipCount: { ...typography.label, color: colors.textMuted },
  chipCountSelected: { color: colors.primary },

  segmentedWrap: { gap: spacing.sm },
  segmented: {
    flexDirection: 'row',
    alignSelf: 'flex-start',
    padding: 3,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceAlt,
  },
  segment: {
    minHeight: 34,
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
    borderRadius: radius.pill,
  },
  segmentSelected: { backgroundColor: colors.background },
  segmentText: { ...typography.caption, fontWeight: '600', color: colors.textMuted },
  segmentTextSelected: { color: colors.primary },
});
