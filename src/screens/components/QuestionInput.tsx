// Renders one question of any kind. Screens slice.
//
// Every kind is built from big tappable rows rather than sliders or grids:
// grid/matrix questions are the worst-performing format on a phone, and a
// fully-labelled row list is more reliable than an endpoint-labelled slider.

import { useMemo, useRef } from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  type GestureResponderEvent,
  type LayoutChangeEvent,
} from 'react-native';

import type {
  AllocationQuestion,
  AnswerValue,
  ChoiceOption,
  MultiChoiceQuestion,
  Question,
  ScaleQuestion,
  SingleChoiceQuestion,
  TextQuestion,
} from '../../models';
import { TOUCH_TARGET, colors, radius, spacing, typography } from '../../theme';
import { focusRing, isFocused } from '../../web/focus';
import { isHovered } from '../../web/hover';

type InputProps = {
  question: Question;
  value: AnswerValue | undefined;
  onChange: (value: AnswerValue) => void;
};

export function QuestionInput({ question, value, onChange }: InputProps) {
  switch (question.kind) {
    case 'single':
      return <SingleInput question={question} value={value} onChange={onChange} />;
    case 'multi':
      return <MultiInput question={question} value={value} onChange={onChange} />;
    case 'scale':
      return <ScaleInput question={question} value={value} onChange={onChange} />;
    case 'allocate':
      return <AllocationInput question={question} value={value} onChange={onChange} />;
    case 'text':
      return <TextAnswerInput question={question} value={value} onChange={onChange} />;
    default:
      return null;
  }
}

function OptionRow({
  option,
  selected,
  onPress,
  disabled,
  indicator,
}: {
  option: ChoiceOption;
  selected: boolean;
  onPress: () => void;
  disabled?: boolean;
  indicator: 'radio' | 'check';
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole={indicator === 'radio' ? 'radio' : 'checkbox'}
      accessibilityState={{ selected, disabled: !!disabled }}
      style={(state) => [
        styles.row,
        selected && styles.rowSelected,
        disabled && !selected && styles.rowDisabled,
        !selected && !disabled && isHovered(state) && styles.rowHover,
        state.pressed && styles.rowPressed,
        isFocused(state) && focusRing,
      ]}
    >
      <View
        style={[
          styles.indicator,
          indicator === 'check' && styles.indicatorSquare,
          selected && styles.indicatorSelected,
        ]}
      >
        {selected ? <View style={styles.indicatorInner} /> : null}
      </View>
      <View style={styles.rowTextWrap}>
        <Text style={[styles.rowLabel, selected && styles.rowLabelSelected]}>{option.label}</Text>
        {option.hint ? <Text style={styles.rowHint}>{option.hint}</Text> : null}
      </View>
    </Pressable>
  );
}

function SingleInput({
  question,
  value,
  onChange,
}: {
  question: SingleChoiceQuestion;
  value: AnswerValue | undefined;
  onChange: (value: AnswerValue) => void;
}) {
  return (
    <View style={styles.stack}>
      {question.options.map((option) => (
        <OptionRow
          key={option.value}
          option={option}
          indicator="radio"
          selected={value === option.value}
          onPress={() => onChange(option.value)}
        />
      ))}
    </View>
  );
}

function MultiInput({
  question,
  value,
  onChange,
}: {
  question: MultiChoiceQuestion;
  value: AnswerValue | undefined;
  onChange: (value: AnswerValue) => void;
}) {
  const selected = Array.isArray(value) ? value : [];
  const max = question.max ?? question.options.length;
  const atCap = selected.length >= max;

  const toggle = (optionValue: string) => {
    if (selected.includes(optionValue)) {
      onChange(selected.filter((item) => item !== optionValue));
      return;
    }
    // At the cap, the newest pick pushes out the oldest rather than silently
    // doing nothing, which reads as a broken tap.
    const next = atCap ? [...selected.slice(1), optionValue] : [...selected, optionValue];
    onChange(next);
  };

  return (
    <View style={styles.stack}>
      {question.options.map((option) => (
        <OptionRow
          key={option.value}
          option={option}
          indicator="check"
          selected={selected.includes(option.value)}
          onPress={() => toggle(option.value)}
        />
      ))}
      {question.max ? (
        <Text style={styles.helper}>
          {selected.length} of {question.max} picked
          {atCap ? ' · tapping another swaps out your first pick' : ''}
        </Text>
      ) : null}
    </View>
  );
}

