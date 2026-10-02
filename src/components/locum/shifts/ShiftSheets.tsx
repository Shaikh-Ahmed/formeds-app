import React, { useEffect, useState } from 'react';
import { StyleSheet, Switch, Text, View } from 'react-native';
import { colors, spacing, typography, fonts, radius } from '../../../theme';
import { Button } from '../../Button';
import { FormInput } from '../../FormInput';
import { DateField, NumberField, TimeField } from '../../InputFields';
import { Sheet } from '../../Sheet';
import { ErrorBanner } from '../../States';
import { ChoiceChips } from '../ChoiceChips';
import { formatShiftHours, isOvernight } from '../LocumMeta';
import { todayString, validateAmount, validateDate, validateTimeRange } from '../../../utils/validation';
import { errorFields } from '../../../utils/api';
import {
  LOCUM_CANCEL_REASONS, type LocumCancelReason, type LocumShift, type UnblockCheckout,
} from '../../../types/locum';
import type { LocumRebookInput, LocumReviewInput } from '../../../api/locum';
import { istDayClock, longDay, rupees, StarInput } from './ShiftBits';

/**
 * The Shifts sheets. Each asks for the one thing the server needs and nothing
 * the server decides: no times (the server clock is the clock), no amounts
 * (the unblock fee comes from the block), no strike counts.
 */

const flex = { flex: 1 };

// ── Cancel (professional) ────────────────────────────────────────────────────

export function CancelShiftSheet({ shift, onClose, onSubmit, submitting, error }: {
  shift: LocumShift | null;
  onClose: () => void;
  onSubmit: (reason: LocumCancelReason, details: string) => void;
  submitting?: boolean;
  error?: string | null;
}) {
  const [reason, setReason] = useState<LocumCancelReason | null>(null);
  const [details, setDetails] = useState('');
  const [local, setLocal] = useState<string | null>(null);
  useEffect(() => { setReason(null); setDetails(''); setLocal(null); }, [shift]);

  const submit = () => {
    if (!reason) { setLocal('Choose a reason.'); return; }
    if (reason === 'other' && details.trim().length < 5) {
      setLocal('Tell the hospital briefly why you are cancelling.'); return;
    }
    setLocal(null);
    onSubmit(reason, details.trim());
  };

  return (
    <Sheet visible={!!shift} onClose={onClose} title="Cancel this shift?" testID="cancel-shift-sheet"
      footer={<>
        <Button label="Keep shift" variant="outline" onPress={onClose} style={flex} />
        <Button label="Cancel shift" loadingLabel="Cancelling…" variant="danger" onPress={submit} loading={submitting} style={flex}
          testID="cancel-shift-confirm" />
      </>}>
      {shift ? (
        <View style={styles.body}>
          <Text style={styles.text}>
            {shift.locum.employer_name} · {longDay(shift.locum.shift_date)} · {formatShiftHours(shift.locum)}
          </Text>
          <Text style={styles.hint}>
            You can cancel until {istDayClock(shift.cancel_deadline)}, 3 hours before the shift. The hospital is told
            straight away and the opening goes back to them. A cancellation is not a no-show strike.
          </Text>
          <ChoiceChips label="Reason" choices={LOCUM_CANCEL_REASONS} value={reason}
            onChange={setReason} testID="cancel-reason" />
          {reason === 'other' ? (
            <FormInput label="What happened? *" value={details} onChangeText={setDetails} maxLength={300}
              multiline rows={2} testID="cancel-details" />
          ) : null}
          <ErrorBanner message={local || error} />
        </View>
      ) : null}
    </Sheet>
  );
}

// ── Confirm no-show (hospital) ───────────────────────────────────────────────

