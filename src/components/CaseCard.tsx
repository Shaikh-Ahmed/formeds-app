import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, radius, spacing, typography, fonts } from '../theme';
import { timeAgo } from '../utils/time';
import { Avatar } from './Avatar';
import { RoleBadge } from './RoleBadge';
import { TagChip } from './TagChip';
import type { CaseThread } from '../types/cases';

interface Props {
  item: CaseThread;
  onPress: () => void;
  onTagPress?: (tag: string) => void;
}

const STATUS_BADGE = {
  resolved: { icon: 'checkmark-circle' as const, label: 'Resolved', color: colors.teal, bg: colors.successBg },
  closed: { icon: 'lock-closed' as const, label: 'Closed', color: colors.textSecondary, bg: colors.bgMuted },
};

function Stat({ icon, value, label }: { icon: any; value: number; label: string }) {
  return (
    <View style={styles.stat} accessible accessibilityLabel={`${value} ${label}`}>
      <Ionicons name={icon} size={14} color={colors.textMuted} />
      <Text style={styles.statText}>{value}</Text>
    </View>
  );
}

/**
 * One row in the Cases list.
 *
 * Deliberately answer-count-forward rather than score-forward: the signal a
 * clinician scanning the list needs is "has anyone weighed in on this yet",
 * which is also what pulls answers onto the questions that have none.
 */
export function CaseCard({ item, onPress, onTagPress }: Props) {
  const badge = item.status !== 'open' ? STATUS_BADGE[item.status] : null;

  return (
    <TouchableOpacity
      testID={`case-card-${item.id}`}
      style={styles.card}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${item.title}. ${item.answer_count} answers, score ${item.vote_score}.`}
    >
      <View style={styles.topRow}>
        <Text style={styles.title} numberOfLines={2}>{item.title}</Text>
        {item.bookmarked ? <Ionicons name="bookmark" size={16} color={colors.navy} /> : null}
      </View>

      {badge ? (
        <View style={[styles.badge, { backgroundColor: badge.bg }]}>
          <Ionicons name={badge.icon} size={12} color={badge.color} />
          <Text style={[styles.badgeText, { color: badge.color }]}>{badge.label}</Text>
        </View>
      ) : null}

      <Text style={styles.excerpt} numberOfLines={2}>{item.body}</Text>

      {item.tags?.length ? (
        <View style={styles.tags}>
          {item.tags.map(tag => (
            <TagChip key={tag} label={tag} onPress={onTagPress ? () => onTagPress(tag) : undefined} />
          ))}
        </View>
      ) : null}

      <View style={styles.footer}>
        <Avatar name={item.author_name} role={item.author_role} size={26} />
        <View style={styles.authorMeta}>
          <Text style={styles.authorName} numberOfLines={1}>{item.author_name}</Text>
          <RoleBadge role={item.author_role} />
        </View>
        <Text style={styles.time}>{timeAgo(item.created_at)}</Text>
      </View>

      <View style={styles.stats}>
        <Stat icon="arrow-up-circle-outline" value={item.vote_score} label="votes" />
        <Stat icon="chatbubble-outline" value={item.answer_count} label="answers" />
        <Stat icon="eye-outline" value={item.view_count} label="views" />
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.card,
    borderRadius: radius.xl + 2,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    marginBottom: spacing.md,
  },
  topRow: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm },
  title: { ...typography.h3, color: colors.text, flex: 1, lineHeight: 23 },
  badge: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.xs, alignSelf: 'flex-start',
    borderRadius: radius.sm, paddingHorizontal: spacing.sm, paddingVertical: 2, marginTop: spacing.sm,
  },
  badgeText: { fontSize: 11, fontWeight: '700' },
  excerpt: { ...typography.caption, color: colors.textSecondary, lineHeight: 19, marginTop: spacing.sm },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs, marginTop: spacing.md },
  footer: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: spacing.md },
  authorMeta: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  authorName: { ...typography.small, fontFamily: fonts.body.semibold, color: colors.textSecondary, flexShrink: 1 },
  time: { ...typography.small, color: colors.textMuted },
  stats: {
    flexDirection: 'row', gap: spacing.xl, marginTop: spacing.md,
    paddingTop: spacing.md, borderTopWidth: 1, borderTopColor: colors.borderLight,
  },
  stat: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  statText: { ...typography.small, color: colors.textMuted, fontFamily: fonts.body.semibold },
});
