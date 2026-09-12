import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, radius, spacing, typography, fonts } from '../../theme';
import { ORG_VERIFICATION_META, type OrgVerification } from '../../types/organizations';

const TONES = {
  teal: { bg: colors.tealBg, fg: colors.teal },
  warning: { bg: colors.warningBg, fg: colors.warning },
  // redText, not red: `red` is 3.6:1 on redBg and fails as text.
  danger: { bg: colors.redBg, fg: colors.redText },
  neutral: { bg: colors.bgMuted, fg: colors.textSecondary },
} as const;

/**
 * The organisation trust mark.
 *
 * This component is the single place the claim "verified" is rendered, and it
 * reads the ORGANISATION's reviewed status and nothing else. It deliberately
 * accepts no user object, no role and no KYC flag: `users.verified` means a
 * person's medical registration was checked, which says nothing about whether
 * the institution named in a posting exists. Conflating them would hand a trust
 * mark to anyone who typed a hospital's name into a form, which is the exact
 * failure organisations were built to prevent.
 *
 * Only `verified` renders a tick. `unverified` renders nothing at all — a badge
 * on every new organisation would be noise, and marking them negatively would
 * punish employers for a review they are waiting on.
 */
export function OrgVerifiedBadge({
  status,
  compact = false,
}: {
  status?: OrgVerification | null;
  compact?: boolean;
}) {
  const meta = status ? ORG_VERIFICATION_META[status] : null;
  if (!meta) return null;

  const { bg, fg } = TONES[meta.tone];

  // Compact is the inline tick beside a name in a list. It still carries an
  // accessible label, because a bare icon says nothing to a screen reader.
  if (compact) {
    return (
      <Ionicons
        name={meta.icon as any}
        size={14}
        color={fg}
        accessibilityLabel={meta.label}
      />
    );
  }

  return (
    <View
      style={[styles.badge, { backgroundColor: bg }]}
      accessible
      accessibilityRole="text"
      accessibilityLabel={meta.label}
      testID={`org-verification-${status}`}
    >
      <Ionicons name={meta.icon as any} size={13} color={fg} />
      {/* Words as well as colour and icon: three signals, because this one is
          a claim people act on. */}
      <Text style={[styles.text, { color: fg }]}>{meta.label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: 4,
    borderRadius: radius.pill,
    alignSelf: 'flex-start',
  },
  text: { ...typography.small, fontFamily: fonts.body.semibold },
});
