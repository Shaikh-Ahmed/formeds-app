import React, { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, fonts, radius, spacing, typography, MIN_TOUCH_TARGET } from '../../../theme';
import { Button } from '../../Button';
import { Chip } from '../../Chip';
import { FormInput } from '../../FormInput';
import { NumberField, TimeField } from '../../InputFields';
import { SelectField } from '../../SelectField';
import { Sheet } from '../../Sheet';
import { ErrorBanner } from '../../States';
import { ChoiceChips } from '../../locum/ChoiceChips';
import { errorFields } from '../../../utils/api';
import {
  firstError, validateContactPhone, validateOptionalEmail, validatePincode, validateUrl,
} from '../../../utils/validation';
import { CLINIC_SUBTYPES, HOSPITAL_SUBTYPES } from '../../../data/orgOptions';
import {
  ORG_OWNERSHIP_LABELS, WEEKDAYS, type OrgLink, type OrgOpeningHours, type Organization,
} from '../../../types/organizations';

/**
 * Section-by-section editing for a hospital or clinic page. Each sheet sends
 * only its own fields; the server re-validates everything (and refuses
 * hospital-only fields for a clinic) whatever a sheet sends.
 */

export type OrgSheet =
  | { kind: 'basic' } | { kind: 'contact' } | { kind: 'hours' }
  | { kind: 'terms'; field: TermField; title: string; suggestions: string[]; hint?: string };

export type TermField = 'specialties' | 'services' | 'facilities' | 'accreditations' | 'research_focus'
  | 'academic_programs';

const flex = { flex: 1 };

function useSheetState<T>(open: boolean, init: () => T): [T, React.Dispatch<React.SetStateAction<T>>] {
  const [v, setV] = useState<T>(init);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { if (open) setV(init()); }, [open]);
  return [v, setV];
}

function Footer({ onClose, onSave, saving, testID }: {
  onClose: () => void; onSave: () => void; saving?: boolean; testID?: string;
}) {
  return (
    <>
      <Button label="Cancel" variant="outline" onPress={onClose} style={flex} />
      <Button label="Save" onPress={onSave} loading={saving} style={flex} testID={testID} />
    </>
  );
}

// ── Basic information ────────────────────────────────────────────────────────

