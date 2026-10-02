import React from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, typography, isRefined, isMaterial, elevation } from '../theme';
import { objectTones } from './material/SoftObjects';
import { LinearGradient } from 'expo-linear-gradient';
import { Button } from './Button';

/**
 * The three non-success states every data screen must handle.
 * (See the mobile-design-system skill: loading / empty / error / success.)
 */

export function LoadingState({ label = 'Loading…' }: { label?: string }) {
  return (
    <View style={styles.center} accessibilityRole="progressbar" accessibilityLabel={label}>
      <ActivityIndicator size={isRefined ? 'small' : 'large'} color={isRefined ? colors.teal : colors.navy} />
      <Text style={[styles.muted, isRefined && styles.pLoading]}>{label}</Text>
    </View>
  );
}

/**
 * Premium: the state's icon sits in a soft tinted disc -- teal for "nothing
 * here yet", red for "something failed" -- so the state reads as designed,
 * not as a blank screen with a grey glyph.
 */
function StateIcon({ name, tone }: { name: keyof typeof Ionicons.glyphMap; tone: 'calm' | 'error' }) {
  if (!isRefined) {
    return <Ionicons name={name} size={48} color={tone === 'error' ? colors.red : colors.textMuted} />;
  }
  if (isMaterial) {
    // Material: a raised, softly lit disc -- the state as a tactile object.
    return (
      <View style={[styles.mDisc, tone === 'error' && styles.mDiscError]}>
        <LinearGradient colors={tone === 'error' ? [objectTones.light[0], '#FCE4E4'] : objectTones.light}
          start={{ x: 0.2, y: 0 }} end={{ x: 0.8, y: 1 }} style={[StyleSheet.absoluteFill, { borderRadius: 40 }]} />
        <Ionicons name={name} size={34} color={tone === 'error' ? colors.aed : colors.teal} />
      </View>
    );
  }
  return (
    <View style={[styles.pHalo, tone === 'error' ? styles.pHaloError : styles.pHaloCalm]}>
      <Ionicons name={name} size={30} color={tone === 'error' ? colors.aed : colors.teal} />
    </View>
  );
}

export function EmptyState({
  icon = 'file-tray-outline',
  title,
  hint,
  actionLabel,
  onAction,
  actionTestID,
}: {
  icon?: keyof typeof Ionicons.glyphMap;
  title: string;
  hint?: string;
  actionLabel?: string;
  onAction?: () => void;
  actionTestID?: string;
}) {
  return (
    <View style={styles.center}>
      <StateIcon name={icon} tone="calm" />
      <Text style={styles.title}>{title}</Text>
      {hint ? <Text style={[styles.muted, isRefined && styles.pHint]}>{hint}</Text> : null}
      {actionLabel && onAction ? (
        <Button label={actionLabel} onPress={onAction} variant={isRefined ? 'primary' : 'outline'} testID={actionTestID}
          style={[styles.action, isRefined && styles.pAction]} />
      ) : null}
    </View>
  );
}

export function ErrorState({
  message = 'Something went wrong.',
  onRetry,
}: {
  message?: string;
  onRetry?: () => void;
}) {
  return (
    <View style={styles.center}>
      <StateIcon name="cloud-offline-outline" tone="error" />
      <Text style={styles.title} accessibilityRole="alert">Couldn&apos;t load</Text>
      <Text style={styles.muted}>{message}</Text>
      {onRetry ? <Button label="Try again" onPress={onRetry} variant="outline"
        style={[styles.action, isRefined && styles.pAction]} /> : null}
    </View>
  );
}

/** Inline error banner for form/mutation failures (replaces alert()). */
export function ErrorBanner({ message }: { message?: string | null }) {
  if (!message) return null;
  return (
    <View style={styles.banner} accessibilityRole="alert">
      <Ionicons name="alert-circle" size={18} color={colors.red} />
      <Text style={styles.bannerText}>{message}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  // ── ForMeds Premium ──────────────────────────────────────────────────────
  mDisc: {
    width: 80, height: 80, borderRadius: 40, alignItems: 'center', justifyContent: 'center', marginBottom: spacing.sm,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.95)', ...elevation.standard,
  },
  mDiscError: { shadowColor: '#7A1E1E' },
  pHalo: { width: 64, height: 64, borderRadius: 32, alignItems: 'center', justifyContent: 'center', marginBottom: spacing.xs },
  pHaloCalm: { backgroundColor: colors.verifiedBg },
  pHaloError: { backgroundColor: colors.aedBg },
  pHint: { maxWidth: 360, color: colors.textSecondary },
  pAction: { minHeight: 44, borderRadius: 10 },
  pLoading: { ...typography.caption, color: colors.textSecondary },

  center: { alignItems: 'center', justifyContent: 'center', paddingVertical: spacing.xxxl + 16, paddingHorizontal: spacing.xxl, gap: spacing.sm },
  title: { ...typography.h3, color: colors.text, marginTop: spacing.sm, textAlign: 'center' },
  muted: { ...typography.body, color: colors.textSecondary, textAlign: 'center' },
  action: { marginTop: spacing.md, paddingHorizontal: spacing.xxl },
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.redBg,
    borderRadius: 10,
    padding: spacing.md,
    marginBottom: spacing.lg,
  },
  bannerText: { color: colors.red, fontSize: 14, flex: 1 },
});