function ScaleInput({
  question,
  value,
  onChange,
}: {
  question: ScaleQuestion;
  value: AnswerValue | undefined;
  onChange: (value: AnswerValue) => void;
}) {
  return (
    <View style={styles.stack}>
      {/* Both ends on one line, so the rows below read as points on a scale
          rather than as a list with two captions floating around it. */}
      {question.minLabel || question.maxLabel ? (
        <View style={styles.anchorRow}>
          <Text style={styles.anchor}>{question.minLabel ?? ''}</Text>
          <View style={styles.anchorRule} />
          <Text style={[styles.anchor, styles.anchorEnd]}>{question.maxLabel ?? ''}</Text>
        </View>
      ) : null}
      {question.labels.map((label, index) => {
        const point = index + 1;
        const selected = value === point;
        return (
          <Pressable
            key={label}
            onPress={() => onChange(point)}
            accessibilityRole="radio"
            accessibilityState={{ selected }}
            style={(state) => [
              styles.row,
              selected && styles.rowSelected,
              !selected && isHovered(state) && styles.rowHover,
              state.pressed && styles.rowPressed,
              isFocused(state) && focusRing,
            ]}
          >
            <View style={[styles.indicator, selected && styles.indicatorSelected]}>
              {selected ? <View style={styles.indicatorInner} /> : null}
            </View>
            <Text style={[styles.rowLabel, selected && styles.rowLabelSelected]}>{label}</Text>
            <Text style={[styles.scalePoint, selected && styles.scalePointSelected]}>
              {point}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function AllocationInput({
  question,
  value,
  onChange,
}: {
  question: AllocationQuestion;
  value: AnswerValue | undefined;
  onChange: (value: AnswerValue) => void;
}) {
  const allocation = useMemo<Record<string, number>>(() => {
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      return value as Record<string, number>;
    }
    return Object.fromEntries(question.options.map((option) => [option.value, 0]));
  }, [value, question.options]);

  const spent = Object.values(allocation).reduce((sum, amount) => sum + amount, 0);
  const remaining = question.total - spent;
  // Measured once per meter so a tap can be read as a share of the bar.
  const trackWidths = useRef<Record<string, number>>({});

  const adjust = (optionValue: string, delta: number) => {
    const current = allocation[optionValue] ?? 0;
    const next = Math.max(0, Math.min(question.total, current + delta));
    // Never let the total run over the budget - that is the whole point of
    // the format.
    if (delta > 0 && next - current > remaining) return;
    onChange({ ...allocation, [optionValue]: next });
  };

  /**
   * Tapping along a meter sets that option directly. Without it, spending 100
   * points five at a time took twenty taps before the question would let you
   * move on, which is the sort of thing people abandon a form over.
   */
  const setFromTap = (optionValue: string, event: GestureResponderEvent) => {
    const width = trackWidths.current[optionValue];
    if (!width) return;
    const share = Math.max(0, Math.min(1, event.nativeEvent.locationX / width));
    const raw = Math.round((share * question.total) / question.step) * question.step;
    const current = allocation[optionValue] ?? 0;
    const ceiling = current + remaining;
    onChange({ ...allocation, [optionValue]: Math.max(0, Math.min(ceiling, raw)) });
  };

  /** An even split, as a starting point people can then pull about. */
  const spreadEvenly = () => {
    const count = question.options.length;
    const each = Math.floor(question.total / count / question.step) * question.step;
    const even = Object.fromEntries(question.options.map((option) => [option.value, each]));
    const first = question.options[0];
    if (first) even[first.value] = question.total - each * (count - 1);
    onChange(even);
  };

  const clearAll = () =>
    onChange(Object.fromEntries(question.options.map((option) => [option.value, 0])));

  return (
    <View style={styles.stack}>
      <View style={[styles.budgetBanner, remaining === 0 && styles.budgetBannerDone]}>
        <Text style={[styles.budgetText, remaining === 0 && styles.budgetTextDone]}>
          {remaining === 0 ? 'All 100 points spent' : `${remaining} points left to spend`}
        </Text>
      </View>

      <View style={styles.budgetHints}>
        <Text style={styles.budgetHint}>Tap along a bar to set it, or use − and +.</Text>
        <View style={styles.budgetShortcuts}>
          <Pressable
            onPress={spreadEvenly}
            accessibilityRole="button"
            hitSlop={8}
            style={({ pressed }) => [styles.shortcut, pressed && styles.rowPressed]}
          >
            <Text style={styles.shortcutText}>Spread evenly</Text>
          </Pressable>
          {spent > 0 ? (
            <Pressable
              onPress={clearAll}
              accessibilityRole="button"
              hitSlop={8}
              style={({ pressed }) => [styles.shortcut, pressed && styles.rowPressed]}
            >
              <Text style={styles.shortcutText}>Start again</Text>
            </Pressable>
          ) : null}
        </View>
      </View>

      {question.options.map((option) => {
        const amount = allocation[option.value] ?? 0;
        return (
          <View key={option.value} style={[styles.allocRow, amount > 0 && styles.rowSelected]}>
            <View style={styles.rowTextWrap}>
              <Text style={[styles.rowLabel, amount > 0 && styles.rowLabelSelected]}>
                {option.label}
              </Text>
              {option.hint ? <Text style={styles.rowHint}>{option.hint}</Text> : null}
              <Pressable
                onPress={(event) => setFromTap(option.value, event)}
                onLayout={(event: LayoutChangeEvent) => {
                  trackWidths.current[option.value] = event.nativeEvent.layout.width;
                }}
                accessibilityRole="adjustable"
                accessibilityLabel={`${option.label}, ${amount} of ${question.total} points`}
                accessibilityValue={{ now: amount, min: 0, max: question.total }}
                style={styles.meterTouch}
              >
                <View style={styles.meterTrack}>
                  <View
                    style={[styles.meterFill, { width: `${(amount / question.total) * 100}%` }]}
                  />
                </View>
              </Pressable>
            </View>
            <View style={styles.stepper}>
              <Pressable
                onPress={() => adjust(option.value, -question.step)}
                disabled={amount === 0}
                accessibilityRole="button"
                accessibilityLabel={`Remove ${question.step} points from ${option.label}`}
                style={({ pressed }) => [
                  styles.stepperButton,
                  amount === 0 && styles.stepperDisabled,
                  pressed && styles.rowPressed,
                ]}
              >
                <Text style={styles.stepperGlyph}>−</Text>
              </Pressable>
              <Text style={styles.stepperValue}>{amount}</Text>
              <Pressable
                onPress={() => adjust(option.value, question.step)}
                disabled={remaining < question.step}
                accessibilityRole="button"
                accessibilityLabel={`Add ${question.step} points to ${option.label}`}
                style={({ pressed }) => [
                  styles.stepperButton,
                  remaining < question.step && styles.stepperDisabled,
                  pressed && styles.rowPressed,
                ]}
              >
                <Text style={styles.stepperGlyph}>+</Text>
              </Pressable>
            </View>
          </View>
        );
      })}
    </View>
  );
}

function TextAnswerInput({
  question,
  value,
  onChange,
}: {
  question: TextQuestion;
  value: AnswerValue | undefined;
  onChange: (value: AnswerValue) => void;
}) {
  const text = typeof value === 'string' ? value : '';
  return (
    <View style={styles.stack}>
      <TextInput
        value={text}
        onChangeText={onChange}
        placeholder={question.placeholder}
        placeholderTextColor={colors.textMuted}
        maxLength={question.maxLength}
        multiline={question.multiline}
        style={[styles.textInput, question.multiline && styles.textInputMultiline]}
        accessibilityLabel={question.prompt}
      />
      {question.maxLength ? (
        <Text style={styles.helper}>
          {text.length} / {question.maxLength}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  stack: { gap: spacing.sm },

  row: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: TOUCH_TARGET + 8,
    gap: spacing.sm + 4,
    paddingVertical: spacing.md - 2,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.background,
  },
  rowSelected: { borderColor: colors.primary, backgroundColor: colors.primarySoft },
  rowHover: { borderColor: colors.borderStrong, backgroundColor: colors.surface },
  rowDisabled: { opacity: 0.5 },
  rowPressed: { opacity: 0.7 },
  rowTextWrap: { flex: 1, gap: 2 },
  rowLabel: { ...typography.body, color: colors.text, flexShrink: 1 },
  rowLabelSelected: { fontWeight: '600' },
  rowHint: { ...typography.caption, color: colors.textMuted },

  indicator: {
    width: 22,
    height: 22,
    borderRadius: radius.pill,
    borderWidth: 2,
    borderColor: colors.borderStrong,
    alignItems: 'center',
    justifyContent: 'center',
  },
  indicatorSquare: { borderRadius: radius.sm - 2 },
  indicatorSelected: { borderColor: colors.primary },
  indicatorInner: {
    width: 11,
    height: 11,
    borderRadius: radius.pill,
    backgroundColor: colors.primary,
  },

  anchorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.xs,
  },
  anchor: { ...typography.label, color: colors.textMuted, letterSpacing: 0.4 },
  anchorEnd: { textAlign: 'right' },
  anchorRule: { flex: 1, height: 1, backgroundColor: colors.border },
  scalePoint: { ...typography.label, color: colors.textMuted, marginLeft: 'auto' },
  scalePointSelected: { color: colors.primary },
  helper: { ...typography.caption, color: colors.textMuted, marginTop: spacing.xs },

  budgetBanner: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceAlt,
  },
  budgetBannerDone: { backgroundColor: colors.primarySoft },
  budgetText: { ...typography.heading, color: colors.textMuted },
  budgetTextDone: { color: colors.primary },

  budgetHints: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
    marginBottom: spacing.xs,
  },
  budgetHint: { ...typography.caption, color: colors.textMuted, flexShrink: 1 },
  budgetShortcuts: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  shortcut: {
    minHeight: 32,
    justifyContent: 'center',
    paddingHorizontal: spacing.sm,
    borderRadius: radius.sm,
  },
  shortcutText: { ...typography.caption, fontWeight: '600', color: colors.primary },

  allocRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.md - 2,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.background,
  },
  // A taller touch area than the 6px bar it draws, so the tap target clears the
  // minimum without a fat line across the row.
  meterTouch: { paddingVertical: spacing.sm, marginTop: spacing.xs },
  meterTrack: {
    height: 6,
    borderRadius: radius.pill,
    backgroundColor: colors.border,
    overflow: 'hidden',
  },
  meterFill: { height: 6, backgroundColor: colors.primary, borderRadius: radius.pill },

  stepper: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  stepperButton: {
    width: TOUCH_TARGET,
    height: TOUCH_TARGET,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepperDisabled: { opacity: 0.35 },
  stepperGlyph: { fontSize: 20, lineHeight: 22, color: colors.text },
  stepperValue: { ...typography.heading, color: colors.text, minWidth: 30, textAlign: 'center' },

  textInput: {
    ...typography.body,
    color: colors.text,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.md,
    backgroundColor: colors.background,
  },
  textInputMultiline: { minHeight: 130, textAlignVertical: 'top' },
});