export function BasicInfoSheet({ org, open, onClose, onSave, saving, error }: {
  org: Organization; open: boolean; onClose: () => void;
  onSave: (patch: Record<string, unknown>) => void; saving?: boolean; error?: unknown;
}) {
  const isHospital = org.org_type === 'hospital';
  const [f, setF] = useSheetState(open, () => ({
    name: org.name, subtype: org.subtype || '', headline: org.headline || '', about: org.about || '',
    founded: org.founded_year ? String(org.founded_year) : '', ownership: org.ownership || '',
    beds: org.bed_count ? String(org.bed_count) : '', teaching: !!org.teaching,
  }));
  const [local, setLocal] = useState<string | null>(null);
  const server = errorFields(error, { invalid_subtype: 'subtype' });
  const year = new Date().getFullYear();

  const save = () => {
    if (f.name.trim().length < 2) { setLocal('Enter the organisation name.'); return; }
    if (f.founded && (Number(f.founded) < 1800 || Number(f.founded) > year)) {
      setLocal(`Established year must be between 1800 and ${year}.`); return;
    }
    setLocal(null);
    const patch: Record<string, unknown> = {
      name: f.name.trim(), subtype: f.subtype, headline: f.headline.trim(), about: f.about.trim(),
      founded_year: f.founded ? Number(f.founded) : null, ownership: f.ownership,
    };
    if (isHospital) { patch.bed_count = f.beds ? Number(f.beds) : 0; patch.teaching = f.teaching; }
    onSave(patch);
  };

  return (
    <Sheet visible={open} onClose={onClose} title="Basic information" testID="org-basic-sheet"
      footer={<Footer onClose={onClose} onSave={save} saving={saving} testID="org-basic-save" />}>
      <View style={styles.body}>
        <FormInput label={isHospital ? 'Hospital name *' : 'Clinic name *'} value={f.name} maxLength={160}
          onChangeText={v => setF(s => ({ ...s, name: v }))} testID="org-name" />
        <SelectField label="Type" value={f.subtype} placeholder="Choose a type"
          options={isHospital ? HOSPITAL_SUBTYPES : CLINIC_SUBTYPES}
          onChange={v => setF(s => ({ ...s, subtype: v }))} testID="org-subtype" />
        {server.subtype ? <Text style={styles.error}>{server.subtype}</Text> : null}
        <FormInput label="Tagline" value={f.headline} maxLength={200}
          placeholder={isHospital ? 'e.g. 250-bed tertiary care hospital' : 'e.g. Dermatology & aesthetic medicine'}
          onChangeText={v => setF(s => ({ ...s, headline: v }))} testID="org-tagline" />
        <FormInput label="About" value={f.about} maxLength={4000} multiline rows={5}
          placeholder="What you do, who you serve, your mission and history."
          onChangeText={v => setF(s => ({ ...s, about: v }))} testID="org-about" />
        <View style={styles.row}>
          <View style={flex}>
            <NumberField label="Established" value={f.founded} maxDigits={4} placeholder="e.g. 1998"
              onChangeText={v => setF(s => ({ ...s, founded: v }))} testID="org-founded" />
          </View>
          {isHospital ? (
            <View style={flex}>
              <NumberField label="Bed capacity" value={f.beds} maxDigits={6} suffix="beds"
                onChangeText={v => setF(s => ({ ...s, beds: v }))} testID="org-beds" />
            </View>
          ) : null}
        </View>
        <ChoiceChips label="Ownership" allowDeselect value={f.ownership || null}
          onChange={v => setF(s => ({ ...s, ownership: (v || '') as any }))} testID="org-ownership"
          choices={(Object.keys(ORG_OWNERSHIP_LABELS) as (keyof typeof ORG_OWNERSHIP_LABELS)[]).map(k => ({
            value: k, label: ORG_OWNERSHIP_LABELS[k] }))} />
        {isHospital ? (
          <View style={styles.switchRow}>
            <Text style={[styles.label, flex]}>Teaching hospital</Text>
            <Switch value={f.teaching} onValueChange={v => setF(s => ({ ...s, teaching: v }))}
              accessibilityLabel="Teaching hospital" testID="org-teaching" />
          </View>
        ) : null}
        <ErrorBanner message={local || (error && !server.subtype ? (error as any)?.message : null)} />
      </View>
    </Sheet>
  );
}

// ── Contact, location and links ──────────────────────────────────────────────

