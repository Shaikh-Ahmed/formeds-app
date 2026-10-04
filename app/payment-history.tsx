import React, { useCallback, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { useAuth } from '../src/context/AuthContext';
import { colors, fonts, radius, spacing, typography } from '../src/theme';
import { PageColumn } from '../src/components/web';
import { EmptyState, ErrorState, LoadingState, ScreenHeader } from '../src/components';
import { CopiedToast } from '../src/components/CopiedToast';
import { fetchBillingHistory } from '../src/api/subscriptions';
import { copyText } from '../src/utils/share';
import { formatDay, formatRupees, type PaymentRecord } from '../src/types/subscriptions';

const STATUS: Record<PaymentRecord['status'], { label: string; fg: string; bg: string; icon: keyof typeof Ionicons.glyphMap }> = {
  succeeded: { label: 'Paid', fg: colors.success, bg: colors.successBg, icon: 'checkmark-circle' },
  failed: { label: 'Failed', fg: colors.redText, bg: colors.redBg, icon: 'close-circle' },
  refunded: { label: 'Refunded', fg: colors.warning, bg: colors.warningBg, icon: 'return-down-back' },
};

const PURPOSE: Record<PaymentRecord['purpose'], string> = { new: 'New plan', upgrade: 'Upgrade', renewal: 'Renewal' };

const METHOD: Record<string, string> = {
  card: 'Card', upi: 'UPI', netbanking: 'Net banking', wallet: 'Wallet', emi: 'EMI', paylater: 'Pay later',
};

/** "Card · Razorpay" / "Demo" -- how it was paid, in words. */
export function paidWith(p: PaymentRecord): string {
  if (p.provider === 'demo') return 'Demo payment';
  const method = METHOD[p.method] || '';
  const gateway = p.provider === 'razorpay' ? 'Razorpay' : p.provider;
  return method ? `${method} · ${gateway}` : gateway;
}

/**
 * Payment history: every settled subscription payment -- paid, failed or
 * refunded -- newest first, with the gateway reference a member quotes to
 * support or finds on their bank statement. Open checkouts are not listed;
 * nothing here can be paid or changed.
 */
export default function PaymentHistoryScreen() {
  const { token } = useAuth();
  const router = useRouter();
  const [payments, setPayments] = useState<PaymentRecord[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const load = useCallback(async () => {
    if (!token) return;
    setError(null);
    try {
      setPayments((await fetchBillingHistory(token)).payments);
    } catch (e: any) {
      setError(e?.message || 'Could not load your payments.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [token]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const copy = async (ref: string) => {
    if (await copyText(ref)) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2200);
    }
  };

  const paid = (payments ?? []).filter(p => p.status === 'succeeded');
  const total = paid.reduce((sum, p) => sum + p.amount, 0);

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <PageColumn maxWidth={760} testID="payment-history-column">
        <ScreenHeader title="Payment history" />
        {loading ? <LoadingState /> : error ? <ErrorState message={error} onRetry={load} /> : payments ? (
          payments.length === 0 ? (
            <EmptyState
              icon="receipt-outline"
              title="No payments yet"
              hint="When you buy or renew a plan, the payment shows up here."
              actionLabel="See plans"
              onAction={() => router.push('/subscription' as any)}
              actionTestID="payment-history-plans"
            />
          ) : (
            <ScrollView
              contentContainerStyle={styles.body}
              refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} />}
            >
              <View style={styles.summary} testID="payment-summary">
                <View style={styles.stat}>
                  <Text style={styles.overline}>Total paid</Text>
                  <Text style={styles.statValue}>{formatRupees(total)}</Text>
                </View>
                <View style={styles.stat}>
                  <Text style={styles.overline}>Payments</Text>
                  <Text style={styles.statValue}>{paid.length}</Text>
                </View>
              </View>

              <View style={styles.list}>
                {payments.map(p => {
                  const s = STATUS[p.status] ?? STATUS.failed;
                  const when = formatDay(p.paid_at || p.created_at);
                  return (
                    <View key={p.id} style={styles.row} testID={`payment-${p.id}`}>
                      <View style={[styles.icon, { backgroundColor: s.bg }]}>
                        <Ionicons name={s.icon} size={20} color={s.fg} />
                      </View>
                      <View style={styles.main}>
                        <View style={styles.titleLine}>
                          <Text style={styles.title} numberOfLines={1}>
                            {p.plan} · {p.billing_cycle === 'yearly' ? 'Yearly' : 'Monthly'}
                          </Text>
                          <Text style={[styles.amount, p.status !== 'succeeded' && styles.amountMuted]}>
                            {formatRupees(p.amount)}
                          </Text>
                        </View>
                        <View style={styles.metaLine}>
                          <View style={[styles.badge, { backgroundColor: s.bg }]}>
                            <Text style={[styles.badgeText, { color: s.fg }]}>{s.label}</Text>
                          </View>
                          {p.test_mode ? (
                            <View style={[styles.badge, styles.testBadge]}>
                              <Text style={[styles.badgeText, styles.testText]}>Test</Text>
                            </View>
                          ) : null}
                          <Text style={styles.meta} numberOfLines={1}>
                            {[when, PURPOSE[p.purpose], paidWith(p)].filter(Boolean).join(' · ')}
                          </Text>
                        </View>
                        {p.failure_reason ? <Text style={styles.reason}>{p.failure_reason}</Text> : null}
                        {p.reference && p.provider !== 'demo' ? (
                          <Pressable
                            onPress={() => copy(p.reference)}
                            accessibilityRole="button"
                            accessibilityLabel={`Copy payment ID ${p.reference}`}
                            style={styles.ref}
                            testID={`payment-ref-${p.id}`}
                          >
                            <Text style={styles.refText} selectable>Payment ID {p.reference}</Text>
                            <Ionicons name="copy-outline" size={13} color={colors.textSecondary} />
                          </Pressable>
                        ) : null}
                      </View>
                    </View>
                  );
                })}
              </View>

              <Text style={styles.hint}>
                Questions about a charge? Contact support with the payment ID shown above.
              </Text>
            </ScrollView>
          )
        ) : null}
      </PageColumn>
      <CopiedToast visible={copied} label="Payment ID copied" />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  body: { padding: spacing.lg, paddingBottom: spacing.xxxl * 2, gap: spacing.lg },
  summary: { flexDirection: 'row', gap: spacing.md },
  stat: {
    flex: 1, backgroundColor: colors.white, borderRadius: radius.xl + 2, borderWidth: 1, borderColor: colors.border,
    padding: spacing.lg, gap: 2,
  },
  overline: { ...typography.overline, color: colors.teal },
  statValue: { ...typography.h2, color: colors.text },
  list: {
    backgroundColor: colors.white, borderRadius: radius.xl + 2, borderWidth: 1, borderColor: colors.border,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row', gap: spacing.md, padding: spacing.lg,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border,
  },
  icon: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  main: { flex: 1, gap: 4, minWidth: 0 },
  titleLine: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', gap: spacing.md },
  title: { ...typography.label, color: colors.text, flex: 1 },
  amount: { ...typography.label, fontFamily: fonts.body.semibold, color: colors.text },
  amountMuted: { color: colors.textSecondary, textDecorationLine: 'line-through' },
  metaLine: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, flexWrap: 'wrap' },
  badge: { paddingHorizontal: spacing.sm, paddingVertical: 2, borderRadius: radius.pill },
  badgeText: { ...typography.small, fontFamily: fonts.body.semibold },
  testBadge: { backgroundColor: colors.warningBg },
  testText: { color: colors.warning },
  meta: { ...typography.small, color: colors.textSecondary, flexShrink: 1 },
  reason: { ...typography.small, color: colors.redText },
  ref: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start', paddingVertical: 2 },
  refText: { ...typography.small, color: colors.textSecondary, fontFamily: fonts.body.medium },
  hint: { ...typography.small, color: colors.textSecondary, textAlign: 'center' },
});
