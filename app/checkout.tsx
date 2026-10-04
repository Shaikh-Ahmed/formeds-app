import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useSubmit } from '../src/hooks/useSubmit';
import { ActivityIndicator, Linking, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useAuth } from '../src/context/AuthContext';
import { colors, fonts, radius, spacing, typography } from '../src/theme';
import { PageColumn } from '../src/components/web';
import { Button, ErrorState, LoadingState, ScreenHeader } from '../src/components';
import { ChoiceChips } from '../src/components/locum/ChoiceChips';
import {
  createPaymentOrder, fetchCheckout, fetchMySubscription, fetchPlans, payDemo, reportPaymentFailure,
  startCheckout, verifyPayment,
} from '../src/api/subscriptions';
import {
  formatDay, formatRupees, type Catalog, type Checkout, type GatewayResponse, type SubscriptionView,
} from '../src/types/subscriptions';
import { openRazorpay, razorpaySupported } from '../src/utils/razorpay';
import { webLink } from '../src/utils/share';

type Method = 'card' | 'upi' | 'netbanking';
type Phase = 'ready' | 'creating' | 'paying' | 'verifying' | 'success' | 'failed' | 'cancelled' | 'unconfirmed';

const METHODS: { value: Method; label: string; icon: any }[] = [
  { value: 'card', label: 'Demo Card', icon: 'card-outline' },
  { value: 'upi', label: 'Demo UPI', icon: 'phone-portrait-outline' },
  { value: 'netbanking', label: 'Demo Net Banking', icon: 'business-outline' },
];

