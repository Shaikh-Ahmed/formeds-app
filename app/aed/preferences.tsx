import React, { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useAuth } from '../../src/context/AuthContext';
import { Button, ErrorBanner, LoadingState, ScreenHeader } from '../../src/components';
import { PageColumn } from '../../src/components/web';
import { colors, fonts, radius, spacing, typography } from '../../src/theme';
import { fetchPreferences, savePreferences, type AedPreferences } from '../../src/api/aedMemory';

const GUIDELINES = ['ICMR', 'MoHFW', 'NICE', 'WHO', 'KDIGO', 'ESC', 'AHA/ACC', 'ADA', 'GINA', 'GOLD'];

function Options<T extends string>({ label, value, options, onChange, testID }: {
  label: string; value: T; options: { value: T; label: string }[]; onChange: (v: T) => void; testID: string;
}) {
  return (
    <View style={styles.group}>
      <Text style={styles.groupLabel}>{label}</Text>
      <View style={styles.row} accessibilityRole="radiogroup">
        {options.map(o => (
          <Pressable key={o.value} onPress={() => onChange(o.value)} accessibilityRole="radio"
            accessibilityState={{ selected: value === o.value }} testID={`${testID}-${o.value}`}
            style={[styles.pill, value === o.value && styles.pillOn]}>
            <Text style={[styles.pillText, value === o.value && styles.pillTextOn]}>{o.label}</Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

/** How AED answers you. Style only -- never patient details. */
export default function AedPreferencesScreen() {
  const { token } = useAuth();
  const router = useRouter();
  const [prefs, setPrefs] = useState<AedPreferences | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) return;
    fetchPreferences(token).then(r => setPrefs(r.preferences)).catch(() => setError('Couldn’t load your preferences.'));
  }, [token]);

  if (!prefs) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <ScreenHeader title="Answer preferences" />
        {error ? <ErrorBanner message={error} /> : <LoadingState />}
      </SafeAreaView>
    );
  }

  const set = <K extends keyof AedPreferences>(key: K, value: AedPreferences[K]) => setPrefs({ ...prefs, [key]: value });
  const toggleGuideline = (g: string) => set('preferred_guidelines', prefs.preferred_guidelines.includes(g)
    ? prefs.preferred_guidelines.filter(x => x !== g) : [...prefs.preferred_guidelines, g].slice(0, 8));

  const save = async () => {
    if (!token) return;
    setBusy(true);
    setError(null);
    try {
      await savePreferences(token, prefs);
      router.back();
    } catch (e: any) {
      setError(e?.message || 'Couldn’t save your preferences.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <PageColumn maxWidth={640} testID="aed-preferences">
        <ScreenHeader title="Answer preferences" />
        <ScrollView contentContainerStyle={styles.scroll}>
          <Options label="Answer length" value={prefs.answer_depth} onChange={v => set('answer_depth', v)}
            testID="pref-depth" options={[{ value: 'brief', label: 'Brief' }, { value: 'standard', label: 'Standard' },
              { value: 'detailed', label: 'Detailed' }]} />
          <Options label="Lab units" value={prefs.units} onChange={v => set('units', v)} testID="pref-units"
            options={[{ value: 'conventional', label: 'Conventional (mg/dL)' }, { value: 'si', label: 'SI (mmol/L)' }]} />
          <Options label="Drug names" value={prefs.drug_naming} onChange={v => set('drug_naming', v)}
            testID="pref-naming" options={[{ value: 'generic', label: 'Generic' },
              { value: 'brand_and_generic', label: 'Generic + Indian brands' }]} />
          <View style={styles.group}>
            <Text style={styles.groupLabel}>Guidelines to mention where relevant</Text>
            <View style={styles.row}>
              {GUIDELINES.map(g => {
                const on = prefs.preferred_guidelines.includes(g);
                return (
                  <Pressable key={g} onPress={() => toggleGuideline(g)} accessibilityRole="checkbox"
                    accessibilityState={{ checked: on }} testID={`pref-guideline-${g}`}
                    style={[styles.pill, on && styles.pillOn]}>
                    <Text style={[styles.pillText, on && styles.pillTextOn]}>{g}</Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
          <View style={styles.group}>
            <Text style={styles.groupLabel}>Anything else about how you like answers</Text>
            <TextInput value={prefs.notes} onChangeText={t => set('notes', t)} maxLength={500} multiline
              placeholder="e.g. Put red flags first. Don't include patient details here."
              placeholderTextColor={colors.textMuted} style={styles.notes} testID="pref-notes" />
          </View>
          {error ? <ErrorBanner message={error} /> : null}
          <Button label="Save" onPress={save} loading={busy} testID="pref-save" />
        </ScrollView>
      </PageColumn>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  scroll: { padding: spacing.lg, gap: spacing.lg, paddingBottom: spacing.xxl },
  group: { gap: spacing.sm },
  groupLabel: { ...typography.label, color: colors.navy },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  pill: {
    paddingHorizontal: spacing.md, paddingVertical: spacing.xs + 2, borderRadius: radius.pill,
    borderWidth: 1, borderColor: colors.border, backgroundColor: colors.white,
  },
  pillOn: { backgroundColor: colors.teal, borderColor: colors.teal },
  pillText: { ...typography.small, color: colors.navy, fontFamily: fonts.body.medium },
  pillTextOn: { color: colors.white },
  notes: {
    ...typography.body, color: colors.text, minHeight: 90, textAlignVertical: 'top',
    padding: spacing.md, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border,
    backgroundColor: colors.white,
  },
});
