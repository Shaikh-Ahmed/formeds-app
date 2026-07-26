import { Stack, useRouter, useSegments } from 'expo-router';
import { useEffect } from 'react';
import { View, ActivityIndicator } from 'react-native';
import * as Sentry from '@sentry/react-native';
import { AuthProvider, useAuth } from '../src/context/AuthContext';
import { StatusBar } from 'expo-status-bar';

const SENTRY_DSN = process.env.EXPO_PUBLIC_SENTRY_DSN || '';
if (SENTRY_DSN) {
  Sentry.init({ dsn: SENTRY_DSN, tracesSampleRate: 0.1, sendDefaultPii: false });
}

const PUBLIC_SEGMENTS = new Set(['index', 'login', 'register', 'forgot-password', 'reset-password', 'verify-email']);

function RootNavigator() {
  const { user, loading } = useAuth();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    const current = segments[0] ?? 'index';
    const inPublicArea = PUBLIC_SEGMENTS.has(current);
    if (!user && !inPublicArea) {
      router.replace('/login');
    } else if (user && inPublicArea) {
      router.replace('/(tabs)/feed');
    }
  }, [user, loading, segments, router]);

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
      <Stack.Screen name="forgot-password" />
      <Stack.Screen name="reset-password" />
      <Stack.Screen name="verify-email" />
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="admin/kyc" options={{ animation: 'slide_from_right' }} />
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