export function ContactSheet({ org, open, onClose, onSave, saving, error }: {
  org: Organization; open: boolean; onClose: () => void;
  onSave: (patch: Record<string, unknown>) => void; saving?: boolean; error?: unknown;
}) {
  const [f, setF] = useSheetState(open, () => ({
    phone: org.public_phone || '', email: org.public_email || '', website: org.website || '',
    address: org.address_line || '', city: org.city || '', state: org.state || '', pincode: org.pincode || '',
    country: org.country || 'India', links: (org.links || []) as OrgLink[],
  }));
  const [errs, setErrs] = useState<Record<string, string | null>>({});
  const server = errorFields(error);

  const save = () => {
    const next = {
      phone: f.phone ? validateContactPhone(f.phone) : null,
      email: validateOptionalEmail(f.email),
      website: f.website ? validateUrl(f.website) : null,
      pincode: f.pincode ? validatePincode(f.pincode) : null,
      links: f.links.some(l => !l.label.trim() || validateUrl(l.url)) ? 'Each link needs a label and a valid address.' : null,
    };
    setErrs(next);
    if (firstError(...Object.values(next))) return;
    onSave({
      public_phone: f.phone.trim(), public_email: f.email.trim(), website: f.website.trim(),
      address_line: f.address.trim(), city: f.city.trim(), state: f.state.trim(), pincode: f.pincode.trim(),
      country: f.country.trim(), links: f.links.map(l => ({ label: l.label.trim(), url: l.url.trim() })),
    });
  };
  const setLink = (i: number, patch: Partial<OrgLink>) =>
    setF(s => ({ ...s, links: s.links.map((l, j) => (j === i ? { ...l, ...patch } : l)) }));

  return (
    <Sheet visible={open} onClose={onClose} title="Contact & location" testID="org-contact-sheet"
      footer={<Footer onClose={onClose} onSave={save} saving={saving} testID="org-contact-save" />}>
      <View style={styles.body}>
        <Text style={styles.hint}>Shown publicly on your page. Use the reception or front-desk details.</Text>
        <FormInput label="Phone" value={f.phone} keyboardType="phone-pad" maxLength={20} icon="call-outline"
          onChangeText={v => setF(s => ({ ...s, phone: v }))} error={errs.phone || server.public_phone} testID="org-phone" />
        <FormInput label="Email" value={f.email} keyboardType="email-address" autoCapitalize="none" maxLength={200}
          icon="mail-outline" onChangeText={v => setF(s => ({ ...s, email: v }))}
          error={errs.email || server.public_email} testID="org-email" />
        <FormInput label="Website" value={f.website} autoCapitalize="none" maxLength={300} icon="globe-outline"
          placeholder="yourhospital.in" onChangeText={v => setF(s => ({ ...s, website: v }))}
          error={errs.website || server.website} testID="org-website" />
        <FormInput label="Address" value={f.address} maxLength={250} icon="location-outline"
          onChangeText={v => setF(s => ({ ...s, address: v }))} testID="org-address" />
        <View style={styles.row}>
          <View style={flex}><FormInput label="City" value={f.city} maxLength={80}
            onChangeText={v => setF(s => ({ ...s, city: v }))} testID="org-city" /></View>
          <View style={flex}><FormInput label="State" value={f.state} maxLength={80}
            onChangeText={v => setF(s => ({ ...s, state: v }))} testID="org-state" /></View>
        </View>
        <View style={styles.row}>
          <View style={flex}><FormInput label="PIN code" value={f.pincode} keyboardType="number-pad" maxLength={6}
            onChangeText={v => setF(s => ({ ...s, pincode: v }))} error={errs.pincode || server.pincode}
            testID="org-pincode" /></View>
          <View style={flex}><FormInput label="Country" value={f.country} maxLength={60}
            onChangeText={v => setF(s => ({ ...s, country: v }))} testID="org-country" /></View>
        </View>

        <Text style={styles.label}>Links</Text>
        {f.links.map((l, i) => (
          <View key={i} style={styles.linkRow}>
            <View style={styles.linkLabel}>
              <FormInput label="Label" value={l.label} maxLength={60} placeholder="e.g. Google Business Profile"
                onChangeText={v => setLink(i, { label: v })} testID={`org-link-label-${i}`} />
            </View>
            <View style={flex}>
              <FormInput label="Address" value={l.url} maxLength={300} autoCapitalize="none"
                onChangeText={v => setLink(i, { url: v })} testID={`org-link-url-${i}`} />
            </View>
            <Pressable onPress={() => setF(s => ({ ...s, links: s.links.filter((_, j) => j !== i) }))}
              accessibilityRole="button" accessibilityLabel="Remove link" style={styles.iconBtn} hitSlop={6}>
              <Ionicons name="trash-outline" size={18} color={colors.textSecondary} />
            </Pressable>
          </View>
        ))}
        {f.links.length < 8 ? (
          <Pressable onPress={() => setF(s => ({ ...s, links: [...s.links, { label: '', url: '' }] }))}
            accessibilityRole="button" style={styles.addRow} testID="org-link-add">
            <Ionicons name="add" size={18} color={colors.navy} />
            <Text style={styles.addText}>Add a link</Text>
          </Pressable>
        ) : null}
        <ErrorBanner message={errs.links || (error && !Object.keys(server).length ? (error as any)?.message : null)} />
      </View>
    </Sheet>
  );
}

// ── Chips: specialties, services, facilities, accreditations, academics ─────