export function NoShowSheet({ shift, onClose, onConfirm, submitting, error }: {
  shift: LocumShift | null;
  onClose: () => void;
  onConfirm: () => void;
  submitting?: boolean;
  error?: string | null;
}) {
  return (
    <Sheet visible={!!shift} onClose={onClose} title="Confirm no-show?" testID="no-show-sheet"
      footer={<>
        <Button label="Cancel" variant="outline" onPress={onClose} style={flex} />
        <Button label="Confirm no-show" variant="danger" onPress={onConfirm} loading={submitting} style={flex}
          testID="no-show-confirm" />
      </>}>
      {shift ? (
        <View style={styles.body}>
          <Text style={styles.strong}>{shift.professional?.name}</Text>
          <Text style={styles.text}>
            {shift.locum.specialty} · {longDay(shift.locum.shift_date)} · {formatShiftHours(shift.locum)}
          </Text>
          {shift.application.arrived_at ? (
            <Text style={[styles.hint, { color: colors.redText }]}>
              They reported arriving at {istDayClock(shift.application.arrived_at)}. Only confirm if they were not there.
            </Text>
          ) : null}
          <Text style={styles.hint}>
            Confirming a no-show will record this as an attendance incident and may add a strike to the
            professional’s Locum reliability record. They are told, and can ask ForMeds to review it.
          </Text>
          <ErrorBanner message={error} />
        </View>
      ) : null}
    </Sheet>
  );
}

// ── Review (hospital) ────────────────────────────────────────────────────────

const PARTS: { key: keyof Omit<LocumReviewInput, 'overall' | 'review'>; label: string }[] = [
  { key: 'punctuality', label: 'Punctuality' },
  { key: 'professionalism', label: 'Professionalism' },
  { key: 'communication', label: 'Communication' },
  { key: 'clinical', label: 'Clinical performance' },
];

export function ReviewSheet({ shift, onClose, onSubmit, submitting, error }: {
  shift: LocumShift | null;
  onClose: () => void;
  onSubmit: (data: LocumReviewInput) => void;
  submitting?: boolean;
  error?: string | null;
}) {
  const [overall, setOverall] = useState(0);
  const [parts, setParts] = useState<Record<string, number>>({});
  const [review, setReview] = useState('');
  const [local, setLocal] = useState<string | null>(null);
  useEffect(() => { setOverall(0); setParts({}); setReview(''); setLocal(null); }, [shift]);

  const submit = () => {
    if (!overall) { setLocal('Choose an overall rating.'); return; }
    setLocal(null);
    const data: LocumReviewInput = { overall, review: review.trim() };
    for (const p of PARTS) if (parts[p.key]) data[p.key] = parts[p.key];
    onSubmit(data);
  };

  return (
    <Sheet visible={!!shift} onClose={onClose} title="Rate professional" testID="review-sheet"
      footer={<>
        <Button label="Cancel" variant="outline" onPress={onClose} style={flex} />
        <Button label="Submit review" loadingLabel="Submitting…" onPress={submit} loading={submitting} style={flex} testID="review-submit" />
      </>}>
      {shift ? (
        <View style={styles.body}>
          <Text style={styles.strong}>{shift.professional?.name}</Text>
          <Text style={styles.text}>
            {shift.locum.specialty} · {longDay(shift.locum.shift_date)} · {formatShiftHours(shift.locum)}
          </Text>
          <StarInput label="Overall rating *" value={overall} onChange={setOverall} testID="review-overall" />
          <View style={styles.parts}>
            {PARTS.map(p => (
              <View key={p.key} style={styles.part}>
                <StarInput label={p.label} value={parts[p.key] || 0}
                  onChange={v => setParts(prev => ({ ...prev, [p.key]: v }))} testID={`review-${p.key}`} />
              </View>
            ))}
          </View>
          <FormInput label="Review (optional)" value={review} onChangeText={setReview} maxLength={1000}
            multiline rows={3} testID="review-text" />
          <Text style={styles.hint}>The professional sees this review. Other hospitals only see the star average.</Text>
          <ErrorBanner message={local || error} />
        </View>
      ) : null}
    </Sheet>
  );
}

// ── Dispute a no-show (professional) ─────────────────────────────────────────

