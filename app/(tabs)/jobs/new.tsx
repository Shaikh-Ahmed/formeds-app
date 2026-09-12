import React, { useCallback, useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useAuth } from '../../../src/context/AuthContext';
import { colors, spacing, typography, MIN_TOUCH_TARGET } from '../../../src/theme';
import { PageColumn } from '../../../src/components/web';
import { KycNotice } from '../../../src/components';
import { JobWizard } from '../../../src/components/jobs/wizard/JobWizard';
import { createJob, setJobStatus } from '../../../src/api/jobs';
import { fetchMyOrganizations } from '../../../src/api/organizations';
import type { Organization } from '../../../src/types/organizations';

/**
 * Post an opportunity.
 *
 * A full screen rather than a sheet: this is a considered piece of writing with
 * a preview at the end, and a sheet that tall on a phone is just a screen with
 * the top 8% wasted.
 */
export default function NewJobScreen() {
  const { token, isKycApproved, user } = useAuth();
  const router = useRouter();

  const [orgs, setOrgs] = useState<Organization[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) return;
    fetchMyOrganizations(token).then(setOrgs).catch(() => {});
  }, [token]);

  const submit = useCallback(async (
    payload: Record<string, unknown>, { publish }: { publish: boolean },
  ) => {
    if (!token) return;
    setSubmitting(true);
    setError(null);
    try {
      // Created as a draft either way, then published as a second step. That
      // ordering means a failure to publish still leaves the writing saved
      // rather than discarding everything the person just typed.
      const job = await createJob(token, { ...payload, status: 'draft' });
      if (publish) await setJobStatus(token, job.id, 'active');
      router.replace('/jobs/posted' as any);
    } catch (e: any) {
      setError(e?.message || 'Could not save this posting.');
    } finally {
      setSubmitting(false);
    }
  }, [token, router]);

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <PageColumn testID="job-new-column">
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
          <Text style={styles.headerTitle}>Post an opportunity</Text>
        </View>

        {isKycApproved ? (
          <JobWizard
            organizations={orgs}
            onCreateOrganization={() => router.push('/org/new' as any)}
            onSubmit={submit}
            submitting={submitting}
            error={error}
            onCancel={() => router.back()}
            posterName={user?.name || 'You'}
          />
        ) : (
          <View style={styles.notice}>
            <KycNotice action="post jobs and shifts" />
          </View>
        )}
      </PageColumn>
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
  notice: { padding: spacing.lg },
  pressed: { opacity: 0.6 },
});
