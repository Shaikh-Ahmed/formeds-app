import React, { useCallback, useMemo, useState } from 'react';
import { useSubmit } from '../../../hooks/useSubmit';
import { RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../../context/AuthContext';
import { colors, fonts, radius, spacing, typography } from '../../../theme';
import { Button } from '../../Button';
import { EmptyState, ErrorBanner, ErrorState } from '../../States';
import { Skeleton } from '../../Skeleton';
import { JobBadge } from '../../jobs/JobMeta';
import { ChoiceChips } from '../ChoiceChips';
import { BADGE_TONE, formatRoleLine, formatShiftDay, formatShiftHours } from '../LocumMeta';
import {
  acceptRebooking, cancelShift, disputeNoShow, fetchMyShifts, markArrival, payUnblock, rejectRebooking,
  startUnblockCheckout,
} from '../../../api/locum';
import {
  LOCUM_REBOOKING_META, type LocumCancelReason, type LocumRebooking, type LocumShift,
  type ProfessionalShifts as Data, type UnblockCheckout,
} from '../../../types/locum';
import {
  istClock, istDayClock, longDay, ReliabilityTiles, rupees, SectionTitle, ShiftHead, shiftStyles, Stars,
} from './ShiftBits';
import { CancelShiftSheet, DisputeSheet, UnblockSheet } from './ShiftSheets';

type Tab = 'upcoming' | 'completed' | 'cancelled' | 'no_show';

const TABS: { value: Tab; label: string }[] = [
  { value: 'upcoming', label: 'Upcoming' },
  { value: 'completed', label: 'Completed' },
  { value: 'cancelled', label: 'Cancelled' },
  { value: 'no_show', label: 'No-show' },
];

const EMPTY: Record<Tab, string> = {
  upcoming: 'Shifts you are selected for, or accept from a request, appear here.',
  completed: 'Shifts you attended and completed build your Locum history here.',
  cancelled: 'Shifts you or a hospital cancelled.',
  no_show: 'Nothing here — keep it that way.',
};

/**
 * My shifts: the professional's side of Locum after selection.
 *
 * Top to bottom in order of urgency: a block (with the way out), requests
 * waiting for an answer, today's shift with its one big button, then history.
 * Every action shown is one the server said is available now, so nothing
 * here re-derives a time rule from the device clock.
 */
export function ProfessionalShifts() {
  const { token } = useAuth();
  const router = useRouter();
  const [data, setData] = useState<Data | null>(null);
  const [tab, setTab] = useState<Tab>('upcoming');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  // One action at a time, whatever is tapped twice or in quick succession.
  const guard = useSubmit();
  const [cancelling, setCancelling] = useState<LocumShift | null>(null);
  const [disputing, setDisputing] = useState<LocumShift | null>(null);
  const [sheetError, setSheetError] = useState<string | null>(null);
  const [unblockOpen, setUnblockOpen] = useState(false);
  const [checkout, setCheckout] = useState<UnblockCheckout | null>(null);

  const load = useCallback(async () => {
    if (!token) { setLoading(false); return; }
    setError(null);
    try {
      setData(await fetchMyShifts(token));
    } catch (e: any) {
      setError(e?.message || 'Could not load your shifts.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [token]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const run = (key: string, fn: () => Promise<unknown>, done: string, fallback: string) => guard.run(async key => {
    if (!token) return;
    setBusy(key); setActionError(null); setNotice(null);
    try {
      await fn();
      setNotice(done);
      await load();
    } catch (e: any) {
      setActionError(e?.message || fallback);
    } finally {
      setBusy(null);
    }
  });

  const doCancel = (reason: LocumCancelReason, details: string) => guard.run(async () => {
    if (!token || !cancelling) return;
    setBusy('cancel'); setSheetError(null);
    try {
      await cancelShift(token, cancelling.application.id, reason, details);
      setCancelling(null);
      setNotice('Shift cancelled. The hospital has been told.');
      await load();
    } catch (e: any) {
      setSheetError(e?.message || 'Could not cancel this shift.');
    } finally { setBusy(null); }
  });

  const doDispute = (reason: string) => guard.run(async () => {
    if (!token || !disputing) return;
    setBusy('dispute'); setSheetError(null);
    try {
      await disputeNoShow(token, disputing.application.id, reason);
      setDisputing(null);
      setNotice('Sent to ForMeds for review.');
      await load();
    } catch (e: any) {
      setSheetError(e?.message || 'Could not send your dispute.');
    } finally { setBusy(null); }
  });

  const openUnblock = async () => {
    if (!token) return;
    setUnblockOpen(true); setCheckout(null); setSheetError(null);
    try {
      setCheckout(await startUnblockCheckout(token));
    } catch (e: any) {
      setSheetError(e?.message || 'Could not start the payment.');
    }
  };

  const pay = (outcome: 'success' | 'failure', method: 'card' | 'upi' | 'netbanking') => guard.run(async key => {
    if (!token || !checkout) return;
    setBusy('pay'); setSheetError(null);
    try {
      await payUnblock(token, checkout.payment_id, outcome, method, key);
      setUnblockOpen(false);
      setNotice('Your Locum access has been restored.');
      await load();
    } catch (e: any) {
      setSheetError(e?.message || 'Payment could not be completed.');
      // A failed checkout cannot be retried; prepare a fresh one.
      try { setCheckout(await startUnblockCheckout(token)); } catch { /* shown above */ }
    } finally { setBusy(null); }
  }, { payment: checkout?.payment_id, outcome, method });

  const counts = useMemo(() => ({
    upcoming: data?.upcoming.length ?? 0, completed: data?.completed.length ?? 0,
    cancelled: data?.cancelled.length ?? 0, no_show: data?.no_show.length ?? 0,
  }), [data]);

  const rel = data?.reliability;
  const list = data ? data[tab] : [];

  return (
    <ScrollView contentContainerStyle={styles.page}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }}
        tintColor={colors.navy} />}>
      {loading ? (
        <View style={styles.stack}>
          {[0, 1].map(i => (
            <View key={i} style={shiftStyles.card}>
              <Skeleton height={12} width="40%" /><Skeleton height={18} width="70%" /><Skeleton height={36} />
            </View>
          ))}
        </View>
      ) : error ? (
        <ErrorState message={error} onRetry={load} />
      ) : data && rel ? (
        <View style={styles.stack}>
          {notice ? (
            <View style={styles.notice} accessibilityLiveRegion="polite">
              <Ionicons name="checkmark-circle" size={18} color={colors.teal} />
              <Text style={styles.noticeText}>{notice}</Text>
            </View>
          ) : null}
          <ErrorBanner message={actionError} />

          {rel.locum_blocked && rel.block ? (
            <View style={[shiftStyles.card, styles.blocked]} testID="locum-blocked">
              <View style={styles.blockedHead}>
                <Ionicons name="lock-closed" size={20} color={colors.redText} />
                <Text style={styles.blockedTitle}>Your Locum access is currently blocked.</Text>
              </View>
              <Text style={styles.body}>
                You have reached {rel.strike_limit} confirmed no-show strikes. You can still use the rest of ForMeds —
                jobs, your profile, messages and learning. Applying for and accepting locums is paused.
              </Text>
              <Text style={styles.strong}>Current strikes: {rel.active_strikes} / {rel.strike_limit}</Text>
              {rel.block.strikes.map(s => (
                <Text key={s.strike_id} style={styles.muted}>
                  {longDay(s.shift_date)} · {s.employer_name} · {s.specialty} · shift pay {rupees(s.pay_amount)}
                </Text>
              ))}
              <Text style={styles.body}>
                To restore access, pay {rupees(rel.block.unblock_amount)} — the highest pay among those three shifts.
              </Text>
              <Button label="Restore Locum access" onPress={openUnblock} testID="unblock-open" />
            </View>
          ) : (
            <View style={shiftStyles.card} testID="locum-reliability">
              <Text style={styles.cardTitle}>Locum reliability</Text>
              <ReliabilityTiles summary={rel} cancellations={rel.cancellations} />
              {rel.active_strikes > 0 ? (
                <Text style={shiftStyles.note}>
                  {rel.active_strikes} of {rel.strike_limit} strikes. Strikes come only from no-shows a hospital
                  confirms; cancelling at least 3 hours ahead never adds one.
                </Text>
              ) : null}
            </View>
          )}

          {data.requests.length ? (
            <>
              <SectionTitle title="Locum requests" count={data.requests.length} />
              {data.requests.map(rb => (
                <RequestCard key={rb.id} rb={rb} busy={busy} blocked={rel.locum_blocked}
                  onAccept={() => run(`accept-${rb.id}`, () => acceptRebooking(token!, rb.id),
                    'Accepted. The shift is in Upcoming.', 'Could not accept this request.')}
                  onReject={() => run(`reject-${rb.id}`, () => rejectRebooking(token!, rb.id),
                    'Request declined. The hospital has been told.', 'Could not decline this request.')} />
              ))}
            </>
          ) : null}

          <ChoiceChips value={tab} onChange={v => v && setTab(v)} testID="shift-tab"
            choices={TABS.map(t => ({ ...t, label: counts[t.value] ? `${t.label} ${counts[t.value]}` : t.label }))} />

          {list.length === 0 ? (
            <EmptyState icon="calendar-outline" title="Nothing here yet" hint={EMPTY[tab]}
              actionLabel={tab === 'upcoming' && !rel.locum_blocked ? 'Find locums' : undefined}
              onAction={tab === 'upcoming' ? () => router.replace('/jobs/locum' as any) : undefined} />
          ) : list.map(shift => (
            <ShiftCard key={shift.application.id} shift={shift} busy={busy}
              onOpen={() => router.push(`/jobs/locum/${shift.locum.id}` as any)}
              onArrive={() => run(`arrive-${shift.application.id}`, () => markArrival(token!, shift.application.id),
                'Arrival marked. The hospital has been notified.', 'Unable to mark arrival. Please try again.')}
              onCancel={() => { setSheetError(null); setCancelling(shift); }}
              onDispute={() => { setSheetError(null); setDisputing(shift); }} />
          ))}

          {rel.strike_history.length ? (
            <View style={shiftStyles.card}>
              <Text style={styles.cardTitle}>Strike history</Text>
              {rel.strike_history.map(s => (
                <View key={s.id} style={styles.historyRow} testID={`strike-${s.id}`}>
                  <Text style={styles.strong}>{longDay(s.shift_date)} · No-show</Text>
                  <Text style={styles.muted}>{s.employer_name} · {s.specialty}</Text>
                  <Text style={[styles.muted, s.status === 'active' && { color: colors.redText }]}>
                    {s.status === 'active' ? `Strike +1${s.dispute_status === 'open' ? ' · under review' : ''}`
                      : s.status === 'cleared' ? 'Cleared by unblock payment'
                        : 'Removed after review'}
                    {s.dispute_status === 'upheld' ? ' · review upheld the no-show' : ''}
                  </Text>
                </View>
              ))}
            </View>
          ) : null}

          {rel.reviews.length ? (
            <View style={shiftStyles.card}>
              <Text style={styles.cardTitle}>Reviews from hospitals</Text>
              {rel.reviews.map(r => (
                <View key={r.id} style={styles.historyRow}>
                  <View style={styles.inline}>
                    <Stars value={r.overall} /><Text style={styles.strong}>{r.employer_name}</Text>
                  </View>
                  <Text style={styles.muted}>{r.specialty} · {longDay(r.shift_date)}</Text>
                  {r.review ? <Text style={styles.body}>{r.review}</Text> : null}
                </View>
              ))}
            </View>
          ) : null}
        </View>
      ) : null}

      <CancelShiftSheet shift={cancelling} onClose={() => setCancelling(null)} onSubmit={doCancel}
        submitting={busy === 'cancel'} error={sheetError} />
      <DisputeSheet shift={disputing} onClose={() => setDisputing(null)} onSubmit={doDispute}
        submitting={busy === 'dispute'} error={sheetError} />
      <UnblockSheet visible={unblockOpen} checkout={checkout} onClose={() => setUnblockOpen(false)} onPay={pay}
        paying={busy === 'pay'} error={sheetError} />
    </ScrollView>
  );
}

