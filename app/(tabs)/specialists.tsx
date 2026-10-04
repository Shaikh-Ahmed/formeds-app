import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../../src/context/AuthContext';
import { ComingSoon } from '../../src/components';
import { PageGrid, ProfileRail } from '../../src/components/web';
import { colors, spacing, typography, useBreakpoint } from '../../src/theme';

/**
 * Specialist Access — ships in the next phase.
 * Clinics post visiting-specialist listings, professionals opt in; neither
 * side is wired up yet, so both roles get a coming-soon panel instead of an
 * empty list. The /api/specialists routes stay live for when it returns.
 */

const CLINIC = {
  title: 'Specialist listings are coming soon',
  description:
    'Post the visiting-specialist slots your clinic needs to fill and see which professionals opt in.',
  bullets: [
    'Publish a slot with specialty, schedule and compensation',
    'Track who has opted in to each listing',
    'Message interested professionals directly',
  ],
};

const PROFESSIONAL = {
  title: 'Specialist access is coming soon',
  description:
    'Browse visiting-specialist slots at clinics near you and opt in to the ones that fit your schedule.',
  bullets: [
    'Openings filtered by your specialty',
    'Schedule, location and compensation up front',
    'One-tap opt-in, no application forms',
  ],
};

export default function SpecialistsScreen() {
  const { user } = useAuth();
  const isClinic = user?.role === 'clinic';
  const copy = isClinic ? CLINIC : PROFESSIONAL;
  const { isMobile } = useBreakpoint();
  const title = isClinic ? 'My Listings' : 'Specialist Access';

  return (
    <SafeAreaView style={styles.safe} edges={[]}>
      <PageGrid left={<ProfileRail />} testID="specialists-grid">
        <ScrollView contentContainerStyle={[styles.body, !isMobile && styles.bodyWide]}>
          {/* No visible page title; the heading stays for screen readers. */}
          <Text style={styles.srOnly} accessibilityRole="header">{title}</Text>
          <ComingSoon
            testID="coming-soon-specialists"
            icon="people-outline"
            title={copy.title}
            description={copy.description}
            bullets={copy.bullets}
          />
          <Text style={styles.footnote}>
            Specialist access arrives in the next phase. Nothing to do here yet.
          </Text>
        </ScrollView>
      </PageGrid>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  srOnly: { position: 'absolute', width: 1, height: 1, overflow: 'hidden', opacity: 0 },
  safe: { flex: 1, backgroundColor: colors.bg },
  wideTitleWrap: { paddingBottom: spacing.xs },
  titleWrapMobile: { paddingBottom: spacing.md },
  body: { padding: spacing.lg, paddingBottom: 100 },
  bodyWide: { paddingHorizontal: 0, paddingTop: spacing.xxl, paddingBottom: spacing.xxxl },
  footnote: {
    ...typography.small,
    color: colors.textMuted,
    textAlign: 'center',
    marginTop: spacing.xl,
    paddingHorizontal: spacing.xl,
    lineHeight: 18,
  },
});
