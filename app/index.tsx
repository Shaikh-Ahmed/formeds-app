import React, { useEffect } from 'react';
import { View, Text, StyleSheet, Image } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '../src/context/AuthContext';
import { Ionicons } from '@expo/vector-icons';
import { ROLE_META, colors, spacing, radius, typography, useBreakpoint } from '../src/theme';
import type { Role } from '../src/theme';
import { AuthShell, Hoverable } from '../src/components/web';

export default function WelcomeScreen() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const { isMobile } = useBreakpoint();

  useEffect(() => {
    if (!loading && user) {
      router.replace('/(tabs)/community');
    }
  }, [user, loading]);

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        {/* On a navy field the logo needs a light chip: its lettering is brand
            navy on a transparent background, so unbacked it renders blank. */}
        <View style={styles.logoChip}>
          <Image source={require('../assets/images/formeds-logo.png')} style={styles.splashLogo} resizeMode="contain" />
        </View>
      </View>
    );
  }

  const roleCards = (['healthcare_professional', 'hospital', 'clinic'] as Role[]).map(role => {
    const meta = ROLE_META[role];
    return (
      <Hoverable
        key={role}
        testID={`role-${role === 'healthcare_professional' ? 'professional' : role}-btn`}
        style={styles.roleCard}
        hoverStyle={styles.roleCardHover}
        onPress={() => router.push({ pathname: '/register', params: { role } })}
        accessibilityLabel={`Get started as ${meta.longLabel}. ${meta.description}`}
      >
        <View style={[styles.roleIconContainer, { backgroundColor: meta.bg }]}>
          <Ionicons name={meta.icon} size={28} color={meta.color} />
        </View>
        <View style={styles.roleTextContainer}>
          <Text style={styles.roleTitle}>{meta.longLabel}</Text>
          <Text style={styles.roleDesc}>{meta.description}</Text>
        </View>
        <Ionicons name="chevron-forward" size={22} color={colors.textMuted} />
      </Hoverable>
    );
  });

  const signInLink = (
    <Hoverable
      testID="login-link"
      style={styles.loginLink}
      hoverStyle={styles.loginLinkHover}
      onPress={() => router.push('/login')}
      accessibilityLabel="Sign in to an existing account"
    >
      <Text style={styles.loginText}>
        Already have an account? <Text style={styles.loginBold}>Sign In</Text>
      </Text>
    </Hoverable>
  );

  // Desktop: the brand moves to AuthShell's left panel, so this side carries
  // only the choice itself.
  if (!isMobile) {
    return (
      <AuthShell maxWidth={520} fill={false} testID="welcome-screen">
        {/* AuthShell's card supplies no horizontal padding — the auth screens
            that own a ScrollView already apply it. This screen doesn't, so it
            adds its own. */}
        <View style={styles.cardInner}>
          <Text style={styles.cardTitle} accessibilityRole="header">Get started</Text>
          <Text style={styles.cardSubtitle}>
            Choose how you&apos;ll use ForMeds. You can only hold one account type.
          </Text>
          <View style={styles.cardRoles}>{roleCards}</View>
          {signInLink}
        </View>
      </AuthShell>
    );
  }

  return (
    <View style={styles.container} testID="welcome-screen">
      <View style={styles.topSection}>
        <View style={styles.logoChip}>
          <Image source={require('../assets/images/formeds-logo.png')} style={styles.logo} resizeMode="contain" />
        </View>
        <Text style={styles.tagline}>India&apos;s First Integrated Healthcare Platform</Text>
        <Text style={styles.mission}>Ensuring access to medical care is driven by need, not geography</Text>
      </View>

      <View style={styles.bottomSection}>
        <Text style={styles.getStartedText}>Get Started As</Text>
        {roleCards}
        {signInLink}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.navy },
  loadingContainer: { flex: 1, backgroundColor: colors.navy, alignItems: 'center', justifyContent: 'center' },
  logoChip: {
    backgroundColor: colors.white,
    borderRadius: radius.lg,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    marginBottom: spacing.lg,
  },
  splashLogo: { width: 180, height: 72 },
  topSection: { flex: 0.35, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32, paddingTop: 60 },
  logo: { width: 168, height: 56 },
  tagline: { fontSize: 18, fontWeight: '700', color: colors.white, textAlign: 'center', marginBottom: 8 },
  mission: { fontSize: 14, color: '#B6C6D8', textAlign: 'center', lineHeight: 20 },
  bottomSection: {
    flex: 0.65,
    backgroundColor: colors.white,
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    paddingHorizontal: 24,
    paddingTop: 32,
  },
  getStartedText: { ...typography.h2, color: colors.text, marginBottom: 20 },

  cardInner: { paddingHorizontal: spacing.xxl },
  cardTitle: { ...typography.h2, color: colors.text },
  cardSubtitle: { ...typography.body, color: colors.textSecondary, marginTop: spacing.xs, lineHeight: 22 },
  cardRoles: { marginTop: spacing.xl },

  roleCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.white,
    borderRadius: radius.xl + 2,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  roleCardHover: { backgroundColor: colors.bg, borderColor: colors.navy },
  roleIconContainer: {
    width: 52,
    height: 52,
    borderRadius: radius.xl,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  roleTextContainer: { flex: 1 },
  roleTitle: { fontSize: 16, fontWeight: '600', color: colors.text, marginBottom: 2 },
  roleDesc: { ...typography.caption, color: colors.textSecondary },
  loginLink: { alignItems: 'center', marginTop: 24, paddingVertical: 12, borderRadius: radius.md },
  loginLinkHover: { backgroundColor: colors.bgMuted },
  loginText: { ...typography.body, color: colors.textSecondary },
  loginBold: { fontWeight: '700', color: colors.navy },
});