function RequestCard({ rb, busy, blocked, onAccept, onReject }: {
  rb: LocumRebooking; busy: string | null; blocked: boolean; onAccept: () => void; onReject: () => void;
}) {
  const locum = rb.locum;
  if (!locum) return null;
  const meta = LOCUM_REBOOKING_META[rb.status];
  return (
    <View style={[shiftStyles.card, styles.request]} testID={`request-${rb.id}`}>
      <View style={styles.inline}>
        <Ionicons name="repeat" size={16} color={colors.navy} />
        <Text style={styles.kicker}>New locum request</Text>
        <JobBadge label={meta.label} icon={meta.icon as any} tone={BADGE_TONE[meta.tone]} />
      </View>
      <Text style={styles.cardTitle}>{locum.employer_name}</Text>
      <Text style={styles.body}>{formatRoleLine(locum)}</Text>
      <Text style={styles.body}>
        {formatShiftDay(locum.shift_date)} · {longDay(locum.shift_date)} · {formatShiftHours(locum)}
      </Text>
      <Text style={styles.strong}>{rupees(locum.shift_pay ?? locum.pay_amount)}</Text>
      {rb.message ? <Text style={styles.quote}>“{rb.message}”</Text> : null}
      <Text style={styles.muted}>
        {rb.require_interview ? 'The hospital would like a quick interview first. ' : 'No interview needed. '}
        Answer by {istDayClock(rb.expires_at)}.
      </Text>
      {blocked ? (
        <Text style={[styles.muted, { color: colors.redText }]}>
          You cannot accept this request because your Locum access is currently blocked.
        </Text>
      ) : null}
      <View style={shiftStyles.actions}>
        <Button label="Decline" variant="outline" onPress={onReject} loading={busy === `reject-${rb.id}`}
          style={shiftStyles.action} testID={`request-reject-${rb.id}`} />
        <Button label="Accept" variant="secondary" onPress={onAccept} loading={busy === `accept-${rb.id}`}
          disabled={blocked} style={shiftStyles.action} testID={`request-accept-${rb.id}`} />
      </View>
    </View>
  );
}

