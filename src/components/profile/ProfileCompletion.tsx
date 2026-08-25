import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, radius, typography, fonts } from '../../theme';
import { CompletionSuggestion, ProfileCompletionInfo } from '../../types/profile';

interface Props {
  completion?: ProfileCompletionInfo;
  onSuggestion?: (suggestion: CompletionSuggestion) => void;
}

/**
 * Profile completeness.
 *
 * Deliberately not gamified: a 3px rule, a percentage and at most three plain
 * suggestions. No ring chart, no streak, no confetti. The goal is to prompt a
 * professional to finish a credible record, and a consumer-app progress toy
 * would undercut exactly the seriousness the rest of this screen is building.
 *
 * Self-view only — the server does not send `completion` to other viewers — and
 * it disappears entirely at 100% rather than lingering as a trophy.
 */
export function ProfileCompletion({ completion, onSuggestion }: Props) {
  if (!completion || completion.percent >= 100) return null;
  const percent = Math.max(0, Math.min(100, completion.percent));

  return (
    <View style={styles.wrap} testID="profile-completion">
      <View style={styles.headRow}>
        <Text style={styles.label}>{`Profile ${percent}% complete`}</Text>
      </View>

      <View
        style={styles.track}
        accessible
        accessibilityRole="progressbar"
        accessibilityValue={{ min: 0, max: 100, now: percent }}
        accessibilityLabel="Profile completeness"
      >
        <View style={[styles.fill, { width: `${percent}%` }]} />
      </View>

      {completion.suggestions.length ? (
        <View style={styles.suggestions}>
          {completion.suggestions.map((suggestion) => (
            <Pressable
              key={suggestion.key}
              onPress={() => onSuggestion?.(suggestion)}
              accessibilityRole="button"
              accessibilityLabel={suggestion.label}
              style={({ pressed }) => [styles.row, pressed && styles.pressed]}
              testID={`completion-${suggestion.key}`}
            >
              <Text style={styles.rowText}>{suggestion.label}</Text>
              <Ionicons name="chevron-forward" size={15} color={colors.textMuted} />
            </Pressable>
          ))}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    backgroundColor: colors.bg,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.borderLight,
    padding: spacing.lg,
    gap: spacing.md,
  },
  headRow: { flexDirection: 'row', justifyContent: 'space-between' },
  label: { ...typography.caption, fontFamily: fonts.body.semibold, color: colors.text },
  track: { height: 3, borderRadius: 2, backgroundColor: colors.border, overflow: 'hidden' },
  fill: { height: 3, backgroundColor: colors.teal },
  suggestions: { gap: 2 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 36,
    gap: spacing.md,
  },
  rowText: { ...typography.caption, color: colors.textSecondary, flex: 1 },
  pressed: { opacity: 0.6 },
});
