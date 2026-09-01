import React, { useCallback, useState } from 'react';
import { FlatList, RefreshControl, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useRouter } from 'expo-router';
import { useAuth } from '../../../src/context/AuthContext';
import { colors, spacing } from '../../../src/theme';
import { PageGrid } from '../../../src/components/web';
import { EmptyState, ErrorState } from '../../../src/components';
import { JobCard } from '../../../src/components/jobs/JobCard';
import { JobListSkeleton } from '../../../src/components/jobs/JobCardSkeleton';
import { JobsSegmentedNav } from '../../../src/components/jobs/JobsSegmentedNav';
import { fetchSavedJobs, toggleSaveJob } from '../../../src/api/jobs';
import type { Job } from '../../../src/types/jobs';

/**
 * Saved jobs, ordered by when they were saved rather than when they were
 * posted — the list is a personal shortlist, and its order is the order the
 * user built it in.
 *
 * Unsaving removes the row immediately and puts it back if the request fails.
 * The alternative, leaving a row the user just unsaved sitting in their saved
 * list until a refetch lands, reads as the tap not registering.
 */
export default function SavedJobsScreen() {
  const { token } = useAuth();
  const router = useRouter();

  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!token) { setLoading(false); return; }
    setError(null);
    try {
      setJobs(await fetchSavedJobs(token));
    } catch (e: any) {
      setError(e?.message || 'Could not load your saved opportunities.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [token]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const unsave = useCallback(async (job: Job) => {
    if (!token) return;
    const previous = jobs;
    setJobs(prev => prev.filter(j => j.id !== job.id));
    try {
      await toggleSaveJob(token, job.id);
    } catch {
      setJobs(previous);
    }
  }, [token, jobs]);

  return (
    <SafeAreaView style={styles.safe} edges={[]}>
      <PageGrid fluid testID="saved-jobs-grid">
        <JobsSegmentedNav active="saved" />
        <FlatList
          data={loading ? [] : jobs}
          keyExtractor={item => item.id}
          renderItem={({ item }) => (
            <JobCard
              item={item}
              onPress={() => router.push(`/jobs/${item.id}` as any)}
              onToggleSave={unsave}
            />
          )}
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
              <View style={styles.pad}><JobListSkeleton count={3} /></View>
            ) : error ? (
              <ErrorState message={error} onRetry={load} />
            ) : (
              <EmptyState
                icon="bookmark-outline"
                title="Nothing saved yet"
                hint="Save an opportunity to come back to it — your shortlist stays here across devices."
                actionLabel="Browse opportunities"
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
  pad: { padding: spacing.lg },
});
