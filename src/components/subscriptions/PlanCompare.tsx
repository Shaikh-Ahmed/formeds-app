import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, fonts, radius, spacing, typography } from '../../theme';
import type { Plan, PlanFeature } from '../../types/subscriptions';

/**
 * The feature matrix, built entirely from the catalogue the server sent: the
 * rows are its features, the columns its plans. Three narrow value columns
 * beside a flexible label column fit a 360px phone without a horizontal
 * scroll, which a conventional pricing table does not.
 */
export function PlanCompare({ plans, features }: { plans: Plan[]; features: PlanFeature[] }) {
  return (
    <View style={styles.table} testID="plan-compare">
      <View style={[styles.row, styles.headRow]}>
        <Text style={[styles.label, styles.headLabel]}>Compare plans</Text>
        {plans.map(p => (
          <Text key={p.code} style={[styles.cell, styles.headCell]} numberOfLines={1}>{p.name}</Text>
        ))}
      </View>
      {features.map((f, i) => (
        <View key={f.code} style={[styles.row, i % 2 === 1 && styles.striped]}>
          <Text style={styles.label}>{f.label}</Text>
          {plans.map(p => {
            const value = p.entitlements[f.code];
            return (
              <View key={p.code} style={styles.cellWrap}>
                {f.value_type === 'bool' ? (
                  value === true ? (
                    <Ionicons name="checkmark-circle" size={18} color={colors.teal}
                      accessibilityLabel={`${f.label}: included in ${p.name}`} />
                  ) : (
                    <Text style={styles.dash} accessibilityLabel={`${f.label}: not in ${p.name}`}>—</Text>
                  )
                ) : (
                  <Text style={styles.value}>
                    {typeof value === 'number' ? value.toLocaleString('en-IN') : String(value ?? '—')}
                  </Text>
                )}
              </View>
            );
          })}
        </View>
      ))}
    </View>
  );
}

const CELL = 64;

const styles = StyleSheet.create({
  table: { borderWidth: 1, borderColor: colors.border, borderRadius: radius.xl, overflow: 'hidden', backgroundColor: colors.white },
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: spacing.sm + 2, paddingHorizontal: spacing.md },
  headRow: { backgroundColor: colors.bgMuted },
  striped: { backgroundColor: colors.bg },
  label: { ...typography.caption, color: colors.text, flex: 1, paddingRight: spacing.sm },
  headLabel: { fontFamily: fonts.body.semibold },
  cell: { width: CELL, textAlign: 'center' },
  headCell: { ...typography.small, fontFamily: fonts.body.semibold, color: colors.navy },
  cellWrap: { width: CELL, alignItems: 'center' },
  value: { ...typography.small, fontFamily: fonts.body.semibold, color: colors.text },
  dash: { ...typography.caption, color: colors.textMuted },
});
