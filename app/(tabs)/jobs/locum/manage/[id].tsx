import React, { useCallback, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useAuth } from '../../../../../src/context/AuthContext';
import { colors, radius, spacing, typography, fonts } from '../../../../../src/theme';
import { PageColumn } from '../../../../../src/components/web';
import { LocumBackHeader } from '../../../../../src/components/locum/LocumBackHeader';
import { LocumApplicantsView } from '../../../../../src/components/locum/LocumApplicantsView';
import { JobBadge } from '../../../../../src/components/jobs/JobMeta';
import {
  BADGE_TONE, formatLocumPay, formatRoleLine, formatShiftDay, formatShiftHours,
} from '../../../../../src/components/locum/LocumMeta';
import { fetchLocum, fetchLocumApplicants } from '../../../../../src/api/locum';
import {
  LOCUM_STATUS_META, type Locum, type ManagedLocumApplication,
} from '../../../../../src/types/locum';

/**
 * One locum's applicants. The header answers the hospital's first question --
 * how many places are still open -- before the list answers the second.
 */
export default function ManageLocumScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { token } = useAuth();
  const router = useRouter();
  const [locum, setLocum] = useState<Locum | null>(null);
  const [apps, setApps] = useState<ManagedLocumApplication[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!token || !id) { setLoading(false); return; }
    setError(null);
    try {
      const [l, a] = await Promise.all([fetchLocum(token, id), fetchLocumApplicants(token, id)]);
      setLocum(l);
      setApps(a);
    } catch (e: any) {
      setError(e?.message || 'Could not load applicants for this locum.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [token, id]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const status = locum ? LOCUM_STATUS_META[locum.status] : null;
  const summary = locum ? (
    <View style={styles.summary} testID="locum-manage-summary">
      <View style={styles.row}>
        <Text style={styles.when}>{formatShiftDay(locum.shift_date)} · {formatShiftHours(locum)}</Text>
        {status ? <JobBadge label={status.label} icon={status.icon as any} tone={BADGE_TONE[status.tone]} /> : null}
      </View>
      <Text style={styles.sub}>{formatLocumPay(locum)}</Text>
      <View style={styles.stats}>
        <Stat value={`${locum.filled_count}/${locum.openings}`} label="filled" />
        <Stat value={String(locum.openings_left)} label={locum.openings_left === 1 ? 'place left' : 'places left'} />
        <Stat value={String(apps.length)} label={apps.length === 1 ? 'applicant' : 'applicants'} />
      </View>
      <Text style={styles.link} onPress={() => router.push(`/jobs/locum/${locum.id}` as any)}
        accessibilityRole="link">
        View the locum as applicants see it
      </Text>
    </View>
  ) : undefined;

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <PageColumn testID="locum-manage-column">
        <LocumBackHeader
          title={locum ? formatRoleLine(locum) : 'Applicants'}
          subtitle="Applicants"
          fallback="/jobs/locum/mine"
        />
        <LocumApplicantsView
          apps={apps}
          setApps={setApps}
          loading={loading}
          error={error}
          refreshing={refreshing}
          onRefresh={() => { setRefreshing(true); load(); }}
          onRetry={load}
          header={summary}
          onLocumUpdate={fresh => setLocum(prev => (prev ? { ...prev, ...fresh } : fresh))}
          empty={{
            title: 'No applicants yet',
            hint: 'Verified professionals who apply to this locum will appear here.',
          }}
        />
      </PageColumn>
    </SafeAreaView>
  );
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  summary: {
    gap: spacing.xs + 2,
    padding: spacing.lg,
    borderRadius: radius.xl + 2,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.xs,
  },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm, flexWrap: 'wrap' },
  when: { ...typography.bodyStrong, color: colors.navy },
  sub: { ...typography.caption, color: colors.textSecondary },
  stats: { flexDirection: 'row', gap: spacing.xl, marginTop: spacing.sm },
  stat: { gap: 2 },
  statValue: { ...typography.h3, color: colors.text },
  statLabel: { ...typography.small, color: colors.textSecondary },
  link: { ...typography.small, fontFamily: fonts.body.semibold, color: colors.navy, marginTop: spacing.sm },
});
