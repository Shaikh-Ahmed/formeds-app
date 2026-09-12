import React, { useCallback, useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useAuth } from '../../../../src/context/AuthContext';
import { colors, spacing, typography, MIN_TOUCH_TARGET } from '../../../../src/theme';
import { PageColumn } from '../../../../src/components/web';
import { EmptyState, ErrorState, LoadingState } from '../../../../src/components';
import { JobWizard, type JobDraft } from '../../../../src/components/jobs/wizard/JobWizard';
import { fetchJob, setJobStatus, updateJob } from '../../../../src/api/jobs';
import { fetchMyOrganizations } from '../../../../src/api/organizations';
import type { Job } from '../../../../src/types/jobs';
import type { Organization } from '../../../../src/types/organizations';

/**
 * Editing an existing posting.
 *
 * Runs the same wizard as creating one, seeded from the stored job. Sharing the
 * component is the point: a separate edit form is how a field ends up
 * changeable at creation and not afterwards, or validated differently in the
 * two places.
 *
 * A draft can still be published from here, which is how the "finish it later"
 * path completes. `org_id` is deliberately not editable — the server refuses to
 * move a posting between employers, because the applications already attached
 * to it were made to a particular one.
 */
export default function EditJobScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { token, user } = useAuth();
  const router = useRouter();

  const [job, setJob] = useState<Job | null>(null);
  const [orgs, setOrgs] = useState<Organization[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    if (!token || !id) { setLoading(false); return; }
    setError(null);
    try {
      const [j, mine] = await Promise.all([
        fetchJob(token, id),
        fetchMyOrganizations(token).catch(() => []),
      ]);
      setJob(j);
      setOrgs(mine);
    } catch (e: any) {
      setError(e?.message || 'Could not load this posting.');
    } finally {
      setLoading(false);
    }
  }, [token, id]);

  useEffect(() => { load(); }, [load]);

  const submit = useCallback(async (
    payload: Record<string, unknown>, { publish }: { publish: boolean },
  ) => {
    if (!token || !job) return;
    setSubmitting(true);
    setActionError(null);
    try {
      // The employer cannot be moved after the fact — applications are attached
      // to a posting made by a particular one — so those keys are stripped.
      const { org_id: _org, posted_as: _as, ...editable } = payload;
      await updateJob(token, job.id, editable);
      if (publish && job.status === 'draft') {
        await setJobStatus(token, job.id, 'active');
      }
      router.replace('/jobs/posted' as any);
    } catch (e: any) {
      setActionError(e?.message || 'Could not save these changes.');
    } finally {
      setSubmitting(false);
    }
  }, [token, job, router]);

  if (loading) return <LoadingState label="Loading posting…" />;
  if (error) return <ErrorState message={error} onRetry={load} />;
  if (!job) return null;

  if (!job.can_manage) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <EmptyState
          icon="lock-closed-outline"
          title="Not your posting"
          hint="Only the person or organisation that published a role can edit it."
          actionLabel="Back to jobs"
          onAction={() => router.replace('/jobs' as any)}
        />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <PageColumn testID="job-edit-column">
        <View style={styles.header}>
          <Pressable
            onPress={() => router.back()}
            accessibilityRole="button"
            accessibilityLabel="Back"
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            style={({ pressed }) => [styles.back, pressed && styles.pressed]}
          >
            <Ionicons name="close" size={24} color={colors.text} />
          </Pressable>
          <View style={styles.headerText}>
            <Text style={styles.headerTitle} numberOfLines={1}>Edit posting</Text>
            {job.status === 'draft' ? (
              <Text style={styles.headerSub}>Draft — not visible to anyone yet</Text>
            ) : null}
          </View>
        </View>

        <JobWizard
          mode="edit"
          initial={toDraft(job)}
          organizations={orgs}
          onSubmit={submit}
          submitting={submitting}
          error={actionError}
          onCancel={() => router.back()}
          posterName={user?.name || 'You'}
        />
      </PageColumn>
    </SafeAreaView>
  );
}

/** Stored row back into the wizard's string-shaped draft. */
function toDraft(job: Job): Partial<JobDraft> {
  return {
    title: job.title,
    employment_type: job.employment_type,
    specialty: job.specialty ?? '',
    department: job.department ?? '',
    vacancies: String(job.vacancies ?? 1),
    org_id: job.org_id ?? null,
    work_mode: job.work_mode,
    state: job.state ?? '',
    city: job.city ?? '',
    shift_start_date: job.shift_start_date ?? '',
    shift_end_date: job.shift_end_date ?? '',
    shift_time: job.shift_time ?? '',
    shift_duration: job.shift_duration ?? '',
    pay_period: job.pay_period,
    // Empty rather than "0": a withheld or unset figure should show a blank
    // field, not a zero the employer then has to delete.
    pay_min: job.pay_min ? String(job.pay_min) : '',
    pay_max: job.pay_max ? String(job.pay_max) : '',
    pay_disclosed: job.pay_disclosed,
    experience_min: job.experience_min ? String(job.experience_min) : '',
    skills: (job.skills ?? []).join(', '),
    requirements: job.requirements ?? '',
    description: job.description ?? '',
    responsibilities: job.responsibilities ?? '',
    is_urgent: job.is_urgent,
  };
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
  headerText: { flex: 1, gap: 2 },
  headerTitle: { ...typography.h3, color: colors.text },
  headerSub: { ...typography.small, color: colors.warning },
  pressed: { opacity: 0.6 },
});
