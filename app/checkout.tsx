import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useAuth } from '../src/context/AuthContext';
import { colors, fonts, radius, spacing, typography } from '../src/theme';
import { PageColumn } from '../src/components/web';
import { Button, ErrorState, LoadingState, ScreenHeader } from '../src/components';
import { ChoiceChips } from '../src/components/locum/ChoiceChips';
import { fetchCheckout, payDemo, startCheckout } from '../src/api/subscriptions';
import { formatRupees, type Checkout, type SubscriptionView } from '../src/types/subscriptions';

type Method = 'card' | 'upi' | 'netbanking';
type Phase = 'ready' | 'processing' | 'success' | 'failed';

const METHODS: { value: Method; label: string; icon: any }[] = [
  { value: 'card', label: 'Demo Card', icon: 'card-outline' },
  { value: 'upi', label: 'Demo UPI', icon: 'phone-portrait-outline' },
  { value: 'netbanking', label: 'Demo Net Banking', icon: 'business-outline' },
];

/**
 * DEMO checkout. No money moves and no payment gateway is contacted: the
 * server's demo provider settles the payment with the outcome chosen here, so
 * both the success and the failure path of the real flow can be walked.
 *
 * The amount shown is the one the server priced when the checkout was
 * created; this screen never sends a price back.
 */
