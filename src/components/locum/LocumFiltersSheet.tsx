import React, { useEffect, useState } from 'react';
import { FormScrollView } from '../FormScrollView';
import { ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { colors, spacing, typography } from '../../theme';
import { Button } from '../Button';
import { FormInput } from '../FormInput';
import { SelectField } from '../SelectField';
import { Sheet } from '../Sheet';
import { ChoiceChips } from './ChoiceChips';
import { toDayString } from './LocumMeta';
import { SPECIALTIES } from '../../data/specialties';
import {
  LOCUM_ROLE_LABELS, LOCUM_SORT_LABELS,
  type LocumFilters, type LocumRole, type LocumSort,
} from '../../types/locum';

type DateWindow = 'today' | 'tomorrow' | 'week';

const addDays = (d: Date, n: number) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);

/** The date filter as the server wants it: an inclusive from/to pair. */
export function dateWindow(choice: DateWindow | null, now = new Date()): Pick<LocumFilters, 'date_from' | 'date_to'> {
  if (!choice) return { date_from: undefined, date_to: undefined };
  const today = toDayString(now);
  if (choice === 'today') return { date_from: today, date_to: today };
  if (choice === 'tomorrow') {
    const t = toDayString(addDays(now, 1));
    return { date_from: t, date_to: t };
  }
  return { date_from: today, date_to: toDayString(addDays(now, 6)) };
}

function windowOf(filters: LocumFilters, now = new Date()): DateWindow | null {
  for (const choice of ['today', 'tomorrow', 'week'] as DateWindow[]) {
    const w = dateWindow(choice, now);
    if (w.date_from === filters.date_from && w.date_to === filters.date_to) return choice;
  }
  return null;
}

/**
 * The handful of filters a locum search needs, and no more. Jobs has salary
 * bands, work modes and experience ranges; a locum search is "what, when,
 * where, and is it worth it", so that is what this asks.
 */
export function LocumFiltersSheet({
  visible, filters, onClose, onApply,
}: {
  visible: boolean;
  filters: LocumFilters;
  onClose: () => void;
  onApply: (filters: LocumFilters) => void;
}) {
  const [draft, setDraft] = useState<LocumFilters>(filters);
  useEffect(() => { if (visible) setDraft(filters); }, [visible, filters]);
  const set = (patch: Partial<LocumFilters>) => setDraft(prev => ({ ...prev, ...patch }));

  return (
    <Sheet
      visible={visible}
      scroll={false}
      onClose={onClose}
      title="Filter locums"
      testID="locum-filters"
      footer={
        <>
          <Button label="Clear all" variant="outline" style={styles.flex}
            onPress={() => setDraft({ sort: draft.sort })} />
          <Button label="Show locums" style={styles.flex} testID="locum-filters-apply"
            onPress={() => onApply(draft)} />
        </>
      }
    >
      <FormScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
        <ChoiceChips
          label="When"
          choices={[
            { value: 'today', label: 'Today' },
            { value: 'tomorrow', label: 'Tomorrow' },
            { value: 'week', label: 'Next 7 days' },
          ]}
          value={windowOf(draft)}
          onChange={choice => set(dateWindow(choice as DateWindow | null))}
          allowDeselect
          testID="locum-filter-date"
        />
        <SelectField
          label="Specialty"
          value={draft.specialty || ''}
          onChange={v => set({ specialty: v })}
          options={SPECIALTIES}
          placeholder="Any specialty"
          testID="locum-filter-specialty"
        />
        <ChoiceChips
          label="Role"
          choices={(Object.keys(LOCUM_ROLE_LABELS) as LocumRole[])
            .map(value => ({ value, label: LOCUM_ROLE_LABELS[value] }))}
          value={draft.role_required}
          onChange={v => set({ role_required: v ?? undefined })}
          allowDeselect
          testID="locum-filter-role"
        />
        <FormInput maxLength={80} label="City" value={draft.city || ''} placeholder="Any city"
          onChangeText={v => set({ city: v })} icon="location-outline" />
        <FormInput label="Minimum pay (₹)" value={draft.pay_min ? String(draft.pay_min) : ''}
          keyboardType="number-pad" placeholder="Any"
          onChangeText={v => set({ pay_min: Number(v.replace(/[^0-9]/g, '')) || undefined })} />
        <View style={styles.switchRow}>
          <Text style={styles.label}>Verified organisations only</Text>
          <Switch
            value={!!draft.verified_only}
            onValueChange={v => set({ verified_only: v })}
            trackColor={{ true: colors.teal, false: colors.border }}
            accessibilityLabel="Verified organisations only"
            testID="locum-filter-verified"
          />
        </View>
        <ChoiceChips
          label="Sort by"
          choices={(Object.keys(LOCUM_SORT_LABELS) as LocumSort[])
            .map(value => ({ value, label: LOCUM_SORT_LABELS[value] }))}
          value={draft.sort || 'soonest'}
          onChange={v => set({ sort: v ?? 'soonest' })}
        />
      </FormScrollView>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  body: { paddingHorizontal: spacing.xl, paddingBottom: spacing.lg, gap: spacing.lg },
  label: { ...typography.label, color: colors.text, flex: 1 },
  switchRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
});
