import React, { useState } from 'react';
import { View, Text, StyleSheet, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Linking from 'expo-linking';
import { SafeAreaView } from 'react-native-safe-area-context';
import { apiFetch } from '../src/utils/api';
import { Button, FormInput, ErrorBanner } from '../src/components';
import { colors, spacing, typography } from '../src/theme';
import { validatePassword } from '../src/utils/validation';
import { AuthShell } from '../src/components/web';

/**
 * The email links to this screen's plain https URL, which mobile OSes open in
 * a browser rather than the installed app — there's no App/Universal Links
 * verification set up for it. A custom-scheme URL (registered via app.json's
 * `scheme`) can still hand off to the installed app on a tap, so mobile web
 * gets an explicit bridge back into it; the in-browser form below still
 * completes the reset on its own for anyone without the app installed.
 */
const isMobileWeb =
  Platform.OS === 'web' &&
  typeof navigator !== 'undefined' &&
  /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);

export default function ResetPasswordScreen() {
  const { token } = useLocalSearchParams<{ token?: string }>();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const router = useRouter();

  const openInApp = () => {
    if (!token) return;
    Linking.openURL(Linking.createURL('reset-password', { queryParams: { token } })).catch(() => {
      // Expected when the app isn't installed — the browser just stays put
      // and the form below still works.
    });
  };

  const handleSubmit = async () => {
    if (!token) { setError('This reset link is invalid.'); return; }
    // Same rule the server enforces (letter + digit + length + denylist).
    const problem = validatePassword(password);
    if (problem) { setError(problem); return; }
    if (password !== confirm) { setError('Passwords do not match'); return; }

    setLoading(true);
    setError(null);
    try {
      await apiFetch('/api/auth/password/reset', null, {
        method: 'POST',
        body: JSON.stringify({ token, new_password: password }),
      });
      setDone(true);
    } catch (e: any) {
      setError(e?.message || 'Could not reset password. The link may have expired.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <AuthShell maxWidth={460}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.flex}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          {done ? (
            <View style={styles.center}>
              <Ionicons name="checkmark-circle" size={64} color={colors.teal} />
              <Text style={styles.title} accessibilityRole="header">Password updated</Text>
              <Text style={styles.subtitle}>
                You can now sign in with your new password. Any other devices have been signed out.
                {isMobileWeb ? ' If you use the ForMeds app, open it now to sign in there.' : ''}
              </Text>
              <Button label="Sign in" onPress={() => router.replace('/login')} style={styles.stretch} />
            </View>
          ) : (
            <>
              <Text style={styles.title} accessibilityRole="header">Set a new password</Text>
              <Text style={styles.subtitle}>Choose a password you haven&apos;t used before.</Text>

              {isMobileWeb && (
                <>
                  <Button
                    testID="reset-open-app-btn"
                    label="Continue in the ForMeds app"
                    variant="outline"
                    onPress={openInApp}
                    style={styles.stretch}
                  />
                  <Text style={styles.orDivider}>or continue here in your browser</Text>
                </>
              )}

              <ErrorBanner message={error} />

              <FormInput
                testID="reset-password-input"
                label="New password"
                icon="lock-closed-outline"
                value={password}
                onChangeText={setPassword}
                placeholder="At least 8 characters, with a number"
                autoCapitalize="none"
                autoComplete="new-password"
                secure
                returnKeyType="next"
              />
              <FormInput
                testID="reset-confirm-input"
                label="Confirm new password"
                icon="lock-closed-outline"
                value={confirm}
                onChangeText={setConfirm}
                placeholder="Re-enter your password"
                autoCapitalize="none"
                autoComplete="new-password"
                secure
                returnKeyType="done"
                onSubmitEditing={handleSubmit}
              />

              <Button testID="reset-submit-btn" label="Update password" onPress={handleSubmit} loading={loading} />
            </>
          )}
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
  center: { alignItems: 'center', paddingTop: spacing.xxxl, gap: spacing.sm },
  stretch: { alignSelf: 'stretch', marginTop: spacing.lg },
  orDivider: {
    ...typography.body, color: colors.textSecondary, textAlign: 'center',
    marginTop: spacing.md, marginBottom: spacing.xl,
  },
  title: { ...typography.h1, color: colors.text, marginBottom: spacing.xs, textAlign: 'center' },
  subtitle: { ...typography.body, color: colors.textSecondary, marginBottom: spacing.xxl, textAlign: 'center', lineHeight: 22 },
});
