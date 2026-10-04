import React from 'react';
import { StyleSheet, Switch, Text, View } from 'react-native';
import { FormInput } from '../FormInput';
import { colors, radius, spacing, typography } from '../../theme';

export interface ClientValue { client_name: string; client_confidential: boolean }

/**
 * The one thing a recruiter's posting needs that an employer's doesn't: who
 * the role is for. Shown on the job wizard's first step; candidates see the name
 * only when it isn't confidential.
 */
export function RecruiterClientFields({ value, onChange }: {
  value: ClientValue; onChange: (v: ClientValue) => void;
}) {
  return (
    <View style={styles.card} testID="recruiter-client-fields">
      <Text style={styles.title}>Hiring for a client</Text>
      <FormInput
        testID="recruiter-client-name"
        label="Client organisation (optional)"
        icon="business-outline"
        value={value.client_name}
        onChangeText={t => onChange({ ...value, client_name: t })}
        placeholder="e.g. Apex Heart Institute"
        maxLength={140}
      />
      <View style={styles.row}>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={styles.label}>Keep client confidential</Text>
          <Text style={styles.hint}>Candidates see “Confidential client” instead of the name.</Text>
        </View>
        <Switch
          testID="recruiter-client-confidential"
          value={value.client_confidential}
          onValueChange={v => onChange({ ...value, client_confidential: v })}
          accessibilityLabel="Keep client confidential"
          trackColor={{ true: colors.teal, false: colors.border }}
          thumbColor={colors.white}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    marginBottom: spacing.lg, padding: spacing.lg, backgroundColor: colors.white,
    borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border,
  },
  title: { ...typography.h3, color: colors.navy, marginBottom: spacing.md },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  label: { ...typography.bodyStrong, color: colors.text },
  hint: { ...typography.caption, color: colors.textSecondary, marginTop: 2 },
});
