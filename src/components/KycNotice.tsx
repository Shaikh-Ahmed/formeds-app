import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useAuth } from '../context/AuthContext';
import { useKycStatus } from '../hooks/useKycStatus';
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
  const student = user?.role === 'student';
  const { state } = useKycStatus({ enabled: !!user && !isKycApproved && !student });

  if (isKycApproved || !user) return null;
  // A student has no professional registration to verify, so there is no
  // "verify to unlock" here -- only an honest statement of who it is for.
  if (student) {
    return (
      <View style={[styles.banner, styles.info]} accessibilityRole="text" testID="kyc-notice-student">
        <Ionicons name="information-circle-outline" size={20} color={colors.info} />
        <View style={styles.body}>
          <Text style={[styles.title, styles.infoTitle]}>For verified healthcare professionals</Text>
          <Text style={styles.hint}>Student accounts can&apos;t {action}.</Text>
        </View>
      </View>
    );
  }
  // Already submitted: say so, rather than asking them to do it again.
  const reviewing = state?.status === 'pending';
  const rejected = state?.status === 'rejected';
  const title = reviewing ? 'Verification under review' : rejected ? 'Verification not approved' : 'Verification required';
  const hint = reviewing
    ? `You can ${action} once your documents are approved. We will notify you.`
    : rejected ? `Resubmit your documents to ${action}.` : `Complete verification to ${action}.`;

  return (
    <TouchableOpacity
      style={styles.banner}
      onPress={() => router.push('/kyc')}
      accessibilityRole="button"
      accessibilityLabel={`${title}. ${hint}`}
      testID="kyc-notice"
    >
      <Ionicons name={reviewing ? 'time-outline' : 'shield-outline'} size={20} color={colors.warning} />
      <View style={styles.body}>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.hint}>{hint}</Text>
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
  info: { backgroundColor: colors.infoBg, borderColor: colors.border },
  infoTitle: { color: colors.info },
  title: { ...typography.bodyStrong, color: colors.warning },
  hint: { ...typography.caption, color: colors.textSecondary, marginTop: 2 },
});
