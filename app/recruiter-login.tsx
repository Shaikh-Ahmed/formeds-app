import React, { useState } from 'react';
import { View, Text, KeyboardAvoidingView, Platform, ScrollView, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../src/context/AuthContext';
import { ApiError } from '../src/utils/api';
import { Button, FormInput, ErrorBanner } from '../src/components';
import { colors, getRoleMeta } from '../src/theme';
import { validateEmail, validateRequired, firstError } from '../src/utils/validation';
import { AuthShell } from '../src/components/web';
import { authStyles as styles } from '../src/components/recruiters/authStyles';

/**
 * Recruiter sign-in. Same session as every account; RootNavigator sends a
 * recruiter to their portal (and anyone else to their usual home), so the
 * destination is never decided here.
 */
export default function RecruiterLoginScreen() {
  const { login } = useAuth();
  const router = useRouter();
  const meta = getRoleMeta('recruiter');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    const problem = firstError(validateEmail(email), validateRequired(password, 'Password'));
    if (problem) { setError(problem); return; }
    setLoading(true);
    setError(null);
    try {
      await login(email, password);
    } catch (e: any) {
      if (e instanceof ApiError && e.code === 'email_unverified') {
        const detail = e.data?.detail ?? {};
        router.replace({
          pathname: '/verify',
          params: { verificationToken: detail.verification_token, email: detail.email ?? email.trim(), phoneRequired: '0' },
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
            <TouchableOpacity testID="recruiter-login-back" style={styles.backBtn} onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))}
              accessibilityRole="button" accessibilityLabel="Go back">
              <Ionicons name="arrow-back" size={24} color={colors.navy} />
            </TouchableOpacity>
            <View style={[styles.badge, { backgroundColor: meta.bg }]}>
              <Ionicons name={meta.icon} size={18} color={meta.color} />
              <Text style={[styles.badgeText, { color: meta.color }]}>Recruiter portal</Text>
            </View>
            <Text style={styles.title} accessibilityRole="header">Recruiter sign in</Text>
            <Text style={styles.subtitle}>Manage your openings, applicants and invitations.</Text>

            <ErrorBanner message={error} />
            <FormInput maxLength={200} testID="recruiter-login-email" label="Work email" icon="mail-outline" value={email}
              onChangeText={setEmail} placeholder="you@agency.com" keyboardType="email-address" autoCapitalize="none"
              autoComplete="email" />
            <FormInput testID="recruiter-login-password" label="Password" icon="lock-closed-outline" value={password}
              onChangeText={setPassword} placeholder="Enter password" autoCapitalize="none"
              autoComplete="current-password" secure returnKeyType="done" onSubmitEditing={submit} />
            <Button testID="recruiter-login-submit" label="Sign in" onPress={submit} loading={loading} />

            <TouchableOpacity style={styles.linkBtn} onPress={() => router.replace('/recruiter-register')} accessibilityRole="link">
              <Text style={styles.linkText}>New recruiter? <Text style={styles.linkBold}>Create an account</Text></Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.linkBtnSmall} onPress={() => router.push('/forgot-password')} accessibilityRole="link">
              <Text style={styles.linkSmall}>Forgot password?</Text>
            </TouchableOpacity>
          </ScrollView>
        </KeyboardAvoidingView>
      </AuthShell>
    </SafeAreaView>
  );
}
