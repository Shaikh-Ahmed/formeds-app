import React, { useCallback, useMemo, useState } from 'react';
import { FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { useAuth } from '../../../src/context/AuthContext';
import { colors, radius, spacing, typography, fonts, MIN_TOUCH_TARGET } from '../../../src/theme';
import { PageGrid } from '../../../src/components/web';
import { Button, EmptyState, ErrorBanner, ErrorState, KycNotice } from '../../../src/components';
import { Skeleton } from '../../../src/components/Skeleton';
import { JobsSegmentedNav } from '../../../src/components/jobs/JobsSegmentedNav';
import { JobBadge, formatPay, formatTypeLine } from '../../../src/components/jobs/JobMeta';
import { fetchMyPostings, setJobStatus } from '../../../src/api/jobs';
import { postedAgo } from '../../../src/utils/time';
import type { Job } from '../../../src/types/jobs';

const STATUS_TONE = {
  active: 'teal', draft: 'neutral', paused: 'warning',
  closed: 'neutral', filled: 'teal', expired: 'neutral',
} as const;

const STATUS_LABEL = {
  active: 'Live', draft: 'Draft', paused: 'Paused',
  closed: 'Closed', filled: 'Filled', expired: 'Expired',
} as const;

/**
 * What this account has advertised.
 *
 * Shown to anyone who can post, not just hospital and clinic accounts. A
 * consultant arranging cover for their own list is an ordinary case in Indian
 * private practice, and gating on account type was the original reason a clinic
 * could not staff its own rota.
 *
 * Pause is offered before Close because it is the reversible one, and a rota
 * that is filled this month usually needs the same posting back next month.
 */
export default function PostedJobsScreen() {
  const { token, user, isKycApproved } = useAuth();
  const router = useRouter();

  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!token) { setLoading(false); return; }
    setError(null);
    try {
      setJobs(await fetchMyPostings(token));
    } catch (e: any) {
      setError(e?.message || 'Could not load your postings.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [token]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const changeStatus = useCallback(async (job: Job, status: string) => {
    if (!token) return;
    setActionError(null);
    const previous = jobs;
    setJobs(prev => prev.map(j => (j.id === job.id ? { ...j, status: status as Job['status'] } : j)));
    try {
      await setJobStatus(token, job.id, status);
    } catch (e: any) {
      setJobs(previous);
      setActionError(e?.message || 'Could not update this posting.');
    }
  }, [token, jobs]);

  const stats = useMemo(() => ({
    live: jobs.filter(j => j.status === 'active').length,
    applicants: jobs.reduce((sum, j) => sum + (j.applicant_count || 0), 0),
  }), [jobs]);

  return (
    <SafeAreaView style={styles.safe} edges={[]}>
      <PageGrid fluid testID="posted-jobs-grid">
        <JobsSegmentedNav active="posted" />

        <View style={styles.actionsRow}>
          {jobs.length ? (
            <Text style={styles.summary}>
              {stats.live} live · {stats.applicants}{' '}
              {stats.applicants === 1 ? 'applicant' : 'applicants'} in total
            </Text>
          ) : <View style={styles.flex} />}
          <Button
            label="Post an opportunity"
            onPress={() => router.push('/jobs/new' as any)}
            disabled={!isKycApproved}
            testID="post-job-open"
          />
        </View>

        <View style={styles.notice}>
          <KycNotice action="post jobs and shifts" />
          <ErrorBanner message={actionError} />
        </View>

        <FlatList
          data={loading ? [] : jobs}
          keyExtractor={item => item.id}
          renderItem={({ item }) => {
            const pay = formatPay(item);
            return (
              <View style={styles.card} testID={`posting-${item.id}`}>
                <Pressable
                  onPress={() => router.push(`/jobs/${item.id}` as any)}
                  accessibilityRole="button"
                  accessibilityLabel={
                    `${item.title}. ${STATUS_LABEL[item.status]}. ` +
                    `${item.applicant_count} applicants.`
                  }
                  style={({ pressed }) => [styles.cardBody, pressed && styles.pressed]}
                >
                  <Text style={styles.title} numberOfLines={2}>{item.title}</Text>
                  <Text style={styles.meta}>
                    {formatTypeLine(item)}{item.location ? ` · ${item.location}` : ''}
                  </Text>
                  {pay ? <Text style={styles.pay}>{pay}</Text> : null}

                  <View style={styles.badgeRow}>
                    <JobBadge
                      label={STATUS_LABEL[item.status]}
                      icon={item.status === 'active' ? 'radio-button-on' : 'pause-circle-outline'}
                      tone={STATUS_TONE[item.status]}
                    />
                    <Text style={styles.stat}>
                      {item.applicant_count}{' '}
                      {item.applicant_count === 1 ? 'applicant' : 'applicants'}
                    </Text>
                    <Text style={styles.stat}>{postedAgo(item.created_at)}</Text>
                  </View>
                </Pressable>

                <View style={styles.cardActions}>
                  <CardAction
                    icon="create-outline"
                    label={item.status === 'draft' ? 'Finish' : 'Edit'}
                    onPress={() => router.push(`/jobs/edit/${item.id}` as any)}
                    testID={`edit-${item.id}`}
                  />
                  {item.applicant_count > 0 ? (
                    <CardAction
                      icon="people-outline"
                      label={`${item.applicant_count} applicant${item.applicant_count === 1 ? '' : 's'}`}
                      onPress={() => router.push(`/jobs/applicants/${item.id}` as any)}
                      testID={`applicants-${item.id}`}
                    />
                  ) : null}
                  {item.status === 'active' ? (
                    <CardAction
                      icon="pause-outline"
                      label="Pause"
                      onPress={() => changeStatus(item, 'paused')}
                      testID={`pause-${item.id}`}
                    />
                  ) : item.status === 'paused' ? (
                    <CardAction
                      icon="play-outline"
                      label="Resume"
                      onPress={() => changeStatus(item, 'active')}
                      testID={`resume-${item.id}`}
                    />
                  ) : null}
                  {item.status !== 'closed' && item.status !== 'filled' ? (
                    <CardAction
                      icon="lock-closed-outline"
                      label="Close"
                      onPress={() => changeStatus(item, 'closed')}
                      testID={`close-${item.id}`}
                    />
                  ) : null}
                </View>
              </View>
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
                {[0, 1].map(i => (
                  <View key={i} style={styles.card}>
                    <View style={styles.cardBody}>
                      <Skeleton height={16} width="70%" />
                      <Skeleton height={11} width="45%" />
                      <Skeleton height={22} width={90} radius={radius.pill} />
                    </View>
                  </View>
                ))}
              </View>
            ) : error ? (
              <ErrorState message={error} onRetry={load} />
            ) : (
              <EmptyState
                icon="megaphone-outline"
                title="Start building your healthcare team"
                hint={
                  user?.role === 'healthcare_professional'
                    ? 'Advertise a permanent role, or find cover for your own list.'
                    : 'Post a role and reach verified healthcare professionals directly.'
                }
                actionLabel={isKycApproved ? 'Post an opportunity' : undefined}
                onAction={isKycApproved ? () => router.push('/jobs/new' as any) : undefined}
              />
            )
          }
        />
      </PageGrid>

    </SafeAreaView>
  );
}

function CardAction({
  icon, label, onPress, testID,
}: {
  icon: keyof typeof Ionicons.glyphMap; label: string; onPress: () => void; testID?: string;
}) {
  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => [styles.action, pressed && styles.pressed]}
    >
      <Ionicons name={icon} size={16} color={colors.textSecondary} />
      <Text style={styles.actionText}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  flex: { flex: 1 },
  actionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
    flexWrap: 'wrap',
  },
  summary: { ...typography.caption, color: colors.textSecondary, flex: 1 },
  notice: { paddingHorizontal: spacing.lg },
  list: { padding: spacing.lg, paddingBottom: spacing.xxxl * 2, gap: spacing.md },
  pad: { gap: spacing.md },

  card: {
    backgroundColor: colors.card,
    borderRadius: radius.xl + 2,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  cardBody: { padding: spacing.lg, gap: spacing.xs + 2 },
  pressed: { backgroundColor: colors.bgMuted },
  title: { ...typography.h3, color: colors.text },
  meta: { ...typography.caption, color: colors.textSecondary },
  pay: { ...typography.bodyStrong, color: colors.text },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    flexWrap: 'wrap',
    marginTop: spacing.xs,
  },
  stat: { ...typography.small, color: colors.textSecondary },

  cardActions: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderTopColor: colors.borderLight,
  },
  action: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs + 2,
    minHeight: MIN_TOUCH_TARGET,
  },
  actionText: { ...typography.caption, fontFamily: fonts.body.semibold, color: colors.textSecondary },
});
