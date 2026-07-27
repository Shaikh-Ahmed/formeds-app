import { useEffect, useRef } from 'react';
import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { useRouter } from 'expo-router';
import { apiFetch } from '../utils/api';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

/**
 * Registers this device for Expo push and routes notification taps.
 * Silently no-ops on web and on simulators (which cannot receive push).
 */
export function usePushNotifications(token: string | null) {
  const router = useRouter();
  const registeredRef = useRef<string | null>(null);

  // Register the device token with the backend.
  useEffect(() => {
    if (!token || Platform.OS === 'web' || !Device.isDevice) return;
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
    if (Platform.OS === 'web') return;
    const sub = Notifications.addNotificationResponseReceivedListener((response) => {
      const data: any = response.notification.request.content.data || {};
      if (data.type === 'message' && data.user_id) {
        router.push({ pathname: '/conversation', params: { userId: data.user_id, userName: data.user_name || '' } });
      } else if (data.type === 'connection') {
        router.push('/people');
      } else {
        router.push('/notifications');
      }
    });
    return () => sub.remove();
  }, [router]);
}
