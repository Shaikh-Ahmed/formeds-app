import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, KeyboardAvoidingView, Platform, ScrollView, TouchableOpacity } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth, VerificationResult } from '../src/context/AuthContext';
import { apiFetch } from '../src/utils/api';
import { Button, FormInput, ErrorBanner } from '../src/components';
import { useResendCooldown } from '../src/hooks/useResendCooldown';
import { colors, radius, spacing, typography } from '../src/theme';
import { AuthShell } from '../src/components/web';

type Step = 'email' | 'phone';

/**
 * Step 3 of signup. The account exists but has no session: the server only
 * issues tokens once every required step here passes, then we sign in and hand
 * off to KYC. Codes are entered in-app rather than clicked in an email so the
 * signup sequence never has to leave the app.
 */
export default function VerifyScreen() {
  const params = useLocalSearchParams<{
    verificationToken?: string;
    email?: string;
    phone?: string;
    phoneRequired?: string;
    delivered?: string;
  }>();
  const router = useRouter();
  const { completeSignup } = useAuth();

  const verificationToken = params.verificationToken ?? '';
  const email = params.email ?? '';
  const phone = params.phone ?? '';
  const phoneRequired = params.phoneRequired === '1';

  const [step, setStep] = useState<Step>('email');
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  // Delivery genuinely failed (provider rejected it) — distinct from a wrong
  // code, and not something the user can fix by waiting.
  const [undelivered, setUndelivered] = useState(params.delivered === '0');
  const cooldown = useResendCooldown();

  const isEmailStep = step === 'email';
  const destination = isEmailStep ? email : phone;

  useEffect(() => {
    // The code for the first step was already sent by /auth/register.
    cooldown.start();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const finish = useCallback(
    async (result: VerificationResult) => {
      if (result.complete) {
        // Storing the session makes RootNavigator route us onward — to KYC,
        // since a brand-new account is never approved yet.
        await completeSignup(result);
        return;
      }
      // Email done, phone still outstanding.
      setStep('phone');
      setCode('');
      setNotice(`We've sent a code to ${phone}.`);
      cooldown.start();
    },
    [completeSignup, phone, cooldown],
  );

  const submit = async () => {
    if (!/^\d{6}$/.test(code)) {
      setError('Enter the 6-digit code');
      return;
    }
    setSubmitting(true);
    setError(null);
    setNotice(null);
    try {
      const result: VerificationResult = await apiFetch(
        `/api/auth/verify/${step}/confirm`,
        verificationToken,
        { method: 'POST', body: JSON.stringify({ code }) },
      );
      await finish(result);
    } catch (e: any) {
      setError(e?.message || 'That code could not be verified.');
      setCode('');
    } finally {
      setSubmitting(false);
    }
  };

  const resend = async () => {
    setError(null);
    setNotice(null);
    try {
      const res = await apiFetch(`/api/auth/verify/${step}/send`, verificationToken, { method: 'POST' });
      setUndelivered(res?.delivered === false);
      if (res?.delivered === false) {
        setError(`We couldn't deliver a code to ${destination}.`);
      } else {
        setNotice(`A new code is on its way to ${destination}.`);
      }
      cooldown.start();
    } catch (e: any) {
      setError(e?.message || 'Could not resend the code. Try again shortly.');
    }
  };

  // A direct visit without a token can't verify anything — send them to login,
  // where an unverified account gets a fresh token and lands back here.
  if (!verificationToken) {
    return (
      <SafeAreaView style={styles.safe}>
        <AuthShell maxWidth={480}>
          <View style={styles.center}>
            <Ionicons name="alert-circle-outline" size={56} color={colors.textMuted} />
            <Text style={styles.title}>Nothing to verify</Text>
            <Text style={styles.subtitle}>Sign in and we&apos;ll pick up where you left off.</Text>
            <Button label="Go to sign in" onPress={() => router.replace('/login')} />
          </View>
        </AuthShell>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <AuthShell maxWidth={480}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.flex}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <View style={styles.iconWrap}>
            <Ionicons
              name={isEmailStep ? 'mail-open-outline' : 'chatbox-ellipses-outline'}
              size={32}
              color={colors.teal}
            />
          </View>

          <Text style={styles.title} accessibilityRole="header">
            {isEmailStep ? 'Confirm your email' : 'Confirm your phone'}
          </Text>
          <Text style={styles.subtitle}>
            Enter the 6-digit code we sent to <Text style={styles.strong}>{destination}</Text>.
          </Text>

          {phoneRequired ? (
            <View style={styles.steps} accessibilityLabel={`Step ${isEmailStep ? 1 : 2} of 2`}>
              <View style={[styles.stepDot, styles.stepDone]} />
              <View style={[styles.stepDot, !isEmailStep && styles.stepDone]} />
            </View>
          ) : null}

          {undelivered ? (
            <View style={styles.undelivered} accessibilityRole="alert">
              <Ionicons name="warning-outline" size={20} color={colors.warning} />
              <View style={styles.flex}>
                <Text style={styles.undeliveredTitle}>We couldn&apos;t send your code</Text>
                <Text style={styles.undeliveredBody}>
                  {isEmailStep
                    ? 'Check the address is right, or go back and correct it. If it looks correct, contact support — no code will arrive until this is resolved.'
                    : 'Check the number is right, or go back and correct it.'}
                </Text>
              </View>
            </View>
          ) : null}

          <ErrorBanner message={error} />
          {notice ? (
            <View style={styles.notice} accessibilityRole="alert">
              <Ionicons name="checkmark-circle-outline" size={18} color={colors.teal} />
              <Text style={styles.noticeText}>{notice}</Text>
            </View>
          ) : null}

          <FormInput
            testID="verify-code-input"
            label="Verification code"
            icon="key-outline"
            value={code}
            onChangeText={(v) => setCode(v.replace(/\D/g, '').slice(0, 6))}
            placeholder="123456"
            keyboardType="number-pad"
            maxLength={6}
            autoComplete="one-time-code"
            textContentType="oneTimeCode"
            returnKeyType="done"
            onSubmitEditing={submit}
          />

          <Button
            testID="verify-submit-btn"
            label="Verify"
            onPress={submit}
            loading={submitting}
            disabled={code.length !== 6}
          />

          <TouchableOpacity
            testID="verify-resend-btn"
            style={styles.resend}
            onPress={resend}
            disabled={cooldown.active}
            accessibilityRole="button"
            accessibilityLabel="Resend verification code"
            accessibilityState={{ disabled: cooldown.active }}
          >
            <Text style={[styles.resendText, cooldown.active && styles.resendDisabled]}>
              {cooldown.active ? `Resend code in ${cooldown.remaining}s` : 'Resend code'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.linkBtn}
            onPress={() => router.replace('/register')}
            accessibilityRole="link"
          >
            <Text style={styles.linkText}>
              Wrong {isEmailStep ? 'email' : 'number'}? <Text style={styles.linkBold}>Start over</Text>
            </Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
      </AuthShell>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.white },
  flex: { flex: 1 },
  scroll: { paddingHorizontal: spacing.xxl, paddingTop: spacing.xxxl, paddingBottom: spacing.xxxl },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: spacing.xxxl, gap: spacing.md },
  iconWrap: {
    width: 64, height: 64, borderRadius: radius.pill, backgroundColor: colors.tealBg,
    alignItems: 'center', justifyContent: 'center', marginBottom: spacing.xl,
  },
  title: { ...typography.h1, color: colors.text, marginBottom: spacing.sm },
  subtitle: { ...typography.body, color: colors.textSecondary, marginBottom: spacing.xl, lineHeight: 22 },
  strong: { ...typography.bodyStrong, color: colors.text },
  steps: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.xl },
  stepDot: { flex: 1, height: 4, borderRadius: 2, backgroundColor: colors.border },
  stepDone: { backgroundColor: colors.teal },
  notice: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    backgroundColor: colors.tealBg, borderRadius: radius.md, padding: spacing.md, marginBottom: spacing.lg,
  },
  noticeText: { ...typography.caption, color: colors.teal, flex: 1 },
  undelivered: {
    flexDirection: 'row', gap: spacing.md, alignItems: 'flex-start',
    backgroundColor: colors.warningBg, borderWidth: 1, borderColor: '#FDE68A',
    borderRadius: radius.lg, padding: spacing.md, marginBottom: spacing.lg,
  },
  undeliveredTitle: { ...typography.bodyStrong, color: colors.warning },
  undeliveredBody: { ...typography.caption, color: colors.textSecondary, marginTop: 2, lineHeight: 18 },
  resend: { alignItems: 'center', paddingVertical: spacing.md, marginTop: spacing.sm, minHeight: 44 },
  resendText: { ...typography.bodyStrong, color: colors.teal },
  resendDisabled: { color: colors.textMuted },
  linkBtn: { alignItems: 'center', paddingVertical: spacing.sm },
  linkText: { ...typography.body, color: colors.textSecondary },
  linkBold: { fontWeight: '700', color: colors.navy },
});
