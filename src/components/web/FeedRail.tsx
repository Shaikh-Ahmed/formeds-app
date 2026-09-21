import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { colors, spacing, radius, typography, shadow } from '../../theme';
import { useAuth } from '../../context/AuthContext';
import { RailCard } from './Rail';
import { Hoverable } from './Hoverable';

/**
 * Right-hand contextual rail for the feed (>=1128px only).
 *
 * Deliberately limited to things the app already knows: verification status
 * and the network entry point. No invented "people you may know" ranking —
 * there is no endpoint for it, and a rail of placeholder faces would be worse
 * than an honest, shorter rail.
 */
export function FeedRail() {
  const { isKycApproved, user } = useAuth();
  const router = useRouter();

  return (
    <View style={styles.wrap}>
      {/* Verification is the gate on posting, applying and messaging, so on
          desktop it gets persistent rail space instead of only appearing
          inside the composer. */}
      {!isKycApproved && user ? (
        <View style={styles.kycCard}>
          <View style={styles.kycHead}>
            <Ionicons name="shield-outline" size={18} color={colors.warning} />
            <Text style={styles.kycTitle}>Verification pending</Text>
          </View>
          <Text style={styles.kycBody}>
            Verified members can post, comment, apply to jobs and message other
            professionals.
          </Text>
          <Hoverable
            testID="rail-kyc-cta"
            onPress={() => router.push('/kyc' as any)}
            accessibilityLabel="Complete verification"
            style={styles.kycCta}
            hoverStyle={styles.kycCtaHover}
          >
            <Text style={styles.kycCtaText}>Complete verification</Text>
            <Ionicons name="arrow-forward" size={14} color={colors.warning} />
          </Hoverable>
        </View>
      ) : null}

      <RailCard
        title="Your network"
        testID="rail-network"
        footerLabel="Go to my network"
        onFooterPress={() => router.push('/people' as any)}
      >
        <View style={styles.railBody}>
          <Text style={styles.railHint}>
            Connect with professionals, hospitals and clinics to see more of
            their cases and postings in your feed.
          </Text>
        </View>
      </RailCard>

      {/* Help and Settings used to live here too, reachable only when this
          rail happened to be on screen (Home tab, >=1128px). Both now live
          in the "Me" menu in the top bar instead, reachable from every
          screen at every width — this footer keeps only the brand line. */}
      <View style={styles.footer}>
        <Text style={styles.footerBrand}>ForMeds © {new Date().getFullYear()}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.lg },
  kycCard: {
    backgroundColor: colors.warningBg,
    borderWidth: 1,
    borderColor: '#FDE68A',
    borderRadius: radius.lg,
    padding: spacing.lg,
    gap: spacing.sm,
  },
  kycHead: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  kycTitle: { ...typography.label, color: colors.warning },
  kycBody: { ...typography.caption, color: colors.textSecondary, lineHeight: 19 },
  kycCta: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, paddingVertical: spacing.xs },
  kycCtaHover: { opacity: 0.7 },
  kycCtaText: { ...typography.label, color: colors.warning },

  railBody: { paddingHorizontal: spacing.lg, paddingBottom: spacing.md },
  railHint: { ...typography.caption, color: colors.textSecondary, lineHeight: 19 },

  footer: { paddingHorizontal: spacing.xs, gap: spacing.xs },
  // textMuted reaches only 2.5:1 on the page background — legible enough for a
  // placeholder, not for a line of standing text.
  footerBrand: { ...typography.small, color: colors.textSecondary, marginTop: spacing.xs },
});

export const railShadow = shadow.card;
