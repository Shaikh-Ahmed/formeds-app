import React, { useCallback, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../src/context/AuthContext';
import { Button, EmptyState, ErrorBanner, LoadingState } from '../../src/components';
import { colors, radius, spacing, typography } from '../../src/theme';
import { Card, RecruiterLockedNotice, RecruiterScreen, formatDate, recruiterStyles } from '../../src/components/recruiters/RecruiterUI';
import { fetchMyPostings } from '../../src/api/jobs';
import { fetchMyLocums } from '../../src/api/locum';
import type { Job } from '../../src/types/jobs';
import type { Locum } from '../../src/types/locum';
import { formatShiftDay, formatShiftHours } from '../../src/components/locum/LocumMeta';

const STATUS_LABEL: Record<string, string> = {
  active: 'Active', draft: 'Draft', paused: 'Paused', closed: 'Closed', filled: 'Filled', expired: 'Expired',
  open: 'Open', full: 'Full', cancelled: 'Cancelled',
};
const statusLabel = (s: string) => STATUS_LABEL[s] ?? s;

/**
 * The recruiter's openings. Posting, editing and applicant management are the
 * Jobs and Locum modules' own screens -- this is the index into them, plus the
 * one recruiter-specific action: inviting talent to an opening.
 */
export default function RecruiterJobsScreen() {
  const { token, isKycApproved } = useAuth();
  const router = useRouter();
  const [jobs, setJobs] = useState<Job[] | null>(null);
  const [locums, setLocums] = useState<Locum[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    if (!token) return;
    try {
      const [j, l] = await Promise.all([fetchMyPostings(token), fetchMyLocums(token).catch(() => [])]);
      setJobs(j);
      setLocums(l);
      setError(null);
    } catch (e: any) {
      setError(e?.message || 'Could not load your openings.');
      setJobs(prev => prev ?? []);
    }
  }, [token]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  if (!jobs) return <LoadingState />;

  return (
    <RecruiterScreen title="Jobs & shifts" subtitle="Your openings, their applicants, and who to invite next." active="jobs" refreshing={refreshing}
      onRefresh={async () => { setRefreshing(true); await load(); setRefreshing(false); }} testID="recruiter-jobs">
      {!isKycApproved ? (
        <RecruiterLockedNotice feature="Posting jobs and locum shifts" />
      ) : (
        <View style={styles.actions}>
          <Button label="Post a job" onPress={() => router.push('/jobs/new' as any)} style={styles.action}
            testID="recruiter-post-job" />
          <Button label="Post locum shift" variant="outline" onPress={() => router.push('/jobs/locum/new' as any)}
            style={styles.action} testID="recruiter-post-locum" />
        </View>
      )}
      <ErrorBanner message={error} />

      <Card title="Jobs" subtitle={`${jobs.length} posting${jobs.length === 1 ? '' : 's'}`}>
        {jobs.length === 0 ? (
          <EmptyState icon="briefcase-outline" title="No jobs yet" hint="Jobs you post for clients appear here." />
        ) : jobs.map(job => (
          <View key={job.id} style={styles.row} testID={`recruiter-job-${job.id}`}>
            <View style={styles.main}>
              <Text style={recruiterStyles.strong} numberOfLines={2}>{job.title}</Text>
              <Text style={recruiterStyles.muted} numberOfLines={1}>
                {job.client_name ? `For ${job.client_name}${job.client_confidential ? ' (confidential)' : ''} · ` : ''}
                {job.city || 'Remote'} · {formatDate(job.created_at)}
              </Text>
              <View style={[recruiterStyles.row, { marginTop: spacing.xs }]}>
                <View style={[styles.status, job.status === 'active' ? styles.statusLive : null]}>
                  <Text style={[styles.statusText, job.status === 'active' ? styles.statusTextLive : null]}>
                    {statusLabel(job.status)}
                  </Text>
                </View>
                <Text style={recruiterStyles.muted}>
                  {job.applicant_count ?? 0} applicant{job.applicant_count === 1 ? '' : 's'}
                </Text>
              </View>
            </View>
            <View style={styles.links}>
              <LinkButton icon="people-outline" label="Applicants" onPress={() => router.push(`/jobs/applicants/${job.id}` as any)} />
              {job.status === 'active' ? (
                <LinkButton icon="person-add-outline" label="Invite"
                  onPress={() => router.push({ pathname: '/recruiter/candidates', params: { job: job.id, title: job.title } } as any)} />
              ) : null}
              <LinkButton icon="create-outline" label="Edit" onPress={() => router.push(`/jobs/edit/${job.id}` as any)} />
            </View>
          </View>
        ))}
      </Card>

      <Card title="Locum shifts" subtitle={`${locums.length} shift${locums.length === 1 ? '' : 's'}`}>
        {locums.length === 0 ? (
          <Text style={recruiterStyles.muted}>Locum shifts you post appear here.</Text>
        ) : locums.map(l => (
          <View key={l.id} style={styles.row} testID={`recruiter-locum-${l.id}`}>
            <View style={styles.main}>
              <Text style={recruiterStyles.strong} numberOfLines={2}>{l.specialty} locum · {l.city}</Text>
              <Text style={recruiterStyles.muted}>{formatShiftDay(l.shift_date)} · {formatShiftHours(l)}</Text>
              <View style={[recruiterStyles.row, { marginTop: spacing.xs }]}>
                <View style={[styles.status, l.status === 'open' ? styles.statusLive : null]}>
                  <Text style={[styles.statusText, l.status === 'open' ? styles.statusTextLive : null]}>
                    {statusLabel(l.status)}
                  </Text>
                </View>
              </View>
            </View>
            <View style={styles.links}>
              <LinkButton icon="people-outline" label="Manage" onPress={() => router.push(`/jobs/locum/manage/${l.id}` as any)} />
              {l.status === 'open' ? (
                <LinkButton icon="person-add-outline" label="Invite"
                  onPress={() => router.push({ pathname: '/recruiter/candidates', params: { locum: l.id, title: `${l.specialty} locum` } } as any)} />
              ) : null}
            </View>
          </View>
        ))}
      </Card>
    </RecruiterScreen>
  );
}

function LinkButton({ icon, label, onPress }: { icon: keyof typeof Ionicons.glyphMap; label: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={label} hitSlop={4}
      style={({ pressed }) => [styles.link, pressed && { opacity: 0.7 }]}>
      <Ionicons name={icon} size={16} color={colors.navy} />
      <Text style={recruiterStyles.link}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  actions: { flexDirection: 'row', gap: spacing.sm, flexWrap: 'wrap' },
  action: { flexGrow: 1, flexBasis: 200 },
  // Wraps the actions under the details on a phone instead of squeezing the
  // title into a narrow column beside them.
  main: { flexGrow: 1, flexShrink: 1, flexBasis: 260, minWidth: 0 },
  row: {
    flexDirection: 'row', gap: spacing.md, paddingVertical: spacing.md, flexWrap: 'wrap',
    borderBottomWidth: 1, borderBottomColor: colors.borderLight,
  },
  links: { flexDirection: 'row', gap: spacing.md, alignItems: 'center', flexWrap: 'wrap' },
  link: { flexDirection: 'row', alignItems: 'center', gap: 4, minHeight: 44 },
  status: { paddingHorizontal: spacing.sm, paddingVertical: 2, borderRadius: radius.pill, backgroundColor: colors.bgMuted },
  statusLive: { backgroundColor: colors.successBg },
  statusText: { ...typography.small, color: colors.textSecondary },
  statusTextLive: { color: colors.teal },
});