/** Keeps Razorpay's response across a reload until the server has verified it. */
const pendingKey = (paymentId: string) => `formeds_rzp_${paymentId}`;
const savePending = (id: string, r: GatewayResponse | null) => {
  try {
    if (typeof sessionStorage === 'undefined') return;
    if (r) sessionStorage.setItem(pendingKey(id), JSON.stringify(r));
    else sessionStorage.removeItem(pendingKey(id));
  } catch { /* storage blocked: the server can still recover the payment */ }
};
const readPending = (id: string): GatewayResponse | null => {
  try {
    const raw = typeof sessionStorage !== 'undefined' ? sessionStorage.getItem(pendingKey(id)) : null;
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
};

/**
 * Checkout for a plan.
 *
 * The amount shown is the one the server priced when the checkout was
 * created; this screen never sends a price. With Razorpay (the normal case),
 * Razorpay's own modal takes the payment and the SERVER verifies it -- the
 * plan is shown as active only after that verification succeeds. The demo
 * flow below remains only for development without Razorpay keys.
 */
export default function CheckoutScreen() {
  const { payment } = useLocalSearchParams<{ payment: string }>();
  const { token } = useAuth();
  const router = useRouter();
  const [checkout, setCheckout] = useState<Checkout | null>(null);
  const [catalog, setCatalog] = useState<Catalog | null>(null);
  const [method, setMethod] = useState<Method>('card');
  const [phase, setPhase] = useState<Phase>('ready');
  const [result, setResult] = useState<SubscriptionView | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const guard = useSubmit();
  const redirect = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pending = useRef<GatewayResponse | null>(null);

  const finishSuccess = useCallback(async (sub?: SubscriptionView) => {
    setResult(sub ?? (token ? await fetchMySubscription(token).catch(() => null) : null));
    setPhase('success');
  }, [token]);

  /** Send Razorpay's response to the server; only its answer counts. */
  const verify = useCallback(async (c: Checkout, response: GatewayResponse) => {
    if (!token) return;
    pending.current = response;
    savePending(c.payment_id, response);
    setPhase('verifying');
    setMessage(null);
    try {
      const res = await verifyPayment(token, c.payment_id, response);
      savePending(c.payment_id, null);
      pending.current = null;
      setCheckout(res.checkout);
      await finishSuccess(res.subscription);
    } catch (e: any) {
      const status = e?.status ?? 0;
      if (status === 400 || status === 404 || status === 409) {
        savePending(c.payment_id, null);
        pending.current = null;
        setPhase('failed');
        setMessage(e?.code === 'payment_not_completed'
          ? 'This payment was not completed. Your subscription has not been changed.'
          : 'Payment verification failed. Your subscription has not been changed. '
            + 'If money was deducted, it is refunded automatically by your bank, or contact ForMeds support.');
      } else {
        // A network problem or a gateway hiccup: the payment may well have
        // gone through. Keep the response and offer a safe re-check.
        setPhase('unconfirmed');
        setMessage("We couldn't confirm your payment yet. Your subscription will update as soon as we can -- "
          + 'check again in a moment.');
      }
    }
  }, [token, finishSuccess]);

  const load = useCallback(async () => {
    if (!token || !payment) return;
    setError(null);
    try {
      // Reading a checkout also lets the server finish a payment whose
      // window closed before it could be verified.
      const c = await fetchCheckout(token, payment);
      setCheckout(c);
      if (c.status === 'succeeded') {
        savePending(c.payment_id, null);
        await finishSuccess();
      } else {
        const saved = readPending(c.payment_id);
        if (saved && c.provider === 'razorpay') verify(c, saved);
      }
    } catch (e: any) {
      setError(e?.message || 'Could not load this checkout.');
    }
  }, [token, payment, finishSuccess, verify]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { fetchPlans(token).then(setCatalog).catch(() => setCatalog(null)); }, [token]);
  useEffect(() => () => { if (redirect.current) clearTimeout(redirect.current); }, []);

  /**
   * One Razorpay attempt per press: the guard blocks a second press while one
   * runs, the idempotency key makes a retried request return the first one's
   * order, and the server creates one order per checkout no matter what.
   */
  const payWithRazorpay = () => guard.run(async key => {
    if (!token || !checkout) return;
    setMessage(null);
    setPhase('creating');
    let current = checkout;
    try {
      let order;
      try {
        order = await createPaymentOrder(token, current.payment_id, key);
      } catch (e: any) {
        if (e?.status !== 410) throw e;
        // The checkout expired: start a fresh one at today's price.
        current = await startCheckout(token, current.plan.code, current.billing_cycle);
        setCheckout(current);
        router.setParams({ payment: current.payment_id } as any);
        order = await createPaymentOrder(token, current.payment_id);
      }
      setPhase('paying');
      const outcome = await openRazorpay(order, colors.action);
      if (outcome.kind === 'paid') {
        await verify(current, outcome.response);
      } else if (outcome.kind === 'failed') {
        reportPaymentFailure(token, current.payment_id, outcome.reason).catch(() => {});
        setPhase('failed');
        setMessage(`Payment could not be completed: ${outcome.reason} Your subscription has not been changed.`);
      } else {
        setPhase('cancelled');
        setMessage('Payment cancelled. Your subscription has not been changed.');
      }
    } catch (e: any) {
      setPhase('failed');
      setMessage(e?.message || 'Could not start the payment. Your subscription has not been changed.');
    }
  }, { payment: checkout?.payment_id });

  const recheck = () => guard.run(async () => {
    if (!checkout) return;
    const saved = pending.current ?? readPending(checkout.payment_id);
    if (saved) await verify(checkout, saved);
    else await load();
  }, { recheck: checkout?.payment_id });

  // ── Demo (development without Razorpay keys only) ───────────────────────

  const payDemoOnce = (outcome: 'success' | 'failure') => guard.run(async key => {
    if (!token || !checkout || phase === 'creating') return;
    setPhase('creating');
    setMessage(null);
    try {
      const res = await payDemo(token, checkout.payment_id, outcome, method, key);
      setResult(res.subscription);
      setPhase('success');
      redirect.current = setTimeout(() => router.replace('/subscription' as any), 2500);
    } catch (e: any) {
      setPhase('failed');
      setMessage(e?.code === 'payment_failed'
        ? 'Demo payment failed. Your subscription has not been changed.'
        : e?.message || 'Payment could not be completed. Your subscription has not been changed.');
    }
  }, { payment: checkout?.payment_id, outcome, method });

  /** A failed demo checkout cannot be paid again; start a new one. */
  const retryDemo = () => guard.run(async key => {
    if (!token || !checkout) return;
    setPhase('creating');
    try {
      const fresh = await startCheckout(token, checkout.plan.code, checkout.billing_cycle, key);
      setCheckout(fresh);
      router.setParams({ payment: fresh.payment_id } as any);
      setPhase('ready');
      setMessage(null);
    } catch (e: any) {
      setPhase('failed');
      setMessage(e?.message || 'Could not start a new checkout.');
    }
  }, { retry: checkout?.payment_id });

  // ── View ────────────────────────────────────────────────────────────────

  const isGateway = checkout?.provider === 'razorpay';
  const amount = checkout ? formatRupees(checkout.amount) : '';
  const cycleLabel = checkout?.billing_cycle === 'yearly' ? 'Yearly' : 'Monthly';
  const per = checkout?.billing_cycle === 'yearly' ? '/ year' : '/ month';
  const tokens = result?.aed_tokens.allocated;
  const benefits = planBenefits(catalog, checkout?.plan.code);
  const busy = phase === 'creating' || phase === 'paying' || phase === 'verifying';

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <PageColumn maxWidth={560} testID="checkout-column">
        <ScreenHeader title="Checkout" />
        {error ? <ErrorState message={error} onRetry={load} /> : !checkout ? <LoadingState /> : (
          <ScrollView contentContainerStyle={styles.body}>
            {!isGateway ? (
              <View style={styles.notice} testID="demo-banner">
                <Ionicons name="information-circle" size={18} color={colors.warning} />
                <Text style={styles.noticeText}>Demo payment — no real money will be charged.</Text>
              </View>
            ) : checkout.test_mode ? (
              <View style={styles.notice} testID="test-mode-banner">
                <Ionicons name="flask-outline" size={18} color={colors.warning} />
                <Text style={styles.noticeText}>
                  Razorpay test mode — use Razorpay&apos;s test cards or UPI; no real money is charged.
                </Text>
              </View>
            ) : null}

            {phase === 'success' ? (
              <View style={[styles.card, styles.center]} testID="checkout-success">
                <Ionicons name="checkmark-circle" size={52} color={colors.success} />
                <Text style={styles.resultTitle}>Payment successful</Text>
                <Text style={styles.resultText}>{checkout.plan.name} is now active.</Text>
                <View style={styles.receipt}>
                  <Row label="Plan" value={checkout.plan.name} />
                  <Row label="Billing" value={cycleLabel} />
                  <Row label="Amount" value={amount} />
                  {result?.subscription ? (
                    <Row label="Valid until" value={formatDay(result.subscription.current_period_end)} />
                  ) : null}
                </View>
                {tokens ? (
                  <Text style={styles.resultText}>
                    {tokens.toLocaleString('en-IN')} AED tokens are ready for this month.
                  </Text>
                ) : null}
                <Button label="Continue to ForMeds" onPress={() => router.replace('/(tabs)/community' as any)}
                  style={styles.full} testID="checkout-done" />
                <Button label="View my plan" variant="outline" onPress={() => router.replace('/subscription' as any)}
                  style={styles.full} />
              </View>
            ) : (
              <>
                <View style={styles.card} testID="checkout-summary">
                  <Text style={styles.overline}>{isGateway ? 'Your plan' : 'Demo checkout'}</Text>
                  <View style={styles.planHead}>
                    <Text style={styles.planName}>{checkout.plan.name}</Text>
                    <Text style={styles.planPrice}>{amount} <Text style={styles.planPer}>{per}</Text></Text>
                  </View>
                  {benefits.length ? (
                    <View style={styles.benefits}>
                      {benefits.map(b => (
                        <View key={b} style={styles.benefit}>
                          <Ionicons name="checkmark-circle" size={16} color={colors.success} />
                          <Text style={styles.benefitText}>{b}</Text>
                        </View>
                      ))}
                    </View>
                  ) : null}
                  <View style={styles.divider} />
                  <Row label="Billing" value={cycleLabel} />
                  <Row label="Amount due" value={amount} strong />
                  {isGateway ? (
                    <Text style={styles.small}>
                      A one-time payment for this {checkout.billing_cycle === 'yearly' ? 'year' : 'month'}. Nothing
                      is charged automatically when it ends.
                    </Text>
                  ) : null}
                </View>

                {phase === 'failed' || phase === 'cancelled' || phase === 'unconfirmed' ? (
                  <View style={[styles.card, styles.center]}
                    testID={phase === 'failed' ? 'checkout-failed' : phase === 'cancelled' ? 'checkout-cancelled' : 'checkout-unconfirmed'}>
                    <Ionicons
                      name={phase === 'failed' ? 'close-circle' : phase === 'cancelled' ? 'remove-circle-outline' : 'time-outline'}
                      size={44} color={phase === 'failed' ? colors.red : colors.textSecondary} />
                    <Text style={styles.resultTitle}>
                      {phase === 'failed' ? 'Payment not completed' : phase === 'cancelled' ? 'Payment cancelled' : 'Confirming your payment'}
                    </Text>
                    <Text style={styles.resultText}>{message}</Text>
                    {phase === 'unconfirmed' ? (
                      <Button label="Check again" onPress={recheck} style={styles.full} testID="checkout-recheck" />
                    ) : (
                      <Button label="Try again" onPress={isGateway ? payWithRazorpay : retryDemo}
                        style={styles.full} testID="checkout-retry" />
                    )}
                    <Button label="Back to plans" variant="outline" onPress={() => router.replace('/subscription' as any)}
                      style={styles.full} />
                  </View>
                ) : isGateway ? (
                  <View style={styles.card}>
                    {!razorpaySupported ? (
                      <>
                        <Text style={styles.resultText}>
                          Plan payments are completed on the ForMeds website. Sign in there to continue.
                        </Text>
                        <Button label="Open ForMeds on the web" onPress={() => Linking.openURL(webLink('/subscription'))}
                          testID="pay-open-web" />
                      </>
                    ) : busy ? (
                      <View style={styles.processing} testID="checkout-processing">
                        <ActivityIndicator color={colors.action} />
                        <Text style={styles.resultText}>
                          {phase === 'creating' ? 'Creating payment…'
                            : phase === 'paying' ? 'Complete the payment in the Razorpay window…'
                              : 'Confirming your payment…'}
                        </Text>
                      </View>
                    ) : (
                      <>
                        <Button label={`Pay ${amount}`} loadingLabel="Creating payment…" onPress={payWithRazorpay}
                          testID="pay-razorpay" />
                        <View style={styles.secure}>
                          <Ionicons name="lock-closed" size={13} color={colors.textSecondary} />
                          <Text style={styles.small}>Secured by Razorpay · cards, UPI, net banking and wallets</Text>
                        </View>
                      </>
                    )}
                  </View>
                ) : (
                  <View style={styles.card}>
                    <Text style={styles.overline}>Payment method</Text>
                    <ChoiceChips choices={METHODS} value={method} onChange={v => v && setMethod(v)} testID="pay-method" />
                    {busy ? (
                      <View style={styles.processing} testID="checkout-processing">
                        <ActivityIndicator color={colors.navy} />
                        <Text style={styles.resultText}>Processing payment…</Text>
                      </View>
                    ) : (
                      <View style={styles.buttons}>
                        <Button label={`Pay ${amount} (Demo)`} loadingLabel="Processing…" onPress={() => payDemoOnce('success')}
                          testID="pay-success" />
                        <Button label="Simulate failed payment" variant="outline" onPress={() => payDemoOnce('failure')}
                          testID="pay-failure" />
                      </View>
                    )}
                  </View>
                )}
              </>
            )}
          </ScrollView>
        )}
      </PageColumn>
    </SafeAreaView>
  );
}

