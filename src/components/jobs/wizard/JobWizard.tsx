import React, { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { colors, radius, spacing, typography, fonts, MIN_TOUCH_TARGET } from '../../../theme';
import { Button } from '../../Button';
import { FormInput } from '../../FormInput';
import { SelectField } from '../../SelectField';
import { ErrorBanner } from '../../States';
import { OrgVerifiedBadge } from '../../organizations/OrgVerifiedBadge';
import { SPECIALTY_OPTIONS } from '../../../data/specialties';
import { STATE_NAMES, citiesForState } from '../../../data/indiaLocations';
import { JobCard } from '../JobCard';
import { JobDetailPanel } from '../JobDetailPanel';
import {
  EMPLOYMENT_TYPES, EMPLOYMENT_TYPE_LABELS, PAY_PERIOD_LABELS, WORK_MODE_LABELS,
  isShiftRole, type EmploymentType, type Job, type PayPeriod, type WorkMode,
} from '../../../types/jobs';
import type { Organization } from '../../../types/organizations';

const PAY_PERIODS = Object.keys(PAY_PERIOD_LABELS) as PayPeriod[];
const WORK_MODES = Object.keys(WORK_MODE_LABELS) as WorkMode[];

const MAX_SCREENING_QUESTIONS = 5;

export interface DraftQuestion {
  /** Present once the server has assigned one; absent for a question added
   *  in this session and not yet saved. */
  id?: string;
  text: string;
  required_answer: 'yes' | 'no';
  /** A "wrong" answer auto-declines the application. Off means the question
   *  is informational only — the employer still sees the answer. */
  knockout: boolean;
}

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
  screening_questions: DraftQuestion[];
}

const EMPTY: JobDraft = {
  title: '', employment_type: 'full_time', specialty: '', department: '', vacancies: '1',
  org_id: null, work_mode: 'onsite', state: '', city: '',
  shift_start_date: '', shift_end_date: '', shift_time: '', shift_duration: '',
  pay_period: 'month', pay_min: '', pay_max: '', pay_disclosed: true,
  experience_min: '', skills: '', requirements: '',
  description: '', responsibilities: '', is_urgent: false,
  screening_questions: [],
};

