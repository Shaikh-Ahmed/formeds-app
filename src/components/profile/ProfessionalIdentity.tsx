import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, radius, typography, fonts, MIN_TOUCH_TARGET } from '../../theme';
import { Profile, OPEN_TO_LABELS } from '../../types/profile';
import { joinMeta } from './format';

interface Props {
  profile: Profile;
  /** Post-nominals, derived from education entries rather than stored twice. */
  credentials?: string[];
  editable?: boolean;
  isMobile: boolean;
  onEdit?: () => void;
  onShare?: () => void;
}

/**
 * Name, headline and the one-glance summary of who this professional is.
 *
 * Ordered the way a CV is read: identity, then what they do, then where, then
 * the credibility line. Everything here is a fact a recruiter or a peer would
 * scan for in the first two seconds.
 */
export function ProfessionalIdentity({
  profile, credentials, editable, isMobile, onEdit, onShare,
}: Props) {
  // Comma, not the meta separator: 'Hyderabad, Telangana' is one location,
  // whereas 'Hyderabad · Telangana' reads as two unrelated facts.
  const location = [profile.city, profile.state].filter(Boolean).join(', ');
  const primary = joinMeta(
    profile.primary_specialization || profile.specialty || profile.professional_role,
    profile.current_organization,
    location,
  );
  const experience = profile.years_experience
    ? `${profile.years_experience}+ years experience`
    : '';
  const openTo = (profile.availability?.open_to || []).slice(0, 2);

  return (
    <View
      style={[styles.wrap, isMobile ? styles.wrapMobile : styles.wrapWide]}
      testID="profile-identity"
    >
      <Text style={[styles.name, isMobile && styles.nameMobile]} accessibilityRole="header">
        {profile.name || 'Your name'}
      </Text>

      {profile.headline ? (
        <Text style={styles.headline}>{profile.headline}</Text>
      ) : editable ? (
        <Pressable onPress={onEdit} accessibilityRole="button" accessibilityLabel="Add a professional headline">
          <Text style={styles.headlinePlaceholder}>Add a professional headline</Text>
        </Pressable>
      ) : null}

      {credentials && credentials.length ? (
        <Text style={styles.credentials}>{credentials.join(', ')}</Text>
      ) : null}

      {primary ? <Text style={styles.meta}>{primary}</Text> : null}
      {experience ? <Text style={styles.metaMuted}>{experience}</Text> : null}

      {profile.account_verified ? (
        <View style={styles.verifiedRow}>
          <Ionicons name="shield-checkmark" size={15} color={colors.teal} />
          <Text style={styles.verifiedText}>Verified healthcare professional</Text>
        </View>
      ) : null}

      {openTo.length ? (
        <View style={styles.openToRow}>
          {openTo.map((option) => (
            <View key={option} style={styles.openToPill}>
              <View style={styles.openToDot} />
              <Text style={styles.openToText}>Open to {OPEN_TO_LABELS[option].toLowerCase()}</Text>
            </View>
          ))}
        </View>
      ) : null}

      <View style={styles.actions}>
        {editable && onEdit ? (
          <Action label="Edit profile" icon="create-outline" primary onPress={onEdit} testID="profile-edit" />
        ) : null}
        {onShare ? (
          <Action label="Share" icon="share-outline" onPress={onShare} testID="profile-share" />
        ) : null}
      </View>
    </View>
  );
}

function Action({
  label, icon, onPress, primary, testID,
}: {
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  onPress: () => void;
  primary?: boolean;
  testID?: string;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      testID={testID}
      style={({ pressed }) => [
        styles.action,
        primary ? styles.actionPrimary : styles.actionSecondary,
        pressed && styles.pressed,
      ]}
    >
      <Ionicons name={icon} size={16} color={primary ? colors.white : colors.navy} />
      <Text style={[styles.actionText, primary ? styles.actionTextPrimary : styles.actionTextSecondary]}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: { paddingTop: spacing.md, gap: 2 },
  wrapMobile: { paddingHorizontal: spacing.lg },
  wrapWide: { paddingHorizontal: spacing.xxl },

  name: { ...typography.h1, color: colors.text },
  nameMobile: { fontSize: 24 },
  headline: {
    ...typography.body,
    fontFamily: fonts.body.medium,
    color: colors.text,
    lineHeight: 21,
    marginTop: spacing.xs,
  },
  headlinePlaceholder: {
    ...typography.body,
    color: colors.textMuted,
    marginTop: spacing.xs,
    textDecorationLine: 'underline',
  },
  // Post-nominals read as a credential string, not as body copy.
  credentials: {
    ...typography.caption,
    fontFamily: fonts.body.semibold,
    color: colors.textSecondary,
    letterSpacing: 0.3,
    marginTop: spacing.sm,
  },
  meta: { ...typography.caption, color: colors.textSecondary, marginTop: spacing.xs },
  metaMuted: { ...typography.caption, color: colors.textMuted },

  verifiedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs + 1,
    marginTop: spacing.md,
  },
  verifiedText: { ...typography.caption, fontFamily: fonts.body.semibold, color: colors.teal },

  openToRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.md },
  openToPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs + 1,
    backgroundColor: colors.tealBg,
    borderWidth: 1,
    borderColor: colors.tealLight,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: 5,
  },
  openToDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.teal },
  openToText: { ...typography.small, fontFamily: fonts.body.semibold, color: colors.teal },

  actions: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.lg },
  action: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs + 2,
    minHeight: MIN_TOUCH_TARGET,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.lg,
    borderWidth: 1,
  },
  actionPrimary: { backgroundColor: colors.navy, borderColor: colors.navy },
  actionSecondary: { backgroundColor: colors.white, borderColor: colors.border },
  actionText: { ...typography.caption, fontFamily: fonts.body.semibold },
  actionTextPrimary: { color: colors.white },
  actionTextSecondary: { color: colors.navy },
  pressed: { opacity: 0.75 },
});
