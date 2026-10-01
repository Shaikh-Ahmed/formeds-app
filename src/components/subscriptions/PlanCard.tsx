import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, fonts, radius, spacing, typography } from '../../theme';
import { Button } from '../Button';
import {
  formatRupees, type BillingCycle, type Plan, type PlanFeature,
} from '../../types/subscriptions';

export type PlanAction = 'current' | 'upgrade' | 'downgrade' | 'scheduled' | 'none';

/** The tier's accent: Core in navy, ProCare in teal, MedElite in the AED red. */
const ACCENT: Record<number, string> = { 0: colors.navy, 1: colors.teal, 2: colors.red };

/**
 * What a tier adds over the one below it, from the entitlements the server
 * sent. Core lists what everyone gets; paid tiers say "Everything in X" and
 * then only their additions, so a card is never a wall of repeated ticks.
 */
export function planHighlights(plan: Plan, below: Plan | null, features: PlanFeature[]): string[] {
  const included = features.filter(f => f.value_type === 'bool' && plan.entitlements[f.code] === true);
  if (!below) return included.slice(0, 6).map(f => f.label);
  const added = included.filter(f => below.entitlements[f.code] !== true).map(f => f.label);
  return [`Everything in ${below.name}`, ...added];
}

export function planPrice(plan: Plan, cycle: BillingCycle): { amount: string; period: string } {
  if (!plan.price_monthly && !plan.price_yearly) return { amount: 'Free', period: '' };
  return cycle === 'yearly'
    ? { amount: formatRupees(plan.price_yearly), period: '/ year' }
    : { amount: formatRupees(plan.price_monthly), period: '/ month' };
}

export function PlanCard({
  plan, below, features, cycle, action, onAction, busy, testID,
}: {
  plan: Plan;
  below: Plan | null;
  features: PlanFeature[];
  cycle: BillingCycle;
  action: PlanAction;
  onAction?: () => void;
  busy?: boolean;
  testID?: string;
}) {
  const accent = ACCENT[plan.rank] ?? colors.navy;
  const price = planPrice(plan, cycle);
  const tokens = Number(plan.entitlements.AED_MONTHLY_TOKENS ?? 0);
  const current = action === 'current';

  return (
    <View style={[styles.card, current && { borderColor: accent, borderWidth: 2 }]} testID={testID}>
      <View style={styles.head}>
        <View style={[styles.badge, { backgroundColor: `${accent}14` }]}>
          <Text style={[styles.badgeText, { color: accent }]}>{plan.tagline}</Text>
        </View>
        {current ? (
          <View style={styles.currentPill}>
            <Ionicons name="checkmark-circle" size={14} color={colors.teal} />
            <Text style={styles.currentText}>Current plan</Text>
          </View>
        ) : null}
      </View>
      <Text style={styles.name}>{plan.name}</Text>
      <View style={styles.priceRow}>
        <Text style={styles.price}>{price.amount}</Text>
        {price.period ? <Text style={styles.period}>{price.period}</Text> : null}
      </View>
      <Text style={styles.description}>{plan.description}</Text>

      <View style={[styles.tokens, { borderColor: `${accent}33` }]}>
        <Ionicons name="flash" size={16} color={accent} />
        <Text style={styles.tokensText}>
          <Text style={styles.tokensValue}>{tokens.toLocaleString('en-IN')}</Text> AED tokens / month
        </Text>
      </View>

      <View style={styles.list}>
        {planHighlights(plan, below, features).map(line => (
          <View key={line} style={styles.item}>
            <Ionicons name="checkmark" size={16} color={accent} />
            <Text style={styles.itemText}>{line}</Text>
          </View>
        ))}
      </View>

      {action === 'upgrade' ? (
        <Button label={`Upgrade to ${plan.name}`} onPress={onAction ?? (() => {})} loading={busy}
          testID={`${testID}-upgrade`} />
      ) : action === 'downgrade' ? (
        <Button label={`Switch to ${plan.name}`} variant="outline" onPress={onAction ?? (() => {})}
          loading={busy} testID={`${testID}-downgrade`} />
      ) : action === 'scheduled' ? (
        <Text style={styles.note}>Starts at your next renewal</Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.white, borderRadius: radius.xl + 2, borderWidth: 1, borderColor: colors.border,
    padding: spacing.xl, gap: spacing.md, flexBasis: 280, flexGrow: 1,
  },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  badge: { paddingHorizontal: spacing.sm + 2, paddingVertical: 3, borderRadius: radius.pill },
  badgeText: { ...typography.small, fontFamily: fonts.body.semibold },
  currentPill: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  currentText: { ...typography.small, fontFamily: fonts.body.semibold, color: colors.teal },
  name: { ...typography.h2, color: colors.text },
  priceRow: { flexDirection: 'row', alignItems: 'baseline', gap: spacing.xs },
  price: { fontSize: 28, fontFamily: fonts.heading.bold, color: colors.text, letterSpacing: -0.4 },
  period: { ...typography.caption, color: colors.textSecondary },
  description: { ...typography.caption, color: colors.textSecondary, lineHeight: 19 },
  tokens: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm, padding: spacing.md,
    borderRadius: radius.lg, borderWidth: 1, backgroundColor: colors.bg,
  },
  tokensText: { ...typography.caption, color: colors.text },
  tokensValue: { fontFamily: fonts.body.bold },
  list: { gap: spacing.sm },
  item: { flexDirection: 'row', gap: spacing.sm, alignItems: 'flex-start' },
  itemText: { ...typography.caption, color: colors.text, flex: 1, lineHeight: 19 },
  note: { ...typography.small, color: colors.textSecondary, textAlign: 'center' },
});
