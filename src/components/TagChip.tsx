import React from 'react';
import { Text, StyleSheet, TouchableOpacity, View } from 'react-native';
import { colors, radius, spacing } from '../theme';

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
      style={[styles.chip, selected && styles.chipSelected]}
      accessibilityRole={onPress || onRemove ? 'button' : undefined}
      accessibilityState={onPress ? { selected: !!selected } : undefined}
      accessibilityLabel={onRemove ? `Remove tag ${label}` : count != null ? `${label}, ${count} cases` : label}
    >
      <Text style={[styles.text, selected && styles.textSelected]}>
        {label}
        {count != null ? <Text style={styles.count}>{`  ${count}`}</Text> : null}
        {onRemove ? '  ✕' : null}
      </Text>
    </Wrapper>
  );
}

const styles = StyleSheet.create({
  chip: {
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#DBEAFE',
    borderRadius: radius.sm,
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: 4,
  },
  chipSelected: { backgroundColor: colors.navy, borderColor: colors.navy },
  text: { fontSize: 12, fontWeight: '600', color: colors.navy },
  textSelected: { color: colors.white },
  count: { color: colors.textMuted, fontWeight: '500' },
});
