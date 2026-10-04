import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useAuth } from '../../context/AuthContext';
import { apiFetch } from '../../utils/api';
import { colors, fonts, radius, spacing, typography, MIN_TOUCH_TARGET, gloss } from '../../theme';

export type ConnectionStatus = 'none' | 'pending_sent' | 'pending_received' | 'connected';

/**
 * Connect → Pending → Message, with Accept when they asked first.
 *
 * Messaging on ForMeds needs an accepted connection (the server refuses
 * otherwise), so the "invite" IS the connection request: Message only appears
 * once the two of you are connected. Status comes from the server -- search
 * results carry it; elsewhere it is fetched for this one person.
 */
export function ConnectActions({
  userId, name, initialStatus, connectionId: initialConnectionId, compact = false, outline = false, iconOnly = false,
  testID = 'connect',
}: {
  userId: string;
  name: string;
  initialStatus?: ConnectionStatus;
  connectionId?: string | null;
  /** Smaller buttons, for a result row. */
  compact?: boolean;
  /** Quieter outlined buttons, for side panels where many sit together. */
  outline?: boolean;
  /**
   * A round icon button with no visible label, for dense lists (the feed
   * rail). The label is still announced to screen readers.
   */
  iconOnly?: boolean;
  testID?: string;
}) {
  const { token, user } = useAuth();
  const router = useRouter();
  const [status, setStatus] = useState<ConnectionStatus | null>(initialStatus ?? null);
  const [connectionId, setConnectionId] = useState<string | null>(initialConnectionId ?? null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (initialStatus || !token || !userId) return;
    let live = true;
    apiFetch(`/api/connections/status/${userId}`, token)
      .then((r: any) => { if (live) { setStatus(r.connection_status ?? 'none'); setConnectionId(r.connection_id); } })
      .catch(() => live && setStatus('none'));
    return () => { live = false; };
  }, [initialStatus, token, userId]);

  // Nothing to offer on your own card, to recruiters (not part of the
  // network), or before we know where you stand.
  if (!user || !token || user.id === userId || user.role === 'recruiter' || !status) return null;

  const run = async (fn: () => Promise<void>) => {
    setBusy(true); setError(null);
    try { await fn(); } catch (e: any) { setError(e?.message || 'Something went wrong. Please try again.'); }
    finally { setBusy(false); }
  };
  const connect = () => run(async () => {
    await apiFetch(`/api/connections/request?target_id=${userId}`, token, { method: 'POST' });
    setStatus('pending_sent');
  });
  const accept = () => run(async () => {
    await apiFetch(`/api/connections/${connectionId}/accept`, token, { method: 'POST' });
    setStatus('connected');
  });
  const message = () => router.push({ pathname: '/conversation', params: { userId, userName: name } } as any);

  const btn = (label: string, icon: keyof typeof Ionicons.glyphMap, onPress: (() => void) | null, primary: boolean,
    id: string) => {
    // Outline mode never fills the button: it sits in a list of suggestions.
    const filled = primary && !outline;
    if (iconOnly) {
      const go = primary && !!onPress;
      return (
        <Pressable onPress={onPress ?? undefined} disabled={!onPress || busy} accessibilityRole="button"
          accessibilityLabel={`${label} ${name}`} accessibilityState={{ disabled: !onPress || busy }}
          testID={`${testID}-${id}`}
          style={({ pressed, hovered }: any) => [styles.iconBtn, go ? styles.iconBtnGo : styles.iconBtnQuiet,
            hovered && go && styles.iconBtnHover, pressed && styles.pressed]}>
          {busy && onPress ? <ActivityIndicator size="small" color={colors.teal} />
            : <Ionicons name={icon} size={17} color={go ? colors.teal : colors.textSecondary} />}
        </Pressable>
      );
    }
    return (
    <Pressable onPress={onPress ?? undefined} disabled={!onPress || busy} accessibilityRole="button"
      accessibilityLabel={`${label} ${name}`} accessibilityState={{ disabled: !onPress || busy }} testID={`${testID}-${id}`}
      style={({ pressed }) => [styles.btn, compact && styles.btnCompact, outline && styles.btnOutline,
        filled ? styles.primary : styles.secondary, outline && primary && styles.outlineAction,
        !onPress && styles.muted, pressed && styles.pressed]}>
      {busy && onPress ? <ActivityIndicator size="small" color={filled ? colors.white : colors.navy} />
        : <Ionicons name={icon} size={compact || outline ? 14 : 16} color={filled ? colors.white : colors.navy} />}
      <Text style={[styles.text, filled ? styles.textPrimary : styles.textSecondary]}>{label}</Text>
    </Pressable>
    );
  };

  return (
    <View style={styles.wrap}>
      <View style={styles.row}>
        {status === 'connected' ? btn('Message', 'chatbubble-outline', message, true, 'message')
          : status === 'pending_received' ? btn('Accept', 'checkmark', accept, true, 'accept')
            : status === 'pending_sent' ? btn('Pending', 'time-outline', null, false, 'pending')
              : btn('Connect', 'person-add-outline', connect, true, 'request')}
      </View>
      {error ? <Text style={styles.error} accessibilityRole="alert">{error}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 4 },
  row: { flexDirection: 'row', gap: spacing.sm },
  btn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.xs + 2,
    minHeight: MIN_TOUCH_TARGET, paddingHorizontal: spacing.lg, borderRadius: radius.lg, borderWidth: 1,
  },
  btnCompact: { minHeight: 34, paddingHorizontal: spacing.md, borderRadius: radius.pill },
  btnOutline: { minHeight: 32, paddingHorizontal: spacing.sm + 2, gap: 4, borderRadius: radius.pill },
  outlineAction: { borderColor: colors.primaryFill },
  primary: { backgroundColor: colors.action, ...gloss.fill, borderColor: colors.action },
  secondary: { backgroundColor: colors.white, borderColor: colors.border },
  muted: { opacity: 0.8 },
  text: { ...typography.caption, fontFamily: fonts.body.semibold },
  textPrimary: { color: colors.white },
  textSecondary: { color: colors.navy },
  pressed: { opacity: 0.75 },
  error: { ...typography.small, color: colors.redText, maxWidth: 220 },
  // Icon-only: a soft tinted circle for the action, a plain one for a state.
  iconBtn: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', borderWidth: 1 },
  iconBtnGo: { backgroundColor: colors.tealBg, borderColor: 'transparent' },
  iconBtnHover: { borderColor: colors.teal },
  iconBtnQuiet: { backgroundColor: colors.bgMuted, borderColor: 'transparent' },
});
