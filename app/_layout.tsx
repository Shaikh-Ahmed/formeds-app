import { Stack, useRouter, useSegments } from 'expo-router';
import { useEffect, useRef } from 'react';
import { View, ActivityIndicator } from 'react-native';
import * as Sentry from '@sentry/react-native';
import { AuthProvider, useAuth } from '../src/context/AuthContext';
import { usePushNotifications } from '../src/hooks/usePushNotifications';
import { StatusBar } from 'expo-status-bar';

const SENTRY_DSN = process.env.EXPO_PUBLIC_SENTRY_DSN || '';
if (SENTRY_DSN) {
  Sentry.init({ dsn: SENTRY_DSN, tracesSampleRate: 0.1, sendDefaultPii: false });
}

// Reachable without a session. `verify` belongs here: during signup the account
// exists but holds only a signup token, so it is not yet an authenticated user.
const PUBLIC_SEGMENTS = new Set([
  'index', 'login', 'register', 'verify', 'forgot-password', 'reset-password', 'verify-email',
]);

function RootNavigator() {
  const { user, loading, token, isKycApproved } = useAuth();
  const segments = useSegments();
  const router = useRouter();
  // Prompt for KYC once per app launch — never trap an unapproved user in a
  // loop, since they are explicitly allowed to explore before approval.
  const kycPrompted = useRef(false);

  usePushNotifications(token);

  useEffect(() => {
    if (loading) return;
    const current = segments[0] ?? 'index';
    const inPublicArea = PUBLIC_SEGMENTS.has(current);

    if (!user && !inPublicArea) {
      router.replace('/login');
      return;
    }
    if (user && inPublicArea) {
      // A signed-in user who still needs KYC lands there first. `isKycApproved`
      // owns the admin exemption so this screen and every KYC-gated control
      // agree on who is approved.
      const needsKyc = !isKycApproved && !kycPrompted.current;
      kycPrompted.current = true;
      router.replace(needsKyc ? '/kyc' : '/(tabs)/community');
    }
  }, [user, loading, segments, router, isKycApproved]);

  if (loading) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#1A3A5C' }}>
        <ActivityIndicator size="large" color="#FFFFFF" />
      </View>
    );
  }

  return (
    <Stack screenOptions={{ headerShown: false, animation: 'fade' }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="login" />
      <Stack.Screen name="register" />
      <Stack.Screen name="verify" />
      <Stack.Screen name="forgot-password" />
      <Stack.Screen name="reset-password" />
      <Stack.Screen name="verify-email" />
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="kyc" options={{ animation: 'slide_from_right' }} />
      <Stack.Screen name="admin/kyc" options={{ animation: 'slide_from_right' }} />
      <Stack.Screen name="edit-profile" options={{ animation: 'slide_from_right' }} />
      <Stack.Screen name="settings" options={{ animation: 'slide_from_right' }} />
      <Stack.Screen name="help" options={{ animation: 'slide_from_right' }} />
      <Stack.Screen name="lesson/[id]" options={{ animation: 'slide_from_right' }} />
      <Stack.Screen name="post/[id]" options={{ animation: 'slide_from_right' }} />
      <Stack.Screen name="case/[id]" options={{ animation: 'slide_from_right' }} />
      <Stack.Screen name="case/new" options={{ animation: 'slide_from_bottom' }} />
      <Stack.Screen name="aed-chat" options={{ presentation: 'modal', animation: 'slide_from_bottom' }} />
      <Stack.Screen name="notifications" options={{ animation: 'slide_from_right' }} />
      <Stack.Screen name="messages" options={{ animation: 'slide_from_right' }} />
      <Stack.Screen name="conversation" options={{ animation: 'slide_from_right' }} />
      <Stack.Screen name="people" options={{ animation: 'slide_from_right' }} />
    </Stack>
  );
}

function RootLayout() {
  return (
    <AuthProvider>
      <StatusBar style="light" />
      <RootNavigator />
    </AuthProvider>
  );
}

export default SENTRY_DSN ? Sentry.wrap(RootLayout) : RootLayout;