export function TermsSheet({ org, sheet, onClose, onSave, saving, error }: {
  org: Organization; sheet: Extract<OrgSheet, { kind: 'terms' }> | null; onClose: () => void;
  onSave: (patch: Record<string, unknown>) => void; saving?: boolean; error?: unknown;
}) {
  const open = !!sheet;
  const [picked, setPicked] = useSheetState<string[]>(open, () => (sheet ? [...((org as any)[sheet.field] || [])] : []));
  const [custom, setCustom] = useState('');
  if (!sheet) return null;
  const has = (t: string) => picked.some(p => p.toLowerCase() === t.toLowerCase());
  const toggle = (t: string) => setPicked(p => (has(t) ? p.filter(x => x.toLowerCase() !== t.toLowerCase()) : [...p, t]));
  const addCustom = () => {
    const t = custom.trim();
    if (t.length >= 2 && t.length <= 80 && !has(t)) setPicked(p => [...p, t]);
    setCustom('');
  };
  const extra = picked.filter(p => !sheet.suggestions.some(s => s.toLowerCase() === p.toLowerCase()));

  return (
    <Sheet visible={open} onClose={onClose} title={sheet.title} testID={`org-terms-${sheet.field}`}
      footer={<Footer onClose={onClose} onSave={() => onSave({ [sheet.field]: picked })} saving={saving}
        testID="org-terms-save" />}>
      <View style={styles.body}>
        {sheet.hint ? <Text style={styles.hint}>{sheet.hint}</Text> : null}
        <View style={styles.chips}>
          {[...sheet.suggestions, ...extra].map(t => (
            <Chip key={t} label={t} tone={has(t) ? 'teal' : 'neutral'} icon={has(t) ? 'checkmark' : 'add'}
              onPress={() => toggle(t)} testID={`org-term-${t}`} />
          ))}
        </View>
        <View style={styles.row}>
          <TextInput value={custom} onChangeText={setCustom} placeholder="Add another" maxLength={80}
            onSubmitEditing={addCustom} style={styles.customInput} accessibilityLabel="Add another"
            testID="org-term-custom" />
          <Button label="Add" variant="outline" onPress={addCustom} />
        </View>
        <Text style={styles.hint}>{picked.length} selected · up to 40</Text>
        <ErrorBanner message={(error as any)?.message ?? null} />
      </View>
    </Sheet>
  );
}

// ── Opening hours and emergency ──────────────────────────────────────────────

type DayRow = { open: boolean; from: string; to: string };

export function HoursSheet({ org, open, onClose, onSave, saving, error }: {
  org: Organization; open: boolean; onClose: () => void;
  onSave: (patch: Record<string, unknown>) => void; saving?: boolean; error?: unknown;
}) {
  const isHospital = org.org_type === 'hospital';
  const [f, setF] = useSheetState(open, () => {
    const byDay = new Map((org.opening_hours || []).map(h => [h.day, h]));
    return {
      allDay: !!org.open_24x7,
      days: WEEKDAYS.map((_, d): DayRow => {
        const h = byDay.get(d);
        return h ? { open: true, from: h.open, to: h.close } : { open: false, from: '09:00', to: '18:00' };
      }),
      emergency: !!org.emergency_24x7, emergencyPhone: org.emergency_phone || '', ambulance: !!org.ambulance,
    };
  });
  const [local, setLocal] = useState<string | null>(null);
  const setDay = (d: number, patch: Partial<DayRow>) =>
    setF(s => ({ ...s, days: s.days.map((r, i) => (i === d ? { ...r, ...patch } : r)) }));

  const save = () => {
    const hours: OrgOpeningHours[] = [];
    for (let d = 0; d < 7; d++) {
      const r = f.days[d];
      if (!r.open) continue;
      if (!r.from || !r.to || r.to <= r.from) {
        setLocal(`${WEEKDAYS[d]}: closing time must be after opening time.`); return;
      }
      hours.push({ day: d, open: r.from, close: r.to });
    }
    if (f.emergencyPhone && validateContactPhone(f.emergencyPhone)) {
      setLocal('Enter a valid emergency phone number.'); return;
    }
    setLocal(null);
    onSave({
      open_24x7: f.allDay, opening_hours: f.allDay ? [] : hours,
      emergency_24x7: f.emergency, emergency_phone: f.emergencyPhone.trim(), ambulance: f.ambulance,
    });
  };

  return (
    <Sheet visible={open} onClose={onClose} title={isHospital ? 'Hours & emergency' : 'Opening hours'}
      testID="org-hours-sheet"
      footer={<Footer onClose={onClose} onSave={save} saving={saving} testID="org-hours-save" />}>
      <View style={styles.body}>
        <View style={styles.switchRow}>
          <Text style={[styles.label, flex]}>{isHospital ? 'Outpatient services open 24/7' : 'Open 24/7'}</Text>
          <Switch value={f.allDay} onValueChange={v => setF(s => ({ ...s, allDay: v }))}
            accessibilityLabel="Open 24/7" testID="org-24x7" />
        </View>
        {!f.allDay ? f.days.map((r, d) => (
          <View key={d} style={styles.dayRow}>
            <View style={styles.dayName}>
              <Switch value={r.open} onValueChange={v => setDay(d, { open: v })}
                accessibilityLabel={`Open on ${WEEKDAYS[d]}`} testID={`org-day-${d}`} />
              <Text style={styles.label}>{WEEKDAYS[d].slice(0, 3)}</Text>
            </View>
            {r.open ? (
              <>
                <View style={flex}><TimeField label="Opens" value={r.from} onChange={v => setDay(d, { from: v })}
                  testID={`org-day-${d}-from`} /></View>
                <View style={flex}><TimeField label="Closes" value={r.to} onChange={v => setDay(d, { to: v })}
                  testID={`org-day-${d}-to`} /></View>
              </>
            ) : <Text style={[styles.hint, flex]}>Closed</Text>}
          </View>
        )) : null}

        <Text style={[styles.label, { marginTop: spacing.md }]}>Emergency</Text>
        <Text style={styles.hint}>Only shown on your page when switched on.</Text>
        <View style={styles.switchRow}>
          <Text style={[styles.body2, flex]}>24/7 emergency services</Text>
          <Switch value={f.emergency} onValueChange={v => setF(s => ({ ...s, emergency: v }))}
            accessibilityLabel="24/7 emergency services" testID="org-emergency" />
        </View>
        {f.emergency ? (
          <FormInput label="Emergency phone" value={f.emergencyPhone} keyboardType="phone-pad" maxLength={20}
            onChangeText={v => setF(s => ({ ...s, emergencyPhone: v }))} testID="org-emergency-phone" />
        ) : null}
        <View style={styles.switchRow}>
          <Text style={[styles.body2, flex]}>Ambulance available</Text>
          <Switch value={f.ambulance} onValueChange={v => setF(s => ({ ...s, ambulance: v }))}
            accessibilityLabel="Ambulance available" testID="org-ambulance" />
        </View>
        <ErrorBanner message={local || ((error as any)?.message ?? null)} />
      </View>
    </Sheet>
  );
}

