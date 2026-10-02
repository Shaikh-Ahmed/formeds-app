import React, { useCallback, useState } from 'react';
import { FormScrollView } from '../../src/components/FormScrollView';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../src/context/AuthContext';
import { apiFetch } from '../../src/utils/api';
import { colors, radius, spacing, typography } from '../../src/theme';
import { PageColumn } from '../../src/components/web';
import { Button, EmptyState, ErrorBanner, ErrorState, FormInput, LoadingState, Sheet } from '../../src/components';
import { JobBadge } from '../../src/components/jobs/JobMeta';
import { ChoiceChips } from '../../src/components/locum/ChoiceChips';
import {
  istDayClock, longDay, ReliabilityTiles, rupees, Stars,
} from '../../src/components/locum/shifts/ShiftBits';
import type { LocumReliability, LocumStrike } from '../../src/types/locum';

type Card = { id: string; name: string; avatar?: string } | null;
type StrikeRow = LocumStrike & { professional: Card };
interface Overview {
  disputes: StrikeRow[];
  strikes: StrikeRow[];
  blocks: { id: string; status: string; unblock_amount: number; strike_pays: number[]; created_at: string;
    lifted_at?: string | null; lift_reason?: string; professional: Card }[];
  payments: { id: string; amount: number; status: string; provider: string; provider_reference?: string;
    paid_at?: string | null; created_at: string; professional: Card }[];
  rebookings: { id: string; status: string; employer_name: string; specialty: string; shift_date: string;
    created_at: string; professional: Card }[];
}
type Detail = Omit<LocumReliability, 'strike_history'> & {
  professional: Card;
  strike_history: (StrikeRow & { arrived_at?: string | null; no_show_at?: string | null;
    timeline: { to_status: string; from_status?: string | null; note: string; created_at: string; actor_name: string }[] })[];
  cancellation_history: { application_id: string; cancelled_at: string; reason: string; details: string }[];
};

/** 'not_started' → 'not started'. */
const human = (status: string) => status.replace(/_/g, ' ');

type Tab = 'disputes' | 'strikes' | 'blocks' | 'payments' | 'rebookings';
const TABS: { value: Tab; label: string }[] = [
  { value: 'disputes', label: 'Disputes' }, { value: 'strikes', label: 'No-shows' },
  { value: 'blocks', label: 'Blocked' }, { value: 'payments', label: 'Unblock payments' },
  { value: 'rebookings', label: 'Rebookings' },
];

/**
 * Admin: Locum reliability. Disputed no-shows first, because each one may be
 * keeping a professional out of Locum. Opening a professional shows every
 * no-show with its full timeline -- arrival report, who flagged it, when --
 * and a strike can be upheld or removed, always with a reason that is kept.
 */
