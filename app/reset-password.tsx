import React, { useState } from 'react';
import { View, Text, StyleSheet, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { apiFetch } from '../src/utils/api';
import { Button, FormInput, ErrorBanner } from '../src/components';
import { colors, spacing, typography } from '../src/theme';
import { validatePassword } from '../src/utils/validation';
import { AuthShell } from '../src/components/web';

export default function ResetPasswordScreen() {
  const { token } = useLocalSearchParams<{ token?: string }>();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const router = useRouter();

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
              </Text>
              <Button label="Sign in" onPress={() => router.replace('/login')} style={styles.stretch} />
            </View>
          ) : (
            <>
              <Text style={styles.title} accessibilityRole="header">Set a new password</Text>
              <Text style={styles.subtitle}>Choose a password you haven&apos;t used before.</Text>

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
  title: { ...typography.h1, color: colors.text, marginBottom: spacing.xs, textAlign: 'center' },
  subtitle: { ...typography.body, color: colors.textSecondary, marginBottom: spacing.xxl, textAlign: 'center', lineHeight: 22 },
});
