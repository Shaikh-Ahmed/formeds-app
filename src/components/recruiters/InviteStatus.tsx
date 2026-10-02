import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { colors, radius, spacing, typography } from '../../theme';
import { INVITATION_LABELS, type InvitationStatus } from '../../types/recruiters';

export const INVITE_TONES: Record<InvitationStatus, { bg: string; fg: string }> = {
  SENT: { bg: colors.bgMuted, fg: colors.textSecondary },
  VIEWED: { bg: colors.tintBg, fg: colors.navy },
  ACCEPTED: { bg: colors.successBg, fg: colors.teal },
  DECLINED: { bg: colors.redBg, fg: colors.redText },
  EXPIRED: { bg: colors.bgMuted, fg: colors.textMuted },
};

export function InviteStatus({ status }: { status: InvitationStatus }) {
  const t = INVITE_TONES[status];
  return (
    <View style={[styles.pill, { backgroundColor: t.bg }]} accessible accessibilityLabel={`Status: ${INVITATION_LABELS[status]}`}>
      <Text style={[styles.pillText, { color: t.fg }]}>{INVITATION_LABELS[status]}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: { paddingHorizontal: spacing.sm + 2, paddingVertical: 4, borderRadius: radius.pill, alignSelf: 'flex-start' },
  pillText: { ...typography.small, fontWeight: '700' },
});
