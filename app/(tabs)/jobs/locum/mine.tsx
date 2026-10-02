import React, { useCallback, useMemo, useState } from 'react';
import { FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useRouter } from 'expo-router';
import { useAuth } from '../../../../src/context/AuthContext';
import { colors, radius, spacing, typography, fonts, gloss } from '../../../../src/theme';
import { PageGrid } from '../../../../src/components/web';
import { Button, EmptyState, ErrorBanner, ErrorState, KycNotice, Sheet } from '../../../../src/components';
import { Skeleton } from '../../../../src/components/Skeleton';
import { JobBadge } from '../../../../src/components/jobs/JobMeta';
import { LocumNav } from '../../../../src/components/locum/LocumNav';
import { ChoiceChips } from '../../../../src/components/locum/ChoiceChips';
import {
  BADGE_TONE, formatLocumPay, formatPlace, formatRoleLine, formatShiftDay, formatShiftHours,
} from '../../../../src/components/locum/LocumMeta';
import { fetchMyLocums, setLocumStatus } from '../../../../src/api/locum';
import { LOCUM_STATUS_META, type Locum } from '../../../../src/types/locum';

type ListView = 'active' | 'closed';

/**
 * The hospital's locums. "Active" is anything still ahead -- open, or filled
 * and waiting to happen; "Closed" is the rest. Each card's first action is
 * its applicants, because that is the thing a hospital comes here to do.
 */
