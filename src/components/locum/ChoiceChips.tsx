import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, radius, spacing, typography, fonts } from '../../theme';

export interface Choice<T extends string> {
  value: T;
  label: string;
  icon?: keyof typeof Ionicons.glyphMap;
}

/**
 * A single-choice row of pills, announced as a radio group.
 *
 * The locum form is built from these because a tap is faster than a picker
 * for every small, fixed set it asks about -- role, shift, pay basis, date --
 * and speed is the whole point of the form. Same pill shape and navy selected
 * state as the Jobs filter chips, so it reads as the same product.
 */
export function ChoiceChips<T extends string>({
  label, choices, value, onChange, testID, allowDeselect = false,
}: {
  label?: string;
  choices: Choice<T>[];
  value: T | null | undefined;
  onChange: (value: T | null) => void;
  testID?: string;
  /** Tapping the selected chip clears it -- for filters, not form fields. */
  allowDeselect?: boolean;
}) {
  return (
    <View style={styles.group}>
      {label ? <Text style={styles.label}>{label}</Text> : null}
      <View style={styles.row} accessibilityRole="radiogroup" accessibilityLabel={label}>
        {choices.map(choice => {
          const selected = choice.value === value;
          return (
            <Pressable
              key={choice.value}
              testID={testID ? `${testID}-${choice.value}` : undefined}
              onPress={() => onChange(selected && allowDeselect ? null : choice.value)}
              accessibilityRole="radio"
              accessibilityState={{ selected }}
              accessibilityLabel={choice.label}
              style={({ pressed }) => [styles.chip, selected && styles.chipOn, pressed && styles.pressed]}
            >
              {choice.icon ? (
                <Ionicons name={choice.icon} size={15} color={selected ? colors.white : colors.textSecondary} />
              ) : null}
              <Text style={[styles.text, selected && styles.textOn]}>{choice.label}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  group: { gap: spacing.sm },
  label: { ...typography.label, color: colors.text },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    minHeight: 38,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.white,
  },
  chipOn: { backgroundColor: colors.navy, borderColor: colors.navy },
  text: { ...typography.caption, color: colors.textSecondary },
  textOn: { color: colors.white, fontFamily: fonts.body.semibold },
  pressed: { opacity: 0.7 },
});
