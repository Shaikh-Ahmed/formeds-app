import React, { useCallback, useMemo, useState } from 'react';
import { FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { useAuth } from '../../../../src/context/AuthContext';
import { colors, radius, spacing, typography } from '../../../../src/theme';
import { PageGrid } from '../../../../src/components/web';
import { EmptyState, ErrorBanner, ErrorState } from '../../../../src/components';
import { Skeleton } from '../../../../src/components/Skeleton';
import { JobBadge } from '../../../../src/components/jobs/JobMeta';
import { LocumNav } from '../../../../src/components/locum/LocumNav';
import { ChoiceChips } from '../../../../src/components/locum/ChoiceChips';
import {
  BADGE_TONE, formatLocumPay, formatPlace, formatRoleLine, formatShiftDay, formatShiftHours,
} from '../../../../src/components/locum/LocumMeta';
import { fetchMyLocumApplications, withdrawLocumApplication } from '../../../../src/api/locum';
import { postedAgo } from '../../../../src/utils/time';
import {
  LOCUM_APPLICATION_META, LOCUM_STATUS_META, LOCUM_WITHDRAWABLE,
  type LocumBucket, type MyLocumApplication,
} from '../../../../src/types/locum';

const BUCKETS: { value: LocumBucket; label: string }[] = [
  { value: 'applied', label: 'Applied' },
  { value: 'interview', label: 'Interview' },
  { value: 'selected', label: 'Selected' },
  { value: 'completed', label: 'Completed' },
  { value: 'closed', label: 'Not selected' },
];

const EMPTY: Record<LocumBucket, string> = {
  applied: 'Locums you apply to wait here while the hospital reviews them.',
  interview: 'When a hospital schedules or clears an interview, it shows here.',
  selected: 'Shifts you have been selected for, still ahead of you.',
  completed: 'Shifts you were selected for that have now happened.',
  closed: 'Applications that were not taken forward, or that you withdrew.',
};

/**
 * The applicant's locums, grouped by where each one stands. The grouping is
 * computed by the server from the application AND the shift's end time, so a
 * selected shift moves to Completed by itself once it is over.
 */
export default function MyLocumApplicationsScreen() {
  const { token } = useAuth();
  const router = useRouter();
  const [apps, setApps] = useState<MyLocumApplication[]>([]);
  const [bucket, setBucket] = useState<LocumBucket>('applied');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!token) { setLoading(false); return; }
    setError(null);
    try {
      setApps(await fetchMyLocumApplications(token));
    } catch (e: any) {
      setError(e?.message || 'Could not load your locum applications.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [token]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const counts = useMemo(() => {
    const out: Partial<Record<LocumBucket, number>> = {};
    for (const a of apps) if (a.bucket) out[a.bucket] = (out[a.bucket] ?? 0) + 1;
    return out;
  }, [apps]);
  const visible = useMemo(() => apps.filter(a => a.bucket === bucket), [apps, bucket]);

  const withdraw = useCallback(async (app: MyLocumApplication) => {
    if (!token) return;
    setActionError(null);
    try {
      await withdrawLocumApplication(token, app.id);
      setApps(prev => prev.map(a => (a.id === app.id
        ? { ...a, status: 'withdrawn' as const, bucket: 'closed' as const } : a)));
    } catch (e: any) {
      setActionError(e?.message || 'Could not withdraw this application.');
    }
  }, [token]);

  return (
    <SafeAreaView style={styles.safe} edges={[]}>
      <PageGrid fluid testID="locum-applications-grid">
        <LocumNav active="applications" />
        <View style={styles.pad}>
          <ChoiceChips
            choices={BUCKETS.map(b => ({ ...b, label: counts[b.value] ? `${b.label} ${counts[b.value]}` : b.label }))}
            value={bucket}
            onChange={v => v && setBucket(v)}
            testID="locum-bucket"
          />
          <ErrorBanner message={actionError} />
        </View>
        <FlatList
          data={loading ? [] : visible}
          keyExtractor={item => item.id}
          contentContainerStyle={styles.list}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }}
              tintColor={colors.navy} />
          }
          renderItem={({ item }) => {
            const meta = LOCUM_APPLICATION_META[item.status];
            const locum = item.locum;
            // Body and Withdraw are siblings, never nested: a button inside a
            // button is invalid on the web and made Withdraw also open the locum.
            return (
              <View style={styles.card}>
              <Pressable
                testID={`locum-application-${item.id}`}
                onPress={() => router.push(`/jobs/locum/${item.locum_id}` as any)}
                accessibilityRole="button"
                style={({ pressed }) => [styles.cardBody, pressed && styles.pressed]}
              >
                {locum ? (
                  <>
                    <Text style={styles.when}>
                      {formatShiftDay(locum.shift_date)} · {formatShiftHours(locum)}
                    </Text>
                    <Text style={styles.title} numberOfLines={2}>{formatRoleLine(locum)}</Text>
                    <Text style={styles.sub} numberOfLines={1}>
                      {locum.employer_name} · {formatPlace(locum)} · {formatLocumPay(locum)}
                    </Text>
                  </>
                ) : <Text style={styles.title}>Locum no longer available</Text>}
                <View style={styles.row}>
                  <JobBadge label={meta.label} icon={meta.icon as any} tone={BADGE_TONE[meta.tone]} />
                  {locum && (locum.status === 'cancelled') ? (
                    <JobBadge label={LOCUM_STATUS_META.cancelled.label} icon="ban-outline" tone="danger" />
                  ) : null}
                  <Text style={styles.small}>{postedAgo(item.created_at).replace('Posted', 'Applied')}</Text>
                </View>
                {item.status === 'interview_scheduled' && item.interview_at ? (
                  <Text style={styles.sub}>
                    Interview {new Date(item.interview_at).toLocaleString(undefined, {
                      weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit',
                    })}
                  </Text>
                ) : null}
              </Pressable>
                {LOCUM_WITHDRAWABLE.includes(item.status) ? (
                  <Pressable onPress={() => withdraw(item)} accessibilityRole="button"
                    accessibilityLabel="Withdraw this application"
                    testID={`locum-withdraw-${item.id}`} hitSlop={6}
                    style={({ pressed }) => [styles.withdraw, pressed && styles.pressed]}>
                    <Ionicons name="arrow-undo-outline" size={14} color={colors.textSecondary} />
                    <Text style={styles.small}>Withdraw</Text>
                  </Pressable>
                ) : null}
              </View>
            );
          }}
          ListEmptyComponent={
            loading ? (
              <View style={styles.skeletons}>
                {[0, 1].map(i => (
                  <View key={i} style={styles.card}>
                    <Skeleton height={12} width="40%" />
                    <Skeleton height={16} width="70%" />
                    <Skeleton height={22} width={110} radius={radius.pill} />
                  </View>
                ))}
              </View>
            ) : error ? (
              <ErrorState message={error} onRetry={load} />
            ) : (
              <EmptyState
                icon="flash-outline"
                title="Nothing here yet"
                hint={EMPTY[bucket]}
                actionLabel={bucket === 'applied' ? 'Find locums' : undefined}
                onAction={bucket === 'applied' ? () => router.replace('/jobs/locum' as any) : undefined}
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
  pad: { paddingHorizontal: spacing.lg, gap: spacing.sm },
  list: { padding: spacing.lg, paddingBottom: spacing.xxxl * 2, gap: spacing.md },
  skeletons: { gap: spacing.md },
  card: {
    backgroundColor: colors.card,
    borderRadius: radius.xl + 2,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    gap: spacing.sm,
  },
  pressed: { opacity: 0.7 },
  cardBody: { gap: spacing.sm },
  when: { ...typography.small, color: colors.navy },
  title: { ...typography.h3, color: colors.text },
  sub: { ...typography.caption, color: colors.textSecondary },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, flexWrap: 'wrap' },
  small: { ...typography.small, color: colors.textSecondary },
  withdraw: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, alignSelf: 'flex-start' },
});
