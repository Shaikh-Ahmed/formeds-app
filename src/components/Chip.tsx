import React from 'react';
import { Text, StyleSheet, View, Pressable, ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, radius, spacing, typography, fonts, compactAction } from '../theme';

export type ChipTone = 'neutral' | 'teal' | 'navy';

interface Props {
  label: string;
  tone?: ChipTone;
  icon?: keyof typeof Ionicons.glyphMap;
  onPress?: () => void;
  /** Turns the whole chip into a remove control, as in the skills editor. */
  onRemove?: () => void;
  style?: ViewStyle;
  testID?: string;
}

/**
 * A pill for profile taxonomies — skills, specializations, interests.
 *
 * Deliberately separate from `TagChip`, which is not a generic chip: it is the
 * case-forum tag, carrying a result `count` and a `selected` filter state, and
 * it is square-ish (`radius.sm`) because it reads as a data label inside a
 * card. This one is a pill and carries neither. Keeping them apart means the
 * forum's filter behaviour can change without reshaping every profile section.
 */
export function Chip({ label, tone = 'neutral', icon, onPress, onRemove, style, testID }: Props) {
  const interactive = !!(onPress || onRemove);
  const toneStyle = TONES[tone];

  const body = (
    <>
      {icon ? (
        <Ionicons name={icon} size={13} color={toneStyle.fg} style={styles.icon} />
      ) : null}
      <Text style={[styles.label, { color: toneStyle.fg }]} numberOfLines={1}>
        {label}
      </Text>
      {onRemove ? (
        <Ionicons name="close" size={14} color={toneStyle.fg} style={styles.remove} />
      ) : null}
    </>
  );

  if (!interactive) {
    return (
      <View
        testID={testID}
        style={[styles.chip, { backgroundColor: toneStyle.bg, borderColor: toneStyle.border }, style]}
      >
        {body}
      </View>
    );
  }

  return (
    <Pressable
      testID={testID}
      onPress={onRemove ?? onPress}
      // Painted short to keep chip rows dense; the slop restores a real target.
      hitSlop={compactAction.hitSlop}
      accessibilityRole="button"
      accessibilityLabel={onRemove ? `Remove ${label}` : label}
      style={({ pressed }) => [
        styles.chip,
        { backgroundColor: toneStyle.bg, borderColor: toneStyle.border },
        pressed && styles.pressed,
        style,
      ]}
    >
      {body}
    </Pressable>
  );
}

const TONES: Record<ChipTone, { bg: string; border: string; fg: string }> = {
  neutral: { bg: colors.bgMuted, border: colors.border, fg: colors.textSecondary },
  teal: { bg: colors.tealBg, border: colors.tealLight, fg: colors.teal },
  navy: { bg: colors.navy, border: colors.navy, fg: colors.white },
};

const styles = StyleSheet.create({
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
  },
  // Opacity only — a transform here would shift neighbouring chips in the row.
  pressed: { opacity: 0.65 },
  label: { ...typography.caption, fontFamily: fonts.body.medium },
  icon: { marginRight: spacing.xs + 1 },
  remove: { marginLeft: spacing.xs + 1 },
});