const STEPS = [
  { key: 'basics', title: 'The role', hint: 'What you are hiring for.' },
  { key: 'place', title: 'Place and schedule', hint: 'Where the work happens, and when.' },
  { key: 'terms', title: 'Terms', hint: 'Pay, experience and requirements.' },
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
}) {
  const [draft, setDraft] = useState<JobDraft>({ ...EMPTY, ...initial });
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
    const out: Record<number, Record<string, string>> = { 0: {}, 1: {}, 2: {}, 3: {} };
    if (draft.title.trim().length < 6) out[0].title = 'Give the role a full title.';
    if (needsCity && !draft.city) out[1].city = 'Choose a city, or set the role to remote.';
    if (shift && !draft.shift_start_date) {
      out[1].shift_start_date = 'A locum or temporary post needs a start date.';
    }
    const min = Number(draft.pay_min) || 0;
    const max = Number(draft.pay_max) || 0;
    if (min && max && max < min) out[2].pay = 'Maximum pay must be at least the minimum.';
    if (draft.description.trim().length < 40) {
      out[3].description = 'Describe the role in at least a couple of sentences.';
    }
    if (draft.screening_questions.some(q => q.text.trim().length < 4)) {
      out[3].screening = 'Give each screening question a full question, or remove it.';
    }
    return out;
  }, [draft, needsCity, shift]);

  const stepOk = (i: number) => Object.keys(problems[i] ?? {}).length === 0;
  const err = (i: number, key: string) => (touched[i] ? problems[i]?.[key] : undefined);

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
          shift_time: draft.shift_time.trim(),
          shift_duration: draft.shift_duration.trim(),
        }
      : {}),
    is_urgent: draft.is_urgent,
    ...(draft.org_id ? { org_id: draft.org_id, posted_as: 'organization' } : {}),
    // Blank rows are dropped rather than sent — a question with no text
    // would fail server validation anyway, and `problems[3].screening`
    // already blocks Next on one, so this only ever strips ones nobody
    // finished typing before backing out.
    screening_questions: draft.screening_questions
      .filter(q => q.text.trim().length >= 4)
      .map(q => ({
        ...(q.id ? { id: q.id } : {}),
        text: q.text.trim(),
        required_answer: q.required_answer,
        knockout: q.knockout,
      })),
  });

  const finish = (publish: boolean) => {
    // Every step is checked here, not just the last: someone can reach step four
    // by going back and forth, and a draft with a broken pay range would be
    // rejected by the server anyway.
    setTouched({ 0: true, 1: true, 2: true, 3: true });
    const firstBad = [0, 1, 2, 3].find(i => !stepOk(i));
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
                  <Choice
                    label="Myself"
                    selected={draft.org_id === null}
                    onPress={() => set('org_id', null)}
                    testID="wizard-as-self"
                  />
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
                ) : (
                  <Text style={styles.hint}>This role will show your own name as the employer.</Text>
                )}
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

            <FormInput
              label="Job title"
              value={draft.title}
              onChangeText={v => set('title', v)}
              placeholder="e.g. Senior Consultant Cardiologist"
              error={err(0, 'title')}
              testID="wizard-title"
            />

            <Field label="Opportunity type">
              <ChipRow>
                {EMPLOYMENT_TYPES.map(t => (
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
            <FormInput
              label="Department (optional)"
              value={draft.department}
              onChangeText={v => set('department', v)}
              placeholder="e.g. Cardiology"
            />
            <FormInput
              label="Number of openings"
              value={draft.vacancies}
              onChangeText={v => set('vacancies', v)}
              keyboardType="number-pad"
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
                <FormInput
                  label="Start date"
                  value={draft.shift_start_date}
                  onChangeText={v => set('shift_start_date', v)}
                  placeholder="YYYY-MM-DD"
                  error={err(1, 'shift_start_date')}
                  testID="wizard-shift-start"
                />
                <FormInput
                  label="End date (optional)"
                  value={draft.shift_end_date}
                  onChangeText={v => set('shift_end_date', v)}
                  placeholder="YYYY-MM-DD"
                />
                <FormInput
                  label="Shift time"
                  value={draft.shift_time}
                  onChangeText={v => set('shift_time', v)}
                  placeholder="e.g. 20:00 – 08:00"
                />
                <FormInput
                  label="Duration"
                  value={draft.shift_duration}
                  onChangeText={v => set('shift_duration', v)}
                  placeholder="e.g. 12 hours"
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
                    <FormInput
                      label="From"
                      value={draft.pay_min}
                      onChangeText={v => set('pay_min', v)}
                      keyboardType="number-pad"
                      placeholder="₹"
                      testID="wizard-pay-min"
                    />
                  </View>
                  <View style={styles.flex}>
                    <FormInput
                      label="To"
                      value={draft.pay_max}
                      onChangeText={v => set('pay_max', v)}
                      keyboardType="number-pad"
                      placeholder="₹"
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

            <FormInput
              label="Minimum years of experience"
              value={draft.experience_min}
              onChangeText={v => set('experience_min', v)}
              keyboardType="number-pad"
              placeholder="0"
            />
            <FormInput
              label="Skills"
              value={draft.skills}
              onChangeText={v => set('skills', v)}
              placeholder="Comma separated, e.g. Echocardiography, Angioplasty"
            />
            <FormInput
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
          <>
            <FormInput
              label="About the role"
              value={draft.description}
              onChangeText={v => set('description', v)}
              placeholder="Responsibilities, the team, the setting, and what makes this role worth taking."
              multiline
              rows={5}
              error={err(3, 'description')}
              testID="wizard-description"
            />
            <FormInput
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

            <ScreeningQuestionsField
              questions={draft.screening_questions}
              onChange={v => set('screening_questions', v)}
              error={err(3, 'screening')}
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
    shift_time: draft.shift_time,
    shift_duration: draft.shift_duration,
    is_urgent: draft.is_urgent,
    status: 'active',
    // The preview is what a candidate sees, and a candidate never sees
    // required_answer/knockout — only the question text, same as job_view()
    // withholds them server-side for anyone but the owner.
    screening_questions: draft.screening_questions
      .filter(q => q.text.trim().length >= 4)
      .map((q, i) => ({ id: q.id || `preview-${i}`, text: q.text.trim() })),
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

/**
 * Up to five yes/no questions, each optionally a knockout.
 *
 * Deliberately not folded into `Field`/`ChipRow`: each row needs its own text
 * input plus two independent controls (which answer counts, and whether a
 * miss auto-declines), which is enough state that a generic wrapper would
 * just be an extra layer between this and the JSX it renders.
 */
function ScreeningQuestionsField({
  questions, onChange, error,
}: {
  questions: DraftQuestion[];
  onChange: (next: DraftQuestion[]) => void;
  error?: string;
}) {
  const update = (i: number, patch: Partial<DraftQuestion>) =>
    onChange(questions.map((q, idx) => (idx === i ? { ...q, ...patch } : q)));

  const remove = (i: number) => onChange(questions.filter((_, idx) => idx !== i));

  const add = () =>
    onChange([...questions, { text: '', required_answer: 'yes', knockout: true }]);

  return (
    <Field label="Screening questions (optional)">
      <Text style={styles.hint}>
        Ask up to {MAX_SCREENING_QUESTIONS} yes/no questions before someone can apply. Mark one as
        required and a &quot;wrong&quot; answer declines the application automatically, before it
        reaches your inbox.
      </Text>

      {questions.map((q, i) => (
        <View key={i} style={styles.questionCard} testID={`wizard-question-${i}`}>
          <View style={styles.questionHead}>
            <Text style={styles.questionIndex}>Question {i + 1}</Text>
            <Pressable
              onPress={() => remove(i)}
              accessibilityRole="button"
              accessibilityLabel={`Remove question ${i + 1}`}
              style={({ pressed }) => [styles.questionRemove, pressed && styles.pressed]}
              testID={`wizard-question-${i}-remove`}
            >
              <Text style={styles.link}>Remove</Text>
            </Pressable>
          </View>

          <FormInput
            label="Question"
            value={q.text}
            onChangeText={v => update(i, { text: v })}
            placeholder="e.g. Do you have an active nursing license?"
            testID={`wizard-question-${i}-text`}
          />

          <View style={styles.row}>
            <View style={styles.flex}>
              <Text style={styles.questionSubLabel}>Qualifying answer</Text>
              <ChipRow>
                <Choice
                  label="Yes"
                  selected={q.required_answer === 'yes'}
                  onPress={() => update(i, { required_answer: 'yes' })}
                  testID={`wizard-question-${i}-answer-yes`}
                />
                <Choice
                  label="No"
                  selected={q.required_answer === 'no'}
                  onPress={() => update(i, { required_answer: 'no' })}
                  testID={`wizard-question-${i}-answer-no`}
                />
              </ChipRow>
            </View>
          </View>

          <SwitchRow
            label="Required to apply"
            hint="On: a different answer auto-declines the application. Off: the answer is shown to you, but never blocks anyone."
            value={q.knockout}
            onValueChange={v => update(i, { knockout: v })}
            danger={q.knockout}
          />
        </View>
      ))}

      {error ? <Text style={styles.error}>{error}</Text> : null}

      {questions.length < MAX_SCREENING_QUESTIONS ? (
        <Pressable
          onPress={add}
          accessibilityRole="button"
          accessibilityLabel="Add a screening question"
          style={({ pressed }) => [styles.linkRow, pressed && styles.pressed]}
          testID="wizard-add-question"
        >
          <Text style={styles.link}>+ Add a question</Text>
        </Pressable>
      ) : null}
    </Field>
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

  questionCard: {
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.bgMuted,
    marginBottom: spacing.md,
  },
  questionHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  questionIndex: { ...typography.small, fontFamily: fonts.body.semibold, color: colors.textSecondary },
  questionRemove: { minHeight: MIN_TOUCH_TARGET, justifyContent: 'center' },
  questionSubLabel: { ...typography.small, color: colors.textSecondary, marginBottom: spacing.xs },

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
