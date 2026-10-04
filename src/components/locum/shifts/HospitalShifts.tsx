import React, { useCallback, useState } from 'react';
import { useSubmit } from '../../../hooks/useSubmit';
import { RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../../context/AuthContext';
import { colors, radius, spacing, typography } from '../../../theme';
import { Avatar } from '../../Avatar';
import { Button } from '../../Button';
import { EmptyState, ErrorBanner, ErrorState } from '../../States';
import { Skeleton } from '../../Skeleton';
import { JobBadge } from '../../jobs/JobMeta';
import { ChoiceChips } from '../ChoiceChips';
import { BADGE_TONE, formatRoleLine, formatShiftDay, formatShiftHours } from '../LocumMeta';
import {
  approveAttendance, cancelRebooking, fetchManagedShifts, reportNoShow, requestAgain, reviewShift,
  type LocumRebookInput, type LocumReviewInput,
} from '../../../api/locum';
import {
  LOCUM_CANCEL_REASONS, LOCUM_REBOOKING_META, type LocumRebooking, type LocumShift, type ManagedShifts,
} from '../../../types/locum';
import {
  istClock, istDayClock, longDay, PhaseBadge, ReliabilityLine, rupees, shiftStyles, Stars,
} from './ShiftBits';
import { NoShowSheet, RebookSheet, ReviewSheet } from './ShiftSheets';

type Tab = 'today' | 'upcoming' | 'completed' | 'issues' | 'requests';

const EMPTY: Record<Tab, string> = {
  today: 'Nobody is booked for today. Selected professionals appear here on the day of their shift.',
  upcoming: 'Professionals you select appear here until their shift day.',
  completed: 'Attended shifts land here, ready to rate and to request again.',
  issues: 'No-shows and cancellations, by either side.',
  requests: 'Requests you send to professionals you have worked with.',
};

/**
 * The hospital's attendance board. "Today" is the working view -- who has
 * arrived, who has not, one tap to approve or flag -- and Completed is where
 * repeat hiring starts: Rate, then Request again.
 */
export function HospitalShifts() {
  const { token } = useAuth();
  const router = useRouter();
  const [data, setData] = useState<ManagedShifts | null>(null);
  const [tab, setTab] = useState<Tab>('today');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  // One action at a time, whatever is tapped twice or in quick succession.
  const guard = useSubmit();
  const [flagging, setFlagging] = useState<LocumShift | null>(null);
  const [rating, setRating] = useState<LocumShift | null>(null);
  const [rebooking, setRebooking] = useState<LocumShift | null>(null);
  const [sheetError, setSheetError] = useState<unknown>(null);
  const [outsideAvailability, setOutsideAvailability] = useState(false);

  const load = useCallback(async () => {
    if (!token) { setLoading(false); return; }
    setError(null);
    try {
      setData(await fetchManagedShifts(token));
    } catch (e: any) {
      setError(e?.message || 'Could not load shifts.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [token]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const act = (key: string, fn: () => Promise<unknown>, done: string, fallback: string) => guard.run(async key => {
    if (!token) return;
    setBusy(key); setActionError(null); setNotice(null);
    try {
      await fn();
      setNotice(done);
      await load();
    } catch (e: any) {
      setActionError(e?.message || fallback);
    } finally { setBusy(null); }
  });

  const confirmNoShow = () => guard.run(async () => {
    if (!token || !flagging) return;
    setBusy('no-show'); setSheetError(null);
    try {
      await reportNoShow(token, flagging.application.id);
      setFlagging(null);
      setNotice('No-show recorded. The professional has been notified.');
      await load();
    } catch (e: any) {
      setSheetError(e);
    } finally { setBusy(null); }
  });

  const submitReview = (review: LocumReviewInput) => guard.run(async key => {
    if (!token || !rating) return;
    setBusy('review'); setSheetError(null);
    try {
      await reviewShift(token, rating.application.id, review, key);
      setRating(null);
      setNotice('Review submitted.');
      await load();
    } catch (e: any) {
      setSheetError(e);
    } finally { setBusy(null); }
  }, { app: rating?.application.id, review });

  const sendRequest = (input: LocumRebookInput) => guard.run(async key => {
    if (!token) return;
    setBusy('rebook'); setSheetError(null);
    try {
      await requestAgain(token, input, key);
      setRebooking(null);
      setOutsideAvailability(false);
      setNotice('Request sent. You will be notified when they answer.');
      setTab('requests');
      await load();
    } catch (e: any) {
      if (e?.code === 'outside_availability') setOutsideAvailability(true);
      setSheetError(e);
    } finally { setBusy(null); }
  }, input);

  const counts: Record<Tab, number> = {
    today: data?.today.length ?? 0, upcoming: data?.upcoming.length ?? 0,
    completed: data?.completed.length ?? 0, issues: data?.issues.length ?? 0,
    requests: data?.requests.filter(r => r.status === 'sent' || r.status === 'viewed').length ?? 0,
  };
  const labels: Record<Tab, string> = {
    today: "Today's locums", upcoming: 'Upcoming', completed: 'Completed', issues: 'Issues', requests: 'Requests',
  };

  return (
    <ScrollView contentContainerStyle={styles.page}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }}
        tintColor={colors.navy} />}>
      <View style={styles.stack}>
        <ChoiceChips value={tab} onChange={v => v && setTab(v)} testID="hospital-shift-tab"
          choices={(Object.keys(labels) as Tab[]).map(t => ({
            value: t, label: counts[t] ? `${labels[t]} ${counts[t]}` : labels[t],
          }))} />
        {data?.needs_action ? (
          <View style={styles.alert} testID="needs-action">
            <Ionicons name="alert-circle" size={18} color={colors.warning} />
            <Text style={styles.alertText}>
              {data.needs_action} attendance {data.needs_action === 1 ? 'decision' : 'decisions'} waiting today
            </Text>
          </View>
        ) : null}
        {notice ? (
          <View style={styles.notice} accessibilityLiveRegion="polite">
            <Ionicons name="checkmark-circle" size={18} color={colors.teal} />
            <Text style={styles.noticeText}>{notice}</Text>
          </View>
        ) : null}
        <ErrorBanner message={actionError} />

        {loading ? (
          [0, 1].map(i => (
            <View key={i} style={shiftStyles.card}>
              <Skeleton height={14} width="50%" /><Skeleton height={12} width="70%" /><Skeleton height={36} />
            </View>
          ))
        ) : error ? (
          <ErrorState message={error} onRetry={load} />
        ) : data && tab === 'requests' ? (
          data.requests.length ? data.requests.map(rb => (
            <RequestRow key={rb.id} rb={rb} busy={busy}
              onWithdraw={() => act(`withdraw-${rb.id}`, () => cancelRebooking(token!, rb.id),
                'Request withdrawn.', 'Could not withdraw this request.')} />
          )) : <EmptyState icon="repeat-outline" title="No requests yet" hint={EMPTY.requests} />
        ) : data ? (
          (data[tab] as LocumShift[]).length ? (data[tab] as LocumShift[]).map(shift => (
            <ShiftRow key={shift.application.id} shift={shift} busy={busy}
              onApprove={() => act(`approve-${shift.application.id}`,
                () => approveAttendance(token!, shift.application.id),
                'Attendance approved.', 'Attendance could not be approved.')}
              onFlag={() => { setSheetError(null); setFlagging(shift); }}
              onRate={() => { setSheetError(null); setRating(shift); }}
              onRebook={() => { setSheetError(null); setOutsideAvailability(false); setRebooking(shift); }}
              onOpen={() => router.push(`/jobs/locum/manage/${shift.locum.id}` as any)} />
          )) : <EmptyState icon="calendar-outline" title="Nothing here" hint={EMPTY[tab]} />
        ) : null}
      </View>

      <NoShowSheet shift={flagging} onClose={() => setFlagging(null)} onConfirm={confirmNoShow}
        submitting={busy === 'no-show'} error={(sheetError as any)?.message ?? null} />
      <ReviewSheet shift={rating} onClose={() => setRating(null)} onSubmit={submitReview}
        submitting={busy === 'review'} error={(sheetError as any)?.message ?? null} />
      <RebookSheet shift={rebooking} onClose={() => setRebooking(null)} onSubmit={sendRequest}
        submitting={busy === 'rebook'} error={sheetError} needsAvailabilityConfirm={outsideAvailability} />
    </ScrollView>
  );
}

