import { useEffect, useRef } from 'react';
import { Platform } from 'react-native';
import * as Device from 'expo-device';
import { isRunningInExpoGo } from 'expo';
import { useRouter } from 'expo-router';
import { apiFetch } from '../utils/api';

type NotificationsModule = typeof import('expo-notifications');

/**
 * Remote push needs a development build. Expo Go dropped it in SDK 53, and the
 * cost of finding that out is paid at *import* time: pulling in
 * expo-notifications runs its DevicePushTokenAutoRegistration side-effect
 * module, which registers a token listener and logs a red startup error before
 * any of our code gets a say. A try/catch around getExpoPushTokenAsync cannot
 * help — the module never reaches it.
 *
 * So the import is deferred behind this flag rather than sitting at the top of
 * the file. In Expo Go the package is never required at all.
 */
const PUSH_SUPPORTED = Platform.OS !== 'web' && !isRunningInExpoGo();

let cached: NotificationsModule | null = null;

function loadNotifications(): NotificationsModule | null {
  if (!PUSH_SUPPORTED) return null;
  if (!cached) {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    cached = require('expo-notifications') as NotificationsModule;
    cached.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowBanner: true,
        shouldShowList: true,
        shouldPlaySound: true,
        shouldSetBadge: false,
      }),
    });
  }
  return cached;
}

/**
 * Registers this device for Expo push and routes notification taps.
 * No-ops on web, in Expo Go, and on simulators (none of which can receive push).
 */
export function usePushNotifications(token: string | null) {
  const router = useRouter();
  const registeredRef = useRef<string | null>(null);

  // Register the device token with the backend.
  useEffect(() => {
    const Notifications = loadNotifications();
    if (!Notifications || !token || !Device.isDevice) return;
    let cancelled = false;

    (async () => {
      try {
        const existing = await Notifications.getPermissionsAsync();
        let status = existing.status;
        if (status !== 'granted') {
          status = (await Notifications.requestPermissionsAsync()).status;
        }
        if (status !== 'granted' || cancelled) return;

        if (Platform.OS === 'android') {
          await Notifications.setNotificationChannelAsync('default', {
            name: 'Default',
            importance: Notifications.AndroidImportance.DEFAULT,
          });
        }

        const { data: expoToken } = await Notifications.getExpoPushTokenAsync();
        if (!expoToken || cancelled || registeredRef.current === expoToken) return;

        await apiFetch('/api/push/register', token, {
          method: 'POST',
          body: JSON.stringify({ token: expoToken, platform: Platform.OS }),
        });
        registeredRef.current = expoToken;
      } catch (e) {
        // Push is a nice-to-have; never surface a failure to the user.
        console.log('Push registration skipped:', e);
      }
    })();

    return () => { cancelled = true; };
  }, [token]);

  // Deep-link on notification tap.
  useEffect(() => {
    const Notifications = loadNotifications();
    if (!Notifications) return;

    const sub = Notifications.addNotificationResponseReceivedListener((response) => {
      const data: any = response.notification.request.content.data || {};
      if (data.type === 'message' && data.user_id) {
        router.push({ pathname: '/conversation', params: { userId: data.user_id, userName: data.user_name || '' } });
      } else if (data.type === 'case' && data.case_id) {
        router.push({ pathname: '/case/[id]', params: { id: data.case_id } });
      } else if (data.type === 'connection') {
        router.push('/people');
      } else {
        router.push('/notifications');
      }
    });
    return () => sub.remove();
  }, [router]);
}
