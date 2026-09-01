import React, { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { colors, radius, spacing, typography, fonts, MIN_TOUCH_TARGET } from '../../theme';
import { Sheet } from '../Sheet';
import { Button } from '../Button';
import { FormInput } from '../FormInput';
import { SelectField } from '../SelectField';
import { ErrorBanner } from '../States';
import { SPECIALTY_OPTIONS } from '../../data/specialties';
import { STATE_NAMES, citiesForState } from '../../data/indiaLocations';
import {
  EMPLOYMENT_TYPES, EMPLOYMENT_TYPE_LABELS, PAY_PERIOD_LABELS, WORK_MODE_LABELS,
  isShiftRole, type EmploymentType, type PayPeriod, type WorkMode,
} from '../../types/jobs';

const PAY_PERIODS = Object.keys(PAY_PERIOD_LABELS) as PayPeriod[];
const WORK_MODES = Object.keys(WORK_MODE_LABELS) as WorkMode[];

/**
 * Post an opportunity.
 *
 * A single structured form, not the multi-step wizard with preview and drafts —
 * that arrives with organisations, when there is an org to post on behalf of
 * and a preview worth showing. What this already fixes is the part that was
 * actually broken: the old form was six free-text boxes with no validation, so
 * "Location" was whatever the poster typed and could not be filtered on at all.
 *
 * Specialty, state and city are pickers over the same lists the profile uses,
 * which is what makes a posted job findable. City clears when state changes,
 * because a city from the previous state is always wrong.
 *
 * Shift fields appear only for the employment types that have dates. The server
 * rejects a full-time role carrying a shift date and a locum without one, so
 * showing those fields for every type would just invite a 422.
 */
export function PostJobSheet({
  visible, onClose, onSubmit, submitting, error,
}: {
  visible: boolean;
  onClose: () => void;
  onSubmit: (payload: Record<string, unknown>) => void;
  submitting?: boolean;
  error?: string | null;
}) {
  const [title, setTitle] = useState('');
  const [employmentType, setEmploymentType] = useState<EmploymentType>('full_time');
  const [specialty, setSpecialty] = useState('');
  const [department, setDepartment] = useState('');
  const [workMode, setWorkMode] = useState<WorkMode>('onsite');
  const [state, setState] = useState('');
  const [city, setCity] = useState('');
  const [payMin, setPayMin] = useState('');
  const [payMax, setPayMax] = useState('');
  const [payPeriod, setPayPeriod] = useState<PayPeriod>('month');
  const [payDisclosed, setPayDisclosed] = useState(true);
  const [experienceMin, setExperienceMin] = useState('');
  const [vacancies, setVacancies] = useState('1');
  const [skills, setSkills] = useState('');
  const [description, setDescription] = useState('');
  const [requirements, setRequirements] = useState('');
  const [shiftStart, setShiftStart] = useState('');
  const [shiftEnd, setShiftEnd] = useState('');
  const [shiftTime, setShiftTime] = useState('');
  const [shiftDuration, setShiftDuration] = useState('');
  const [isUrgent, setIsUrgent] = useState(false);
  const [touched, setTouched] = useState(false);

  useEffect(() => { if (visible) setTouched(false); }, [visible]);

  const shift = isShiftRole(employmentType);
  const needsCity = workMode !== 'remote';

  // Mirrors the server's rules so the user is told before a round trip, not by
  // a 422 after one. The server remains the authority.
  const problems = useMemo(() => {
    const out: Record<string, string> = {};
    if (title.trim().length < 6) out.title = 'Give the role a full title.';
    if (description.trim().length < 40) {
      out.description = 'Describe the role in at least a couple of sentences.';
    }
    if (needsCity && !city) out.city = 'Choose a city, or set the role to remote.';
    if (shift && !shiftStart) out.shiftStart = 'A locum or temporary post needs a start date.';
    const min = Number(payMin) || 0;
    const max = Number(payMax) || 0;
    if (min && max && max < min) out.pay = 'Maximum pay must be at least the minimum.';
    return out;
  }, [title, description, needsCity, city, shift, shiftStart, payMin, payMax]);

  const submit = () => {
    setTouched(true);
    if (Object.keys(problems).length) return;
    onSubmit({
      title: title.trim(),
      employment_type: employmentType,
      specialty,
      department: department.trim(),
      description: description.trim(),
      requirements: requirements.trim(),
      city: needsCity ? city : '',
      state: needsCity ? state : '',
      work_mode: workMode,
      pay_min: Number(payMin) || 0,
      pay_max: Number(payMax) || 0,
      pay_period: payPeriod,
      pay_disclosed: payDisclosed,
      experience_min: Number(experienceMin) || 0,
      vacancies: Number(vacancies) || 1,
      skills: skills.split(',').map(s => s.trim()).filter(Boolean),
      // Omitted rather than sent empty: the server rejects shift fields on a
      // standing post, and "" is still a value.
      ...(shift
        ? {
            shift_start_date: shiftStart,
            ...(shiftEnd ? { shift_end_date: shiftEnd } : {}),
            shift_time: shiftTime.trim(),
            shift_duration: shiftDuration.trim(),
          }
        : {}),
      is_urgent: isUrgent,
    });
  };

  const err = (key: string) => (touched ? problems[key] : undefined);

  return (
    <Sheet
      visible={visible}
      onClose={onClose}
      title="Post an opportunity"
      testID="post-job-sheet"
      maxWidth={640}
      footer={
        <>
          <Button label="Cancel" variant="outline" onPress={onClose} style={styles.footerBtn} />
          <Button
            label="Publish"
            onPress={submit}
            loading={submitting}
            style={styles.footerBtn}
            testID="post-job-submit"
          />
        </>
      }
    >
      <ScrollView
        contentContainerStyle={styles.body}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <ErrorBanner message={error} />

        <Section title="The role">
          <FormInput
            label="Job title"
            value={title}
            onChangeText={setTitle}
            placeholder="e.g. Senior Consultant Cardiologist"
            error={err('title')}
            testID="post-title"
          />
          <Label>Opportunity type</Label>
          <ChipRow>
            {EMPLOYMENT_TYPES.map(type => (
              <Choice
                key={type}
                label={EMPLOYMENT_TYPE_LABELS[type]}
                selected={employmentType === type}
                onPress={() => setEmploymentType(type)}
                testID={`post-type-${type}`}
              />
            ))}
          </ChipRow>
          <SelectField
            label="Specialty"
            value={specialty}
            onChange={setSpecialty}
            options={SPECIALTY_OPTIONS}
            placeholder="Select a specialty"
            icon="medical-outline"
            testID="post-specialty"
          />
          <FormInput
            label="Department (optional)"
            value={department}
            onChangeText={setDepartment}
            placeholder="e.g. Cardiology"
          />
          <FormInput
            label="Number of openings"
            value={vacancies}
            onChangeText={setVacancies}
            keyboardType="number-pad"
          />
        </Section>

        <Section title="Where">
          <Label>Work mode</Label>
          <ChipRow>
            {WORK_MODES.map(mode => (
              <Choice
                key={mode}
                label={WORK_MODE_LABELS[mode]}
                selected={workMode === mode}
                onPress={() => setWorkMode(mode)}
                testID={`post-mode-${mode}`}
              />
            ))}
          </ChipRow>
          {needsCity ? (
            <>
              <SelectField
                label="State"
                value={state}
                onChange={v => { setState(v); setCity(''); }}
                options={STATE_NAMES}
                placeholder="Select a state"
                icon="map-outline"
                testID="post-state"
              />
              <SelectField
                label="City"
                value={city}
                onChange={setCity}
                options={citiesForState(state)}
                placeholder="Select a city"
                icon="location-outline"
                disabled={!state}
                disabledHint="Choose a state first"
                helper={err('city')}
                testID="post-city"
              />
            </>
          ) : (
            <Text style={styles.hint}>Remote roles do not need a location.</Text>
          )}
        </Section>

        {shift ? (
          <Section title="Shift details">
            <FormInput
              label="Start date"
              value={shiftStart}
              onChangeText={setShiftStart}
              placeholder="YYYY-MM-DD"
              error={err('shiftStart')}
              testID="post-shift-start"
            />
            <FormInput
              label="End date (optional)"
              value={shiftEnd}
              onChangeText={setShiftEnd}
              placeholder="YYYY-MM-DD"
            />
            <FormInput
              label="Shift time"
              value={shiftTime}
              onChangeText={setShiftTime}
              placeholder="e.g. 20:00 – 08:00"
            />
            <FormInput
              label="Duration"
              value={shiftDuration}
              onChangeText={setShiftDuration}
              placeholder="e.g. 12 hours"
            />
          </Section>
        ) : null}

        <Section title="Compensation">
          <View style={styles.switchRow}>
            <View style={styles.switchLabel}>
              <Text style={styles.label}>Show pay on the listing</Text>
              <Text style={styles.hint}>
                Listings with a published figure get noticeably more applications.
              </Text>
            </View>
            <Switch
              value={payDisclosed}
              onValueChange={setPayDisclosed}
              trackColor={{ true: colors.teal, false: colors.border }}
              accessibilityLabel="Show pay on the listing"
            />
          </View>
          {payDisclosed ? (
            <>
              <View style={styles.payRow}>
                <FormInput
                  label="From"
                  value={payMin}
                  onChangeText={setPayMin}
                  keyboardType="number-pad"
                  placeholder="₹"
                />
                <FormInput
                  label="To"
                  value={payMax}
                  onChangeText={setPayMax}
                  keyboardType="number-pad"
                  placeholder="₹"
                />
              </View>
              {err('pay') ? <Text style={styles.error}>{err('pay')}</Text> : null}
              <Label>Paid</Label>
              <ChipRow>
                {PAY_PERIODS.map(period => (
                  <Choice
                    key={period}
                    label={PAY_PERIOD_LABELS[period]}
                    selected={payPeriod === period}
                    onPress={() => setPayPeriod(period)}
                    testID={`post-period-${period}`}
                  />
                ))}
              </ChipRow>
            </>
          ) : null}
        </Section>

        <Section title="Requirements">
          <FormInput
            label="Minimum years of experience"
            value={experienceMin}
            onChangeText={setExperienceMin}
            keyboardType="number-pad"
            placeholder="0"
          />
          <FormInput
            label="Skills"
            value={skills}
            onChangeText={setSkills}
            placeholder="Comma separated, e.g. Echocardiography, Angioplasty"
          />
          <FormInput
            label="Qualifications and registration"
            value={requirements}
            onChangeText={setRequirements}
            placeholder="e.g. MD/DM Cardiology, valid NMC registration"
            multiline
            rows={4}
          />
        </Section>

        <Section title="Description">
          <FormInput
            label="About the role"
            value={description}
            onChangeText={setDescription}
            placeholder="Responsibilities, the team, the setting, and what makes this role worth taking."
            multiline
            rows={4}
            error={err('description')}
            testID="post-description"
          />
          <View style={styles.switchRow}>
            <View style={styles.switchLabel}>
              <Text style={styles.label}>Mark as urgent</Text>
              <Text style={styles.hint}>
                Only for cover you genuinely need filled quickly.
              </Text>
            </View>
            <Switch
              value={isUrgent}
              onValueChange={setIsUrgent}
              trackColor={{ true: colors.red, false: colors.border }}
              accessibilityLabel="Mark as urgent"
            />
          </View>
        </Section>
      </ScrollView>
    </Sheet>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle} accessibilityRole="header">{title}</Text>
      {children}
    </View>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return <Text style={styles.label}>{children}</Text>;
}

function ChipRow({ children }: { children: React.ReactNode }) {
  return <View style={styles.chipRow}>{children}</View>;
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
      style={({ pressed }) => [
        styles.chip, selected && styles.chipSelected, pressed && styles.pressed,
      ]}
    >
      <Text style={[styles.chipText, selected && styles.chipTextSelected]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  body: { padding: spacing.xl, paddingTop: spacing.md, gap: spacing.xl },
  section: { gap: spacing.sm },
  sectionTitle: { ...typography.overline, color: colors.teal },
  label: { ...typography.label, color: colors.text },
  hint: { ...typography.small, color: colors.textSecondary },
  error: { ...typography.small, color: colors.redText },

  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginBottom: spacing.md },
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
  chipSelected: { backgroundColor: colors.navy, borderColor: colors.navy },
  chipText: { ...typography.caption, color: colors.textSecondary },
  chipTextSelected: { color: colors.white, fontFamily: fonts.body.semibold },

  payRow: { flexDirection: 'row', gap: spacing.md },
  switchRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, minHeight: MIN_TOUCH_TARGET },
  switchLabel: { flex: 1, gap: 2 },
  footerBtn: { flex: 1 },
  pressed: { opacity: 0.7 },
});
