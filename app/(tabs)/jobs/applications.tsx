import React, { useCallback, useState } from 'react';
import { FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { useAuth } from '../../../src/context/AuthContext';
import { colors, radius, spacing, typography, fonts } from '../../../src/theme';
import { PageGrid } from '../../../src/components/web';
import { EmptyState, ErrorState } from '../../../src/components';
import { Skeleton } from '../../../src/components/Skeleton';
import { JobsSegmentedNav } from '../../../src/components/jobs/JobsSegmentedNav';
import { JobBadge } from '../../../src/components/jobs/JobMeta';
import { fetchMyApplications } from '../../../src/api/jobs';
import { postedAgo } from '../../../src/utils/time';
import { APPLICATION_STATUS_META, type Application } from '../../../src/types/jobs';

const TONE_FOR_BADGE = {
  neutral: 'neutral', teal: 'teal', navy: 'navy', warning: 'warning', danger: 'danger',
} as const;

/**
 * Applications, with the employer-controlled status shown exactly as the
 * employer set it.
 *
 * Status is rendered as an icon plus words, never a coloured dot: "Offered" and
 * "Not selected" are the two outcomes a person most needs to distinguish, and
 * distinguishing them by hue alone fails for a colourblind reader and in
 * bright sunlight.
 */
export default function ApplicationsScreen() {
  const { token } = useAuth();
  const router = useRouter();

  const [apps, setApps] = useState<Application[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!token) { setLoading(false); return; }
    setError(null);
    try {
      setApps(await fetchMyApplications(token));
    } catch (e: any) {
      setError(e?.message || 'Could not load your applications.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [token]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  return (
    <SafeAreaView style={styles.safe} edges={[]}>
      <PageGrid fluid testID="applications-grid">
        <JobsSegmentedNav active="applications" />
        <FlatList
          data={loading ? [] : apps}
          keyExtractor={item => item.id}
          renderItem={({ item }) => {
            const meta = APPLICATION_STATUS_META[item.status]
              ?? APPLICATION_STATUS_META.applied;
            return (
              <Pressable
                testID={`application-${item.id}`}
                onPress={() => router.push(`/jobs/${item.job_id}` as any)}
                accessibilityRole="button"
                accessibilityLabel={
                  `${item.job_title} at ${item.employer_name}. Status: ${meta.label}. ` +
                  `Applied ${postedAgo(item.created_at).replace('Posted ', '')}.`
                }
                style={({ pressed }) => [styles.card, pressed && styles.pressed]}
              >
                <Text style={styles.title} numberOfLines={2}>{item.job_title || 'Opportunity'}</Text>
                {item.employer_name ? (
                  <Text style={styles.employer} numberOfLines={1}>{item.employer_name}</Text>
                ) : null}

                <View style={styles.statusRow}>
                  <JobBadge
                    label={meta.label}
                    icon={meta.icon as any}
                    tone={TONE_FOR_BADGE[meta.tone]}
                  />
                  <Text style={styles.applied}>
                    {postedAgo(item.created_at).replace('Posted', 'Applied')}
                  </Text>
                </View>

                {item.employer_note ? (
                  <Text style={styles.note} numberOfLines={3}>{item.employer_note}</Text>
                ) : null}
              </Pressable>
            );
          }}
          contentContainerStyle={styles.list}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => { setRefreshing(true); load(); }}
              tintColor={colors.navy}
            />
          }
          ListEmptyComponent={
            loading ? (
              <View style={styles.pad}>
                {[0, 1, 2].map(i => (
                  <View key={i} style={styles.card}>
                    <Skeleton height={16} width="70%" />
                    <Skeleton height={11} width="40%" />
                    <Skeleton height={22} width={110} radius={radius.pill} />
                  </View>
                ))}
              </View>
            ) : error ? (
              <ErrorState message={error} onRetry={load} />
            ) : (
              <EmptyState
                icon="document-text-outline"
                title="No applications yet"
                hint="Roles you apply to appear here, with the employer's decision as it changes."
                actionLabel="Find opportunities"
                onAction={() => router.replace('/jobs' as any)}
              />
            )
          }
        />
      </PageGrid>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  list: { padding: spacing.lg, paddingBottom: spacing.xxxl * 2, gap: spacing.md },
  pad: { gap: spacing.md },
  card: {
    backgroundColor: colors.card,
    borderRadius: radius.xl + 2,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    gap: spacing.sm,
  },
  pressed: { backgroundColor: colors.bgMuted },
  title: { ...typography.h3, color: colors.text },
  employer: { ...typography.caption, color: colors.textSecondary },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
    flexWrap: 'wrap',
  },
  applied: { ...typography.small, color: colors.textSecondary },
  note: {
    ...typography.caption,
    color: colors.textSecondary,
    lineHeight: 19,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.borderLight,
  },
});
