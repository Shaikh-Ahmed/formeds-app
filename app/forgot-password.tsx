import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { apiFetch } from '../src/utils/api';
import { Button, FormInput, ErrorBanner } from '../src/components';
import { colors, radius, spacing, typography } from '../src/theme';
import { validateEmail } from '../src/utils/validation';

export default function ForgotPasswordScreen() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const handleSubmit = async () => {
    const problem = validateEmail(email);
    if (problem) { setError(problem); return; }

    setLoading(true);
    setError(null);
    try {
      await apiFetch('/api/auth/password/forgot', null, {
        method: 'POST',
        body: JSON.stringify({ email: email.trim() }),
      });
      setSent(true);
    } catch (e: any) {
      setError(e?.message || 'Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.flex}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <TouchableOpacity
            style={styles.backBtn}
            onPress={() => router.back()}
            accessibilityRole="button"
            accessibilityLabel="Go back"
          >
            <Ionicons name="arrow-back" size={24} color={colors.navy} />
          </TouchableOpacity>

          {sent ? (
            <View style={styles.center}>
              <Ionicons name="mail-open-outline" size={64} color={colors.teal} />
              <Text style={styles.title} accessibilityRole="header">Check your email</Text>
              <Text style={styles.subtitle}>
                If {email.trim()} is registered, we&apos;ve sent a link to reset your password. The link expires in 1 hour.
              </Text>
              <Button label="Back to sign in" onPress={() => router.replace('/login')} style={styles.stretch} />
            </View>
          ) : (
            <>
              <Text style={styles.title} accessibilityRole="header">Forgot password?</Text>
              <Text style={styles.subtitle}>Enter your email and we&apos;ll send you a reset link.</Text>

              <ErrorBanner message={error} />

              <FormInput
                testID="forgot-email-input"
                label="Email"
                icon="mail-outline"
                value={email}
                onChangeText={setEmail}
                placeholder="you@example.com"
                keyboardType="email-address"
                autoCapitalize="none"
                autoComplete="email"
                returnKeyType="done"
                onSubmitEditing={handleSubmit}
              />

              <Button testID="forgot-submit-btn" label="Send reset link" onPress={handleSubmit} loading={loading} />
            </>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.white },
  flex: { flex: 1 },
  scroll: { paddingHorizontal: spacing.xxl, paddingTop: spacing.lg, paddingBottom: spacing.xxxl },
  center: { alignItems: 'center', paddingTop: spacing.xxxl, gap: spacing.sm },
  stretch: { alignSelf: 'stretch', marginTop: spacing.lg },
  backBtn: {
    width: 44, height: 44, borderRadius: radius.lg, backgroundColor: colors.bgMuted,
    alignItems: 'center', justifyContent: 'center', marginBottom: spacing.xxl,
  },
  title: { ...typography.h1, color: colors.text, marginBottom: spacing.xs, textAlign: 'center' },
  subtitle: { ...typography.body, color: colors.textSecondary, marginBottom: spacing.xxl, textAlign: 'center', lineHeight: 22 },
});