/** The plan's headline benefits, from the server's catalogue -- never hardcoded. */
function planBenefits(catalog: Catalog | null, code?: string): string[] {
  const plan = catalog?.plans.find(p => p.code === code);
  if (!plan || !catalog) return [];
  const out: string[] = [];
  const tokens = Number(plan.entitlements.AED_MONTHLY_TOKENS ?? 0);
  if (tokens) out.push(`${tokens.toLocaleString('en-IN')} AED tokens every month`);
  for (const f of catalog.features) {
    if (f.code.startsWith('AED_') && f.code !== 'AED_ACCESS' && f.value_type === 'bool' && plan.entitlements[f.code]) {
      out.push(f.label);
    }
  }
  return out;
}

function Row({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={[styles.rowValue, strong && styles.rowStrong]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  body: { padding: spacing.lg, paddingBottom: spacing.xxxl * 2, gap: spacing.lg },
  notice: {
    flexDirection: 'row', gap: spacing.sm, alignItems: 'center', padding: spacing.md,
    borderRadius: radius.lg, backgroundColor: colors.warningBg, borderWidth: 1, borderColor: '#FDE68A',
  },
  noticeText: { ...typography.caption, fontFamily: fonts.body.semibold, color: colors.warning, flex: 1 },
  card: {
    backgroundColor: colors.white, borderRadius: radius.xl + 2, borderWidth: 1, borderColor: colors.border,
    padding: spacing.xl, gap: spacing.md,
  },
  center: { alignItems: 'center' },
  overline: { ...typography.overline, color: colors.teal },
  planHead: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: spacing.md, flexWrap: 'wrap' },
  planName: { ...typography.h2, color: colors.text },
  planPrice: { fontFamily: fonts.heading.bold, fontSize: 22, color: colors.text },
  planPer: { ...typography.caption, color: colors.textSecondary },
  benefits: { gap: spacing.sm },
  benefit: { flexDirection: 'row', gap: spacing.sm, alignItems: 'center' },
  benefitText: { ...typography.body, color: colors.text, flexShrink: 1 },
  row: { flexDirection: 'row', justifyContent: 'space-between', gap: spacing.md },
  rowLabel: { ...typography.body, color: colors.textSecondary },
  rowValue: { ...typography.body, color: colors.text, flexShrink: 1, textAlign: 'right' },
  rowStrong: { fontFamily: fonts.heading.bold, fontSize: 20 },
  divider: { height: 1, backgroundColor: colors.border },
  small: { ...typography.small, color: colors.textSecondary },
  secure: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
  buttons: { gap: spacing.md, marginTop: spacing.sm },
  processing: { flexDirection: 'row', gap: spacing.sm, alignItems: 'center', justifyContent: 'center', paddingVertical: spacing.lg },
  receipt: { alignSelf: 'stretch', gap: spacing.sm, paddingVertical: spacing.sm },
  resultTitle: { ...typography.h2, color: colors.text, textAlign: 'center' },
  resultText: { ...typography.body, color: colors.textSecondary, textAlign: 'center' },
  full: { alignSelf: 'stretch' },
});