export default function AdminLocumScreen() {
  const { token, user } = useAuth();
  const router = useRouter();
  const [data, setData] = useState<Overview | null>(null);
  const [tab, setTab] = useState<Tab>('disputes');
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [detail, setDetail] = useState<Detail | null>(null);
  const [deciding, setDeciding] = useState<{ strike: StrikeRow; decision: 'uphold' | 'remove' } | null>(null);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [sheetError, setSheetError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!token) return;
    setError(null);
    try { setData(await apiFetch('/api/admin/locum/overview', token)); } catch (e: any) {
      setError(e?.message || 'Could not load Locum records.');
    } finally { setRefreshing(false); }
  }, [token]);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const openProfessional = async (id?: string) => {
    if (!token || !id) return;
    setSheetError(null);
    try { setDetail(await apiFetch(`/api/admin/locum/professionals/${id}`, token)); } catch (e: any) {
      setError(e?.message || 'Could not load this professional.');
    }
  };

  const decide = async () => {
    if (!token || !deciding) return;
    if (reason.trim().length < 5) { setSheetError('Give a reason for this decision.'); return; }
    setBusy(true); setSheetError(null);
    try {
      await apiFetch(`/api/admin/locum/strikes/${deciding.strike.id}/decision`, token, {
        method: 'POST', body: JSON.stringify({ decision: deciding.decision, reason: reason.trim() }),
      });
      const pid = deciding.strike.professional?.id ?? detail?.professional?.id;
      setDeciding(null); setReason('');
      await load();
      if (pid) await openProfessional(pid);
    } catch (e: any) {
      setSheetError(e?.message || 'Could not record the decision.');
    } finally { setBusy(false); }
  };

  if (!user?.is_admin) {
    return (
      <SafeAreaView style={styles.safe}>
        <EmptyState icon="lock-closed-outline" title="Admin access required" hint="This page is for ForMeds admins." />
      </SafeAreaView>
    );
  }

  const rows = data ? data[tab] : [];
  const counts: Record<Tab, number> = {
    disputes: data?.disputes.length ?? 0, strikes: data?.strikes.length ?? 0,
    blocks: data?.blocks.filter(b => b.status === 'active').length ?? 0,
    payments: data?.payments.length ?? 0, rebookings: data?.rebookings.length ?? 0,
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <PageColumn maxWidth={900} testID="admin-locum">
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} accessibilityRole="button" accessibilityLabel="Back" hitSlop={10}>
            <Ionicons name="arrow-back" size={24} color={colors.navy} />
          </Pressable>
          <Text style={styles.title}>Locum reliability</Text>
        </View>
        <FormScrollView contentContainerStyle={styles.page}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} />}>
          <ChoiceChips value={tab} onChange={v => v && setTab(v)} testID="admin-locum-tab"
            choices={TABS.map(t => ({ ...t, label: counts[t.value] ? `${t.label} ${counts[t.value]}` : t.label }))} />
          {error ? <ErrorState message={error} onRetry={load} /> : !data ? <LoadingState /> : rows.length === 0 ? (
            <EmptyState icon="checkmark-done-outline" title="Nothing here" hint="No records in this list." />
          ) : tab === 'disputes' || tab === 'strikes' ? (data[tab] as StrikeRow[]).map(s => (
            <Pressable key={s.id} style={styles.row} onPress={() => openProfessional(s.professional?.id)}
              accessibilityRole="button" testID={`admin-strike-${s.id}`}>
              <View style={styles.flex}>
                <Text style={styles.strong}>{s.professional?.name ?? 'Unknown'}</Text>
                <Text style={styles.muted}>
                  No-show · {s.employer_name} · {s.specialty} · {longDay(s.shift_date)} · pay {rupees(s.pay_amount)}
                </Text>
                {s.dispute_reason ? <Text style={styles.quote}>“{s.dispute_reason}”</Text> : null}
              </View>
              <JobBadge label={s.status === 'active' ? (s.dispute_status === 'open' ? 'Disputed' : 'Active')
                : s.status === 'cleared' ? 'Cleared (paid)' : 'Removed'}
                tone={s.status === 'active' ? (s.dispute_status === 'open' ? 'warning' : 'danger') : 'neutral'} />
            </Pressable>
          )) : tab === 'blocks' ? data.blocks.map(b => (
            <Pressable key={b.id} style={styles.row} onPress={() => openProfessional(b.professional?.id)}
              accessibilityRole="button">
              <View style={styles.flex}>
                <Text style={styles.strong}>{b.professional?.name ?? 'Unknown'}</Text>
                <Text style={styles.muted}>
                  Blocked {istDayClock(b.created_at)} · fee {rupees(b.unblock_amount)} (max of {b.strike_pays.map(rupees).join(', ')})
                </Text>
                {b.lift_reason ? <Text style={styles.muted}>{b.lift_reason}</Text> : null}
              </View>
              <JobBadge label={b.status === 'active' ? 'Blocked' : b.status === 'lifted' ? 'Paid' : 'Overturned'}
                tone={b.status === 'active' ? 'danger' : 'neutral'} />
            </Pressable>
          )) : tab === 'payments' ? data.payments.map(p => (
            <View key={p.id} style={styles.row}>
              <View style={styles.flex}>
                <Text style={styles.strong}>{p.professional?.name ?? 'Unknown'} · {rupees(p.amount)}</Text>
                <Text style={styles.muted}>
                  {p.provider}{p.provider_reference ? ` · ${p.provider_reference}` : ''} · {istDayClock(p.paid_at || p.created_at)}
                </Text>
              </View>
              <JobBadge label={p.status} tone={p.status === 'succeeded' ? 'teal' : p.status === 'failed' ? 'danger' : 'neutral'} />
            </View>
          )) : data.rebookings.map(r => (
            <View key={r.id} style={styles.row}>
              <View style={styles.flex}>
                <Text style={styles.strong}>{r.employer_name} → {r.professional?.name ?? 'Unknown'}</Text>
                <Text style={styles.muted}>{r.specialty} · {longDay(r.shift_date)} · sent {istDayClock(r.created_at)}</Text>
              </View>
              <JobBadge label={r.status} tone="navy" />
            </View>
          ))}
        </FormScrollView>
      </PageColumn>

      <Sheet visible={!!detail} onClose={() => setDetail(null)} title={detail?.professional?.name ?? ''} maxWidth={720}
        testID="admin-locum-detail">
        {detail ? (
          <View style={styles.sheet}>
            <ReliabilityTiles summary={detail} cancellations={detail.cancellations} />
            {detail.block ? (
              <Text style={[styles.muted, { color: colors.redText }]}>
                Locum blocked · unblock fee {rupees(detail.block.unblock_amount)}
              </Text>
            ) : null}
            <Text style={styles.section}>No-shows</Text>
            {detail.strike_history.length === 0 ? <Text style={styles.muted}>None.</Text> : detail.strike_history.map(s => (
              <View key={s.id} style={styles.card}>
                <Text style={styles.strong}>{longDay(s.shift_date)} · {s.employer_name} · {s.specialty}</Text>
                <Text style={styles.muted}>
                  Arrival report: {s.arrived_at ? istDayClock(s.arrived_at) : 'none'} · flagged {istDayClock(s.no_show_at)}
                  {' '}· strike {s.status}{s.dispute_status !== 'none' ? ` · dispute ${s.dispute_status}` : ''}
                </Text>
                {s.dispute_reason ? <Text style={styles.quote}>Professional: “{s.dispute_reason}”</Text> : null}
                {s.resolution_note ? <Text style={styles.muted}>Decision: {s.resolution_note}</Text> : null}
                <Text style={styles.label}>Timeline</Text>
                {s.timeline.map((e, i) => (
                  <Text key={i} style={styles.muted}>
                    {istDayClock(e.created_at)} · {e.actor_name} · {e.from_status ? `${human(e.from_status)} → ` : ''}{human(e.to_status)}
                    {e.note ? ` · ${e.note}` : ''}
                  </Text>
                ))}
                {s.status === 'active' ? (
                  <View style={styles.actions}>
                    <Button label="Uphold" variant="outline" style={styles.flex}
                      onPress={() => { setReason(''); setSheetError(null); setDeciding({ strike: s, decision: 'uphold' }); }} />
                    <Button label="Remove strike" variant="danger" style={styles.flex} testID={`remove-${s.id}`}
                      onPress={() => { setReason(''); setSheetError(null); setDeciding({ strike: s, decision: 'remove' }); }} />
                  </View>
                ) : null}
              </View>
            ))}
            {detail.cancellation_history.length ? (
              <>
                <Text style={styles.section}>Cancellations</Text>
                {detail.cancellation_history.map(c => (
                  <Text key={c.application_id} style={styles.muted}>
                    {istDayClock(c.cancelled_at)} · {c.reason}{c.details ? ` · ${c.details}` : ''}
                  </Text>
                ))}
              </>
            ) : null}
            {detail.reviews.length ? (
              <>
                <Text style={styles.section}>Reviews</Text>
                {detail.reviews.map(r => (
                  <View key={r.id} style={styles.inline}>
                    <Stars value={r.overall} />
                    <Text style={styles.muted}>{r.employer_name} · {longDay(r.shift_date)}{r.review ? ` · “${r.review}”` : ''}</Text>
                  </View>
                ))}
              </>
            ) : null}
          </View>
        ) : null}
      </Sheet>

      <Sheet visible={!!deciding} onClose={() => setDeciding(null)}
        title={deciding?.decision === 'remove' ? 'Remove this strike?' : 'Uphold this no-show?'}
        footer={<>
          <Button label="Cancel" variant="outline" onPress={() => setDeciding(null)} style={styles.flex} />
          <Button label={deciding?.decision === 'remove' ? 'Remove strike' : 'Uphold'} onPress={decide} loading={busy}
            variant={deciding?.decision === 'remove' ? 'danger' : 'primary'} style={styles.flex} testID="admin-decide" />
        </>}>
        <View style={styles.sheet}>
          <Text style={styles.muted}>
            {deciding?.decision === 'remove'
              ? 'The strike is kept on record as removed, with your name and reason. If it was part of a block, the block is lifted.'
              : 'The no-show stands. The professional is told your reason.'}
          </Text>
          <FormInput label="Reason *" value={reason} onChangeText={setReason} multiline rows={3} maxLength={1000}
            testID="admin-reason" />
          <ErrorBanner message={sheetError} />
        </View>
      </Sheet>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.lg },
  title: { ...typography.h2, color: colors.text },
  page: { padding: spacing.lg, gap: spacing.md, paddingBottom: spacing.xxxl * 2 },
  row: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.md, backgroundColor: colors.card,
    borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, padding: spacing.md,
  },
  flex: { flex: 1, minWidth: 0 },
  strong: { ...typography.bodyStrong, color: colors.text },
  muted: { ...typography.caption, color: colors.textSecondary, lineHeight: 19 },
  quote: { ...typography.caption, color: colors.text, fontStyle: 'italic' },
  label: { ...typography.small, color: colors.textSecondary, marginTop: spacing.xs },
  section: { ...typography.label, color: colors.textSecondary, marginTop: spacing.sm },
  sheet: { paddingHorizontal: spacing.xl, paddingBottom: spacing.lg, gap: spacing.md },
  card: { borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg, padding: spacing.md, gap: 4 },
  actions: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm },
  inline: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, flexWrap: 'wrap' },
});