export default function CheckoutScreen() {
  const { payment } = useLocalSearchParams<{ payment: string }>();
  const { token } = useAuth();
  const router = useRouter();
  const [checkout, setCheckout] = useState<Checkout | null>(null);
  const [method, setMethod] = useState<Method>('card');
  const [phase, setPhase] = useState<Phase>('ready');
  const [result, setResult] = useState<SubscriptionView | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const redirect = useRef<ReturnType<typeof setTimeout> | null>(null);

  const load = useCallback(async () => {
    if (!token || !payment) return;
    setError(null);
    try {
      const c = await fetchCheckout(token, payment);
      setCheckout(c);
      if (c.status === 'succeeded') setPhase('success');
    } catch (e: any) {
      setError(e?.message || 'Could not load this checkout.');
    }
  }, [token, payment]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => () => { if (redirect.current) clearTimeout(redirect.current); }, []);

  const pay = async (outcome: 'success' | 'failure') => {
    if (!token || !checkout || phase === 'processing') return;
    setPhase('processing');
    setMessage(null);
    try {
      const res = await payDemo(token, checkout.payment_id, outcome, method);
      setResult(res.subscription);
      setPhase('success');
      redirect.current = setTimeout(() => router.replace('/subscription' as any), 2500);
    } catch (e: any) {
      setPhase('failed');
      setMessage(e?.code === 'payment_failed'
        ? 'Demo payment failed. Your subscription has not been changed.'
        : e?.message || 'Payment could not be completed. Your subscription has not been changed.');
    }
  };

  /** A failed or expired checkout cannot be paid again; start a new one. */
  const retry = async () => {
    if (!token || !checkout) return;
    setPhase('processing');
    try {
      const fresh = await startCheckout(token, checkout.plan.code, checkout.billing_cycle);
      setCheckout(fresh);
      router.setParams({ payment: fresh.payment_id } as any);
      setPhase('ready');
      setMessage(null);
    } catch (e: any) {
      setPhase('failed');
      setMessage(e?.message || 'Could not start a new checkout.');
    }
  };

  const amount = checkout ? formatRupees(checkout.amount) : '';
  const tokens = result?.aed_tokens.allocated;

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <PageColumn maxWidth={560} testID="checkout-column">
        <ScreenHeader title="Checkout" />
        {error ? <ErrorState message={error} onRetry={load} /> : !checkout ? <LoadingState /> : (
          <ScrollView contentContainerStyle={styles.body}>
            <View style={styles.demo} testID="demo-banner">
              <Ionicons name="information-circle" size={18} color={colors.warning} />
              <Text style={styles.demoText}>Demo payment — no real money will be charged.</Text>
            </View>

            <View style={styles.card} testID="checkout-summary">
              <Text style={styles.overline}>Demo checkout</Text>
              <Row label="Plan" value={`${checkout.plan.name} · ${checkout.plan.tagline}`} />
              <Row label="Billing" value={checkout.billing_cycle === 'yearly' ? 'Yearly' : 'Monthly'} />
              <View style={styles.divider} />
              <Row label="Amount" value={amount} strong />
            </View>

            {phase === 'success' ? (
              <View style={[styles.card, styles.center]} testID="checkout-success">
                <Ionicons name="checkmark-circle" size={48} color={colors.teal} />
                <Text style={styles.resultTitle}>Payment successful</Text>
                <Text style={styles.resultText}>{checkout.plan.name} is now active.</Text>
                {tokens ? (
                  <Text style={styles.resultText}>
                    {tokens.toLocaleString('en-IN')} AED tokens allocated for this month.
                  </Text>
                ) : null}
                <Button label="Go to my plan" onPress={() => router.replace('/subscription' as any)}
                  style={styles.full} testID="checkout-done" />
              </View>
            ) : phase === 'failed' ? (
              <View style={[styles.card, styles.center]} testID="checkout-failed">
                <Ionicons name="close-circle" size={48} color={colors.red} />
                <Text style={styles.resultTitle}>Payment not completed</Text>
                <Text style={styles.resultText}>{message}</Text>
                <Button label="Try again" onPress={retry} style={styles.full} testID="checkout-retry" />
                <Button label="Back to plans" variant="outline" onPress={() => router.replace('/subscription' as any)}
                  style={styles.full} />
              </View>
            ) : (
              <View style={styles.card}>
                <Text style={styles.overline}>Payment method</Text>
                <ChoiceChips choices={METHODS} value={method} onChange={v => v && setMethod(v)} testID="pay-method" />
                {phase === 'processing' ? (
                  <View style={styles.processing} testID="checkout-processing">
                    <ActivityIndicator color={colors.navy} />
                    <Text style={styles.resultText}>Processing payment…</Text>
                  </View>
                ) : (
                  <View style={styles.buttons}>
                    <Button label={`Pay ${amount} (Demo)`} onPress={() => pay('success')} testID="pay-success" />
                    <Button label="Simulate failed payment" variant="outline" onPress={() => pay('failure')}
                      testID="pay-failure" />
                  </View>
                )}
              </View>
            )}
          </ScrollView>
        )}
      </PageColumn>
    </SafeAreaView>
  );
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
  demo: {
    flexDirection: 'row', gap: spacing.sm, alignItems: 'center', padding: spacing.md,
    borderRadius: radius.lg, backgroundColor: colors.warningBg, borderWidth: 1, borderColor: '#FDE68A',
  },
  demoText: { ...typography.caption, fontFamily: fonts.body.semibold, color: colors.warning, flex: 1 },
  card: {
    backgroundColor: colors.white, borderRadius: radius.xl + 2, borderWidth: 1, borderColor: colors.border,
    padding: spacing.xl, gap: spacing.md,
  },
  center: { alignItems: 'center' },
  overline: { ...typography.overline, color: colors.teal },
  row: { flexDirection: 'row', justifyContent: 'space-between', gap: spacing.md },
  rowLabel: { ...typography.body, color: colors.textSecondary },
  rowValue: { ...typography.body, color: colors.text, flexShrink: 1, textAlign: 'right' },
  rowStrong: { fontFamily: fonts.heading.bold, fontSize: 20 },
  divider: { height: 1, backgroundColor: colors.border },
  buttons: { gap: spacing.md, marginTop: spacing.sm },
  processing: { flexDirection: 'row', gap: spacing.sm, alignItems: 'center', justifyContent: 'center', paddingVertical: spacing.lg },
  resultTitle: { ...typography.h2, color: colors.text, textAlign: 'center' },
  resultText: { ...typography.body, color: colors.textSecondary, textAlign: 'center' },
  full: { alignSelf: 'stretch' },
});
