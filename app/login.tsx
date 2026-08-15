import React, { useState } from 'react';
import { Text, StyleSheet, TouchableOpacity, KeyboardAvoidingView, Platform, ScrollView, Image } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../src/context/AuthContext';
import { ApiError } from '../src/utils/api';
import { Button, FormInput, ErrorBanner } from '../src/components';
import { colors, radius, spacing, typography } from '../src/theme';
import { validateEmail, validateRequired, firstError } from '../src/utils/validation';
import { AuthShell } from '../src/components/web';

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const router = useRouter();

  const handleLogin = async () => {
    const problem = firstError(validateEmail(email), validateRequired(password, 'Password'));
    if (problem) { setError(problem); return; }

    setLoading(true);
    setError(null);
    try {
      await login(email, password);
      // Destination is RootNavigator's call — it sends users who still need KYC
      // there instead of the feed. Racing it with a replace() here would make
      // the landing screen depend on which effect won.
    } catch (e: any) {
      // An account that never finished signup gets resumed rather than
      // dead-ended: the server returns a fresh signup token and a new code.
      if (e instanceof ApiError && e.code === 'email_unverified') {
        const detail = e.data?.detail ?? {};
        router.replace({
          pathname: '/verify',
          params: {
            verificationToken: detail.verification_token,
            email: detail.email ?? email.trim(),
            phoneRequired: '0',
          },
        });
        return;
      }
      setError(e?.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <AuthShell maxWidth={460}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.flex}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <TouchableOpacity
            testID="login-back-btn"
            style={styles.backBtn}
            onPress={() => router.back()}
            accessibilityRole="button"
            accessibilityLabel="Go back"
          >
            <Ionicons name="arrow-back" size={24} color={colors.navy} />
          </TouchableOpacity>

          <Image source={require('../assets/images/formeds-logo.png')} style={styles.logo} resizeMode="contain" />
          <Text style={styles.title} accessibilityRole="header">Welcome back</Text>
          <Text style={styles.subtitle}>Sign in to your ForMeds account</Text>

          <ErrorBanner message={error} />

          <FormInput
            testID="login-email-input"
            label="Email"
            icon="mail-outline"
            value={email}
            onChangeText={setEmail}
            placeholder="you@example.com"
            keyboardType="email-address"
            autoCapitalize="none"
            autoComplete="email"
            returnKeyType="next"
          />
          <FormInput
            testID="login-password-input"
            label="Password"
            icon="lock-closed-outline"
            value={password}
            onChangeText={setPassword}
            placeholder="Enter password"
            autoCapitalize="none"
            autoComplete="current-password"
            secure
            returnKeyType="done"
            onSubmitEditing={handleLogin}
          />

          <TouchableOpacity
            style={styles.forgotBtn}
            onPress={() => router.push('/forgot-password')}
            accessibilityRole="link"
          >
            <Text style={styles.forgotText}>Forgot password?</Text>
          </TouchableOpacity>

          <Button testID="login-submit-btn" label="Sign in" onPress={handleLogin} loading={loading} />

          <TouchableOpacity style={styles.linkBtn} onPress={() => router.replace('/')} accessibilityRole="link">
            <Text style={styles.linkText}>
              Don&apos;t have an account? <Text style={styles.linkBold}>Register</Text>
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
  scroll: { paddingHorizontal: spacing.xxl, paddingTop: spacing.lg, paddingBottom: spacing.xxxl },
  backBtn: {
    width: 44, height: 44, borderRadius: radius.lg, backgroundColor: colors.bgMuted,
    alignItems: 'center', justifyContent: 'center', marginBottom: spacing.xxl,
  },
  logo: { width: 140, height: 60, alignSelf: 'center', marginBottom: spacing.xxl },
  title: { ...typography.h1, color: colors.text, marginBottom: spacing.xs },
  subtitle: { ...typography.body, color: colors.textSecondary, marginBottom: spacing.xxl },
  forgotBtn: { alignSelf: 'flex-end', paddingVertical: spacing.sm, marginBottom: spacing.md, minHeight: 44, justifyContent: 'center' },
  forgotText: { ...typography.label, color: colors.teal },
  linkBtn: { alignItems: 'center', paddingVertical: spacing.md, marginTop: spacing.lg },
  linkText: { ...typography.body, color: colors.textSecondary },
  linkBold: { fontWeight: '700', color: colors.navy },
});
