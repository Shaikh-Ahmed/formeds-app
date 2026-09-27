import React, { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { colors, radius, spacing, typography, fonts, MIN_TOUCH_TARGET } from '../../../theme';
import { Button } from '../../Button';
import { FormInput } from '../../FormInput';
import { SelectField } from '../../SelectField';
import { ErrorBanner } from '../../States';
import { OrgVerifiedBadge } from '../../organizations/OrgVerifiedBadge';
import { DateField, NumberField, TimeField } from '../../InputFields';
import { ScreeningEditor, questionErrors } from '../Screening';
import type { ScreeningQuestion } from '../../../types/applicants';
import {
  todayString, validateAmount, validateDate, validateDateOrder, validateInteger,
} from '../../../utils/validation';
import { SPECIALTY_OPTIONS } from '../../../data/specialties';
import { STATE_NAMES, citiesForState } from '../../../data/indiaLocations';
import { JobCard } from '../JobCard';
import { JobDetailPanel } from '../JobDetailPanel';
import {
  POSTABLE_EMPLOYMENT_TYPES, EMPLOYMENT_TYPE_LABELS, PAY_PERIOD_LABELS, WORK_MODE_LABELS,
  isShiftRole, type EmploymentType, type Job, type PayPeriod, type WorkMode,
} from '../../../types/jobs';
import type { Organization } from '../../../types/organizations';

const PAY_PERIODS = Object.keys(PAY_PERIOD_LABELS) as PayPeriod[];
const WORK_MODES = Object.keys(WORK_MODE_LABELS) as WorkMode[];

export interface JobDraft {
  title: string;
  employment_type: EmploymentType;
  specialty: string;
  department: string;
  vacancies: string;
  org_id: string | null;
  work_mode: WorkMode;
  state: string;
  city: string;
  shift_start_date: string;
  shift_end_date: string;
  shift_time: string;
  shift_duration: string;
  /** Applications close (YYYY-MM-DD); blank for no deadline. */
  expires_at: string;
  screening_questions: ScreeningQuestion[];
  /** The two pickers behind `shift_time` ("20:00–08:00"). */
  shift_start_time: string;
  shift_end_time: string;
  pay_period: PayPeriod;
  pay_min: string;
  pay_max: string;
  pay_disclosed: boolean;
  experience_min: string;
  skills: string;
  requirements: string;
  description: string;
  responsibilities: string;
  is_urgent: boolean;
}

const EMPTY: JobDraft = {
  title: '', employment_type: 'full_time', specialty: '', department: '', vacancies: '1',
  org_id: null, work_mode: 'onsite', state: '', city: '',
  shift_start_date: '', shift_end_date: '', shift_time: '', shift_duration: '', expires_at: '',
  shift_start_time: '', shift_end_time: '', screening_questions: [],
  pay_period: 'month', pay_min: '', pay_max: '', pay_disclosed: true,
  experience_min: '', skills: '', requirements: '',
  description: '', responsibilities: '', is_urgent: false,
};

const STEPS = [
  { key: 'basics', title: 'The role', hint: 'What you are hiring for.' },
  { key: 'place', title: 'Place and schedule', hint: 'Where the work happens, and when.' },
  { key: 'terms', title: 'Terms', hint: 'Pay, experience and requirements.' },
  { key: 'screening', title: 'Screening questions', hint: 'Optional. Asked when a professional applies.' },
  { key: 'describe', title: 'Describe and publish', hint: 'The detail, then a look before it goes live.' },
] as const;

/**
 * Posting an opportunity, in four steps.
 *
 * The old form was six free-text boxes with no validation, which is why
 * "Location" was whatever the poster typed and could not be filtered on. The
 * structure here is not ceremony: each step groups the fields that are decided
 * together, and each one validates only itself, so somebody is never blocked on
 * step four by something they have not reached.
 *
 * The last step shows the actual `JobCard` and `JobDetailPanel` rendered from
 * the draft. Not a mock-up of them — the same components a candidate sees, so a
 * preview can never quietly diverge from the real thing.
 *
 * Draft and publish are separate outcomes rather than a checkbox, because they
 * are different intentions: a draft is private and can be finished later, and
 * publishing is the irreversible-ish act that puts a role in front of people.
 */
export function JobWizard({
  initial,
  mode = 'create',
  organizations = [],
  onCreateOrganization,
  onSubmit,
  submitting,
  error,
  onCancel,
  posterName = 'You',
  allowSelf = true,
  firstStepExtra,
  serverFieldErrors,
  hasApplicants = false,
}: {
  initial?: Partial<JobDraft>;
  mode?: 'create' | 'edit';
  organizations?: Organization[];
  onCreateOrganization?: () => void;
  onSubmit: (payload: Record<string, unknown>, opts: { publish: boolean }) => void;
  submitting?: boolean;
  error?: string | null;
  onCancel?: () => void;
  posterName?: string;
  /** False when the poster must post as one of `organizations` (a recruiter's agency). */
  allowSelf?: boolean;
  /** Extra fields shown on the first step, after "Posting as". */
  firstStepExtra?: React.ReactNode;
  /** Per-field refusals from the last submit (see utils/api errorFields). */
  serverFieldErrors?: Record<string, string>;
  /** Editing a job people have applied to (the screening step says what happens). */
  hasApplicants?: boolean;
}) {
  const [draft, setDraft] = useState<JobDraft>(() => {
    const base = { ...EMPTY, ...initial };
    return { ...base, ...splitShiftTime(base.shift_time) };
  });
  const [step, setStep] = useState(0);
  // Per step, so moving forward surfaces this step's gaps without lighting up
  // fields the person has not seen yet.
  const [touched, setTouched] = useState<Record<number, boolean>>({});

  const set = <K extends keyof JobDraft>(key: K, value: JobDraft[K]) =>
    setDraft(prev => ({ ...prev, [key]: value }));

  const shift = isShiftRole(draft.employment_type);
  const needsCity = draft.work_mode !== 'remote';

  /**
   * Mirrors the server's rules, grouped by the step that owns each one. The
   * server stays the authority; this exists so nobody is told about a problem
   * only after a round trip, on a screen they have already left.
   */
  const problems = useMemo(() => {
    const out: Record<number, Record<string, string>> = { 0: {}, 1: {}, 2: {}, 3: {}, 4: {} };
    const today = todayString();
    // Dates already stored are not re-judged against today on an edit -- the
    // server applies the same rule -- so an older posting can still be fixed.
    const moved = (k: 'shift_start_date' | 'shift_end_date' | 'expires_at') => mode !== 'edit' || draft[k] !== (initial?.[k] ?? '');

    if (draft.title.trim().length < 6) out[0].title = 'Give the role a full title (at least 6 characters).';
    const openings = validateInteger(draft.vacancies, 'Number of openings', { required: true, min: 1, max: 999 });
    if (openings) out[0].vacancies = openings;

    if (needsCity && !draft.city) out[1].city = 'Choose a city, or set the role to remote.';
    if (shift) {
      const start = validateDate(draft.shift_start_date, 'Start date', { required: true, notPast: moved('shift_start_date') });
      if (start) out[1].shift_start_date = start === 'Please choose the start date.'
        ? 'A locum or temporary post needs a start date.' : start;
      const end = validateDate(draft.shift_end_date, 'End date')
        ?? validateDateOrder(draft.shift_start_date, draft.shift_end_date, 'End date cannot be before the start date.');
      if (end) out[1].shift_end_date = end;
      if ((draft.shift_start_time && !draft.shift_end_time) || (!draft.shift_start_time && draft.shift_end_time)) {
        out[1].shift_time = 'Choose both a start and an end time, or neither.';
      } else if (draft.shift_start_time && draft.shift_start_time === draft.shift_end_time) {
        out[1].shift_time = 'Start and end times must be different.';
      }
    }
    const deadline = validateDate(draft.expires_at, 'Application deadline', { notPast: moved('expires_at') });
    if (deadline) out[1].expires_at = deadline;
    else if (shift && draft.expires_at && draft.shift_start_date && draft.expires_at > draft.shift_start_date) {
      out[1].expires_at = 'Application deadline cannot be after the start date.';
    }
    void today;

    if (draft.pay_disclosed) {
      const pmin = validateAmount(draft.pay_min, 'Minimum pay', { max: 100_000_000 });
      const pmax = validateAmount(draft.pay_max, 'Maximum pay', { max: 100_000_000 });
      const min = Number(draft.pay_min) || 0;
      const max = Number(draft.pay_max) || 0;
      if (pmin || pmax) out[2].pay = (pmin || pmax) as string;
      else if (min && max && max < min) out[2].pay = 'Maximum pay must be at least the minimum.';
    }
    const exp = validateInteger(draft.experience_min, 'Minimum experience', { max: 80 });
    if (exp) out[2].experience_min = exp;

    const qErrors = questionErrors(draft.screening_questions);
    Object.entries(qErrors).forEach(([i, m]) => { out[3][`q${i}`] = m; });
    if (draft.description.trim().length < 40) {
      out[4].description = 'Describe the role in at least a couple of sentences (40 characters or more).';
    }
    return out;
  }, [draft, needsCity, shift, mode, initial]);

  // The server's refusals, placed on the step and field they belong to, and
  // the wizard moved back to that step so the person can see it.
  const server = useMemo(() => {
    const out: Record<number, Record<string, string>> = { 0: {}, 1: {}, 2: {}, 3: {}, 4: {} };
    Object.entries(serverFieldErrors ?? {}).forEach(([field, message]) => {
      const [stepNo, key] = SERVER_FIELD_STEP[field] ?? [0, field];
      out[stepNo][key] = message;
    });
    return out;
  }, [serverFieldErrors]);
  useEffect(() => {
    const first = [0, 1, 2, 3, 4].find(i => Object.keys(server[i]).length);
    if (first !== undefined) setStep(first);
  }, [server]);

  const stepOk = (i: number) => Object.keys(problems[i] ?? {}).length === 0;
  const err = (i: number, key: string) => (touched[i] ? problems[i]?.[key] : undefined) ?? server[i]?.[key];

  const next = () => {
    setTouched(t => ({ ...t, [step]: true }));
    if (stepOk(step)) setStep(s => Math.min(s + 1, STEPS.length - 1));
  };

  const payload = () => ({
    title: draft.title.trim(),
    employment_type: draft.employment_type,
    specialty: draft.specialty,
    department: draft.department.trim(),
    description: draft.description.trim(),
    responsibilities: draft.responsibilities.trim(),
    requirements: draft.requirements.trim(),
    city: needsCity ? draft.city : '',
    state: needsCity ? draft.state : '',
    work_mode: draft.work_mode,
    pay_min: Number(draft.pay_min) || 0,
    pay_max: Number(draft.pay_max) || 0,
    pay_period: draft.pay_period,
    pay_disclosed: draft.pay_disclosed,
    experience_min: Number(draft.experience_min) || 0,
    vacancies: Number(draft.vacancies) || 1,
    skills: draft.skills.split(',').map(s => s.trim()).filter(Boolean),
    // Omitted rather than blanked: the server rejects shift fields on a
    // standing post, and '' is still a value.
    ...(shift
      ? {
          shift_start_date: draft.shift_start_date,
          ...(draft.shift_end_date ? { shift_end_date: draft.shift_end_date } : {}),
          // Two pickers in, the same display strings out: "20:00–08:00" and
          // a duration worked out from them, never typed separately.
          shift_time: draft.shift_start_time && draft.shift_end_time
            ? `${draft.shift_start_time}–${draft.shift_end_time}` : draft.shift_time.trim(),
          shift_duration: draft.shift_start_time && draft.shift_end_time
            ? shiftDuration(draft.shift_start_time, draft.shift_end_time) : draft.shift_duration.trim(),
        }
      : {}),
    is_urgent: draft.is_urgent,
    screening_questions: draft.screening_questions.map(q => ({
      ...(q.id ? { id: q.id } : {}), text: q.text.trim(), type: q.type, required: q.required,
      options: q.options.map(o => o.trim()).filter(Boolean), preferred: q.preferred || '',
    })),
    // Omitted when blank on a new post; null clears it on an edit.
    ...(draft.expires_at ? { expires_at: draft.expires_at } : mode === 'edit' ? { expires_at: null } : {}),
    ...(draft.org_id ? { org_id: draft.org_id, posted_as: 'organization' } : {}),
  });

  const finish = (publish: boolean) => {
    // Every step is checked here, not just the last: someone can reach step four
    // by going back and forth, and a draft with a broken pay range would be
    // rejected by the server anyway.
    setTouched({ 0: true, 1: true, 2: true, 3: true, 4: true });
    const firstBad = [0, 1, 2, 3, 4].find(i => !stepOk(i));
    if (firstBad !== undefined) { setStep(firstBad); return; }
    onSubmit(payload(), { publish });
  };

  const org = organizations.find(o => o.id === draft.org_id);
  const preview = usePreviewJob(draft, org, posterName);

  return (
    <View style={styles.flex}>
      <Progress step={step} />

      <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
        <View style={styles.stepHead}>
          <Text style={styles.stepTitle} accessibilityRole="header">{STEPS[step].title}</Text>
          <Text style={styles.stepHint}>{STEPS[step].hint}</Text>
        </View>

        <ErrorBanner message={error} />

        {step === 0 ? (
          <>
            {organizations.length || onCreateOrganization ? (
              <Field label="Posting as">
                <ChipRow>
                  {allowSelf ? (
                    <Choice
                      label="Myself"
                      selected={draft.org_id === null}
                      onPress={() => set('org_id', null)}
                      testID="wizard-as-self"
                    />
                  ) : null}
                  {organizations.map(o => (
                    <Choice
                      key={o.id}
                      label={o.name}
                      selected={draft.org_id === o.id}
                      onPress={() => set('org_id', o.id)}
                      testID={`wizard-as-${o.id}`}
                    />
                  ))}
                </ChipRow>
                {org ? (
                  <OrgVerifiedBadge status={org.verification_status} />
                ) : allowSelf ? (
                  <Text style={styles.hint}>This role will show your own name as the employer.</Text>
                ) : null}
                {onCreateOrganization ? (
                  <Pressable
                    onPress={onCreateOrganization}
                    accessibilityRole="button"
                    accessibilityLabel="Create an organisation"
                    style={({ pressed }) => [styles.linkRow, pressed && styles.pressed]}
                  >
                    <Text style={styles.link}>+ Create an organisation</Text>
                  </Pressable>
                ) : null}
              </Field>
            ) : null}

            {firstStepExtra}

            <FormInput maxLength={140}
              label="Job title"
              value={draft.title}
              onChangeText={v => set('title', v)}
              placeholder="e.g. Senior Consultant Cardiologist"
              error={err(0, 'title')}
              testID="wizard-title"
            />

            <Field label="Opportunity type">
              <ChipRow>
                {/* An older locum posting keeps its own type while being edited. */}
                {(draft.employment_type === 'locum'
                  ? [...POSTABLE_EMPLOYMENT_TYPES, 'locum' as const]
                  : POSTABLE_EMPLOYMENT_TYPES).map(t => (
                  <Choice
                    key={t}
                    label={EMPLOYMENT_TYPE_LABELS[t]}
                    selected={draft.employment_type === t}
                    onPress={() => set('employment_type', t)}
                    testID={`wizard-type-${t}`}
                  />
                ))}
              </ChipRow>
            </Field>

            <SelectField
              label="Specialty"
              value={draft.specialty}
              onChange={v => set('specialty', v)}
              options={SPECIALTY_OPTIONS}
              placeholder="Select a specialty"
              icon="medical-outline"
              testID="wizard-specialty"
            />
            <FormInput maxLength={120}
              label="Department (optional)"
              value={draft.department}
              onChangeText={v => set('department', v)}
              placeholder="e.g. Cardiology"
            />
            <NumberField
              label="Number of openings"
              value={draft.vacancies}
              onChangeText={v => set('vacancies', v)}
              maxDigits={3}
              error={err(0, 'vacancies')}
              testID="wizard-vacancies"
            />
          </>
        ) : null}

        {step === 1 ? (
          <>
            <Field label="Work mode">
              <ChipRow>
                {WORK_MODES.map(m => (
                  <Choice
                    key={m}
                    label={WORK_MODE_LABELS[m]}
                    selected={draft.work_mode === m}
                    onPress={() => set('work_mode', m)}
                    testID={`wizard-mode-${m}`}
                  />
                ))}
              </ChipRow>
            </Field>

            {needsCity ? (
              <>
                <SelectField
                  label="State"
                  value={draft.state}
                  onChange={v => setDraft(p => ({ ...p, state: v, city: '' }))}
                  options={STATE_NAMES}
                  placeholder="Select a state"
                  icon="map-outline"
                  testID="wizard-state"
                />
                <SelectField
                  label="City"
                  value={draft.city}
                  onChange={v => set('city', v)}
                  options={citiesForState(draft.state)}
                  placeholder="Select a city"
                  icon="location-outline"
                  disabled={!draft.state}
                  disabledHint="Choose a state first"
                  helper={err(1, 'city')}
                  testID="wizard-city"
                />
              </>
            ) : (
              <Text style={styles.hint}>A fully remote role does not need a location.</Text>
            )}

            {/* Only for the types that carry dates. The server rejects a
                full-time role with a shift date and a locum without one, so
                showing these always would just invite a 422. */}
            {shift ? (
              <View testID="wizard-shift-fields">
                <DateField
                  label="Start date"
                  value={draft.shift_start_date}
                  onChange={v => set('shift_start_date', v)}
                  min={mode === 'edit' ? undefined : todayString()}
                  error={err(1, 'shift_start_date')}
                  testID="wizard-shift-start"
                />
                <DateField
                  label="End date (optional)"
                  value={draft.shift_end_date}
                  onChange={v => set('shift_end_date', v)}
                  min={draft.shift_start_date || todayString()}
                  clearable
                  error={err(1, 'shift_end_date')}
                  testID="wizard-shift-end"
                />
                <View style={styles.row}>
                  <View style={styles.flex}>
                    <TimeField label="Shift starts (optional)" value={draft.shift_start_time}
                      onChange={v => set('shift_start_time', v)} clearable testID="wizard-shift-time-start" />
                  </View>
                  <View style={styles.flex}>
                    <TimeField label="Shift ends" value={draft.shift_end_time}
                      onChange={v => set('shift_end_time', v)} clearable testID="wizard-shift-time-end" />
                  </View>
                </View>
                {err(1, 'shift_time') ? <Text style={styles.error}>{err(1, 'shift_time')}</Text>
                  : draft.shift_start_time && draft.shift_end_time ? (
                    <Text style={styles.hint}>
                      {shiftDuration(draft.shift_start_time, draft.shift_end_time)}
                      {draft.shift_end_time < draft.shift_start_time ? ', ending the next morning' : ''}
                    </Text>
                  ) : draft.shift_time && !draft.shift_start_time ? (
                    <Text style={styles.hint}>Currently: {draft.shift_time}</Text>
                  ) : null}
            <DateField
              label="Applications close (optional)"
              value={draft.expires_at}
              onChange={v => set('expires_at', v)}
              min={todayString()}
              max={shift && draft.shift_start_date ? draft.shift_start_date : undefined}
              clearable
              helper="The listing stops taking applications after this date."
              error={err(1, 'expires_at')}
              testID="wizard-deadline"
            />
              </View>
            ) : null}
          </>
        ) : null}

        {step === 2 ? (
          <>
            <SwitchRow
              label="Show pay on the listing"
              hint="Listings with a published figure get noticeably more applications."
              value={draft.pay_disclosed}
              onValueChange={v => set('pay_disclosed', v)}
            />

            {draft.pay_disclosed ? (
              <>
                <View style={styles.row}>
                  <View style={styles.flex}>
                    <NumberField
                      label="From"
                      prefix="₹"
                      value={draft.pay_min}
                      onChangeText={v => set('pay_min', v)}
                      testID="wizard-pay-min"
                    />
                  </View>
                  <View style={styles.flex}>
                    <NumberField
                      label="To"
                      prefix="₹"
                      value={draft.pay_max}
                      onChangeText={v => set('pay_max', v)}
                      testID="wizard-pay-max"
                    />
                  </View>
                </View>
                {err(2, 'pay') ? <Text style={styles.error}>{err(2, 'pay')}</Text> : null}
                <Field label="Paid">
                  <ChipRow>
                    {PAY_PERIODS.map(p => (
                      <Choice
                        key={p}
                        label={PAY_PERIOD_LABELS[p]}
                        selected={draft.pay_period === p}
                        onPress={() => set('pay_period', p)}
                        testID={`wizard-period-${p}`}
                      />
                    ))}
                  </ChipRow>
                </Field>
              </>
            ) : null}

            <NumberField
              label="Minimum experience"
              suffix="years"
              value={draft.experience_min}
              onChangeText={v => set('experience_min', v)}
              maxDigits={2}
              placeholder="0"
              error={err(2, 'experience_min')}
              testID="wizard-experience"
            />
            <FormInput maxLength={700}
              label="Skills"
              value={draft.skills}
              onChangeText={v => set('skills', v)}
              placeholder="Comma separated, e.g. Echocardiography, Angioplasty"
            />
            <FormInput maxLength={8000}
              label="Qualifications and registration"
              value={draft.requirements}
              onChangeText={v => set('requirements', v)}
              placeholder="e.g. MD/DM Cardiology, valid NMC registration"
              multiline
              rows={4}
            />
          </>
        ) : null}

        {step === 3 ? (
          <ScreeningEditor
            questions={draft.screening_questions}
            onChange={qs => set('screening_questions', qs)}
            errors={touched[3] ? Object.fromEntries(Object.entries(problems[3]).map(([k, v]) => [Number(k.slice(1)), v])) : {}}
            hasApplicants={mode === 'edit' && hasApplicants}
          />
        ) : null}

        {step === 4 ? (
          <>
            <FormInput maxLength={20000}
              label="About the role"
              value={draft.description}
              onChangeText={v => set('description', v)}
              placeholder="Responsibilities, the team, the setting, and what makes this role worth taking."
              multiline
              rows={5}
              error={err(4, 'description')}
              testID="wizard-description"
            />
            <FormInput maxLength={8000}
              label="Key responsibilities (optional)"
              value={draft.responsibilities}
              onChangeText={v => set('responsibilities', v)}
              placeholder="One per line."
              multiline
              rows={4}
            />
            <SwitchRow
              label="Mark as urgent"
              hint="Only for cover you genuinely need filled quickly."
              value={draft.is_urgent}
              onValueChange={v => set('is_urgent', v)}
              danger
            />

            <View style={styles.previewBlock} testID="wizard-preview">
              <Text style={styles.previewLabel} accessibilityRole="header">
                How it will look
              </Text>
              <Text style={styles.hint}>
                This is the real card and page a candidate sees, not a mock-up.
              </Text>
              <JobCard item={preview} onPress={() => {}} />
              <View style={styles.previewPanel}>
                <JobDetailPanel
                  job={preview}
                  embedded
                  onApply={() => {}}
                  onToggleSave={() => {}}
                  onShare={() => {}}
                />
              </View>
            </View>
          </>
        ) : null}
      </ScrollView>

      <View style={styles.footer}>
        {step > 0 ? (
          <Button
            label="Back"
            variant="outline"
            onPress={() => setStep(s => s - 1)}
            style={styles.footerBtn}
            testID="wizard-back"
          />
        ) : onCancel ? (
          <Button label="Cancel" variant="outline" onPress={onCancel} style={styles.footerBtn} />
        ) : null}

        {step < STEPS.length - 1 ? (
          <Button label="Next" onPress={next} style={styles.footerBtn} testID="wizard-next" />
        ) : (
          <>
            {mode === 'create' ? (
              <Button
                label="Save draft"
                variant="outline"
                onPress={() => finish(false)}
                loading={submitting}
                style={styles.footerBtn}
                testID="wizard-draft"
              />
            ) : null}
            <Button
              label={mode === 'edit' ? 'Save changes' : 'Publish'}
              onPress={() => finish(true)}
              loading={submitting}
              style={styles.footerBtn}
              testID="wizard-publish"
            />
          </>
        )}
      </View>
    </View>
  );
}

/**
 * A Job shaped from the draft, for the preview.
 *
 * Deliberately built here rather than by asking the server for a dry run: the
 * preview has to work before anything has been saved, and a round trip on every
 * keystroke of the description would be absurd.
 */
function usePreviewJob(draft: JobDraft, org: Organization | undefined, posterName: string): Job {
  return useMemo(() => ({
    id: 'preview',
    poster_id: 'preview',
    org_id: org?.id ?? null,
    posted_as: org ? 'organization' : 'individual',
    employment_type: draft.employment_type,
    title: draft.title.trim() || 'Untitled role',
    specialty: draft.specialty,
    department: draft.department,
    description: draft.description,
    responsibilities: draft.responsibilities,
    requirements: draft.requirements,
    city: draft.city,
    state: draft.state,
    location: [draft.city, draft.state].filter(Boolean).join(', '),
    work_mode: draft.work_mode,
    pay_min: Number(draft.pay_min) || 0,
    pay_max: Number(draft.pay_max) || 0,
    pay_period: draft.pay_period,
    pay_currency: 'INR',
    pay_disclosed: draft.pay_disclosed,
    experience_min: Number(draft.experience_min) || 0,
    experience_max: 0,
    vacancies: Number(draft.vacancies) || 1,
    skills: draft.skills.split(',').map(s => s.trim()).filter(Boolean),
    shift_start_date: draft.shift_start_date || null,
    shift_end_date: draft.shift_end_date || null,
    expires_at: draft.expires_at || null,
    shift_time: draft.shift_time,
    shift_duration: draft.shift_duration,
    is_urgent: draft.is_urgent,
    status: 'active',
    applicant_count: 0,
    view_count: 0,
    save_count: 0,
    created_at: new Date().toISOString(),
    saved: false,
    has_applied: false,
    can_manage: true,
    employer_name: org?.name || posterName,
    employer_avatar: org?.logo || '',
    // Only ever the organisation's reviewed status. An individual poster gets
    // no badge at all, whatever their own KYC says.
    employer_verified: org ? org.verified : undefined,
  }), [draft, org, posterName]);
}

/** Which step (and which of its fields) a server-side field name belongs to. */
const SERVER_FIELD_STEP: Record<string, [number, string]> = {
  title: [0, 'title'], vacancies: [0, 'vacancies'], specialty: [0, 'specialty'],
  city: [1, 'city'], shift_start_date: [1, 'shift_start_date'], shift_end_date: [1, 'shift_end_date'],
  expires_at: [1, 'expires_at'], shift_time: [1, 'shift_time'],
  pay_min: [2, 'pay'], pay_max: [2, 'pay'], experience_min: [2, 'experience_min'],
  description: [4, 'description'], responsibilities: [4, 'description'], screening_questions: [3, 'q0'],
};

/** Business-rule codes from the Jobs API, and the field each belongs to. */
export const JOB_ERROR_FIELDS: Record<string, string> = {
  start_in_past: 'shift_start_date', deadline_in_past: 'expires_at', deadline_after_start: 'expires_at',
};

/** "20:00–08:00" (or "20:00 - 08:00") into the two pickers; blank otherwise. */
export function splitShiftTime(value: string): { shift_start_time: string; shift_end_time: string } {
  const m = /^\s*([01]\d|2[0-3]):([0-5]\d)\s*[–-]\s*([01]\d|2[0-3]):([0-5]\d)\s*$/.exec(value || '');
  return m ? { shift_start_time: `${m[1]}:${m[2]}`, shift_end_time: `${m[3]}:${m[4]}` }
    : { shift_start_time: '', shift_end_time: '' };
}

/** "12 hours" / "8 hours 30 min", overnight aware. */
export function shiftDuration(start: string, end: string): string {
  const toMin = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3));
  let mins = toMin(end) - toMin(start);
  if (mins <= 0) mins += 24 * 60;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `${h} hour${h === 1 ? '' : 's'}${m ? ` ${m} min` : ''}`;
}