function ShiftRow({ shift, busy, onApprove, onFlag, onRate, onRebook, onOpen }: {
  shift: LocumShift; busy: string | null;
  onApprove: () => void; onFlag: () => void; onRate: () => void; onRebook: () => void; onOpen: () => void;
}) {
  const app = shift.application;
  const who = shift.professional;
  const cancelReason = LOCUM_CANCEL_REASONS.find(r => r.value === app.cancel_reason)?.label;
  return (
    <View style={shiftStyles.card} testID={`hshift-${app.id}`}>
      <View style={styles.person}>
        <Avatar uri={who?.avatar} name={who?.name ?? ''} size={40} />
        <View style={styles.flex}>
          <Text style={styles.name} numberOfLines={1}>{who?.name ?? 'Professional'}</Text>
          <ReliabilityLine summary={shift.reliability} />
        </View>
        <PhaseBadge phase={shift.phase} />
      </View>
      <View style={styles.grid}>
        <Field label="Shift" value={`${formatRoleLine(shift.locum)}`} />
        <Field label="When" value={`${formatShiftDay(shift.locum.shift_date)} · ${formatShiftHours(shift.locum)}`} />
        <Field label="Arrival" value={app.arrived_at ? istClock(app.arrived_at) : '—'} testID={`arrival-${app.id}`} />
        <Field label="Pay" value={rupees(shift.locum.shift_pay)} />
      </View>
      {shift.phase === 'not_arrived' && !shift.actions.flag_no_show ? (
        <Text style={shiftStyles.note}>You can flag a no-show from {istDayClock(shift.no_show_from)}.</Text>
      ) : null}
      {shift.phase === 'cancelled' ? (
        <Text style={shiftStyles.note}>
          Cancelled by the professional on {istDayClock(app.cancelled_at)}
          {cancelReason ? ` · ${cancelReason}` : ''}{app.cancel_details ? ` — “${app.cancel_details}”` : ''}
        </Text>
      ) : null}
      {shift.phase === 'no_show' && shift.strike?.dispute_status === 'open' ? (
        <Text style={shiftStyles.note}>The professional disputed this no-show. ForMeds is reviewing it.</Text>
      ) : null}
      {shift.review ? (
        <View style={styles.inline}>
          <Stars value={shift.review.overall} />
          <Text style={shiftStyles.note}>You rated this shift{shift.review.review ? `: “${shift.review.review}”` : ''}</Text>
        </View>
      ) : null}
      <View style={shiftStyles.actions}>
        {shift.actions.approve_attendance ? (
          <Button label="Approve attendance" variant="secondary" onPress={onApprove}
            loading={busy === `approve-${app.id}`} style={shiftStyles.action} testID={`approve-${app.id}`} />
        ) : null}
        {shift.actions.flag_no_show ? (
          <Button label="Flag no-show" variant="danger" onPress={onFlag} style={shiftStyles.action}
            testID={`flag-${app.id}`} />
        ) : null}
        {shift.actions.review ? (
          <Button label="Rate professional" onPress={onRate} style={shiftStyles.action} testID={`rate-${app.id}`} />
        ) : null}
        {shift.actions.rebook ? (
          <Button label="Request again" variant="outline" onPress={onRebook} style={shiftStyles.action}
            testID={`rebook-${app.id}`} />
        ) : null}
        <Button label="Open locum" variant="outline" onPress={onOpen} style={shiftStyles.action} />
      </View>
    </View>
  );
}

