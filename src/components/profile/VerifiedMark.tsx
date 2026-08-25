import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, typography, fonts } from '../../theme';
import { VerificationStatus } from '../../types/profile';

interface Props {
  status: VerificationStatus;
  /** Self-view shows actionable states; a public viewer sees only real ones. */
  showUnverified?: boolean;
  compact?: boolean;
}

const STATES = {
  verified: { icon: 'checkmark-circle' as const, color: colors.teal, label: 'Verified' },
  pending: { icon: 'time-outline' as const, color: colors.warning, label: 'Pending' },
  rejected: { icon: 'close-circle-outline' as const, color: colors.redText, label: 'Not verified' },
  unverified: { icon: 'ellipse-outline' as const, color: colors.textMuted, label: 'Unverified' },
};

/**
 * A credential's verification state.
 *
 * Two rules, both from the product brief and both load-bearing for trust:
 *
 * 1. `unverified` renders NOTHING on a public profile. Absence, not a grey
 *    badge — a badge that says "not verified" still puts a badge next to the
 *    claim, and a wall of them reads as noise rather than as signal.
 * 2. Colour is never the only signal. Every state carries an icon and a word,
 *    because teal-vs-amber is not distinguishable for every reader.
 *
 * Never render this from the account-level KYC flag. That flag says the person
 * is a real registered professional; it says nothing about this claim.
 */
export function VerifiedMark({ status, showUnverified, compact }: Props) {
  if ((status === 'unverified' || status === 'rejected') && !showUnverified) return null;

  const state = STATES[status] ?? STATES.unverified;

  return (
    <View
      style={styles.row}
      accessible
      accessibilityLabel={`Verification status: ${state.label}`}
    >
      <Ionicons name={state.icon} size={compact ? 13 : 14} color={state.color} />
      {compact ? null : <Text style={[styles.label, { color: state.color }]}>{state.label}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  label: { ...typography.small, fontFamily: fonts.body.semibold },
});
