import React, { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../src/context/AuthContext';
import { Button, ErrorBanner, LoadingState, ScreenHeader } from '../../src/components';
import { PageColumn } from '../../src/components/web';
import { colors, fonts, radius, spacing, typography } from '../../src/theme';
import {
  fetchCalculators, fieldType, runCalculator, type Calculator, type CalculatorResult,
} from '../../src/api/aedCalculators';

function label(value: string): string {
  return value.replace(/_/g, ' ').replace(/^\w/, c => c.toUpperCase());
}

/**
 * Clinical calculators, computed by ForMeds' validated formulas -- the same
 * ones AED uses when it needs a score or a dose. The form is built from each
 * calculator's input schema, so a new calculator needs no app change.
 */
export default function AedCalculatorsScreen() {
  const { token } = useAuth();
  const [calcs, setCalcs] = useState<Calculator[] | null>(null);
  const [selected, setSelected] = useState<Calculator | null>(null);
  const [values, setValues] = useState<Record<string, any>>({});
  const [result, setResult] = useState<CalculatorResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!token) return;
    fetchCalculators(token).then(r => setCalcs(r.calculators)).catch(() => setError('Couldn’t load the calculators.'));
  }, [token]);

  const fields = useMemo(() => Object.entries(selected?.inputs.properties ?? {}), [selected]);

  const choose = (c: Calculator) => {
    setSelected(c);
    setResult(null);
    setError(null);
    // Booleans start at their default (false); everything else starts empty.
    setValues(Object.fromEntries(Object.entries(c.inputs.properties)
      .filter(([, f]) => fieldType(f) === 'boolean').map(([k, f]) => [k, f.default ?? false])));
  };

  const calculate = async () => {
    if (!token || !selected) return;
    setBusy(true);
    setError(null);
    const body: Record<string, any> = {};
    for (const [name, f] of fields) {
      const v = values[name];
      if (v === undefined || v === '') continue;
      const t = fieldType(f);
      body[name] = t === 'integer' ? parseInt(v, 10) : t === 'number' ? parseFloat(v) : v;
    }
    try {
      setResult(await runCalculator(token, selected.name, body));
    } catch (e: any) {
      const field = e?.data?.detail?.field;
      const title = field ? selected.inputs.properties[field]?.title : null;
      setError(title ? `${title}: ${e.message}` : e?.message || 'Couldn’t calculate. Check the values.');
      setResult(null);
    } finally {
      setBusy(false);
    }
  };

  if (!calcs) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <ScreenHeader title="Clinical calculators" />
        {error ? <ErrorBanner message={error} /> : <LoadingState />}
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <PageColumn maxWidth={640} testID="aed-calculators">
        <ScreenHeader title={selected ? selected.title : 'Clinical calculators'}
          onBack={selected ? () => setSelected(null) : undefined} />
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          {!selected ? calcs.map(c => (
            <Pressable key={c.name} onPress={() => choose(c)} accessibilityRole="button" testID={`calc-${c.name}`}
              style={({ pressed }) => [styles.row, pressed && styles.pressed]}>
              <Ionicons name="calculator-outline" size={18} color={colors.teal} />
              <Text style={styles.rowText}>{c.title}</Text>
              <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
            </Pressable>
          )) : (
            <>
              {fields.map(([name, f]) => {
                const t = fieldType(f);
                if (t === 'boolean') {
                  return (
                    <View key={name} style={styles.switchRow}>
                      <Text style={styles.fieldLabel}>{f.title}</Text>
                      <Switch value={!!values[name]} onValueChange={v => setValues({ ...values, [name]: v })}
                        accessibilityLabel={f.title} testID={`field-${name}`} />
                    </View>
                  );
                }
                if (f.enum) {
                  return (
                    <View key={name} style={styles.field}>
                      <Text style={styles.fieldLabel}>{f.title}</Text>
                      <View style={styles.pills} accessibilityRole="radiogroup">
                        {f.enum.map(opt => (
                          <Pressable key={opt} onPress={() => setValues({ ...values, [name]: opt })}
                            accessibilityRole="radio" accessibilityState={{ selected: values[name] === opt }}
                            testID={`field-${name}-${opt}`}
                            style={[styles.pill, values[name] === opt && styles.pillOn]}>
                            <Text style={[styles.pillText, values[name] === opt && styles.pillTextOn]}>{label(opt)}</Text>
                          </Pressable>
                        ))}
                      </View>
                    </View>
                  );
                }
                return (
                  <View key={name} style={styles.field}>
                    <Text style={styles.fieldLabel}>{f.title}</Text>
                    <TextInput value={values[name] ?? ''} onChangeText={v => setValues({ ...values, [name]: v })}
                      keyboardType="decimal-pad" style={styles.input} accessibilityLabel={f.title}
                      placeholder={f.anyOf ? 'Optional' : undefined} placeholderTextColor={colors.textMuted}
                      testID={`field-${name}`} />
                  </View>
                );
              })}
              {error ? <ErrorBanner message={error} /> : null}
              <Button label="Calculate" onPress={calculate} loading={busy} testID="calc-run" />
              {result ? (
                <View style={styles.result} testID="calc-result" accessibilityLiveRegion="polite">
                  <Text style={styles.value}>{result.value} <Text style={styles.unit}>{result.unit}</Text></Text>
                  {result.category ? <Text style={styles.category}>{result.category}</Text> : null}
                  <Text style={styles.interpretation}>{result.interpretation}</Text>
                  <Text style={styles.reference}>{result.reference}</Text>
                </View>
              ) : null}
              <Text style={styles.footnote}>Validated formula; check inputs and use clinical judgement.</Text>
            </>
          )}
        </ScrollView>
      </PageColumn>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  pressed: { opacity: 0.7 },
  scroll: { padding: spacing.lg, gap: spacing.md, paddingBottom: spacing.xxl },
  row: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.md,
    backgroundColor: colors.white, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border,
  },
  rowText: { ...typography.label, color: colors.text, flex: 1 },
  field: { gap: spacing.xs },
  fieldLabel: { ...typography.label, color: colors.navy, flexShrink: 1 },
  switchRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.md,
    paddingVertical: spacing.xs,
  },
  input: {
    ...typography.body, color: colors.text, paddingHorizontal: spacing.md, paddingVertical: spacing.sm + 2,
    borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.white,
  },
  pills: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  pill: {
    paddingHorizontal: spacing.md, paddingVertical: spacing.xs + 2, borderRadius: radius.pill,
    borderWidth: 1, borderColor: colors.border, backgroundColor: colors.white,
  },
  pillOn: { backgroundColor: colors.teal, borderColor: colors.teal },
  pillText: { ...typography.small, color: colors.navy, fontFamily: fonts.body.medium },
  pillTextOn: { color: colors.white },
  result: {
    gap: spacing.xs, padding: spacing.lg, borderRadius: radius.xl, backgroundColor: colors.white,
    borderWidth: 1, borderColor: colors.teal,
  },
  value: { ...typography.h2, color: colors.navy },
  unit: { ...typography.body, color: colors.textSecondary },
  category: { ...typography.label, color: colors.teal },
  interpretation: { ...typography.caption, color: colors.text, lineHeight: 20 },
  reference: { ...typography.small, color: colors.textSecondary, fontStyle: 'italic' },
  footnote: { ...typography.small, color: colors.textMuted, textAlign: 'center' },
});