export function DisputeSheet({ shift, onClose, onSubmit, submitting, error }: {
  shift: LocumShift | null;
  onClose: () => void;
  onSubmit: (reason: string) => void;
  submitting?: boolean;
  error?: string | null;
}) {
  const [reason, setReason] = useState('');
  const [local, setLocal] = useState<string | null>(null);
  useEffect(() => { setReason(''); setLocal(null); }, [shift]);
  const submit = () => {
    if (reason.trim().length < 10) { setLocal('Explain what happened in at least 10 characters.'); return; }
    setLocal(null);
    onSubmit(reason.trim());
  };
  return (
    <Sheet visible={!!shift} onClose={onClose} title="Dispute this no-show" testID="dispute-sheet"
      footer={<>
        <Button label="Cancel" variant="outline" onPress={onClose} style={flex} />
        <Button label="Send to ForMeds" loadingLabel="Sending…" onPress={submit} loading={submitting} style={flex} testID="dispute-submit" />
      </>}>
      {shift ? (
        <View style={styles.body}>
          <Text style={styles.text}>
            No-show recorded by {shift.locum.employer_name} on {longDay(shift.locum.shift_date)}.
          </Text>
          <Text style={styles.hint}>
            A ForMeds admin reviews the shift’s full record — your arrival report, the hospital’s actions and the
            timeline. The strike stays until they decide.
          </Text>
          <FormInput label="What happened? *" value={reason} onChangeText={setReason} maxLength={1000}
            multiline rows={4} testID="dispute-reason" />
          <ErrorBanner message={local || error} />
        </View>
      ) : null}
    </Sheet>
  );
}

// ── Unblock payment (professional) ───────────────────────────────────────────

export function UnblockSheet({ visible, checkout, onClose, onPay, paying, error }: {
  visible: boolean;
  checkout: UnblockCheckout | null;
  onClose: () => void;
  onPay: (outcome: 'success' | 'failure', method: 'card' | 'upi' | 'netbanking') => void;
  paying?: boolean;
  error?: string | null;
}) {
  const [method, setMethod] = useState<'card' | 'upi' | 'netbanking'>('upi');
  return (
    <Sheet visible={visible} onClose={onClose} title="Restore Locum access" testID="unblock-sheet"
      footer={checkout ? (
        <>
          {checkout.demo ? (
            <Button label="Simulate failure" variant="outline" onPress={() => onPay('failure', method)}
              style={flex} testID="unblock-fail" />
          ) : null}
          <Button label={`Pay ${rupees(checkout.amount)}`} loadingLabel="Processing…" onPress={() => onPay('success', method)}
            loading={paying} style={flex} testID="unblock-pay" />
        </>
      ) : undefined}>
      <View style={styles.body}>
        {checkout ? (
          <>
            <View style={styles.amountBox}>
              <Text style={styles.amountLabel}>Unblock amount</Text>
              <Text style={styles.amount} testID="unblock-amount">{rupees(checkout.amount)}</Text>
              <Text style={styles.hint}>The highest pay among the three shifts that were missed.</Text>
            </View>
            <ChoiceChips label="Pay with" value={method} onChange={v => v && setMethod(v)} testID="unblock-method"
              choices={[{ value: 'upi', label: 'UPI' }, { value: 'card', label: 'Card' },
                { value: 'netbanking', label: 'Netbanking' }]} />
            {checkout.demo ? (
              <Text style={styles.hint}>
                Demo payment: no money moves. Your access is restored only after the payment is confirmed by the
                server.
              </Text>
            ) : null}
          </>
        ) : <Text style={styles.hint}>Preparing your payment…</Text>}
        <ErrorBanner message={error} />
      </View>
    </Sheet>
  );
}

// ── Request again (hospital) ─────────────────────────────────────────────────

const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

