import React, { useCallback, useMemo, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { useAuth } from '../src/context/AuthContext';
import { colors, fonts, radius, spacing, typography } from '../src/theme';
import { PageColumn } from '../src/components/web';
import { Button, ErrorBanner, ErrorState, LoadingState, ScreenHeader, Sheet } from '../src/components';
import { AedTokenMeter } from '../src/components/subscriptions/AedTokenMeter';
import { PlanCard, type PlanAction } from '../src/components/subscriptions/PlanCard';
import { PlanCompare } from '../src/components/subscriptions/PlanCompare';
import { ChoiceChips } from '../src/components/locum/ChoiceChips';
import {
  cancelSubscription, fetchAedTokens, fetchMySubscription, fetchPlans, resumeSubscription,
  scheduleDowngrade, startCheckout,
} from '../src/api/subscriptions';
import {
  formatDay, formatRupees, type BillingCycle, type Catalog, type Plan, type SubscriptionView,
  type TokenTransaction,
} from '../src/types/subscriptions';

type Confirm = { kind: 'cancel' } | { kind: 'downgrade'; plan: Plan };

/**
 * Plans & AED tokens: what you are on, what you have used, and what else
 * there is.
 *
 * Every number on this page comes from the server -- prices, allowances,
 * features, token costs -- so nothing here needs a release when a plan
 * changes. Upgrades go through checkout; downgrades and cancellation are
 * scheduled for the end of the period, and the page says exactly when.
 */
export default function SubscriptionScreen() {
  const { token } = useAuth();
  const router = useRouter();
  const [view, setView] = useState<SubscriptionView | null>(null);
  const [catalog, setCatalog] = useState<Catalog | null>(null);
  const [recent, setRecent] = useState<TokenTransaction[]>([]);
  const [cycle, setCycle] = useState<BillingCycle>('monthly');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<Confirm | null>(null);

  const load = useCallback(async () => {
    if (!token) return;
    setError(null);
    try {
      const [v, c, t] = await Promise.all([fetchMySubscription(token), fetchPlans(token), fetchAedTokens(token)]);
      setView(v);
      setCatalog(c);
      setRecent(t.recent);
      if (v.subscription) setCycle(v.subscription.billing_cycle);
    } catch (e: any) {
      setError(e?.message || 'Could not load your plan.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [token]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const current = view?.plan;
  const sub = view?.subscription;
  const pendingChange = !!sub && (sub.cancel_at_period_end || !!sub.scheduled_plan);

  const yearlySaving = useMemo(() => {
    const paid = catalog?.plans.filter(p => p.price_monthly > 0) ?? [];
    return paid.reduce((best, p) => Math.max(best, p.price_monthly * 12 - p.price_yearly), 0);
  }, [catalog]);

  const actionFor = (plan: Plan): PlanAction => {
    if (!view?.can_subscribe || !current) return 'none';
    if (plan.code === current.code) return 'current';
    if (plan.rank > current.rank) return 'upgrade';
    const scheduled = sub?.scheduled_plan?.code === plan.code || (plan.rank === 0 && sub?.cancel_at_period_end);
    return scheduled ? 'scheduled' : 'downgrade';
  };

  const upgrade = async (plan: Plan) => {
    if (!token) return;
    setBusy(plan.code);
    setActionError(null);
    try {
      const checkout = await startCheckout(token, plan.code, cycle);
      router.push(`/checkout?payment=${checkout.payment_id}` as any);
    } catch (e: any) {
      setActionError(e?.message || 'Could not start checkout.');
    } finally {
      setBusy(null);
    }
  };

  const confirmChange = async () => {
    if (!token || !confirm) return;
    setBusy('confirm');
    setActionError(null);
    try {
      const next = confirm.kind === 'cancel'
        ? await cancelSubscription(token)
        : await scheduleDowngrade(token, confirm.plan.code);
      setView(next);
      setConfirm(null);
    } catch (e: any) {
      setActionError(e?.message || 'Could not change your plan.');
    } finally {
      setBusy(null);
    }
  };

  const resume = async () => {
    if (!token) return;
    setBusy('resume');
    setActionError(null);
    try {
      setView(await resumeSubscription(token));
    } catch (e: any) {
      setActionError(e?.message || 'Could not resume your plan.');
    } finally {
      setBusy(null);
    }
  };

  const renewalLine = !sub
    ? 'Core is free and does not renew.'
    : sub.cancel_at_period_end
      ? `Ends ${formatDay(sub.current_period_end)}. You'll move to Core, and keep everything you have created.`
      : sub.scheduled_plan
        ? `Switches to ${sub.scheduled_plan.name} on ${formatDay(sub.current_period_end)}.`
        : `Renews ${formatDay(sub.current_period_end)} · billed ${sub.billing_cycle}`;

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <PageColumn maxWidth={1040} testID="subscription-column">
        <ScreenHeader title="Plans & AED tokens" />
        {loading ? <LoadingState /> : error ? <ErrorState message={error} onRetry={load} /> : view && catalog ? (
          <ScrollView
            contentContainerStyle={styles.body}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} />}
          >
            <ErrorBanner message={actionError} />

            <View style={styles.summary}>
              <View style={[styles.panel, styles.flexPanel]} testID="current-plan">
                <Text style={styles.overline}>Your current plan</Text>
                <View style={styles.planLine}>
                  <Text style={styles.planName}>{view.plan.name}</Text>
                  <View style={styles.tagline}><Text style={styles.taglineText}>{view.plan.tagline}</Text></View>
                </View>
                <Text style={styles.renewal}>{renewalLine}</Text>
                {!view.can_subscribe ? (
                  <Text style={styles.hint}>
                    ProCare and MedElite are plans for healthcare professionals. Your organisation
                    account includes AED on the Core allowance.
                  </Text>
                ) : null}
                {view.can_subscribe && sub ? (
                  <View style={styles.actions}>
                    {pendingChange ? (
                      <Button label="Keep my plan" variant="outline" onPress={resume}
                        loading={busy === 'resume'} style={styles.smallBtn} testID="subscription-resume" />
                    ) : (
                      <Button label="Cancel plan" variant="outline" onPress={() => setConfirm({ kind: 'cancel' })}
                        style={styles.smallBtn} testID="subscription-cancel" />
                    )}
                  </View>
                ) : null}
              </View>

              <View style={[styles.panel, styles.flexPanel]} testID="aed-usage">
                <Text style={styles.overline}>AED usage this period</Text>
                <AedTokenMeter wallet={view.aed_tokens} />
                {recent.filter(t => t.type !== 'allocation').slice(0, 4).map(t => (
                  <View key={t.id} style={styles.txRow}>
                    <Text style={styles.txLabel} numberOfLines={1}>{t.description}</Text>
                    <Text style={[styles.txAmount, t.amount > 0 && styles.txCredit]}>
                      {t.amount > 0 ? `+${t.amount}` : t.amount}
                    </Text>
                  </View>
                ))}
              </View>
            </View>

            <View style={styles.sectionHead}>
              <Text style={styles.h2}>{view.can_subscribe ? 'Available plans' : 'Professional plans'}</Text>
              <View style={styles.cycle}>
                <ChoiceChips
                  choices={[{ value: 'monthly', label: 'Monthly' }, { value: 'yearly', label: 'Yearly' }]}
                  value={cycle}
                  onChange={v => v && setCycle(v)}
                  testID="billing-cycle"
                />
                {yearlySaving > 0 ? (
                  <Text style={styles.saving}>Yearly saves up to {formatRupees(yearlySaving)}</Text>
                ) : null}
              </View>
            </View>

            <View style={styles.cards}>
              {catalog.plans.map((plan, i) => (
                <PlanCard
                  key={plan.code}
                  plan={plan}
                  below={i > 0 ? catalog.plans[i - 1] : null}
                  features={catalog.features}
                  cycle={cycle}
                  action={actionFor(plan)}
                  busy={busy === plan.code}
                  onAction={() => (actionFor(plan) === 'upgrade' ? upgrade(plan) : setConfirm({ kind: 'downgrade', plan }))}
                  testID={`plan-${plan.code}`}
                />
              ))}
            </View>

            <PlanCompare plans={catalog.plans} features={catalog.features} />

            <View style={styles.panel}>
              <Text style={styles.overline}>How AED tokens are used</Text>
              {catalog.token_costs.map(c => (
                <View key={c.request_type} style={styles.txRow}>
                  <Text style={styles.txLabel}>{c.label}</Text>
                  <Text style={styles.cost}>{c.tokens} {c.tokens === 1 ? 'token' : 'tokens'}</Text>
                </View>
              ))}
              <Text style={styles.hint}>
                {'Tokens reset each month and unused tokens don’t carry over. A possible emergency is always ' +
                  'answered, even with no tokens left, and costs nothing.'}
              </Text>
            </View>

            <Pressable onPress={() => router.push('/aed-chat' as any)} accessibilityRole="link" style={styles.link}>
              <Ionicons name="medical-outline" size={16} color={colors.navy} />
              <Text style={styles.linkText}>Open AED</Text>
            </Pressable>
          </ScrollView>
        ) : null}
      </PageColumn>

      <Sheet
        visible={!!confirm}
        onClose={() => setConfirm(null)}
        title={confirm?.kind === 'cancel' ? `Cancel ${current?.name}?` : `Switch to ${confirm?.kind === 'downgrade' ? confirm.plan.name : ''}?`}
        testID="subscription-confirm"
        footer={
          <>
            <Button label="Keep my plan" variant="outline" onPress={() => setConfirm(null)} style={styles.flex} />
            <Button label="Confirm" variant="danger" onPress={confirmChange} loading={busy === 'confirm'}
              style={styles.flex} testID="subscription-confirm-yes" />
          </>
        }
      >
        <View style={styles.sheetBody}>
          <Text style={styles.sheetText}>
            {confirm?.kind === 'cancel'
              ? `You keep ${current?.name} until ${formatDay(sub?.current_period_end)}. After that you move to Core with ${Number(catalog?.plans.find(p => p.rank === 0)?.entitlements.AED_MONTHLY_TOKENS ?? 0).toLocaleString('en-IN')} AED tokens a month. Nothing you have created is deleted.`
              : confirm?.kind === 'downgrade'
                ? `You keep ${current?.name} until ${formatDay(sub?.current_period_end)}, then switch to ${confirm.plan.name}.`
                : ''}
          </Text>
        </View>
      </Sheet>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  flex: { flex: 1 },
  body: { padding: spacing.lg, paddingBottom: spacing.xxxl * 2, gap: spacing.xl },
  summary: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.lg },
  panel: {
    backgroundColor: colors.white, borderRadius: radius.xl + 2, borderWidth: 1, borderColor: colors.border,
    padding: spacing.xl, gap: spacing.sm,
  },
  flexPanel: { flexBasis: 320, flexGrow: 1 },
  overline: { ...typography.overline, color: colors.teal },
  planLine: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, flexWrap: 'wrap' },
  planName: { ...typography.h1, color: colors.text },
  tagline: { paddingHorizontal: spacing.sm + 2, paddingVertical: 3, borderRadius: radius.pill, backgroundColor: colors.tealBg },
  taglineText: { ...typography.small, fontFamily: fonts.body.semibold, color: colors.teal },
  renewal: { ...typography.caption, color: colors.textSecondary, lineHeight: 19 },
  hint: { ...typography.small, color: colors.textSecondary, lineHeight: 18 },
  actions: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.xs },
  smallBtn: { minHeight: 44, paddingHorizontal: spacing.lg },
  txRow: { flexDirection: 'row', justifyContent: 'space-between', gap: spacing.md, paddingVertical: 4 },
  txLabel: { ...typography.caption, color: colors.text, flex: 1 },
  txAmount: { ...typography.caption, fontFamily: fonts.body.semibold, color: colors.textSecondary },
  txCredit: { color: colors.teal },
  cost: { ...typography.caption, fontFamily: fonts.body.semibold, color: colors.text },
  sectionHead: { gap: spacing.sm },
  h2: { ...typography.h2, color: colors.text },
  cycle: { gap: spacing.xs },
  saving: { ...typography.small, color: colors.teal },
  cards: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.lg },
  link: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, alignSelf: 'center' },
  linkText: { ...typography.label, color: colors.navy },
  sheetBody: { padding: spacing.xl, paddingTop: spacing.md },
  sheetText: { ...typography.body, color: colors.text, lineHeight: 22 },
});
