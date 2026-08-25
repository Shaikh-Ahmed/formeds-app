import React, { ReactNode } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, typography, fonts, radius, compactAction } from '../../theme';
import { Visibility, VISIBILITY_LABELS } from '../../types/profile';

const VISIBILITY_ICON: Record<Visibility, keyof typeof Ionicons.glyphMap> = {
  everyone: 'globe-outline',
  verified_professionals: 'shield-checkmark-outline',
  employers: 'business-outline',
  only_me: 'lock-closed-outline',
};

interface Props {
  title: string;
  children?: ReactNode;
  /** When true the section renders its empty state instead of `children`. */
  isEmpty?: boolean;
  /** Copy for the empty state. Every optional section should supply one. */
  emptyTitle?: string;
  emptyHint?: string;
  onAdd?: () => void;
  addLabel?: string;
  /**
   * A section holding ONE value (About, Skills, Links) rather than a
   * collection. Once filled, its action is Edit — offering "+ Add summary"
   * next to a summary that already exists reads as a bug.
   */
  singular?: boolean;
  visibility?: Visibility;
  onChangeVisibility?: () => void;
  /** Self-view. Controls whether add/privacy affordances render at all. */
  editable?: boolean;
  /** Suppresses the trailing rule on the last section of a column. */
  last?: boolean;
  testID?: string;
}

/**
 * One section of the resume.
 *
 * The profile is deliberately a single continuous document rather than a stack
 * of cards — a card per section is what made the old screen read as Settings,
 * and 17 borders plus 17 shadows is what "cluttered" looks like. Hierarchy
 * comes from the teal overline and vertical rhythm; separation comes from a
 * hairline rule.
 *
 * The empty state is built in and intentionally compact. `EmptyState` from the
 * shared library is a centred 48px-icon, full-screen treatment; repeating that
 * down a profile with fifteen unfilled sections produces exactly the "huge
 * empty spaces" the design brief rejects.
 */
export function ProfileSection({
  title,
  children,
  isEmpty,
  emptyTitle,
  emptyHint,
  onAdd,
  addLabel = 'Add',
  singular,
  visibility,
  onChangeVisibility,
  editable,
  last,
  testID,
}: Props) {
  // An empty optional section is a prompt to its owner and noise to everyone
  // else. A visitor reading a stranger's CV should not be told to "Add your
  // certifications" — on a public profile the section simply does not exist.
  if (isEmpty && !editable) return null;

  const showAdd = editable && !!onAdd;
  const actionLabel = singular && !isEmpty ? 'Edit' : addLabel;
  const actionIcon = singular && !isEmpty ? 'pencil' : 'add';
  const showPrivacy = editable && !!onChangeVisibility && !!visibility;

  return (
    <View style={[styles.section, last && styles.sectionLast]} testID={testID}>
      <View style={styles.header}>
        <Text style={styles.overline} accessibilityRole="header">
          {title}
        </Text>
        <View style={styles.headerActions}>
          {showPrivacy ? (
            <Pressable
              onPress={onChangeVisibility}
              hitSlop={compactAction.hitSlop}
              accessibilityRole="button"
              accessibilityLabel={`${title} visibility: ${VISIBILITY_LABELS[visibility!]}. Change`}
              style={({ pressed }) => [styles.iconBtn, pressed && styles.pressed]}
              testID={testID ? `${testID}-privacy` : undefined}
            >
              <Ionicons name={VISIBILITY_ICON[visibility!]} size={15} color={colors.textMuted} />
            </Pressable>
          ) : null}
          {showAdd && !isEmpty ? (
            <Pressable
              onPress={onAdd}
              hitSlop={compactAction.hitSlop}
              accessibilityRole="button"
              accessibilityLabel={`${actionLabel} — ${title}`}
              style={({ pressed }) => [styles.addBtn, pressed && styles.pressed]}
              testID={testID ? `${testID}-add` : undefined}
            >
              <Ionicons name={actionIcon} size={actionIcon === 'pencil' ? 14 : 16} color={colors.navy} />
              <Text style={styles.addText}>{actionLabel}</Text>
            </Pressable>
          ) : null}
        </View>
      </View>

      {isEmpty ? (
        <View style={styles.empty}>
          {emptyTitle ? <Text style={styles.emptyTitle}>{emptyTitle}</Text> : null}
          {emptyHint ? <Text style={styles.emptyHint}>{emptyHint}</Text> : null}
          {showAdd ? (
            <Pressable
              onPress={onAdd}
              accessibilityRole="button"
              accessibilityLabel={`${addLabel} — ${title}`}
              style={({ pressed }) => [styles.emptyAction, pressed && styles.pressed]}
              testID={testID ? `${testID}-add-empty` : undefined}
            >
              <Ionicons name="add" size={16} color={colors.navy} />
              <Text style={styles.addText}>{addLabel}</Text>
            </Pressable>
          ) : null}
        </View>
      ) : (
        children
      )}

      {last ? null : <View style={styles.rule} />}
    </View>
  );
}

const styles = StyleSheet.create({
  section: { paddingTop: spacing.xxl },
  sectionLast: { paddingBottom: spacing.xxl },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    marginBottom: spacing.md,
    gap: spacing.sm,
  },
  overline: { ...typography.overline, color: colors.teal, flexShrink: 1 },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  iconBtn: { padding: 2 },
  addBtn: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  addText: { ...typography.caption, fontFamily: fonts.body.semibold, color: colors.navy },
  pressed: { opacity: 0.6 },

  empty: {
    backgroundColor: colors.bg,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.borderLight,
    padding: spacing.lg,
    gap: spacing.xs,
    alignItems: 'flex-start',
  },
  emptyTitle: { ...typography.bodyStrong, color: colors.text },
  emptyHint: { ...typography.caption, color: colors.textSecondary, lineHeight: 19 },
  emptyAction: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    marginTop: spacing.sm,
    minHeight: 32,
  },

  rule: { height: 1, backgroundColor: colors.borderLight, marginTop: spacing.xxl },
});