export function RebookSheet({ shift, onClose, onSubmit, submitting, error, needsAvailabilityConfirm }: {
  shift: LocumShift | null;
  onClose: () => void;
  onSubmit: (data: LocumRebookInput) => void;
  submitting?: boolean;
  error?: unknown;
  /** Set after the server said the time is outside their availability. */
  needsAvailabilityConfirm?: boolean;
}) {
  const [date, setDate] = useState('');
  const [start, setStart] = useState('');
  const [end, setEnd] = useState('');
  const [pay, setPay] = useState('');
  const [message, setMessage] = useState('');
  const [interview, setInterview] = useState(false);
  const [errors, setErrors] = useState<Record<string, string | null>>({});

  useEffect(() => {
    if (!shift) return;
    setDate('');
    setStart(shift.locum.start_time);
    setEnd(shift.locum.end_time);
    setPay(shift.locum.pay_amount ? String(shift.locum.pay_amount) : '');
    setMessage('We would like you to cover another shift with us.');
    setInterview(false);
    setErrors({});
  }, [shift]);

  // Field-level 422s land on their field; anything else is shown as a banner.
  const fields = errorFields(error);
  const server = { date: fields.shift_date, start: fields.start_time, end: fields.end_time, pay: fields.pay_amount };
  const submit = (allowOutside = false) => {
    const next = {
      date: validateDate(date, 'Shift date', { required: true, notPast: true }),
      time: validateTimeRange(start, end, { allowOvernight: true }),
      pay: validateAmount(pay, 'Pay', { required: true, max: 10_000_000 }),
    };
    setErrors(next);
    if (Object.values(next).some(Boolean) || !shift) return;
    onSubmit({
      source_application_id: shift.application.id,
      shift_date: date, start_time: start, end_time: end,
      pay_amount: Number(pay), pay_type: shift.locum.pay_type === 'negotiable' ? 'per_shift' : shift.locum.pay_type,
      shift_type: shift.locum.shift_type, message: message.trim(),
      require_interview: interview, allow_outside_availability: allowOutside,
    });
  };
  const serverMessage = error && !Object.keys(fields).length ? (error as any)?.message ?? null : null;

  return (
    <Sheet visible={!!shift} onClose={onClose} title="Request again" testID="rebook-sheet"
      footer={<>
        <Button label="Cancel" variant="outline" onPress={onClose} style={flex} />
        {needsAvailabilityConfirm ? (
          <Button label="Send anyway" loadingLabel="Sending…" onPress={() => submit(true)} loading={submitting} style={flex}
            testID="rebook-send-anyway" />
        ) : (
          <Button label="Send request" loadingLabel="Sending…" onPress={() => submit(false)} loading={submitting} style={flex}
            testID="rebook-send" />
        )}
      </>}>
      {shift ? (
        <View style={styles.body}>
          <Text style={styles.strong}>{shift.professional?.name}</Text>
          <Text style={styles.hint}>
            A direct request for a new shift at {shift.locum.employer_name}. It is not posted publicly, and no new
            interview is needed unless you ask for one. They accept or decline.
          </Text>
          <DateField label="Date *" value={date} onChange={setDate} min={todayString()}
            error={errors.date || server.date} testID="rebook-date" />
          <View style={styles.row}>
            <View style={flex}>
              <TimeField label="Start *" value={start} onChange={setStart} error={errors.time || server.start}
                testID="rebook-start" />
            </View>
            <View style={flex}>
              <TimeField label="End *" value={end} onChange={setEnd} error={server.end} testID="rebook-end" />
            </View>
          </View>
          {TIME_RE.test(start) && TIME_RE.test(end) && isOvernight({ start_time: start, end_time: end }) ? (
            <Text style={styles.hint}>Ends the next morning.</Text>
          ) : null}
          <NumberField label={`Pay (${shift.locum.pay_type === 'per_hour' ? 'per hour' : 'per shift'}) *`}
            prefix="₹" value={pay} onChangeText={setPay} error={errors.pay || server.pay} testID="rebook-pay" />
          <FormInput label="Message" value={message} onChangeText={setMessage} maxLength={500} multiline rows={2}
            testID="rebook-message" />
          <View style={styles.switchRow}>
            <View style={flex}>
              <Text style={styles.strong}>Ask for an interview first</Text>
              <Text style={styles.hint}>Off: accepting confirms the shift. On: they start at the interview step.</Text>
            </View>
            <Switch value={interview} onValueChange={setInterview} testID="rebook-interview"
              accessibilityLabel="Ask for an interview first" />
          </View>
          <ErrorBanner message={serverMessage} />
        </View>
      ) : null}
    </Sheet>
  );
}

const styles = StyleSheet.create({
  body: { paddingHorizontal: spacing.xl, paddingBottom: spacing.md, gap: spacing.md },
  text: { ...typography.body, color: colors.text },
  strong: { ...typography.bodyStrong, color: colors.text },
  hint: { ...typography.caption, color: colors.textSecondary, lineHeight: 19 },
  parts: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
  part: { flexBasis: 220, flexGrow: 1 },
  row: { flexDirection: 'row', gap: spacing.md },
  switchRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  amountBox: {
    backgroundColor: colors.bg, borderRadius: radius.lg, padding: spacing.lg, alignItems: 'center', gap: spacing.xs,
  },
  amountLabel: { ...typography.caption, color: colors.textSecondary },
  amount: { fontSize: 32, fontFamily: fonts.heading.bold, color: colors.navy },
});
