import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Skeleton } from '../Skeleton';
import { colors, radius, spacing } from '../../theme';

/**
 * Placeholder shaped like a JobCard: title, employer row, two metadata lines,
 * pay. Matching the real card's height is the whole point — the list must not
 * jump when the data lands.
 */
export function JobCardSkeleton({ compact = false }: { compact?: boolean }) {
  return (
    <View style={[styles.card, compact && styles.cardCompact]}>
      <Skeleton height={16} width="75%" />
      <View style={styles.employerRow}>
        <Skeleton height={20} width={20} radius={10} />
        <Skeleton height={11} width="40%" />
      </View>
      <Skeleton height={11} width="90%" />
      <Skeleton height={13} width="35%" />
    </View>
  );
}

/** The list's whole loading state. */
export function JobListSkeleton({ count = 4, compact = false }: { count?: number; compact?: boolean }) {
  return (
    <View style={styles.list} accessibilityLabel="Loading jobs" accessibilityRole="progressbar">
      {Array.from({ length: count }, (_, i) => <JobCardSkeleton key={i} compact={compact} />)}
    </View>
  );
}

const styles = StyleSheet.create({
  list: { gap: spacing.md },
  card: {
    backgroundColor: colors.card,
    borderRadius: radius.xl + 2,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    gap: spacing.md,
  },
  cardCompact: { borderRadius: radius.lg, padding: spacing.md + 2, gap: spacing.sm },
  employerRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
});