// ── "I work here" (professional) ─────────────────────────────────────────────

export function JoinTeamSheet({ open, orgName, onClose, onSubmit, saving, error }: {
  open: boolean; orgName: string; onClose: () => void;
  onSubmit: (title: string, department: string) => void; saving?: boolean; error?: string | null;
}) {
  const [title, setTitle] = useState('');
  const [dept, setDept] = useState('');
  useEffect(() => { if (open) { setTitle(''); setDept(''); } }, [open]);
  return (
    <Sheet visible={open} onClose={onClose} title="Join the medical team" testID="org-join-sheet"
      footer={<>
        <Button label="Cancel" variant="outline" onPress={onClose} style={flex} />
        <Button label="Send request" onPress={() => onSubmit(title.trim(), dept.trim())} loading={saving}
          style={flex} testID="org-join-submit" />
      </>}>
      <View style={styles.body}>
        <Text style={styles.hint}>
          {orgName} confirms who works there before you appear on its page. Your own professional verification
          is unchanged.
        </Text>
        <FormInput label="Your role" value={title} onChangeText={setTitle} maxLength={100}
          placeholder="e.g. Consultant Cardiologist" testID="org-join-title" />
        <FormInput label="Department" value={dept} onChangeText={setDept} maxLength={100}
          placeholder="e.g. Cardiology" testID="org-join-dept" />
        <ErrorBanner message={error ?? null} />
      </View>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  body: { paddingHorizontal: spacing.xl, paddingBottom: spacing.md, gap: spacing.md },
  row: { flexDirection: 'row', gap: spacing.md, alignItems: 'flex-start' },
  label: { ...typography.label, color: colors.text },
  body2: { ...typography.body, color: colors.text },
  hint: { ...typography.caption, color: colors.textSecondary, lineHeight: 19 },
  error: { ...typography.caption, color: colors.redText },
  switchRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, minHeight: MIN_TOUCH_TARGET },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  customInput: {
    flex: 1, minHeight: MIN_TOUCH_TARGET, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md,
    paddingHorizontal: spacing.md, ...typography.body, color: colors.text,
  },
  linkRow: { flexDirection: 'row', gap: spacing.sm, alignItems: 'flex-end' },
  linkLabel: { width: 150 },
  iconBtn: { minWidth: MIN_TOUCH_TARGET, minHeight: MIN_TOUCH_TARGET, alignItems: 'center', justifyContent: 'center' },
  addRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, minHeight: MIN_TOUCH_TARGET },
  addText: { ...typography.label, color: colors.navy, fontFamily: fonts.body.semibold },
  dayRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  dayName: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, width: 96 },
});
