import React, { useCallback, useState } from 'react';
import { FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { useAuth } from '../../../src/context/AuthContext';
import { colors, radius, spacing, typography } from '../../../src/theme';
import { PageGrid } from '../../../src/components/web';
import { Button, EmptyState, ErrorBanner, ErrorState, Sheet } from '../../../src/components';
import { Skeleton } from '../../../src/components/Skeleton';
import { JobsSegmentedNav } from '../../../src/components/jobs/JobsSegmentedNav';
import { JobBadge } from '../../../src/components/jobs/JobMeta';
import { fetchMyApplications, withdrawApplication } from '../../../src/api/jobs';
import { postedAgo } from '../../../src/utils/time';
import { APPLICATION_STATUS_META, type Application } from '../../../src/types/jobs';

/** Once a decision is in, withdrawing says nothing the status does not. */
const WITHDRAWABLE = new Set(['applied', 'reviewing', 'shortlisted', 'interviewing', 'offered']);

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
  const [actionError, setActionError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState<Application | null>(null);
  const [withdrawing, setWithdrawing] = useState(false);

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

  /**
   * Withdrawing is confirmed rather than instant. It frees the employer's slot
   * and is not something a mis-tap should do — but it is reversible by simply
   * applying again, so a sheet is enough and a typed confirmation would be
   * theatre.
   */
  const confirmWithdraw = useCallback(async () => {
    if (!token || !confirming) return;
    setWithdrawing(true);
    setActionError(null);
    try {
      await withdrawApplication(token, confirming.id);
      setApps(prev => prev.map(a =>
        a.id === confirming.id ? { ...a, status: 'withdrawn' as const } : a));
      setConfirming(null);
    } catch (e: any) {
      setActionError(e?.message || 'Could not withdraw this application.');
    } finally {
      setWithdrawing(false);
    }
  }, [token, confirming]);

  return (
    <SafeAreaView style={styles.safe} edges={[]}>
      <PageGrid fluid testID="applications-grid">
        <JobsSegmentedNav active="applications" />
        <View style={styles.notice}><ErrorBanner message={actionError} /></View>
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

                {WITHDRAWABLE.has(item.status) ? (
                  <Pressable
                    testID={`withdraw-${item.id}`}
                    onPress={() => setConfirming(item)}
                    accessibilityRole="button"
                    accessibilityLabel={`Withdraw your application for ${item.job_title}`}
                    hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                    style={({ pressed }) => [styles.withdraw, pressed && styles.linkPressed]}
                  >
                    <Ionicons name="arrow-undo-outline" size={14} color={colors.textSecondary} />
                    <Text style={styles.withdrawText}>Withdraw</Text>
                  </Pressable>
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

      <Sheet
        visible={!!confirming}
        onClose={() => setConfirming(null)}
        title="Withdraw application"
        testID="withdraw-sheet"
        footer={
          <>
            <Button label="Keep it" variant="outline" onPress={() => setConfirming(null)}
              style={styles.footerBtn} />
            <Button label="Withdraw" variant="danger" onPress={confirmWithdraw}
              loading={withdrawing} style={styles.footerBtn} testID="withdraw-confirm" />
          </>
        }
      >
        <View style={styles.sheetBody}>
          <Text style={styles.sheetText}>
            {confirming?.employer_name
              ? `${confirming.job_title} at ${confirming.employer_name} will no longer see you as an applicant.`
              : 'The employer will no longer see you as an applicant.'}
          </Text>
          <Text style={styles.sheetHint}>You can apply again later if you change your mind.</Text>
        </View>
      </Sheet>
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
  notice: { paddingHorizontal: spacing.lg },
  withdraw: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    alignSelf: 'flex-start',
    marginTop: spacing.xs,
  },
  withdrawText: { ...typography.small, color: colors.textSecondary },
  linkPressed: { opacity: 0.6 },
  sheetBody: { padding: spacing.xl, paddingTop: spacing.md, gap: spacing.sm },
  sheetText: { ...typography.body, color: colors.text, lineHeight: 22 },
  sheetHint: { ...typography.small, color: colors.textSecondary },
  footerBtn: { flex: 1 },
  note: {
    ...typography.caption,
    color: colors.textSecondary,
    lineHeight: 19,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.borderLight,
  },
});
