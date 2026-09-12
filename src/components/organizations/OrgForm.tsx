import React, { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, radius, spacing, typography, fonts } from '../../theme';
import { Button, FormInput, SelectField } from '../index';
import { ErrorBanner } from '../States';
import { STATE_NAMES, citiesForState } from '../../data/indiaLocations';
import { SPECIALTY_OPTIONS } from '../../data/specialties';
import { ORG_TYPES, ORG_TYPE_LABELS, type OrgType, type Organization } from '../../types/organizations';

const MAX_SPECIALTIES = 20;

/**
 * The organisation details form, shared by create and edit.
 *
 * One component for both so the two can never drift on what is editable —
 * which matters here more than usual, because the field that must NOT be
 * editable is verification status, and a second copy is exactly how that
 * eventually grows a toggle.
 *
 * `legal_name` is collected but described as registry data rather than a public
 * field, because it is: the server keeps it off the public projection and shows
 * it back only to admins and owners.
 */
export function OrgForm({
  initial,
  submitLabel,
  submitting,
  error,
  onSubmit,
  onCancel,
}: {
  initial?: Partial<Organization>;
  submitLabel: string;
  submitting?: boolean;
  error?: string | null;
  onSubmit: (payload: Record<string, unknown>) => void;
  onCancel?: () => void;
}) {
  const [name, setName] = useState(initial?.name ?? '');
  const [orgType, setOrgType] = useState<OrgType>(initial?.org_type ?? 'hospital');
  const [legalName, setLegalName] = useState(initial?.legal_name ?? '');
  const [headline, setHeadline] = useState(initial?.headline ?? '');
  const [about, setAbout] = useState(initial?.about ?? '');
  const [state, setState] = useState(initial?.state ?? '');
  const [city, setCity] = useState(initial?.city ?? '');
  const [addressLine, setAddressLine] = useState(initial?.address_line ?? '');
  const [pincode, setPincode] = useState(initial?.pincode ?? '');
  const [website, setWebsite] = useState(initial?.website ?? '');
  const [publicEmail, setPublicEmail] = useState(initial?.public_email ?? '');
  const [publicPhone, setPublicPhone] = useState(initial?.public_phone ?? '');
  const [bedCount, setBedCount] = useState(String(initial?.bed_count || ''));
  const [foundedYear, setFoundedYear] = useState(String(initial?.founded_year || ''));
  const [specialties, setSpecialties] = useState<string[]>(initial?.specialties ?? []);
  const [touched, setTouched] = useState(false);

  // Mirrors the server so the user is told before a round trip, not by a 422
  // after one. The server stays the authority.
  const problems = useMemo(() => {
    const out: Record<string, string> = {};
    if (name.trim().length < 2) out.name = 'Give the organisation a name.';
    if (website && !/^https:\/\//i.test(website.trim())) {
      out.website = 'Use a full https:// address.';
    }
    const year = Number(foundedYear);
    if (foundedYear && (year < 1800 || year > 2100)) {
      out.foundedYear = 'Enter a four-digit year.';
    }
    return out;
  }, [name, website, foundedYear]);

  const toggleSpecialty = (value: string) =>
    setSpecialties(prev =>
      prev.includes(value)
        ? prev.filter(s => s !== value)
        : prev.length >= MAX_SPECIALTIES ? prev : [...prev, value]);

  const submit = () => {
    setTouched(true);
    if (Object.keys(problems).length) return;
    onSubmit({
      name: name.trim(),
      org_type: orgType,
      legal_name: legalName.trim(),
      headline: headline.trim(),
      about: about.trim(),
      state,
      city,
      address_line: addressLine.trim(),
      pincode: pincode.trim(),
      website: website.trim(),
      public_email: publicEmail.trim(),
      public_phone: publicPhone.trim(),
      bed_count: Number(bedCount) || 0,
      // null, not 0: "not stated" and "year zero" are different, and the server
      // treats the field as optional rather than defaulted.
      founded_year: foundedYear ? Number(foundedYear) : null,
      specialties,
    });
  };

  const err = (key: string) => (touched ? problems[key] : undefined);

  return (
    <View style={styles.wrap}>
      <ErrorBanner message={error} />

      <Section title="Identity">
        <FormInput
          label="Organisation name"
          value={name}
          onChangeText={setName}
          placeholder="e.g. Apollo Hospitals, Jubilee Hills"
          error={err('name')}
          testID="org-name"
        />
        <Text style={styles.label}>Type</Text>
        <View style={styles.chips}>
          {ORG_TYPES.map(type => (
            <Choice
              key={type}
              label={ORG_TYPE_LABELS[type]}
              selected={orgType === type}
              onPress={() => setOrgType(type)}
              testID={`org-type-${type}`}
            />
          ))}
        </View>
        <FormInput
          label="Registered legal name (optional)"
          value={legalName}
          onChangeText={setLegalName}
          placeholder="As it appears on your registration"
        />
        <Text style={styles.hint}>
          Kept for verification. It is not shown on your public page.
        </Text>
      </Section>

      <Section title="About">
        <FormInput
          label="One-line summary"
          value={headline}
          onChangeText={setHeadline}
          placeholder="e.g. 400-bed tertiary care centre in Hyderabad"
        />
        <FormInput
          label="Description"
          value={about}
          onChangeText={setAbout}
          placeholder="What the organisation does, and what it is like to work there."
          multiline
          rows={5}
        />
      </Section>

      <Section title="Where">
        <SelectField
          label="State"
          value={state}
          onChange={v => { setState(v); setCity(''); }}
          options={STATE_NAMES}
          placeholder="Select a state"
          icon="map-outline"
          testID="org-state"
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
          testID="org-city"
        />
        <FormInput
          label="Address (optional)"
          value={addressLine}
          onChangeText={setAddressLine}
          placeholder="Street and area"
        />
        <FormInput
          label="Pincode (optional)"
          value={pincode}
          onChangeText={setPincode}
          keyboardType="number-pad"
        />
      </Section>

      <Section title="Contact">
        <FormInput
          label="Website (optional)"
          value={website}
          onChangeText={setWebsite}
          placeholder="https://example.org"
          autoCapitalize="none"
          error={err('website')}
        />
        <FormInput
          label="Public email (optional)"
          value={publicEmail}
          onChangeText={setPublicEmail}
          placeholder="careers@example.org"
          autoCapitalize="none"
          keyboardType="email-address"
        />
        <FormInput
          label="Public phone (optional)"
          value={publicPhone}
          onChangeText={setPublicPhone}
          keyboardType="phone-pad"
        />
      </Section>

      <Section title="Details">
        <FormInput
          label="Beds (optional)"
          value={bedCount}
          onChangeText={setBedCount}
          keyboardType="number-pad"
        />
        <FormInput
          label="Founded (optional)"
          value={foundedYear}
          onChangeText={setFoundedYear}
          keyboardType="number-pad"
          placeholder="e.g. 1983"
          error={err('foundedYear')}
        />
        <Text style={styles.label}>
          Specialties {specialties.length ? `(${specialties.length}/${MAX_SPECIALTIES})` : ''}
        </Text>
        <Text style={styles.hint}>
          What you hire for. These help clinicians find you in the directory.
        </Text>
        <View style={styles.chips}>
          {SPECIALTY_OPTIONS.slice(0, 40).map(s => (
            <Choice
              key={s}
              label={s}
              selected={specialties.includes(s)}
              onPress={() => toggleSpecialty(s)}
            />
          ))}
        </View>
      </Section>

      <View style={styles.actions}>
        {onCancel ? (
          <Button label="Cancel" variant="outline" onPress={onCancel} style={styles.action} />
        ) : null}
        <Button
          label={submitLabel}
          onPress={submit}
          loading={submitting}
          style={styles.action}
          testID="org-submit"
        />
      </View>
    </View>
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

function Choice({
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
      style={({ pressed }) => [styles.chip, selected && styles.chipOn, pressed && styles.pressed]}
    >
      <Text style={[styles.chipText, selected && styles.chipTextOn]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.xl },
  section: { gap: spacing.sm },
  sectionTitle: { ...typography.overline, color: colors.teal },
  label: { ...typography.label, color: colors.text },
  hint: { ...typography.small, color: colors.textSecondary },

  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginBottom: spacing.md },
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

  actions: { flexDirection: 'row', gap: spacing.md, paddingTop: spacing.md },
  action: { flex: 1 },
  pressed: { opacity: 0.7 },
});
