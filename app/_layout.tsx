import { Stack, useRouter, useSegments } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { View, ActivityIndicator } from 'react-native';
import * as Sentry from '@sentry/react-native';
import { AuthProvider, useAuth } from '../src/context/AuthContext';
import { usePushNotifications } from '../src/hooks/usePushNotifications';
import { StatusBar } from 'expo-status-bar';
import { TopBar } from '../src/components/web';
import { colors, useBreakpoint } from '../src/theme';
import { apiFetch } from '../src/utils/api';

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
  const { isMobile } = useBreakpoint();
  // Prompt for KYC once per app launch — never trap an unapproved user in a
  // loop, since they are explicitly allowed to explore before approval.
  const kycPrompted = useRef(false);

  usePushNotifications(token);

  const currentSegment = segments[0] ?? 'index';
  const inPublicArea = PUBLIC_SEGMENTS.has(currentSegment);

  /**
   * The desktop nav bar lives at the root, not inside (tabs).
   * Messages, Notifications, People and the case/post detail screens are all
   * stack routes outside the tab group — mounting the bar in (tabs) would
   * make it vanish the moment a user opened any of them, which is exactly the
   * kind of half-converted layout this redesign is meant to remove.
   */
  const showTopBar = !!user && !inPublicArea && !isMobile;

  const [unreadMsgs, setUnreadMsgs] = useState(0);
  const [unreadNotifs, setUnreadNotifs] = useState(0);

  const loadCounts = useCallback(async () => {
    if (!token || !showTopBar) return;
    const [msgs, notifs] = await Promise.all([
      apiFetch('/api/messages/unread-total', token).catch(() => ({ count: 0 })),
      apiFetch('/api/notifications/unread-count', token).catch(() => ({ count: 0 })),
    ]);
    setUnreadMsgs(msgs.count || 0);
    setUnreadNotifs(notifs.count || 0);
  }, [token, showTopBar]);

  // Refresh on navigation: the bar is persistent, so its badges can't be owned
  // by any one screen's fetch.
  useEffect(() => { loadCounts(); }, [loadCounts, currentSegment]);

  useEffect(() => {
    if (loading) return;

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
  }, [user, loading, inPublicArea, router, isKycApproved]);

  if (loading) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.navy }}>
        {/* Navy field, so the clock and battery need to be light here. */}
        <StatusBar style="light" />
        <ActivityIndicator size="large" color={colors.white} />
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      {showTopBar && (
        <TopBar unreadMessages={unreadMsgs} unreadNotifications={unreadNotifs} />
      )}
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
      {/* Fades rather than slides: search is a mode you enter from the header,
          not a place further along the stack. */}
      <Stack.Screen name="search" options={{ animation: 'fade' }} />
    </Stack>
    </View>
  );
}

function RootLayout() {
  return (
    <AuthProvider>
      {/*
        Dark content is the app-wide default because the signed-in shell is
        white — MobileTopBar now paints the status-bar strip, and light icons
        on it were invisible. The two navy screens (the loading splash above
        and the welcome gateway) mount their own light StatusBar, which wins
        while they are on screen.
      */}
      <StatusBar style="dark" />
      <RootNavigator />
    </AuthProvider>
  );
}

export default SENTRY_DSN ? Sentry.wrap(RootLayout) : RootLayout;
