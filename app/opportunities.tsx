import React, { useCallback, useEffect, useState } from 'react';
import { Alert, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../src/context/AuthContext';
import {
  Button, DateField, EmptyState, ErrorBanner, FormInput, LoadingState, SelectField, Sheet, TimeField, displayDate, displayTime,
} from '../src/components';
import { todayString, validateTimeRange } from '../src/utils/validation';
import { ChoiceChips } from '../src/components/locum/ChoiceChips';
import { colors, fonts, radius, spacing, typography } from '../src/theme';
import {
  Card, MultiChips, Notice, RecruiterScreen, ToggleRow, VerifiedRecruiterBadge, formatDate, recruiterStyles,
} from '../src/components/recruiters/RecruiterUI';
import { InviteStatus } from '../src/components/recruiters/InviteStatus';
import { formatShiftDay, formatShiftHours } from '../src/components/locum/LocumMeta';
import {
  blockRecruiter, declineInvitation, fetchAvailability, fetchCities, fetchDiscovery, fetchMyInvitations,
  markInvitationViewed, reportUser, saveAvailability, saveDiscovery,
} from '../src/api/recruiters';
import {
  WEEKDAYS, type AvailabilitySlot, type DiscoverySettings, type Invitation, type LocumRole,
} from '../src/types/recruiters';

type Tab = 'preferences' | 'availability' | 'invitations';
const LOCUM_ROLES: { value: LocumRole; label: string }[] = [
  { value: 'doctor', label: 'Doctor' }, { value: 'nurse', label: 'Nurse' }, { value: 'specialist', label: 'Specialist' },
  { value: 'allied_health', label: 'Allied health' }, { value: 'other', label: 'Other' },
];
const DISTANCES = ['5', '10', '25', '50', '100'] as const;
const FULL_DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

function confirm(title: string, message: string, onYes: () => void) {
  if (Platform.OS === 'web') {
    if (typeof window !== 'undefined' && window.confirm(`${title}\n\n${message}`)) onYes();
    return;
  }
  Alert.alert(title, message, [{ text: 'Cancel', style: 'cancel' }, { text: 'Continue', style: 'destructive', onPress: onYes }]);
}

/**
 * The professional's side of recruiting: whether (and how) they can be found,
 * when they can cover locum shifts, and the invitations they've received.
 * Everything is off until they turn it on.
 */
export default function OpportunitiesScreen() {
  const params = useLocalSearchParams<{ tab?: string }>();
  const { user } = useAuth();
  const [tab, setTab] = useState<Tab>((['preferences', 'availability', 'invitations'].includes(params.tab || '')
    ? params.tab : 'preferences') as Tab);

  const student = user?.role === 'student';
  if (user && user.role !== 'healthcare_professional' && !student) {
    return (
      <RecruiterScreen title="Opportunities">
        <Notice tone="neutral" title="For healthcare professionals"
          body="Discovery, locum availability and recruiter invitations are available on professional accounts." />
      </RecruiterScreen>
    );
  }

  // A student's career preferences: visibility and invitations to jobs and
  // internships. Locum availability is for registered professionals.
  const shown: Tab = student && tab === 'availability' ? 'preferences' : tab;
  return (
    <RecruiterScreen title={student ? 'Career preferences' : 'Opportunities'} testID="opportunities-screen">
      <ChoiceChips value={shown} onChange={v => v && setTab(v)} testID="opportunities-tabs" choices={[
        { value: 'preferences', label: 'Preferences', icon: 'options-outline' },
        ...(student ? [] : [{ value: 'availability' as const, label: 'Availability', icon: 'calendar-outline' as const }]),
        { value: 'invitations', label: 'Invitations', icon: 'mail-outline' },
      ]} />
      {shown === 'preferences' ? <Preferences student={student} /> : shown === 'availability' ? <Availability /> : <Invitations />}
    </RecruiterScreen>
  );
}

// ── Preferences ─────────────────────────────────────────────────────────────

function Preferences({ student = false }: { student?: boolean }) {
  const { token } = useAuth();
  const [s, setS] = useState<DiscoverySettings | null>(null);
  const [cities, setCities] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (!token) return;
    fetchDiscovery(token).then(setS).catch(e => setError(e?.message));
    fetchCities(token).then(setCities).catch(() => {});
  }, [token]);

  if (!s) return error ? <ErrorBanner message={error} /> : <LoadingState />;

  const update = (patch: Partial<DiscoverySettings>) => { setS({ ...s, ...patch }); setSaved(false); };
  const save = async () => {
    if (!token) return;
    setSaving(true); setError(null);
    try {
      const { city_known: _k, state: _s, ...all } = s;
      // A student never sends locum settings: the server refuses them.
      const { available_for_locum: _l, locum_alerts: _a, locum_roles: _r, ...studentBody } = all;
      setS(await saveDiscovery(token, (student ? studentBody : all) as typeof all));
      setSaved(true);
    } catch (e: any) {
      setError(e?.message || 'Could not save your preferences.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <Card title="Visibility" subtitle="All of these are off until you turn them on.">
        <ToggleRow label={student ? 'Open to internships and jobs' : 'Open to job opportunities'} value={s.open_to_jobs}
          onChange={v => update({ open_to_jobs: v })}
          hint={student ? "Signals you'd consider internships and roles open to students." : "Signals you'd consider new permanent or contract roles."}
          testID="toggle-open-to-jobs" />
        {student ? null : (
          <ToggleRow label="Available for locum shifts" value={s.available_for_locum}
            onChange={v => update({ available_for_locum: v })}
            hint="Lets us alert you to shifts that fit your availability." testID="toggle-locum" />
        )}
        <ToggleRow label="Discoverable by verified recruiters" value={s.recruiter_discovery}
          onChange={v => update({ recruiter_discovery: v })}
          hint="Verified recruiters can find your public profile and invite you to apply. They never see your email, phone or exact location."
          testID="toggle-discovery" />
      </Card>

      <Card title="Location" subtitle="We only ever show your city and an approximate distance.">
        <SelectField label={student ? 'City you study in' : 'City you work from'} value={s.city} onChange={city => update({ city })} options={cities}
          placeholder="Choose a city" searchPlaceholder="Search cities" testID="discovery-city" />
        {student ? null : <ChoiceChips label="Alert me about locum shifts within" value={String(s.max_distance_km) as typeof DISTANCES[number]}
          onChange={v => v && update({ max_distance_km: Number(v) })} testID="discovery-distance"
          choices={DISTANCES.map(d => ({ value: d, label: `${d} km` }))} />}
      </Card>

      {student ? null : (
        <Card title="Locum matching">
          <MultiChips label="Roles you cover" options={LOCUM_ROLES} value={s.locum_roles}
            onChange={v => update({ locum_roles: v })} testID="discovery-roles" />
          <Text style={recruiterStyles.muted}>Leave empty to hear about every role.</Text>
        </Card>
      )}

      <Card title="Alerts">
        {student ? null : (
          <ToggleRow label="Locum shift matches" value={s.locum_alerts === 'immediate'}
            onChange={v => update({ locum_alerts: v ? 'immediate' : 'off' })}
            hint="A notification when a new shift matches your role, distance and availability." testID="toggle-locum-alerts" />
        )}
        <ToggleRow label="Recruiter invitations" value={s.invitation_alerts === 'immediate'}
          onChange={v => update({ invitation_alerts: v ? 'immediate' : 'off' })} testID="toggle-invite-alerts" />
      </Card>

      <ErrorBanner message={error} />
      {saved ? <Text style={styles.saved} accessibilityLiveRegion="polite">Preferences saved</Text> : null}
      <Button label="Save preferences" onPress={save} loading={saving} testID="discovery-save" />
    </>
  );
}

// ── Availability ────────────────────────────────────────────────────────────

/** Minutes from midnight; an end at or before the start runs overnight. */
function span(start: string, end: string): [number, number] {
  const toMin = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3));
  const a = toMin(start);
  let b = toMin(end);
  if (b <= a) b += 24 * 60;
  return [a, b];
}

