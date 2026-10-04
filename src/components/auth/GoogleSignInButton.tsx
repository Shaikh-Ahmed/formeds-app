import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';
import { apiFetch } from '../../utils/api';
import { colors, spacing, typography } from '../../theme';

/**
 * "Continue with Google", using Google Identity Services' own rendered button.
 *
 * Google draws the button itself, which is how its branding rules are met
 * without copying its artwork. What comes back is a signed ID token plus the
 * server's one-time nonce ticket; both go to the API, which verifies the token
 * against Google's keys. Nothing here decides who the person is.
 *
 * Web only for now. The native app needs a platform OAuth client and a native
 * sign-in library (see the Google setup notes); until then it renders nothing,
 * so native builds keep email sign-in exactly as it is.
 *
 * No secret is involved: the web client ID is public by design.
 */

const CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID || '';
const GIS_SRC = 'https://accounts.google.com/gsi/client';

declare global {
  interface Window { google?: any }
}

let scriptPromise: Promise<void> | null = null;
function loadGis(): Promise<void> {
  if (typeof window === 'undefined') return Promise.reject(new Error('no window'));
  if (window.google?.accounts?.id) return Promise.resolve();
  if (!scriptPromise) {
    scriptPromise = new Promise((resolve, reject) => {
      const el = document.createElement('script');
      el.src = GIS_SRC;
      el.async = true;
      el.defer = true;
      el.onload = () => resolve();
      el.onerror = () => { scriptPromise = null; reject(new Error('Google sign-in could not load')); };
      document.head.appendChild(el);
    });
  }
  return scriptPromise;
}

export const googleSignInAvailable = Platform.OS === 'web' && !!CLIENT_ID;

export function GoogleSignInButton({
  onCredential, onError, text = 'continue_with', testID = 'google-signin', divider,
}: {
  onCredential: (credential: string, nonceToken: string) => void;
  onError?: (message: string) => void;
  text?: 'continue_with' | 'signin_with' | 'signup_with';
  testID?: string;
  /** Where the "OR" divider goes. Drawn only when the button itself shows. */
  divider?: 'above' | 'below';
}) {
  const container = useRef<HTMLDivElement | null>(null);
  const [enabled, setEnabled] = useState<boolean | null>(googleSignInAvailable ? null : false);
  const [width, setWidth] = useState(0);
  const handlers = useRef({ onCredential, onError });
  handlers.current = { onCredential, onError };

  // The server has the final say: no client IDs configured there, no button.
  useEffect(() => {
    if (!googleSignInAvailable) return;
    let live = true;
    apiFetch('/api/auth/google/config', null)
      .then((c: { enabled: boolean }) => { if (live) setEnabled(!!c?.enabled); })
      .catch(() => { if (live) setEnabled(false); });
    return () => { live = false; };
  }, []);

  // Each attempt gets a fresh nonce: a token can be used once, for this server.
  const prepare = useCallback(async () => {
    if (!container.current || !width) return;
    try {
      await loadGis();
      const { nonce, nonce_token } = await apiFetch('/api/auth/google/nonce', null, { method: 'POST' });
      const gis = window.google!.accounts.id;
      gis.initialize({
        client_id: CLIENT_ID,
        nonce,
        auto_select: false,
        cancel_on_tap_outside: true,
        ux_mode: 'popup',
        callback: (res: { credential?: string }) => {
          if (res?.credential) handlers.current.onCredential(res.credential, nonce_token);
          // The next click needs a new nonce.
          prepare();
        },
      });
      container.current.innerHTML = '';
      gis.renderButton(container.current, {
        type: 'standard', theme: 'outline', size: 'large', shape: 'pill',
        text, logo_alignment: 'left', width: Math.min(Math.max(width, 200), 400),
      });
    } catch {
      handlers.current.onError?.('Google sign-in is unavailable right now. Use your email instead.');
    }
  }, [text, width]);

  useEffect(() => {
    if (enabled) prepare();
  }, [enabled, prepare]);

  if (!enabled) return null;
  return (
    <>
      {divider === 'above' ? <OrDivider /> : null}
      <View
        style={styles.wrap}
        testID={testID}
        onLayout={e => setWidth(Math.floor(e.nativeEvent.layout.width))}
        accessibilityLabel="Continue with Google"
      >
        {React.createElement('div', { ref: container, style: { display: 'flex', justifyContent: 'center' } })}
      </View>
      {divider === 'below' ? <OrDivider /> : null}
    </>
  );
}

/** "──── OR ────" between the email form and Google. */
export function OrDivider() {
  return (
    <View style={styles.divider} accessibilityRole="none">
      <View style={styles.line} />
      <Text style={styles.or}>OR</Text>
      <View style={styles.line} />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { width: '100%', minHeight: 44, alignItems: 'center' },
  divider: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginVertical: spacing.lg },
  line: { flex: 1, height: 1, backgroundColor: colors.border },
  or: { ...typography.small, color: colors.textMuted, letterSpacing: 1 },
});
