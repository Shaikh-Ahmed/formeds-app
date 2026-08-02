import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useAuth } from '../context/AuthContext';
import { colors, radius, spacing, typography, MIN_TOUCH_TARGET } from '../theme';

/**
 * The one "you can't do this yet" affordance for KYC-gated actions.
 *
 * Every screen that hides a professional action behind approval renders this
 * instead of writing its own banner, so the explanation and the route into the
 * KYC screen stay identical everywhere. Renders nothing once approved.
 */
export function KycNotice({ action }: { action: string }) {
  const { isKycApproved, user } = useAuth();
  const router = useRouter();

  if (isKycApproved || !user) return null;

  return (
    <TouchableOpacity
      style={styles.banner}
      onPress={() => router.push('/kyc')}
      accessibilityRole="button"
      accessibilityLabel={`Verification required to ${action}. Tap to complete verification.`}
    >
      <Ionicons name="shield-outline" size={20} color={colors.warning} />
      <View style={styles.body}>
        <Text style={styles.title}>Verification required</Text>
        <Text style={styles.hint}>Complete verification to {action}.</Text>
      </View>
      <Ionicons name="chevron-forward" size={18} color={colors.warning} />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    minHeight: MIN_TOUCH_TARGET,
    backgroundColor: colors.warningBg,
    borderWidth: 1,
    borderColor: '#FDE68A',
    borderRadius: radius.lg,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  body: { flex: 1 },
  title: { ...typography.bodyStrong, color: colors.warning },
  hint: { ...typography.caption, color: colors.textSecondary, marginTop: 2 },
});