function RequestRow({ rb, busy, onWithdraw }: { rb: LocumRebooking; busy: string | null; onWithdraw: () => void }) {
  const meta = LOCUM_REBOOKING_META[rb.status];
  const open = rb.status === 'sent' || rb.status === 'viewed';
  return (
    <View style={shiftStyles.card} testID={`hrequest-${rb.id}`}>
      <View style={styles.person}>
        <Avatar uri={rb.professional?.avatar} name={rb.professional?.name ?? ''} size={40} />
        <View style={styles.flex}>
          <Text style={styles.name} numberOfLines={1}>{rb.professional?.name ?? 'Professional'}</Text>
          {rb.locum ? (
            <Text style={shiftStyles.note}>
              {rb.locum.specialty} · {longDay(rb.locum.shift_date)} · {formatShiftHours(rb.locum)} · {rupees(rb.locum.shift_pay)}
            </Text>
          ) : null}
        </View>
        <JobBadge label={meta.label} icon={meta.icon as any} tone={BADGE_TONE[meta.tone]} />
      </View>
      {open ? <Text style={shiftStyles.note}>Open until {istDayClock(rb.expires_at)}.</Text> : null}
      {rb.response_note ? <Text style={shiftStyles.note}>“{rb.response_note}”</Text> : null}
      {open ? (
        <View style={shiftStyles.actions}>
          <Button label="Withdraw request" variant="outline" onPress={onWithdraw}
            loading={busy === `withdraw-${rb.id}`} style={shiftStyles.action} />
        </View>
      ) : null}
    </View>
  );
}

function Field({ label, value, testID }: { label: string; value: string; testID?: string }) {
  return (
    <View style={styles.field} testID={testID}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <Text style={styles.fieldValue} numberOfLines={2}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { padding: spacing.lg, paddingBottom: spacing.xxxl * 2 },
  stack: { gap: spacing.md },
  flex: { flex: 1, minWidth: 0 },
  person: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  name: { ...typography.h3, color: colors.text },
  inline: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, flexWrap: 'wrap' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
  field: { flexBasis: 130, flexGrow: 1, gap: 2 },
  fieldLabel: { ...typography.small, color: colors.textSecondary },
  fieldValue: { ...typography.label, color: colors.text },
  alert: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm, backgroundColor: colors.warningBg,
    borderRadius: radius.lg, padding: spacing.md,
  },
  alertText: { ...typography.label, color: colors.text, flex: 1 },
  notice: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm, backgroundColor: colors.tealBg,
    borderRadius: radius.lg, padding: spacing.md,
  },
  noticeText: { ...typography.label, color: colors.teal, flex: 1 },
});