function ShiftCard({ shift, busy, onOpen, onArrive, onCancel, onDispute }: {
  shift: LocumShift; busy: string | null;
  onOpen: () => void; onArrive: () => void; onCancel: () => void; onDispute: () => void;
}) {
  const app = shift.application;
  const today = shift.phase === 'arrival_open' || shift.phase === 'not_arrived';
  return (
    <View style={[shiftStyles.card, today && styles.todayCard]} testID={`shift-${app.id}`}>
      {today ? <Text style={styles.kicker}>Today’s locum</Text> : null}
      <ShiftHead shift={shift} />
      {shift.locum.notes ? <Text style={shiftStyles.note}>{shift.locum.notes}</Text> : null}

      {app.arrived_at && shift.phase === 'arrival_reported' ? (
        <View>
          <View style={shiftStyles.ok}>
            <Ionicons name="checkmark-circle" size={16} color={colors.teal} />
            <Text style={shiftStyles.okText}>Arrival reported · {istClock(app.arrived_at)}</Text>
          </View>
          <Text style={shiftStyles.note}>Waiting for hospital confirmation.</Text>
        </View>
      ) : null}
      {app.attendance_approved_at && (shift.phase === 'attendance_approved' || shift.phase === 'in_progress'
        || shift.phase === 'completed') ? (
          <View style={shiftStyles.ok}>
            <Ionicons name="checkmark-done" size={16} color={colors.teal} />
            <Text style={shiftStyles.okText}>
              Attendance approved{app.arrived_at ? ` · arrived ${istClock(app.arrived_at)}` : ''}
            </Text>
          </View>
        ) : null}
      {shift.phase === 'confirmed' ? (
        <Text style={shiftStyles.note}>
          “I’ve arrived” opens at {istDayClock(shift.arrival_opens_at)}.
          {shift.actions.cancel ? ` You can cancel until ${istDayClock(shift.cancel_deadline)}.` : ''}
        </Text>
      ) : null}
      {shift.phase === 'awaiting_attendance' ? (
        <Text style={shiftStyles.note}>The shift has ended. The hospital has not recorded attendance yet.</Text>
      ) : null}
      {shift.phase === 'no_show' ? (
        <Text style={[shiftStyles.note, { color: colors.redText }]}>
          No-show recorded by {shift.locum.employer_name} on {longDay(shift.locum.shift_date)}.
          {shift.strike?.dispute_status === 'open' ? ' Your dispute is with ForMeds for review.' : ''}
          {shift.strike?.status === 'removed' ? ' The strike was removed after review.' : ''}
        </Text>
      ) : null}
      {shift.phase === 'cancelled' && app.cancel_reason ? (
        <Text style={shiftStyles.note}>You cancelled on {istDayClock(app.cancelled_at)}.</Text>
      ) : null}
      {shift.review ? (
        <View style={styles.inline}>
          <Stars value={shift.review.overall} />
          <Text style={styles.muted}>Rated by the hospital{shift.review.review ? `: “${shift.review.review}”` : ''}</Text>
        </View>
      ) : null}

      <View style={shiftStyles.actions}>
        {shift.actions.arrive ? (
          <Button label="I've arrived" variant="secondary" onPress={onArrive} loading={busy === `arrive-${app.id}`}
            style={[shiftStyles.action, styles.arrive]} testID={`arrive-${app.id}`} />
        ) : null}
        <Button label="View shift" variant="outline" onPress={onOpen} style={shiftStyles.action} />
        {shift.actions.cancel ? (
          <Button label="Cancel shift" variant="danger" onPress={onCancel} style={shiftStyles.action}
            testID={`cancel-${app.id}`} />
        ) : null}
        {shift.actions.dispute ? (
          <Button label="Dispute no-show" variant="outline" onPress={onDispute} style={shiftStyles.action}
            testID={`dispute-${app.id}`} />
        ) : null}
      </View>
      {shift.phase === 'not_arrived' || (shift.phase === 'arrival_open' && !shift.actions.cancel) ? (
        <Text style={shiftStyles.note}>
          Cancellation is no longer available for this shift because it starts in less than 3 hours.
          Message the hospital if you cannot attend.
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  page: { padding: spacing.lg, paddingBottom: spacing.xxxl * 2 },
  stack: { gap: spacing.md },
  cardTitle: { ...typography.h3, color: colors.text },
  body: { ...typography.body, color: colors.text, lineHeight: 21 },
  strong: { ...typography.bodyStrong, color: colors.text },
  muted: { ...typography.caption, color: colors.textSecondary },
  kicker: { ...typography.small, color: colors.navy, fontFamily: fonts.body.semibold, textTransform: 'uppercase', letterSpacing: 0.6 },
  quote: { ...typography.body, color: colors.text, fontStyle: 'italic' },
  inline: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, flexWrap: 'wrap' },
  historyRow: { gap: 2, paddingVertical: spacing.sm, borderTopWidth: 1, borderTopColor: colors.borderLight },
  blocked: { borderColor: '#FECACA', backgroundColor: colors.redBg },
  blockedHead: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  blockedTitle: { ...typography.h3, color: colors.redText, flex: 1 },
  request: { borderColor: colors.navy, borderWidth: 1.5 },
  todayCard: { borderColor: colors.teal, borderWidth: 1.5 },
  arrive: { minHeight: 52 },
  notice: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm, backgroundColor: colors.tealBg,
    borderRadius: radius.lg, padding: spacing.md,
  },
  noticeText: { ...typography.label, color: colors.teal, flex: 1 },
});
