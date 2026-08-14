import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { apiFetch } from '../src/utils/api';
import { useAuth } from '../src/context/AuthContext';
import { Button, LoadingState } from '../src/components';
import { colors, spacing, typography } from '../src/theme';

/**
 * Landing page for the emailed verification LINK. New signups verify with an
 * in-app code (see app/verify.tsx); this remains so links already sitting in
 * inboxes — and the web flow, where a link is the natural affordance — work.
 */
export default function VerifyEmailScreen() {
  const { token } = useLocalSearchParams<{ token?: string }>();
  const [status, setStatus] = useState<'loading' | 'ok' | 'error'>('loading');
  const router = useRouter();
  const { user, refreshUser } = useAuth();

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!token) { setStatus('error'); return; }
      try {
        await apiFetch('/api/auth/verify-email/confirm', null, {
          method: 'POST',
          body: JSON.stringify({ token }),
        });
        if (cancelled) return;
        setStatus('ok');
        // Pull the updated email_verified flag into the session, if signed in.
        await refreshUser();
      } catch {
        if (!cancelled) setStatus('error');
      }
    })();
    return () => { cancelled = true; };
    // refreshUser is stable per token; re-running on identity changes would
    // re-consume the (single-use) verification token.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.center}>
        {status === 'loading' && <LoadingState label="Verifying your email…" />}

        {status === 'ok' && (
          <>
            <Ionicons name="checkmark-circle" size={72} color={colors.teal} />
            <Text style={styles.title} accessibilityRole="header">Email verified</Text>
            <Text style={styles.subtitle}>
              Your email is confirmed. {user ? 'You can carry on where you left off.' : 'Sign in to continue.'}
            </Text>
            <Button
              label={user ? 'Go to feed' : 'Sign in'}
              onPress={() => router.replace(user ? '/(tabs)/community' : '/login')}
              style={styles.action}
            />
          </>
        )}

        {status === 'error' && (
          <>
            <Ionicons name="close-circle" size={72} color={colors.red} />
            <Text style={styles.title} accessibilityRole="header">Link invalid or expired</Text>
            <Text style={styles.subtitle}>
              This verification link is no longer valid. Sign in and we&apos;ll send you a fresh code.
            </Text>
            <Button
              label={user ? 'Go to profile' : 'Sign in'}
              onPress={() => router.replace(user ? '/(tabs)/profile' : '/login')}
              style={styles.action}
            />
          </>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.white },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: spacing.xxxl, gap: spacing.sm },
  title: { ...typography.h2, color: colors.text, marginTop: spacing.md, textAlign: 'center' },
  subtitle: { ...typography.body, color: colors.textSecondary, marginTop: spacing.xs, marginBottom: spacing.xxl, textAlign: 'center', lineHeight: 22 },
  action: { alignSelf: 'stretch' },
});