function Progress({ step }: { step: number }) {
  return (
    <View style={styles.progress}>
      <View style={styles.progressBar}>
        {STEPS.map((s, i) => (
          <View
            key={s.key}
            style={[styles.progressSeg, i <= step && styles.progressSegOn]}
          />
        ))}
      </View>
      {/* Announced, so a screen reader user knows they advanced. Numbers as
          well as the bar, because a bar alone says nothing out loud. */}
      <Text
        style={styles.progressText}
        accessibilityRole="text"
        accessibilityLiveRegion="polite"
        testID="wizard-progress"
      >
        Step {step + 1} of {STEPS.length}
      </Text>
    </View>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      {children}
    </View>
  );
}

function ChipRow({ children }: { children: React.ReactNode }) {
  return <View style={styles.chips}>{children}</View>;
}

function Choice({
  label, selected, onPress, testID,
}: {
  label: string; selected: boolean; onPress: () => void; testID?: string;
}) {
  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      accessibilityLabel={label}
      style={({ pressed }) => [styles.chip, selected && styles.chipOn, pressed && styles.pressed]}
    >
      <Text style={[styles.chipText, selected && styles.chipTextOn]}>{label}</Text>
    </Pressable>
  );
}

function SwitchRow({
  label, hint, value, onValueChange, danger,
}: {
  label: string; hint: string; value: boolean;
  onValueChange: (v: boolean) => void; danger?: boolean;
}) {
  return (
    <View style={styles.switchRow}>
      <View style={styles.flex}>
        <Text style={styles.label}>{label}</Text>
        <Text style={styles.hint}>{hint}</Text>
      </View>
      <Switch
        value={value}
        onValueChange={onValueChange}
        trackColor={{ true: danger ? colors.red : colors.teal, false: colors.border }}
        accessibilityLabel={label}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  progress: { paddingHorizontal: spacing.lg, paddingTop: spacing.md, gap: spacing.xs },
  progressBar: { flexDirection: 'row', gap: spacing.xs },
  progressSeg: {
    flex: 1, height: 4, borderRadius: 2, backgroundColor: colors.border,
  },
  progressSegOn: { backgroundColor: colors.navy },
  progressText: { ...typography.small, color: colors.textSecondary },

  body: { padding: spacing.lg, paddingBottom: spacing.xxxl, gap: spacing.xs },
  stepHead: { gap: spacing.xs, marginBottom: spacing.md },
  stepTitle: { ...typography.h2, color: colors.text },
  stepHint: { ...typography.caption, color: colors.textSecondary },

  field: { gap: spacing.sm, marginBottom: spacing.lg },
  label: { ...typography.label, color: colors.text },
  hint: { ...typography.small, color: colors.textSecondary, lineHeight: 18 },
  error: { ...typography.small, color: colors.redText, marginBottom: spacing.md },
  row: { flexDirection: 'row', gap: spacing.md },

  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  chip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.white,
    minHeight: 36,
    justifyContent: 'center',
  },
  chipOn: { backgroundColor: colors.navy, borderColor: colors.navy },
  chipText: { ...typography.caption, color: colors.textSecondary },
  chipTextOn: { color: colors.white, fontFamily: fonts.body.semibold },

  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    minHeight: MIN_TOUCH_TARGET,
    marginBottom: spacing.lg,
  },

  previewBlock: { gap: spacing.sm, marginTop: spacing.lg },
  previewLabel: { ...typography.overline, color: colors.teal },
  previewPanel: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.xl,
    backgroundColor: colors.white,
    overflow: 'hidden',
    maxHeight: 460,
  },

  linkRow: { alignSelf: 'flex-start', minHeight: MIN_TOUCH_TARGET, justifyContent: 'center' },
  link: { ...typography.caption, fontFamily: fonts.body.semibold, color: colors.navy },

  footer: {
    flexDirection: 'row',
    gap: spacing.md,
    padding: spacing.lg,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.white,
  },
  footerBtn: { flex: 1 },
  pressed: { opacity: 0.7 },
});
