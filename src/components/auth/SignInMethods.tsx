import React, { useCallback, useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../context/AuthContext';
import { apiFetch } from '../../utils/api';
import { colors, spacing, typography, MIN_TOUCH_TARGET } from '../../theme';
import { Button } from '../Button';
import { ErrorBanner } from '../States';
import { GoogleSignInButton } from './GoogleSignInButton';

interface Identities {
  has_password: boolean;
  google_available: boolean;
  google: { linked: boolean; email: string | null; linked_at: string | null };
}

/**
 * Settings → Sign-in methods. Shows how this account can sign in and lets a
 * normal member link or unlink Google. The server refuses to unlink the only
 * way in; the button is disabled for the same case so nobody is surprised.
 * Not shown to recruiters or admins, who never use Google.
 */
export function SignInMethods() {
  const { token } = useAuth();
  const [data, setData] = useState<Identities | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    if (!token) return;
    try { setData(await apiFetch('/api/auth/identities', token)); } catch { setData(null); }
  }, [token]);
  useEffect(() => { load(); }, [load]);

  const link = async (credential: string, nonceToken: string) => {
    if (!token) return;
    setBusy(true); setError(null);
    try {
      setData(await apiFetch('/api/auth/identities/google', token, {
        method: 'POST', body: JSON.stringify({ credential, nonce_token: nonceToken }),
      }));
    } catch (e: any) {
      setError(e?.message || 'Google could not be linked.');
    } finally { setBusy(false); }
  };

  const unlink = async () => {
    if (!token) return;
    setBusy(true); setError(null);
    try {
      setData(await apiFetch('/api/auth/identities/google', token, { method: 'DELETE' }));
    } catch (e: any) {
      setError(e?.message || 'Google could not be unlinked.');
    } finally { setBusy(false); }
  };

  if (!data || !data.google_available) return null;
  return (
    <View style={styles.section} testID="signin-methods">
      <Text style={styles.title}>Sign-in methods</Text>
      <View style={styles.row}>
        <Ionicons name="key-outline" size={18} color={colors.textSecondary} />
        <Text style={styles.label}>Email & password</Text>
        <Text style={styles.value}>{data.has_password ? 'Set' : 'Not set'}</Text>
      </View>
      <View style={styles.row}>
        <Ionicons name="logo-google" size={18} color={colors.textSecondary} />
        <Text style={styles.label}>Google</Text>
        <Text style={styles.value} testID="google-link-status" numberOfLines={1}>
          {data.google.linked ? `Connected${data.google.email ? ` · ${data.google.email}` : ''}` : 'Not connected'}
        </Text>
      </View>
      <ErrorBanner message={error} />
      {data.google.linked ? (
        <>
          <Button label="Unlink Google" variant="outline" onPress={unlink} loading={busy}
            disabled={!data.has_password} testID="google-unlink" />
          {!data.has_password ? (
            <Text style={styles.hint}>
              Google is your only way to sign in. Set a password with “Forgot password” on the sign-in page first.
            </Text>
          ) : null}
        </>
      ) : (
        <GoogleSignInButton text="continue_with" testID="google-link" onCredential={link} onError={setError} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  section: { backgroundColor: colors.white, marginTop: spacing.md, paddingHorizontal: spacing.xl, paddingVertical: spacing.lg, gap: spacing.sm },
  title: { ...typography.h3, color: colors.navy, marginBottom: spacing.xs },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, minHeight: MIN_TOUCH_TARGET, borderBottomWidth: 1, borderBottomColor: colors.borderLight },
  label: { ...typography.body, color: colors.textSecondary, flex: 1 },
  value: { ...typography.bodyStrong, color: colors.text, maxWidth: '60%', textAlign: 'right' },
  hint: { ...typography.caption, color: colors.textSecondary },
});
