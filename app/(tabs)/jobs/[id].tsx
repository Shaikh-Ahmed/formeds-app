import React, { useCallback, useEffect, useState } from 'react';
import { useSubmit } from '../../../src/hooks/useSubmit';
import { ApiError } from '../../../src/utils/api';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useAuth } from '../../../src/context/AuthContext';
import { colors, spacing, typography, useBreakpoint, MIN_TOUCH_TARGET } from '../../../src/theme';
import { PageColumn } from '../../../src/components/web';
import { ErrorBanner, ErrorState } from '../../../src/components';
import { JobDetailPanel } from '../../../src/components/jobs/JobDetailPanel';
import { JobActionBar, JobsScreen } from '../../../src/components/jobs/JobsScreen';
import { ApplySheet, type ApplyExtras } from '../../../src/components/jobs/ApplySheet';
import { applyToJob, fetchJob, toggleSaveJob } from '../../../src/api/jobs';
import { shareJob } from '../../../src/utils/share';
import type { Job } from '../../../src/types/jobs';

/** The tab bar stays mounted under this route, so the pinned bar clears it. */
const TAB_BAR_HEIGHT = 60;

/**
 * One job.
 *
 * On desktop this renders the SAME `JobsScreen` as Discover, with this job
 * selected — so a shared link opens the split view in context rather than a
 * lone page with no way back into the list. On a phone and tablet it is a
 * pushed screen with the actions pinned within thumb reach.
 */
export default function JobDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { token, user } = useAuth();
  const { isDesktop } = useBreakpoint();
  // A recruiter sees their posting on its own: no job board around it, and no
  // tab bar under it (see (tabs)/_layout).
  const isRecruiter = user?.role === 'recruiter';
  const insets = useSafeAreaInsets();
  const router = useRouter();

  // Same first-render guard as JobsScreen: useBreakpoint() reports mobile on
  // frame one at any width, so committing to a layout before mount would flash
  // the phone view on a desktop cold load.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const [job, setJob] = useState<Job | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [applyOpen, setApplyOpen] = useState(false);
  const { submitting: applying, run: runApply } = useSubmit();

  const load = useCallback(async () => {
    if (!id) return;
    setError(null);
    try {
      setJob(await fetchJob(token, id));
    } catch (e: any) {
      setError(e?.message || 'Could not load this opportunity.');
    } finally {
      setLoading(false);
    }
  }, [id, token]);

  useEffect(() => { load(); }, [load]);

  const onToggleSave = useCallback(async () => {
    if (!token || !job) return;
    const next = !job.saved;
    setJob({ ...job, saved: next });
    try {
      const res = await toggleSaveJob(token, job.id);
      setJob(prev => (prev ? { ...prev, saved: res.saved } : prev));
    } catch {
      setJob(prev => (prev ? { ...prev, saved: !next } : prev));
    }
  }, [token, job]);

  const onShare = useCallback(() => {
    if (job) shareJob(job);
  }, [job]);

  const submit = useCallback((note: string, extras?: ApplyExtras) => runApply(async key => {
    if (!token || !job) return;
    setActionError(null);
    try {
      // Keyed: a second tap or a retry returns this same application.
      await applyToJob(token, job.id, note, extras, key);
      setApplyOpen(false);
      setJob(prev => (prev ? { ...prev, has_applied: true } : prev));
    } catch (e: any) {
      if (e instanceof ApiError && e.code === 'already_applied') {
        setApplyOpen(false);
        setJob(prev => (prev ? { ...prev, has_applied: true } : prev));
      }
      setActionError(e?.message || 'Could not submit your application. Please try again.');
    }
  }, { job: job?.id, note, extras }), [token, job, runApply]);

  if (mounted && isDesktop && !isRecruiter) {
    return (
      <SafeAreaView style={styles.safe} edges={[]}>
        <JobsScreen selectedId={id ?? null} segment="discover" />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <PageColumn testID="job-column">
        <View style={styles.header}>
          <Pressable
            onPress={() => (router.canGoBack() ? router.back() : router.replace('/jobs' as any))}
            accessibilityRole="button"
            accessibilityLabel="Back to jobs"
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            style={({ pressed }) => [styles.back, pressed && styles.pressed]}
          >
            <Ionicons name="arrow-back" size={22} color={colors.text} />
          </Pressable>
          <Text style={styles.headerTitle} numberOfLines={1}>Opportunity</Text>
        </View>

        <ErrorBanner message={actionError} />

        {error ? (
          <ErrorState message={error} onRetry={load} />
        ) : (
          <JobDetailPanel
            job={job}
            loading={loading || !mounted}
            onApply={() => setApplyOpen(true)}
            onToggleSave={onToggleSave}
            onShare={onShare}
            onViewOrganization={orgId => router.push(`/org/${orgId}` as any)}
          />
        )}
      </PageColumn>

      {job && !error ? (
        <JobActionBar
          job={job}
          onApply={() => setApplyOpen(true)}
          onToggleSave={onToggleSave}
          onShare={onShare}
          bottomInset={insets.bottom + (isRecruiter ? 0 : TAB_BAR_HEIGHT)}
        />
      ) : null}

      <ApplySheet
        visible={applyOpen}
        job={job}
        onClose={() => setApplyOpen(false)}
        onSubmit={submit}
        submitting={applying}
        error={actionError}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: colors.white,
  },
  back: {
    width: MIN_TOUCH_TARGET,
    height: MIN_TOUCH_TARGET,
    alignItems: 'flex-start',
    justifyContent: 'center',
  },
  headerTitle: { ...typography.h3, color: colors.text, flex: 1 },
  pressed: { opacity: 0.6 },
});