/** Would this window overlap one already on the same day (or date)? */
function overlaps(slots: AvailabilitySlot[], next: AvailabilitySlot): boolean {
  const [a, b] = span(next.start_time, next.end_time);
  return slots.some(s => s.kind === next.kind
    && (s.kind === 'weekly' ? s.weekday === next.weekday : s.on_date === next.on_date)
    && (() => { const [c, d] = span(s.start_time, s.end_time); return a < d && c < b; })());
}

function Availability() {
  const { token } = useAuth();
  const [slots, setSlots] = useState<AvailabilitySlot[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [adding, setAdding] = useState<number | null>(null);
  const [start, setStart] = useState('09:00');
  const [end, setEnd] = useState('17:00');
  const [saveError, setSaveError] = useState<string | null>(null);
  // Problems that belong to one input: shown under that input, not the section.
  const [fieldError, setFieldError] = useState<{ end?: string; date?: string; overrideEnd?: string }>({});
  const [override, setOverride] = useState({ on_date: '', available: false, allDay: true, start: '09:00', end: '17:00' });

  useEffect(() => {
    if (!token) return;
    fetchAvailability(token).then(setSlots).catch(e => { setError(e?.message); setSlots([]); });
  }, [token]);

  if (!slots) return <LoadingState />;

  const change = (next: AvailabilitySlot[]) => { setSlots(next); setSaved(false); };
  // Overnight windows are allowed (a night shift); the same start and end,
  // or a window overlapping one already on that day, are not.
  const addWeekly = (weekday: number) => {
    const problem = validateTimeRange(start, end, { allowOvernight: true });
    setFieldError({ end: problem ?? undefined });
    if (problem) { setError(null); return; }
    const slot: AvailabilitySlot = { kind: 'weekly', weekday, start_time: start, end_time: end, available: true };
    // An overlap involves two windows, not one input: it stays a section message.
    if (overlaps(slots, slot)) { setError(`Availability periods overlap on ${FULL_DAYS[weekday]}.`); return; }
    setError(null);
    change([...slots, slot]);
    setAdding(null);
  };
  const addOverride = () => {
    const dateProblem = !override.on_date ? 'Please choose the date.'
      : override.on_date < todayString() ? 'Availability exceptions cannot be in the past.' : null;
    const st = override.allDay ? '00:00' : override.start;
    const en = override.allDay ? '23:59' : override.end;
    const problem = override.allDay ? null : validateTimeRange(st, en, { allowOvernight: true });
    setFieldError({ date: dateProblem ?? undefined, overrideEnd: problem ?? undefined });
    if (dateProblem || problem) { setError(null); return; }
    const slot: AvailabilitySlot = { kind: 'date', on_date: override.on_date, start_time: st, end_time: en, available: override.available };
    if (overlaps(slots, slot)) { setError(`You already have an exception covering ${displayDate(override.on_date)}.`); return; }
    setError(null);
    change([...slots, slot]);
    setOverride({ ...override, on_date: '' });
  };
  const remove = (i: number) => change(slots.filter((_, j) => j !== i));
  const save = async () => {
    if (!token) return;
    setSaving(true); setError(null);
    setSaveError(null);
    try { setSlots(await saveAvailability(token, slots)); setSaved(true); } catch (e: any) {
      setSaveError(e?.message || 'Could not save your availability.');
    } finally { setSaving(false); }
  };

  const label = (s: AvailabilitySlot) =>
    s.start_time === '00:00' && s.end_time === '23:59' ? 'All day'
      : `${displayTime(s.start_time)} – ${displayTime(s.end_time)}${s.end_time < s.start_time ? ' (overnight)' : ''}`;
  const overrides = slots.map((s, i) => ({ s, i })).filter(x => x.s.kind === 'date')
    .sort((a, b) => String(a.s.on_date).localeCompare(String(b.s.on_date)));

  return (
    <>
      <Notice tone="neutral" title="How matching works"
        body="We alert you to a locum shift only when the whole shift fits inside your availability. With no schedule set, any time counts." />

      <Card title="Weekly availability" subtitle="Add as many windows per day as you like. An end before the start runs overnight.">
        {WEEKDAYS.map((day, weekday) => {
          const mine = slots.map((s, i) => ({ s, i })).filter(x => x.s.kind === 'weekly' && x.s.weekday === weekday);
          return (
            <View key={day} style={styles.dayRow} testID={`avail-day-${weekday}`}>
              <Text style={styles.day}>{day}</Text>
              <View style={styles.windows}>
                {mine.length === 0 && adding !== weekday ? <Text style={recruiterStyles.muted}>Not available</Text> : null}
                {mine.map(({ s, i }) => (
                  <Pressable key={i} onPress={() => remove(i)} style={styles.window} accessibilityRole="button"
                    accessibilityLabel={`Remove ${day} ${label(s)}`}>
                    <Text style={styles.windowText}>{label(s)}</Text>
                    <Ionicons name="close" size={14} color={colors.navy} />
                  </Pressable>
                ))}
                {adding === weekday ? (
                  <View style={styles.addBox}>
                    <View style={styles.addRow}>
                      <View style={styles.timeCol}>
                        <TimeField label="From" value={start} onChange={setStart} testID="avail-start" />
                      </View>
                      <View style={styles.timeCol}>
                        <TimeField label="To" value={end} testID="avail-end" error={fieldError.end}
                          onChange={v => { setEnd(v); setFieldError(f => ({ ...f, end: undefined })); }} />
                      </View>
                    </View>
                    {error ? <ErrorBanner message={error} /> : null}
                    <View style={styles.addRow}>
                      <Pressable onPress={() => addWeekly(weekday)} style={styles.addBtn} accessibilityRole="button"
                        accessibilityLabel="Add window" testID="avail-add-confirm">
                        <Text style={styles.addText}>Add</Text>
                      </Pressable>
                      <Pressable onPress={() => { setAdding(null); setError(null); }} accessibilityRole="button"
                        accessibilityLabel="Cancel" hitSlop={8}>
                        <Text style={recruiterStyles.link}>Cancel</Text>
                      </Pressable>
                    </View>
                  </View>
                ) : (
                  <Pressable onPress={() => { setAdding(weekday); setError(null); }} style={styles.plus} accessibilityRole="button"
                    accessibilityLabel={`Add a window on ${day}`} testID={`avail-add-${weekday}`}>
                    <Ionicons name="add" size={16} color={colors.teal} />
                  </Pressable>
                )}
              </View>
            </View>
          );
        })}
      </Card>

      <Card title="Date exceptions" subtitle="Block out leave, or open up a day you're not normally free.">
        {overrides.length === 0 ? <Text style={recruiterStyles.muted}>No exceptions.</Text> : overrides.map(({ s, i }) => (
          <View key={i} style={styles.overrideRow}>
            <Ionicons name={s.available ? 'checkmark-circle-outline' : 'remove-circle-outline'} size={18}
              color={s.available ? colors.teal : colors.redText} />
            <Text style={[recruiterStyles.body, { flex: 1 }]}>
              {displayDate(String(s.on_date))} · {s.available ? 'Available' : 'Unavailable'} · {label(s)}
            </Text>
            <Pressable onPress={() => remove(i)} accessibilityRole="button" accessibilityLabel="Remove exception" hitSlop={8}>
              <Ionicons name="trash-outline" size={18} color={colors.textSecondary} />
            </Pressable>
          </View>
        ))}
        <View style={styles.overrideForm}>
          <DateField label="Date" value={override.on_date} min={todayString()} testID="override-date"
            error={fieldError.date}
            onChange={v => { setOverride({ ...override, on_date: v }); setFieldError(f => ({ ...f, date: undefined })); }} />
          <ChoiceChips value={override.available ? 'yes' : 'no'} testID="override-kind"
            onChange={v => v && setOverride({ ...override, available: v === 'yes' })}
            choices={[{ value: 'no', label: 'Unavailable' }, { value: 'yes', label: 'Available' }]} />
          <ToggleRow label="All day" value={override.allDay} onChange={v => setOverride({ ...override, allDay: v })} />
          {!override.allDay ? (
            <View style={[styles.addRow, { marginTop: spacing.sm }]}>
              <View style={styles.timeCol}>
                <TimeField label="From" value={override.start} onChange={v => setOverride({ ...override, start: v })} />
              </View>
              <View style={styles.timeCol}>
                <TimeField label="To" value={override.end} error={fieldError.overrideEnd}
                  onChange={v => { setOverride({ ...override, end: v }); setFieldError(f => ({ ...f, overrideEnd: undefined })); }} />
              </View>
            </View>
          ) : null}
          {error && adding === null ? <ErrorBanner message={error} /> : null}
          <Button label="Add exception" variant="outline" onPress={addOverride} style={{ marginTop: spacing.md }}
            testID="override-add" />
        </View>
      </Card>

      <ErrorBanner message={saveError} />
      {saved ? <Text style={styles.saved} accessibilityLiveRegion="polite">Availability saved</Text> : null}
      <Button label="Save availability" onPress={save} loading={saving} testID="avail-save" />
    </>
  );
}

// ── Invitations ─────────────────────────────────────────────────────────────

const REPORT_REASONS = [
  { value: 'spam', label: 'Spam' }, { value: 'harassment', label: 'Harassment' },
  { value: 'fraud', label: 'Fraud / fake job' }, { value: 'inappropriate', label: 'Inappropriate' },
  { value: 'other', label: 'Other' },
] as const;

function Invitations() {
  const { token } = useAuth();
  const router = useRouter();
  const [items, setItems] = useState<Invitation[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reporting, setReporting] = useState<Invitation | null>(null);
  const [reason, setReason] = useState<typeof REPORT_REASONS[number]['value']>('spam');
  const [details, setDetails] = useState('');
  const [notice, setNotice] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!token) return;
    try { setItems(await fetchMyInvitations(token)); setError(null); } catch (e: any) { setError(e?.message); setItems([]); }
  }, [token]);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  if (!items) return <LoadingState />;

  const open = async (inv: Invitation) => {
    if (!token) return;
    if (inv.status === 'SENT') markInvitationViewed(token, inv.id).catch(() => {});
    router.push((inv.target.kind === 'job' ? `/jobs/${inv.target.id}` : `/jobs/locum/${inv.target.id}`) as any);
  };
  const decline = async (inv: Invitation) => {
    if (!token) return;
    try { await declineInvitation(token, inv.id); load(); } catch (e: any) { setError(e?.message); }
  };
  const block = (inv: Invitation) => {
    if (!token || !inv.recruiter) return;
    confirm('Block this recruiter?', `${inv.recruiter.company_name} won't be able to find you, invite you or message you.`,
      async () => {
        try { await blockRecruiter(token, inv.recruiter!.user_id); setNotice('Recruiter blocked.'); load(); } catch (e: any) {
          setError(e?.message);
        }
      });
  };
  const report = async () => {
    if (!token || !reporting?.recruiter) return;
    try {
      await reportUser(token, reporting.recruiter.user_id, { reason, details: details.trim(), context: 'invitation' });
      setNotice('Thanks — our team will review this report.');
      setReporting(null); setDetails('');
    } catch (e: any) { setError(e?.message); }
  };

  return (
    <>
      <ErrorBanner message={error} />
      {notice ? <Notice tone="success" title={notice} /> : null}
      {items.length === 0 ? (
        <EmptyState icon="mail-open-outline" title="No invitations yet"
          hint="Turn on “Discoverable by verified recruiters” in Preferences to receive invitations." />
      ) : items.map(inv => {
        const actionable = inv.status === 'SENT' || inv.status === 'VIEWED';
        return (
          <Card key={inv.id} testID={`invitation-${inv.id}`}>
            <View style={recruiterStyles.row}>
              <Text style={[recruiterStyles.strong, { flexShrink: 1 }]} numberOfLines={1}>
                {inv.recruiter?.company_name ?? 'Recruiter'}
              </Text>
              {inv.recruiter?.verified ? <VerifiedRecruiterBadge compact /> : null}
              <View style={{ flex: 1 }} />
              <InviteStatus status={inv.status} />
            </View>
            <Text style={styles.target}>{inv.target.title}</Text>
            <Text style={recruiterStyles.muted}>
              {[
                inv.target.city,
                inv.target.shift_date && formatShiftDay(inv.target.shift_date),
                inv.target.start_time && inv.target.end_time
                  && formatShiftHours({ start_time: inv.target.start_time, end_time: inv.target.end_time }),
              ].filter(Boolean).join(' · ')}
              {` · received ${formatDate(inv.created_at)}`}
            </Text>
            {inv.message ? <Text style={styles.message}>“{inv.message}”</Text> : null}
            {actionable && !inv.target.open ? (
              <Text style={recruiterStyles.muted}>This opening is no longer accepting applications.</Text>
            ) : null}
            <View style={styles.invActions}>
              {actionable && inv.target.open ? (
                <Button label="View & apply" onPress={() => open(inv)} style={styles.invBtn} testID={`invitation-open-${inv.id}`} />
              ) : (
                <Button label="View opening" variant="outline" onPress={() => open(inv)} style={styles.invBtn} />
              )}
              {actionable ? (
                <Button label="Decline" variant="outline" onPress={() => decline(inv)} style={styles.invBtn}
                  testID={`invitation-decline-${inv.id}`} />
              ) : null}
            </View>
            <View style={recruiterStyles.row}>
              <Pressable onPress={() => block(inv)} accessibilityRole="button" style={styles.small}
                testID={`invitation-block-${inv.id}`}>
                <Text style={styles.smallText}>Block recruiter</Text>
              </Pressable>
              <Pressable onPress={() => setReporting(inv)} accessibilityRole="button" style={styles.small}
                testID={`invitation-report-${inv.id}`}>
                <Text style={styles.smallText}>Report</Text>
              </Pressable>
            </View>
          </Card>
        );
      })}

      <Sheet visible={!!reporting} onClose={() => setReporting(null)} title="Report recruiter"
        footer={<Button label="Send report" variant="danger" onPress={report} testID="report-send" />}>
        <View style={{ padding: spacing.lg }}>
          <ChoiceChips label="Reason" value={reason} onChange={v => v && setReason(v)} choices={[...REPORT_REASONS]} />
          <FormInput label="Details (optional)" value={details} onChangeText={setDetails} rows={3} multiline maxLength={1000} />
        </View>
      </Sheet>
    </>
  );
}

