import React, { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import { colors, radius, spacing, typography, fonts, MIN_TOUCH_TARGET } from '../../theme';
import { Sheet } from '../Sheet';
import { Button } from '../Button';
import { SelectField } from '../SelectField';
import { SPECIALTY_OPTIONS } from '../../data/specialties';
import { STATE_NAMES, citiesForState } from '../../data/indiaLocations';
import {
  EMPLOYMENT_TYPES, EMPLOYMENT_TYPE_LABELS, WORK_MODE_LABELS,
  type EmploymentType, type JobFilters, type WorkMode,
} from '../../types/jobs';

const WORK_MODES = Object.keys(WORK_MODE_LABELS) as WorkMode[];

const POSTED_WITHIN: { days: number; label: string }[] = [
  { days: 1, label: 'Last 24 hours' },
  { days: 3, label: 'Last 3 days' },
  { days: 7, label: 'Last week' },
  { days: 30, label: 'Last month' },
];

const EXPERIENCE_STEPS: { years: number; label: string }[] = [
  { years: 0, label: 'No experience needed' },
  { years: 2, label: 'Up to 2 years' },
  { years: 5, label: 'Up to 5 years' },
  { years: 10, label: 'Up to 10 years' },
];

/**
 * The full filter set, in a sheet.
 *
 * Edits are held in local draft state and only handed back on "Show jobs".
 * Applying each toggle live would refetch the list underneath a sheet the user
 * cannot see it through, and on a slow connection would leave them tapping into
 * a moving target.
 *
 * Specialty and city are `SelectField` rather than chips because the lists are
 * ~130 and ~1000 entries; the chip treatment used elsewhere works to about six.
 * City is cleared whenever state changes — a city from the previous state is
 * always wrong, and leaving it silently returns nothing.
 */
export function JobFiltersSheet({
  visible, filters, onClose, onApply,
}: {
  visible: boolean;
  filters: JobFilters;
  onClose: () => void;
  onApply: (next: JobFilters) => void;
}) {
  const [draft, setDraft] = useState<JobFilters>(filters);

  // Re-seed each time it opens, so a cancelled edit does not leak into the next.
  useEffect(() => { if (visible) setDraft(filters); }, [visible, filters]);

  const set = <K extends keyof JobFilters>(key: K, value: JobFilters[K]) =>
    setDraft(prev => ({ ...prev, [key]: value }));

  const toggleType = (type: EmploymentType) => {
    const current = draft.employment_type ?? [];
    set('employment_type',
      current.includes(type) ? current.filter(t => t !== type) : [...current, type]);
  };

  const clearAll = () =>
    // The query and the sort are not filters and survive a clear: wiping the
    // search box from a "Clear filters" button is never what was meant.
    setDraft({ q: draft.q, sort: draft.sort });

  return (
    <Sheet
      visible={visible}
      onClose={onClose}
      title="Filter jobs"
      testID="jobs-filters-sheet"
      footer={
        <>
          <Button label="Clear all" variant="outline" onPress={clearAll} style={styles.footerBtn} />
          <Button
            label="Show jobs"
            onPress={() => onApply(draft)}
            style={styles.footerBtn}
            testID="jobs-filters-apply"
          />
        </>
      }
    >
      <ScrollView
        contentContainerStyle={styles.body}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <Section title="Specialty">
          <SelectField
            label="Specialty"
            hideLabel
            value={draft.specialty ?? ''}
            onChange={v => set('specialty', v)}
            options={SPECIALTY_OPTIONS}
            placeholder="Any specialty"
            icon="medical-outline"
            containerStyle={styles.field}
            testID="filter-specialty"
          />
        </Section>

        <Section title="Location">
          <SelectField
            label="State"
            hideLabel
            value={draft.state ?? ''}
            onChange={v => setDraft(prev => ({ ...prev, state: v, city: undefined }))}
            options={STATE_NAMES}
            placeholder="Any state"
            icon="map-outline"
            containerStyle={styles.field}
            testID="filter-state"
          />
          <SelectField
            label="City"
            hideLabel
            value={draft.city ?? ''}
            onChange={v => set('city', v)}
            options={citiesForState(draft.state)}
            placeholder="Any city"
            icon="location-outline"
            disabled={!draft.state}
            disabledHint="Choose a state first"
            containerStyle={styles.field}
            testID="filter-city"
          />
        </Section>

        <Section title="Opportunity type">
          <ChipRow>
            {EMPLOYMENT_TYPES.map(type => (
              <FilterChip
                key={type}
                label={EMPLOYMENT_TYPE_LABELS[type]}
                selected={(draft.employment_type ?? []).includes(type)}
                onPress={() => toggleType(type)}
                testID={`filter-type-${type}`}
              />
            ))}
          </ChipRow>
        </Section>

        <Section title="Work mode">
          <ChipRow>
            {WORK_MODES.map(mode => (
              <FilterChip
                key={mode}
                label={WORK_MODE_LABELS[mode]}
                selected={draft.work_mode === mode}
                onPress={() => set('work_mode', draft.work_mode === mode ? undefined : mode)}
                testID={`filter-mode-${mode}`}
              />
            ))}
          </ChipRow>
        </Section>

        <Section title="Monthly pay" hint="Matches any role whose range overlaps yours.">
          <View style={styles.payRow}>
            <PayInput
              label="From"
              value={draft.pay_min}
              onChange={v => set('pay_min', v)}
              testID="filter-pay-min"
            />
            <PayInput
              label="To"
              value={draft.pay_max}
              onChange={v => set('pay_max', v)}
              testID="filter-pay-max"
            />
          </View>
        </Section>

        <Section title="Experience">
          <ChipRow>
            {EXPERIENCE_STEPS.map(step => (
              <FilterChip
                key={step.years}
                label={step.label}
                selected={draft.experience_max === step.years}
                onPress={() =>
                  set('experience_max', draft.experience_max === step.years ? undefined : step.years)
                }
                testID={`filter-exp-${step.years}`}
              />
            ))}
          </ChipRow>
        </Section>

        <Section title="Date posted">
          <ChipRow>
            {POSTED_WITHIN.map(option => (
              <FilterChip
                key={option.days}
                label={option.label}
                selected={draft.posted_within_days === option.days}
                onPress={() =>
                  set('posted_within_days',
                    draft.posted_within_days === option.days ? undefined : option.days)
                }
                testID={`filter-posted-${option.days}`}
              />
            ))}
          </ChipRow>
        </Section>

        <View style={styles.switchRow}>
          <View style={styles.switchLabel}>
            <Text style={styles.sectionTitle}>Urgent cover only</Text>
            <Text style={styles.hint}>Shifts and roles the employer flagged as urgent.</Text>
          </View>
          <Switch
            value={!!draft.urgent_only}
            onValueChange={v => set('urgent_only', v || undefined)}
            trackColor={{ true: colors.teal, false: colors.border }}
            accessibilityLabel="Show urgent roles only"
            testID="filter-urgent"
          />
        </View>
      </ScrollView>
    </Sheet>
  );
}

function Section({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle} accessibilityRole="header">{title}</Text>
      {hint ? <Text style={styles.hint}>{hint}</Text> : null}
      {children}
    </View>
  );
}