export default function MyLocumsScreen() {
  const { token, isKycApproved } = useAuth();
  const router = useRouter();
  const [view, setView] = useState<ListView>('active');
  const [locums, setLocums] = useState<Locum[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [cancelling, setCancelling] = useState<Locum | null>(null);

  const load = useCallback(async () => {
    if (!token) { setLoading(false); return; }
    setError(null);
    try {
      setLocums(await fetchMyLocums(token, view));
    } catch (e: any) {
      setError(e?.message || 'Could not load your locums.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [token, view]);

  useFocusEffect(useCallback(() => { setLoading(true); load(); }, [load]));

  const changeStatus = useCallback(async (locum: Locum, status: 'open' | 'closed' | 'cancelled') => {
    if (!token) return;
    setActionError(null);
    try {
      const fresh = await setLocumStatus(token, locum.id, status);
      setLocums(prev => prev.map(l => (l.id === locum.id ? { ...l, ...fresh } : l)));
    } catch (e: any) {
      setActionError(e?.message || 'Could not update this locum.');
    }
  }, [token]);

  const totals = useMemo(() => ({
    applicants: locums.reduce((n, l) => n + (l.applicant_count || 0), 0),
    open: locums.reduce((n, l) => n + (l.status === 'open' ? l.openings_left : 0), 0),
  }), [locums]);

  return (
    <SafeAreaView style={styles.safe} edges={[]}>
      <PageGrid fluid testID="my-locums-grid">
        <LocumNav active="mine" />
        <View style={styles.top}>
          <View style={styles.topRow}>
            <ChoiceChips
              choices={[{ value: 'active', label: 'Active' }, { value: 'closed', label: 'Closed' }]}
              value={view}
              onChange={v => v && setView(v)}
              testID="my-locums-view"
            />
            <Button label="Post a locum" onPress={() => router.push('/jobs/locum/new' as any)}
              disabled={!isKycApproved} testID="locum-post-open" />
          </View>
          {view === 'active' && locums.length ? (
            <Text style={styles.summary}>
              {totals.open} {totals.open === 1 ? 'opening' : 'openings'} to fill · {totals.applicants}{' '}
              {totals.applicants === 1 ? 'applicant' : 'applicants'}
            </Text>
          ) : null}
          <KycNotice action="post locums" />
          <ErrorBanner message={actionError} />
        </View>

        <FlatList
          data={loading ? [] : locums}
          keyExtractor={item => item.id}
          contentContainerStyle={styles.list}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }}
              tintColor={colors.navy} />
          }
          renderItem={({ item }) => {
            const status = LOCUM_STATUS_META[item.status];
            const live = item.status === 'open' || item.status === 'full';
            return (
              <View style={styles.card} testID={`my-locum-${item.id}`}>
                <Pressable onPress={() => router.push(`/jobs/locum/manage/${item.id}` as any)}
                  accessibilityRole="button" style={({ pressed }) => [styles.body, pressed && styles.pressed]}>
                  <View style={styles.row}>
                    <Text style={styles.when}>
                      {formatShiftDay(item.shift_date)} · {formatShiftHours(item)}
                    </Text>
                    <JobBadge label={status.label} icon={status.icon as any} tone={BADGE_TONE[status.tone]} />
                  </View>
                  <Text style={styles.title}>{formatRoleLine(item)}</Text>
                  <Text style={styles.sub} numberOfLines={1}>
                    {formatPlace(item)} · {formatLocumPay(item)}
                  </Text>
                  <FillBar filled={item.filled_count} total={item.openings} />
                </Pressable>
                <View style={styles.actions}>
                  <ActionLink label={`Applicants (${item.applicant_count})`} primary
                    onPress={() => router.push(`/jobs/locum/manage/${item.id}` as any)}
                    testID={`my-locum-applicants-${item.id}`} />
                  {item.status !== 'cancelled' ? (
                    <ActionLink label="Edit" onPress={() => router.push(`/jobs/locum/edit/${item.id}` as any)} />
                  ) : null}
                  {item.status === 'open' ? (
                    <ActionLink label="Close" onPress={() => changeStatus(item, 'closed')}
                      testID={`my-locum-close-${item.id}`} />
                  ) : null}
                  {item.status === 'closed' && new Date(item.shift_ends_at) > new Date() ? (
                    <ActionLink label="Re-open" onPress={() => changeStatus(item, 'open')} />
                  ) : null}
                  {live || item.status === 'closed' ? (
                    <ActionLink label="Cancel locum" quiet onPress={() => setCancelling(item)} />
                  ) : null}
                </View>
              </View>
            );
          }}
          ListEmptyComponent={
            loading ? (
              <View style={styles.skeletons}>
                {[0, 1].map(i => (
                  <View key={i} style={styles.card}>
                    <Skeleton height={12} width="40%" />
                    <Skeleton height={16} width="65%" />
                    <Skeleton height={8} width="100%" />
                  </View>
                ))}
              </View>
            ) : error ? (
              <ErrorState message={error} onRetry={load} />
            ) : view === 'active' ? (
              <EmptyState icon="flash-outline" title="No active locums"
                hint="Need cover at short notice? Posting a locum takes under a minute."
                actionLabel={isKycApproved ? 'Post a locum' : undefined}
                onAction={isKycApproved ? () => router.push('/jobs/locum/new' as any) : undefined} />
            ) : (
              <EmptyState icon="archive-outline" title="Nothing closed yet"
                hint="Finished, closed and cancelled locums are kept here." />
            )
          }
        />
      </PageGrid>

      <Sheet
        visible={!!cancelling}
        onClose={() => setCancelling(null)}
        title="Cancel this locum?"
        testID="locum-cancel-sheet"
        footer={
          <>
            <Button label="Keep it" variant="outline" style={styles.flex} onPress={() => setCancelling(null)} />
            <Button label="Cancel locum" variant="danger" style={styles.flex} testID="locum-cancel-confirm"
              onPress={() => { if (cancelling) changeStatus(cancelling, 'cancelled'); setCancelling(null); }} />
          </>
        }
      >
        <View style={styles.sheetBody}>
          <Text style={styles.sheetText}>
            Everyone who applied — including anyone already selected — will be notified that
            this shift is cancelled. This cannot be undone.
          </Text>
        </View>
      </Sheet>
    </SafeAreaView>
  );
}

function FillBar({ filled, total }: { filled: number; total: number }) {
  const pct = total ? Math.min(filled / total, 1) : 0;
  return (
    <View style={styles.fill} accessible accessibilityLabel={`${filled} of ${total} filled`}>
      <View style={styles.track}><View style={[styles.bar, { width: `${pct * 100}%` }]} /></View>
      <Text style={styles.fillText}>{filled}/{total} filled</Text>
    </View>
  );
}

function ActionLink({
  label, onPress, primary, quiet, testID,
}: { label: string; onPress: () => void; primary?: boolean; quiet?: boolean; testID?: string }) {
  return (
    <Pressable onPress={onPress} accessibilityRole="button" testID={testID}
      style={({ pressed }) => [styles.action, primary && styles.actionPrimary, quiet && styles.actionQuiet,
        pressed && styles.pressed]}>
      <Text style={[styles.actionText, primary && styles.actionTextPrimary, quiet && styles.actionTextQuiet]}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  flex: { flex: 1 },
  top: { paddingHorizontal: spacing.lg, gap: spacing.sm },
  topRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.md, flexWrap: 'wrap' },
  summary: { ...typography.caption, color: colors.textSecondary },
  list: { padding: spacing.lg, paddingBottom: spacing.xxxl * 2, gap: spacing.md },
  skeletons: { gap: spacing.md },
  card: {
    backgroundColor: colors.card,
    borderRadius: radius.xl + 2,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    gap: spacing.md,
  },
  body: { gap: spacing.xs + 2 },
  pressed: { opacity: 0.7 },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm, flexWrap: 'wrap' },
  when: { ...typography.small, fontFamily: fonts.body.semibold, color: colors.navy },
  title: { ...typography.h3, color: colors.text },
  sub: { ...typography.caption, color: colors.textSecondary },
  fill: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: spacing.xs },
  track: { flex: 1, height: 6, borderRadius: radius.pill, backgroundColor: colors.bgMuted, overflow: 'hidden' },
  bar: { height: 6, borderRadius: radius.pill, backgroundColor: colors.teal },
  fillText: { ...typography.small, fontFamily: fonts.body.semibold, color: colors.text },
  actions: {
    flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm,
    paddingTop: spacing.md, borderTopWidth: 1, borderTopColor: colors.borderLight,
  },
  action: {
    paddingHorizontal: spacing.md, minHeight: 36, borderRadius: radius.md,
    borderWidth: 1, borderColor: colors.navy, justifyContent: 'center', backgroundColor: colors.white,
  },
  actionPrimary: { backgroundColor: colors.action, ...gloss.fill },
  actionQuiet: { borderColor: colors.border },
  actionText: { ...typography.small, fontFamily: fonts.body.semibold, color: colors.navy },
  actionTextPrimary: { color: colors.white },
  actionTextQuiet: { color: colors.textSecondary },
  sheetBody: { padding: spacing.xl, paddingTop: spacing.md },
  sheetText: { ...typography.body, color: colors.text, lineHeight: 22 },
});