const styles = StyleSheet.create({
  saved: { ...typography.label, color: colors.teal },
  dayRow: {
    flexDirection: 'row', gap: spacing.md, paddingVertical: spacing.sm, alignItems: 'flex-start',
    borderBottomWidth: 1, borderBottomColor: colors.borderLight,
  },
  day: { ...typography.bodyStrong, color: colors.text, width: 40, paddingTop: 8 },
  windows: { flex: 1, flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, alignItems: 'center', minHeight: 40 },
  window: {
    flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: spacing.md, minHeight: 34,
    borderRadius: radius.pill, backgroundColor: colors.tintBg,
  },
  windowText: { fontSize: 13, fontFamily: fonts.body.semibold, color: colors.navy },
  plus: {
    width: 34, height: 34, borderRadius: 17, borderWidth: 1, borderColor: colors.teal,
    alignItems: 'center', justifyContent: 'center',
  },
  addRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, flexWrap: 'wrap' },
  addBox: { flexBasis: '100%', gap: spacing.xs },
  timeCol: { flexGrow: 1, flexBasis: 130 },
  time: {
    width: 72, minHeight: 40, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md,
    paddingHorizontal: spacing.sm, fontSize: 15, color: colors.text, textAlign: 'center', backgroundColor: colors.white,
  },
  addBtn: { backgroundColor: colors.teal, paddingHorizontal: spacing.md, minHeight: 40, borderRadius: radius.md, justifyContent: 'center' },
  addText: { color: colors.white, fontFamily: fonts.body.bold },
  overrideRow: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.sm,
    borderBottomWidth: 1, borderBottomColor: colors.borderLight,
  },
  overrideForm: { marginTop: spacing.md },
  target: { ...typography.h3, color: colors.navy, marginTop: spacing.sm },
  message: { ...typography.body, color: colors.textSecondary, fontStyle: 'italic', marginTop: spacing.sm },
  invActions: { flexDirection: 'row', gap: spacing.sm, flexWrap: 'wrap', marginTop: spacing.md },
  invBtn: { flexGrow: 1, flexBasis: 140 },
  small: { minHeight: 40, justifyContent: 'center', marginTop: spacing.xs },
  smallText: { ...typography.caption, color: colors.textSecondary, textDecorationLine: 'underline' },
});
