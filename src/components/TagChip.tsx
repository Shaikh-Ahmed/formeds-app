import React from 'react';
import { Text, StyleSheet, TouchableOpacity, View } from 'react-native';
import { colors, fonts, radius, spacing, gloss, isPremium, isTerracotta } from '../theme';

interface Props {
  label: string;
  count?: number;
  selected?: boolean;
  onPress?: () => void;
  /** Remove affordance, for the composer's tag editor. */
  onRemove?: () => void;
  testID?: string;
}

/** A case tag. Static when no handler is given, filter toggle when there is one. */
export function TagChip({ label, count, selected, onPress, onRemove, testID }: Props) {
  const Wrapper: any = onPress || onRemove ? TouchableOpacity : View;
  return (
    <Wrapper
      testID={testID}
      onPress={onRemove ?? onPress}
      style={[styles.chip, isPremium && styles.pChip, selected && styles.chipSelected]}
      accessibilityRole={onPress || onRemove ? 'button' : undefined}
      accessibilityState={onPress ? { selected: !!selected } : undefined}
      accessibilityLabel={onRemove ? `Remove tag ${label}` : count != null ? `${label}, ${count} cases` : label}
    >
      <Text style={[styles.text, isPremium && styles.pText, selected && styles.textSelected]}>
        {label}
        {count != null ? <Text style={styles.count}>{`  ${count}`}</Text> : null}
        {onRemove ? '  ✕' : null}
      </Text>
    </Wrapper>
  );
}

const styles = StyleSheet.create({
  chip: {
    // A pale brand tint: blue everywhere but Terracotta, which is warm.
    backgroundColor: isTerracotta ? colors.tealBg : '#EFF6FF',
    borderWidth: 1,
    borderColor: isTerracotta ? colors.border : '#DBEAFE',
    borderRadius: radius.sm,
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: 4,
  },
  chipSelected: { backgroundColor: colors.action, ...gloss.fill, borderColor: colors.action },
  text: { fontSize: 12, fontWeight: '600', color: colors.navy },
  textSelected: { color: colors.white },
  count: { color: colors.textMuted, fontWeight: '500' },
  // Premium: a classification label -- a crisp 4px tag in uppercase teal.
  pChip: { backgroundColor: colors.tealBg, borderColor: colors.tealLine, borderRadius: radius.tag, paddingHorizontal: spacing.sm, paddingVertical: 3 },
  pText: { fontSize: 10.5, fontFamily: fonts.body.bold, fontWeight: undefined, color: colors.tealInk, letterSpacing: 0.6, textTransform: 'uppercase' },
});
