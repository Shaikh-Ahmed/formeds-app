import React, { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../context/AuthContext';
import { colors, radius, spacing, typography, fonts, MIN_TOUCH_TARGET } from '../../theme';
import { Button } from '../Button';
import { FormInput } from '../FormInput';
import { SelectField } from '../SelectField';
import { DateField, DateTimeField, NumberField, TimeField } from '../InputFields';
import {
  isRealDate, nowMinuteString, todayString, validateAmount, validateInteger, validateTimeRange,
} from '../../utils/validation';
import { ErrorBanner } from '../States';
import { ChoiceChips } from './ChoiceChips';
import { toDayString } from './LocumMeta';
import { OTHER_SPECIALTY, SPECIALTY_OPTIONS, SPECIALTIES } from '../../data/specialties';
import { OTHER_CITY, STATE_NAMES, citiesForState, isCustomCity } from '../../data/indiaLocations';
import { fetchMyOrganizations } from '../../api/organizations';
import type { Organization } from '../../types/organizations';
import {
  LOCUM_ROLE_LABELS, LOCUM_SHIFT_LABELS,
  type Locum, type LocumPayType, type LocumRole, type LocumShiftType,
} from '../../types/locum';

export type DeadlineChoice = 'shift_start' | 'two_hours' | 'custom';
type DayChoice = 'today' | 'tomorrow' | 'other';

export interface LocumFormState {
  org_id: string | null;
  role_required: LocumRole;
  specialty: string;
  customSpecialty: string;
  openings: number;
  dayChoice: DayChoice;
  shift_date: string;
  start_time: string;
  end_time: string;
  shift_type: LocumShiftType;
  city: string;
  state: string;
  address: string;
  pay_amount: string;
  pay_type: LocumPayType;
  experience_min: string;
  qualifications: string;
  requirements: string;
  notes: string;
  deadline: DeadlineChoice;
  customDeadline: string;
}

/** Hours a shift preset fills in. Custom and the others leave them alone. */
const SHIFT_PRESETS: Partial<Record<LocumShiftType, [string, string]>> = {
  day: ['09:00', '17:00'],
  night: ['20:00', '08:00'],
};

const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;
const DEADLINE_RE = /^\d{4}-\d{2}-\d{2}[ T]([01]\d|2[0-3]):[0-5]\d$/;

const addDays = (base: Date, days: number) =>
  new Date(base.getFullYear(), base.getMonth(), base.getDate() + days);

export function emptyLocumForm(user?: { city?: string; state?: string } | null, now = new Date()): LocumFormState {
  return {
    org_id: null,
    role_required: 'doctor',
    specialty: '',
    customSpecialty: '',
    openings: 1,
    dayChoice: 'tomorrow',
    shift_date: toDayString(addDays(now, 1)),
    start_time: '09:00',
    end_time: '17:00',
    shift_type: 'day',
    city: user?.city || '',
    state: user?.state || '',
    address: '',
    pay_amount: '',
    pay_type: 'per_shift',
    experience_min: '',
    qualifications: '',
    requirements: '',
    notes: '',
    deadline: 'shift_start',
    customDeadline: '',
  };
}

export function formFromLocum(locum: Locum): LocumFormState {
  const known = SPECIALTIES.includes(locum.specialty);
  return {
    ...emptyLocumForm(),
    org_id: locum.org_id ?? null,
    role_required: locum.role_required,
    specialty: known ? locum.specialty : OTHER_SPECIALTY,
    customSpecialty: known ? '' : locum.specialty,
    openings: locum.openings,
    dayChoice: 'other',
    shift_date: locum.shift_date.slice(0, 10),
    start_time: locum.start_time,
    end_time: locum.end_time,
    shift_type: locum.shift_type,
    city: locum.city,
    state: locum.state || '',
    address: locum.address || '',
    pay_amount: locum.pay_amount ? String(locum.pay_amount) : '',
    pay_type: locum.pay_type,
    experience_min: locum.experience_min ? String(locum.experience_min) : '',
    qualifications: locum.qualifications || '',
    requirements: locum.requirements || '',
    notes: locum.notes || '',
    deadline: 'shift_start',
    customDeadline: '',
  };
}

/**
 * The deadline as an offset-less "YYYY-MM-DDTHH:MM", which the server reads as
 * IST. Null means "until the shift starts", the server's default.
 */
export function deadlineFor(form: LocumFormState): string | null {
  if (form.deadline === 'shift_start') return null;
  if (form.deadline === 'custom') return form.customDeadline.trim().replace(' ', 'T');
  const [y, m, d] = form.shift_date.split('-').map(Number);
  const [h, mi] = form.start_time.split(':').map(Number);
  const at = new Date(y, m - 1, d, h - 2, mi);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${toDayString(at)}T${pad(at.getHours())}:${pad(at.getMinutes())}`;
}

export type LocumField =
  | 'specialty' | 'shift_date' | 'start_time' | 'end_time' | 'city' | 'pay_amount' | 'experience_min'
  | 'customDeadline';

/**
 * Every problem with the form, keyed by the field it belongs to, in the order
 * the fields appear. `initial` is the stored locum when editing: a date that
 * has not been touched is not re-judged against today (the server applies the
 * same rule), so a poster can still fix a typo on yesterday's shift.
 */
export function locumFieldErrors(
  form: LocumFormState, now: Date = new Date(), initial?: LocumFormState,
): Partial<Record<LocumField, string>> {
  const out: Partial<Record<LocumField, string>> = {};
  const specialty = form.specialty === OTHER_SPECIALTY ? form.customSpecialty.trim() : form.specialty;
  if (specialty.length < 2) out.specialty = 'Please select a specialty.';

  const timingMoved = !initial || initial.shift_date !== form.shift_date
    || initial.start_time !== form.start_time || initial.end_time !== form.end_time;
  if (!form.shift_date) out.shift_date = 'Please choose the locum date.';
  else if (!isRealDate(form.shift_date)) out.shift_date = 'Please choose a valid date.';
  else if (timingMoved && form.shift_date < todayString(now)) out.shift_date = 'Locum date cannot be in the past.';

  // Night shifts run past midnight, so an end before the start is allowed.
  const times = validateTimeRange(form.start_time, form.end_time, { allowOvernight: true });
  if (times) {
    if (!form.start_time || !TIME_RE.test(form.start_time)) out.start_time = times;
    else out.end_time = times;
  } else if (timingMoved && form.shift_date === todayString(now)
    && `${form.shift_date}T${form.start_time}` <= nowMinuteString(now)) {
    out.start_time = "This shift's start time has already passed.";
  }

  if (!form.city.trim()) out.city = 'Please choose the city.';
  if (form.pay_type !== 'negotiable') {
    const pay = validateAmount(form.pay_amount, 'Pay', { required: true, max: 10_000_000 });
    if (pay) out.pay_amount = pay === 'Pay is required.' ? 'Enter the pay, or mark it negotiable.' : pay;
  }
  const exp = validateInteger(form.experience_min, 'Minimum experience', { max: 60 });
  if (exp) out.experience_min = exp;

  if (form.deadline === 'custom') {
    const at = form.customDeadline.trim().replace(' ', 'T');
    if (!DEADLINE_RE.test(at)) out.customDeadline = 'Please choose when applications close.';
    else if (at <= nowMinuteString(now)) out.customDeadline = 'Application deadline cannot be in the past.';
    else if (!out.shift_date && !out.start_time && at > `${form.shift_date}T${form.start_time}`) {
      out.customDeadline = 'Application deadline cannot be after the shift starts.';
    }
  }
  return out;
}

/** The first problem, or null: for callers that want one message. */
const FIELD_NAMES: Record<LocumField, string> = {
  specialty: 'specialty', shift_date: 'date', start_time: 'start time', end_time: 'end time', city: 'city',
  pay_amount: 'pay', experience_min: 'minimum experience', customDeadline: 'application deadline',
};

/** Where the server's business-rule refusals belong on this form. */
export const LOCUM_ERROR_FIELDS: Record<string, LocumField> = {
  shift_in_past: 'shift_date', shift_started: 'start_time',
  deadline_after_shift: 'customDeadline', deadline_passed: 'customDeadline',
};
const SERVER_FIELD: Record<string, LocumField> = {
  shift_date: 'shift_date', start_time: 'start_time', end_time: 'end_time', city: 'city',
  pay_amount: 'pay_amount', experience_min: 'experience_min', apply_by: 'customDeadline', specialty: 'specialty',
};

export function validateLocumForm(form: LocumFormState, now: Date = new Date()): string | null {
  return Object.values(locumFieldErrors(form, now))[0] ?? null;
}

export function buildLocumPayload(form: LocumFormState): Record<string, unknown> {
  const specialty = form.specialty === OTHER_SPECIALTY ? form.customSpecialty.trim() : form.specialty;
  const payload: Record<string, unknown> = {
    role_required: form.role_required,
    specialty,
    openings: form.openings,
    shift_date: form.shift_date,
    start_time: form.start_time,
    end_time: form.end_time,
    shift_type: form.shift_type,
    city: form.city.trim(),
    state: form.state,
    address: form.address.trim(),
    pay_amount: form.pay_type === 'negotiable' ? 0 : Number(form.pay_amount) || 0,
    pay_type: form.pay_type,
    experience_min: Number(form.experience_min) || 0,
    qualifications: form.qualifications.trim(),
    requirements: form.requirements.trim(),
    notes: form.notes.trim(),
    apply_by: deadlineFor(form),
  };
  if (form.org_id) payload.org_id = form.org_id;
  return payload;
}

/**
 * Only what changed, for an edit. Sending untouched timing fields would make
 * the server re-check a deadline the poster never meant to move.
 */
export function diffLocumPayload(
  initial: LocumFormState, current: LocumFormState,
): Record<string, unknown> {
  const before = buildLocumPayload(initial);
  const after = buildLocumPayload(current);
  const out: Record<string, unknown> = {};
  for (const key of Object.keys(after)) {
    if (key === 'org_id') continue; // fixed once posted
    if (key === 'apply_by') {
      if (current.deadline !== initial.deadline || current.customDeadline !== initial.customDeadline) {
        out.apply_by = after.apply_by;
      }
      continue;
    }
    if (JSON.stringify(before[key]) !== JSON.stringify(after[key])) out[key] = after[key];
  }
  return out;
}

const ROLE_CHOICES = (Object.keys(LOCUM_ROLE_LABELS) as LocumRole[])
  .map(value => ({ value, label: LOCUM_ROLE_LABELS[value] }));

const SHIFT_CHOICES: { value: LocumShiftType; label: string; icon: any }[] = [
  { value: 'day', label: LOCUM_SHIFT_LABELS.day, icon: 'sunny-outline' },
  { value: 'night', label: LOCUM_SHIFT_LABELS.night, icon: 'moon-outline' },
  { value: 'emergency', label: LOCUM_SHIFT_LABELS.emergency, icon: 'alert-circle-outline' },
  { value: 'weekend', label: LOCUM_SHIFT_LABELS.weekend, icon: 'calendar-outline' },
  { value: 'custom', label: LOCUM_SHIFT_LABELS.custom, icon: 'options-outline' },
];

const PAY_CHOICES: { value: LocumPayType; label: string }[] = [
  { value: 'per_shift', label: 'Per shift' },
  { value: 'per_hour', label: 'Per hour' },
  { value: 'fixed', label: 'Fixed amount' },
  { value: 'negotiable', label: 'Negotiable' },
];

const DEADLINE_CHOICES: { value: DeadlineChoice; label: string }[] = [
  { value: 'shift_start', label: 'Until the shift starts' },
  { value: 'two_hours', label: '2 hours before' },
  { value: 'custom', label: 'Set a time' },
];

/**
 * Quick setup: a locum in under a minute.
 *
 * Every required answer is a tap where it can be -- role, date, shift, pay
 * basis -- and a preset where it cannot: choosing "Night" fills 20:00 to
 * 08:00, "Tomorrow" fills the date, the hospital's organisation fills the
 * location. What is left to type is the specialty and the amount. The optional
 * requirements live behind "More details", closed by default, because most
 * urgent cover needs none of them.
 */
export function LocumForm({
  initial,
  editing = false,
  submitting,
  error,
  serverFieldErrors,
  onSubmit,
}: {
  initial?: LocumFormState;
  editing?: boolean;
  submitting?: boolean;
  error?: string | null;
  /** Per-field refusals from the last submit (see utils/api errorFields). */
  serverFieldErrors?: Record<string, string>;
  onSubmit: (payload: Record<string, unknown>) => void;
}) {
  const { token, user } = useAuth();
  const start = useMemo(() => initial ?? emptyLocumForm(user), [initial, user]);
  const [form, setForm] = useState<LocumFormState>(start);
  const [orgs, setOrgs] = useState<Organization[]>([]);
  const [moreOpen, setMoreOpen] = useState(
    !!(start.qualifications || start.requirements || start.notes || start.experience_min),
  );
  const [localError, setLocalError] = useState<string | null>(null);
  // Shown under each field once the poster has tried to submit, then live as
  // they correct it -- never while they are still filling the form in.
  const [attempted, setAttempted] = useState(false);
  // The server's word on a field shows until that field is edited; the
  // client's own checks win wherever both have something to say.
  const [serverErrors, setServerErrors] = useState<Partial<Record<LocumField, string>>>({});
  useEffect(() => {
    const mapped: Partial<Record<LocumField, string>> = {};
    Object.entries(serverFieldErrors ?? {}).forEach(([k, v]) => { const f = SERVER_FIELD[k] ?? (k as LocumField); mapped[f] = v; });
    setServerErrors(mapped);
  }, [serverFieldErrors]);
  const fieldErrors = { ...serverErrors, ...(attempted ? locumFieldErrors(form, new Date(), editing ? start : undefined) : {}) };
  const [cityOther, setCityOther] = useState(false);
  const cityOptions = citiesForState(form.state);
  const showCityText = cityOther || (!!form.city && isCustomCity(form.state, form.city)) || !cityOptions.length;

  useEffect(() => { setForm(start); }, [start]);

  // Offer the poster's organisations, so the hospital is picked, not typed.
  // A recruiter always posts as their agency, so it is picked for them.
  const isRecruiter = user?.role === 'recruiter';
  useEffect(() => {
    if (!token || editing) return;
    fetchMyOrganizations(token).then(list => {
      setOrgs(list);
      if (isRecruiter && list.length) {
        const agency = list.find(o => o.org_type === 'staffing') ?? list[0];
        setForm(prev => (prev.org_id ? prev : {
          ...prev, org_id: agency.id, city: agency.city || prev.city, state: agency.state || prev.state,
        }));
      }
    }).catch(() => setOrgs([]));
  }, [token, editing, isRecruiter]);

  const set = <K extends keyof LocumFormState>(key: K, value: LocumFormState[K]) => {
    setForm(prev => ({ ...prev, [key]: value }));
    const field = (key === 'customSpecialty' ? 'specialty' : key) as LocumField;
    setServerErrors(prev => (prev[field] ? (({ [field]: _, ...rest }) => rest)(prev) : prev));
  };

  const chooseOrg = (orgId: string | null) => {
    const org = orgs.find(o => o.id === orgId);
    setForm(prev => ({
      ...prev,
      org_id: orgId,
      city: org?.city || prev.city,
      state: org?.state || prev.state,
      address: org?.address_line || prev.address,
    }));
  };

  const chooseDay = (choice: DayChoice | null) => {
    if (!choice) return;
    const today = new Date();
    setForm(prev => ({
      ...prev,
      dayChoice: choice,
      shift_date: choice === 'today' ? toDayString(today)
        : choice === 'tomorrow' ? toDayString(addDays(today, 1))
        : prev.shift_date,
    }));
  };

  const chooseShift = (type: LocumShiftType | null) => {
    if (!type) return;
    const preset = SHIFT_PRESETS[type];
    setForm(prev => ({
      ...prev,
      shift_type: type,
      start_time: preset ? preset[0] : prev.start_time,
      end_time: preset ? preset[1] : prev.end_time,
    }));
  };

  const submit = () => {
    setAttempted(true);
    const errors = locumFieldErrors(form, new Date(), editing ? start : undefined);
    const count = Object.keys(errors).length;
    setLocalError(count ? (count === 1 ? Object.values(errors)[0]!
      : `Please fix: ${(Object.keys(errors) as LocumField[]).map(k => FIELD_NAMES[k]).join(', ')}.`) : null);
    if (count) return;
    onSubmit(editing ? diffLocumPayload(start, form) : buildLocumPayload(form));
  };

  const orgChoices = [
    ...(isRecruiter ? [] : [{ value: '__me', label: user?.name ? `${user.name}` : 'My account' }]),
    ...orgs.map(o => ({ value: o.id, label: o.name })),
  ];

  return (
    <ScrollView
      contentContainerStyle={styles.body}
      keyboardShouldPersistTaps="handled"
      testID="locum-form"
    >
      {orgs.length ? (
        <ChoiceChips
          label="Posting for"
          choices={orgChoices}
          value={form.org_id ?? '__me'}
          onChange={v => chooseOrg(v === '__me' ? null : v)}
          testID="locum-org"
        />
      ) : null}

      <Section title="Who you need">
        <ChoiceChips label="Role" choices={ROLE_CHOICES} value={form.role_required}
          onChange={v => v && set('role_required', v)} testID="locum-role" />
        <SelectField
          label="Specialty"
          value={form.specialty}
          onChange={v => set('specialty', v)}
          options={SPECIALTY_OPTIONS}
          placeholder="e.g. Emergency Medicine"
          icon="medkit-outline"
          testID="locum-specialty"
        />
        {fieldErrors.specialty && form.specialty !== OTHER_SPECIALTY ? (
          <Text style={styles.fieldError} accessibilityRole="alert">{fieldErrors.specialty}</Text>
        ) : null}
        {form.specialty === OTHER_SPECIALTY ? (
          <FormInput label="Specialty (type it)" value={form.customSpecialty}
            onChangeText={v => set('customSpecialty', v)} placeholder="e.g. ICU Nurse" maxLength={100}
            error={fieldErrors.specialty} testID="locum-specialty-custom" />
        ) : null}
        <View style={styles.stepperRow}>
          <Text style={styles.label}>How many?</Text>
          <View style={styles.stepper}>
            <StepButton icon="remove" label="One fewer" disabled={form.openings <= 1}
              onPress={() => set('openings', Math.max(1, form.openings - 1))} />
            <Text style={styles.stepValue} testID="locum-openings">{form.openings}</Text>
            <StepButton icon="add" label="One more" disabled={form.openings >= 50}
              onPress={() => set('openings', Math.min(50, form.openings + 1))} />
          </View>
        </View>
      </Section>

      <Section title="When">
        <ChoiceChips
          label="Date"
          choices={[
            { value: 'today', label: 'Today' },
            { value: 'tomorrow', label: 'Tomorrow' },
            { value: 'other', label: 'Another day' },
          ]}
          value={form.dayChoice}
          onChange={chooseDay}
          testID="locum-day"
        />
        {form.dayChoice === 'other' ? (
          <DateField label="Shift date" value={form.shift_date} onChange={v => set('shift_date', v)}
            min={todayString()} error={fieldErrors.shift_date} testID="locum-date" />
        ) : fieldErrors.shift_date ? (
          <Text style={styles.fieldError} accessibilityRole="alert">{fieldErrors.shift_date}</Text>
        ) : null}
        <ChoiceChips label="Shift" choices={SHIFT_CHOICES} value={form.shift_type}
          onChange={chooseShift} testID="locum-shift" />
        <View style={styles.pair}>
          <View style={styles.flex}>
            <TimeField label="Starts" value={form.start_time} onChange={v => set('start_time', v)}
              error={fieldErrors.start_time} testID="locum-start" />
          </View>
          <View style={styles.flex}>
            <TimeField label="Ends" value={form.end_time} onChange={v => set('end_time', v)}
              error={fieldErrors.end_time} testID="locum-end" />
          </View>
        </View>
        {form.end_time && form.start_time && form.end_time <= form.start_time ? (
          <Text style={styles.hint}>Ends the next morning (overnight shift).</Text>
        ) : null}
      </Section>

      <Section title="Where">
        {/* State first, then its cities: the city drives distance matching,
            so a known name matters more than free text. "Other" still allows
            a town that is not on the list. */}
        <View style={styles.pair}>
          <View style={styles.flex}>
            <SelectField label="State" value={form.state} options={STATE_NAMES} placeholder="State"
              onChange={v => { setForm(prev => ({ ...prev, state: v, city: citiesForState(v).includes(prev.city) ? prev.city : '' })); setCityOther(false); }}
              testID="locum-state" />
          </View>
          <View style={styles.flex}>
            {showCityText ? (
              <FormInput label="City" value={form.city} onChangeText={v => set('city', v)} maxLength={80}
                icon="location-outline" error={fieldErrors.city} testID="locum-city" />
            ) : (
              <>
                <SelectField label="City" value={form.city} placeholder="City" icon="location-outline"
                  options={[...cityOptions, OTHER_CITY]} searchPlaceholder="Search cities"
                  onChange={v => { if (v === OTHER_CITY) { setCityOther(true); set('city', ''); } else set('city', v); }}
                  testID="locum-city-select" />
                {fieldErrors.city ? <Text style={styles.fieldError} accessibilityRole="alert">{fieldErrors.city}</Text> : null}
              </>
            )}
          </View>
        </View>
        <FormInput label="Ward, wing or address (optional)" value={form.address}
          onChangeText={v => set('address', v)} testID="locum-address" />
      </Section>

      <Section title="Pay">
        <ChoiceChips choices={PAY_CHOICES} value={form.pay_type}
          onChange={v => v && set('pay_type', v)} testID="locum-pay-type" />
        {form.pay_type !== 'negotiable' ? (
          <NumberField label="Amount" prefix="₹" value={form.pay_amount} maxDigits={8}
            onChangeText={v => set('pay_amount', v)} placeholder="e.g. 12000"
            error={fieldErrors.pay_amount} testID="locum-pay" />
        ) : null}
      </Section>

      <Section title="Applications close">
        <ChoiceChips choices={DEADLINE_CHOICES} value={form.deadline}
          onChange={v => v && set('deadline', v)} testID="locum-deadline" />
        {form.deadline === 'custom' ? (
          <DateTimeField label="Applications close at" value={form.customDeadline.replace(' ', 'T')}
            onChange={v => set('customDeadline', v)} min={nowMinuteString()}
            max={isRealDate(form.shift_date) && TIME_RE.test(form.start_time) ? `${form.shift_date}T${form.start_time}` : undefined}
            helper="Must be before the shift starts." error={fieldErrors.customDeadline}
            testID="locum-deadline-custom" />
        ) : null}
        {editing && form.deadline === 'shift_start' ? (
          <Text style={styles.hint}>Leave as is to keep the current deadline.</Text>
        ) : null}
      </Section>

      <Pressable
        onPress={() => setMoreOpen(o => !o)}
        accessibilityRole="button"
        accessibilityState={{ expanded: moreOpen }}
        style={({ pressed }) => [styles.more, pressed && styles.pressed]}
        testID="locum-more"
      >
        <Text style={styles.moreText}>More details (optional)</Text>
        <Ionicons name={moreOpen ? 'chevron-up' : 'chevron-down'} size={18} color={colors.navy} />
      </Pressable>
      {moreOpen ? (
        <View style={styles.moreBody}>
          <NumberField label="Minimum experience" suffix="years" value={form.experience_min} maxDigits={2}
            onChangeText={v => set('experience_min', v)} error={fieldErrors.experience_min}
            testID="locum-experience" />
          <FormInput label="Qualifications or certifications" value={form.qualifications} maxLength={300}
            onChangeText={v => set('qualifications', v)} placeholder="e.g. MBBS, ACLS certified" />
          <FormInput label="Other requirements" value={form.requirements} multiline rows={3} maxLength={1000}
            onChangeText={v => set('requirements', v)} />
          <FormInput label="Notes for applicants" value={form.notes} multiline rows={3} maxLength={1000}
            onChangeText={v => set('notes', v)} placeholder="Report to casualty; ask for Dr. Rao" />
        </View>
      ) : null}

      <ErrorBanner message={localError || error} />
      <Button
        label={editing ? 'Save changes' : 'Post locum'}
        onPress={submit}
        loading={submitting}
        testID="locum-submit"
      />
    </ScrollView>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={styles.overline}>{title}</Text>
      {children}
    </View>
  );
}

function StepButton({
  icon, label, onPress, disabled,
}: { icon: 'add' | 'remove'; label: string; onPress: () => void; disabled?: boolean }) {
  return (
    <Pressable onPress={onPress} disabled={disabled} accessibilityRole="button"
      accessibilityLabel={label} accessibilityState={{ disabled }}
      style={({ pressed }) => [styles.stepBtn, (pressed || disabled) && styles.pressed]}>
      <Ionicons name={icon} size={20} color={colors.navy} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  body: { padding: spacing.lg, paddingBottom: spacing.xxxl * 3, gap: spacing.xl },
  section: { gap: spacing.md },
  overline: { ...typography.overline, color: colors.teal },
  label: { ...typography.label, color: colors.text },
  hint: { ...typography.small, color: colors.textSecondary },
  fieldError: { ...typography.small, color: colors.redText, marginTop: -spacing.xs },
  pair: { flexDirection: 'row', gap: spacing.md },
  stepperRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  stepper: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  stepBtn: {
    width: MIN_TOUCH_TARGET,
    height: MIN_TOUCH_TARGET,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.white,
  },
  stepValue: { ...typography.h3, color: colors.text, minWidth: 28, textAlign: 'center' },
  more: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: MIN_TOUCH_TARGET,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.white,
  },
  moreText: { ...typography.label, fontFamily: fonts.body.semibold, color: colors.navy },
  moreBody: { gap: spacing.xs },
  pressed: { opacity: 0.6 },
});