/** Wraps, so no option is ever clipped out of reach. */
function ChipRow({ children }: { children: React.ReactNode }) {
  return <View style={styles.chipRow}>{children}</View>;
}

function FilterChip({
  label, selected, onPress, testID,
}: {
  label: string; selected: boolean; onPress: () => void; testID?: string;
}) {
  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      accessibilityRole="checkbox"
      accessibilityState={{ checked: selected }}
      accessibilityLabel={label}
      style={({ pressed }) => [
        styles.chip, selected && styles.chipSelected, pressed && styles.pressed,
      ]}
    >
      <Text style={[styles.chipText, selected && styles.chipTextSelected]}>{label}</Text>
    </Pressable>
  );
}

function PayInput({
  label, value, onChange, testID,
}: {
  label: string; value?: number; onChange: (v: number | undefined) => void; testID?: string;
}) {
  return (
    <View style={styles.payField}>
      <Text style={styles.payLabel}>{label}</Text>
      <TextInput
        testID={testID}
        style={styles.payInput}
        value={value == null ? '' : String(value)}
        onChangeText={text => {
          const digits = text.replace(/[^0-9]/g, '');
          onChange(digits ? Number(digits) : undefined);
        }}
        keyboardType="number-pad"
        placeholder="₹ per month"
        placeholderTextColor={colors.textMuted}
        accessibilityLabel={`${label} monthly pay`}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  body: { padding: spacing.xl, paddingTop: spacing.md, gap: spacing.xl },
  section: { gap: spacing.sm },
  sectionTitle: { ...typography.label, color: colors.text },
  hint: { ...typography.small, color: colors.textSecondary },
  field: { marginBottom: 0 },

  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
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
  payField: { flex: 1, gap: spacing.xs },
  payLabel: { ...typography.small, color: colors.textSecondary },
  payInput: {
    ...typography.body,
    color: colors.text,
    backgroundColor: colors.bg,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    paddingHorizontal: spacing.md,
    minHeight: MIN_TOUCH_TARGET,
  },

  switchRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  switchLabel: { flex: 1, gap: spacing.xs },
  footerBtn: { flex: 1 },
  pressed: { opacity: 0.7 },
});
