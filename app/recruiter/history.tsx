import React, { useCallback, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { useAuth } from '../../src/context/AuthContext';
import { EmptyState, ErrorState, LoadingState } from '../../src/components';
import { colors, radius, spacing, typography } from '../../src/theme';
import { RecruiterScreen, formatDate, recruiterStyles } from '../../src/components/recruiters/RecruiterUI';
import { fetchRecruiterHistory } from '../../src/api/recruiters';
import type { HistoryItem } from '../../src/types/recruiters';

/** Closed and filled openings, with how each one ended. */
export default function RecruitmentHistoryScreen() {
  const { token } = useAuth();
  const [items, setItems] = useState<HistoryItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!token) return;
    try { setItems(await fetchRecruiterHistory(token)); setError(null); } catch (e: any) { setError(e?.message); }
  }, [token]);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  if (!items && error) return <ErrorState message={error} onRetry={load} />;
  if (!items) return <LoadingState />;

  const placed = items.reduce((n, i) => n + i.hired, 0);
  return (
    <RecruiterScreen title="Recruitment history" subtitle="Closed and filled openings, and how each one ended." active="history" testID="recruiter-history">
      <Text style={recruiterStyles.muted}>
        {items.length} closed opening{items.length === 1 ? '' : 's'} · {placed} placement{placed === 1 ? '' : 's'}
      </Text>
      {items.length === 0 ? (
        <EmptyState icon="time-outline" title="Nothing here yet"
          hint="When you mark a job filled or closed, it moves to your history." />
      ) : items.map(i => (
        <View key={i.id} style={styles.row} testID={`history-${i.id}`}>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={recruiterStyles.strong} numberOfLines={2}>{i.title}</Text>
            <Text style={recruiterStyles.muted} numberOfLines={1}>
              {i.client_name ? `For ${i.client_name}${i.client_confidential ? ' (confidential)' : ''} · ` : ''}
              {i.city || 'Remote'} · posted {formatDate(i.created_at)}
            </Text>
            <Text style={recruiterStyles.muted}>{i.applicants} applicants · {i.hired} hired</Text>
          </View>
          <View style={[styles.pill, i.status === 'filled' ? styles.filled : null]}>
            <Text style={[styles.pillText, i.status === 'filled' ? { color: colors.teal } : null]}>
              {i.status === 'filled' ? 'Filled' : 'Closed'}
            </Text>
          </View>
        </View>
      ))}
    </RecruiterScreen>
  );
}

const styles = StyleSheet.create({
  row: {
    backgroundColor: colors.white, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border,
    padding: spacing.md, flexDirection: 'row', alignItems: 'center', gap: spacing.md,
  },
  pill: { paddingHorizontal: spacing.sm + 2, paddingVertical: 4, borderRadius: radius.pill, backgroundColor: colors.bgMuted },
  filled: { backgroundColor: colors.successBg },
  pillText: { ...typography.small, fontWeight: '700', color: colors.textSecondary },
});
