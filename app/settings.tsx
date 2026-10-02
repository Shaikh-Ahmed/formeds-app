import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, Linking, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import Constants from 'expo-constants';
import { useAuth } from '../src/context/AuthContext';
import { ScreenHeader, Button } from '../src/components';
import { colors, spacing, radius, typography, MIN_TOUCH_TARGET, THEMES, activeTheme, applyTheme, type ThemeId } from '../src/theme';
import { PageColumn } from '../src/components/web';
import { SignInMethods } from '../src/components/auth/SignInMethods';

const SUPPORT_EMAIL = 'support@formeds.in';

export default function SettingsScreen() {
  const { user, logout } = useAuth();
  const router = useRouter();
  const [loggingOut, setLoggingOut] = useState(false);

  const version = Constants.expoConfig?.version ?? '1.0.0';

  const handleLogout = async () => {
    setLoggingOut(true);
    const wasRecruiter = user?.role === 'recruiter';
    await logout();
    router.replace(wasRecruiter ? '/recruiter-login' : '/login');
  };

  const confirmDelete = () => {
    Alert.alert(
      'Delete account',
      'Account deletion is handled by our support team so we can verify your identity first. We\'ll email you to confirm before anything is removed.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Email support',
          style: 'destructive',
          onPress: () => Linking.openURL(`mailto:${SUPPORT_EMAIL}?subject=Account deletion request&body=Please delete the account for ${user?.email ?? ''}.`),
        },
      ],
    );
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <PageColumn maxWidth={640} testID="settings-column">
      <ScreenHeader title="Settings" />
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Account</Text>
          <Row icon="mail-outline" label="Email" value={user?.email} />
          <Row
            icon={user?.email_verified ? 'checkmark-circle-outline' : 'alert-circle-outline'}
            label="Email verified"
            value={user?.email_verified ? 'Yes' : 'Not yet'}
          />
          <Row icon="call-outline" label="Phone" value={user?.phone} />
          {/* Previously a dead read-only row — there was no way to act on it. */}
          <TouchableOpacity
            style={styles.row}
            onPress={() => router.push((user?.role === 'recruiter' ? '/recruiter/account' : '/kyc') as any)}
            accessibilityRole="button"
            accessibilityLabel={`Professional verification: ${user?.verified ? 'verified' : 'not verified'}. Tap to view.`}
            testID="settings-kyc"
          >
            <Ionicons
              name={user?.verified ? 'shield-checkmark-outline' : 'shield-outline'}
              size={18}
              color={user?.verified ? colors.teal : colors.warning}
            />
            <Text style={styles.rowLabel}>Professional verification</Text>
            <Text style={styles.rowValue}>{user?.verified ? 'Verified' : 'Not verified'}</Text>
            <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
          </TouchableOpacity>
        </View>

        {/* Google is for normal members only; recruiters and admins never see it. */}
        {user?.role !== 'recruiter' && !user?.is_admin ? <SignInMethods /> : null}

        {user?.role === 'healthcare_professional' ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Opportunities</Text>
            <TouchableOpacity
              style={styles.row}
              onPress={() => router.push('/opportunities' as any)}
              accessibilityRole="button"
              accessibilityLabel="Discovery, locum availability and invitations. Tap to manage."
              testID="settings-opportunities"
            >
              <Ionicons name="compass-outline" size={18} color={colors.navy} />
              <Text style={styles.rowLabel}>Discovery & locum availability</Text>
              <Text style={styles.rowValue}>Manage</Text>
              <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
            </TouchableOpacity>
          </View>
        ) : null}

        {/* Plans are AED tokens -- not part of the recruiter portal. */}
        {user?.role !== 'recruiter' ? (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Plan</Text>
          <TouchableOpacity
            style={styles.row}
            onPress={() => router.push('/subscription' as any)}
            accessibilityRole="button"
            accessibilityLabel="Plan and AED tokens. Tap to view."
            testID="settings-plan"
          >
            <Ionicons name="ribbon-outline" size={18} color={colors.navy} />
            <Text style={styles.rowLabel}>Plan & AED tokens</Text>
            <Text style={styles.rowValue}>Manage</Text>
            <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.row}
            onPress={() => router.push('/payment-history' as any)}
            accessibilityRole="button"
            accessibilityLabel="Payment history. Tap to view."
            testID="settings-payments"
          >
            <Ionicons name="receipt-outline" size={18} color={colors.navy} />
            <Text style={styles.rowLabel}>Payment history</Text>
            <Text style={styles.rowValue}>View</Text>
            <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
          </TouchableOpacity>
        </View>
        ) : null}

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Appearance</Text>
          <View style={styles.themeRow} accessibilityRole="radiogroup">
            {THEMES.map(t => (
              <ThemeOption key={t.id} id={t.id} label={t.label} description={t.description}
                selected={activeTheme === t.id} />
            ))}
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>About</Text>
          <Row icon="information-circle-outline" label="Version" value={version} />
          <TouchableOpacity
            style={styles.link}
            onPress={() => Linking.openURL('https://formeds.in')}
            accessibilityRole="link"
            accessibilityLabel="Open the ForMeds website"
          >
            <Ionicons name="globe-outline" size={20} color={colors.navy} />
            <Text style={styles.linkText}>formeds.in</Text>
            <Ionicons name="open-outline" size={16} color={colors.textMuted} />
          </TouchableOpacity>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Danger zone</Text>
          <Button label="Sign out" onPress={handleLogout} loading={loggingOut} variant="outline" testID="settings-logout" />
          <View style={{ height: spacing.md }} />
          <Button label="Delete account" onPress={confirmDelete} variant="danger" testID="settings-delete" />
        </View>
      </ScrollView>
      </PageColumn>
    </SafeAreaView>
  );
}

/** Swatches that preview each theme in its own colours, whatever is active. */
const SWATCHES: Record<ThemeId, { ground: string; card: string; ink: string; accent: string; serif: boolean }> = {
  classic: { ground: '#F8FAFC', card: '#FFFFFF', ink: '#1A3A5C', accent: '#0F766E', serif: false },
  journal: { ground: '#FAF8F4', card: '#FFFFFF', ink: '#1C2430', accent: '#0F5E57', serif: true },
  premium: { ground: '#F8FAFC', card: '#FFFFFF', ink: '#0F172A', accent: '#0F766E', serif: false },
  material: { ground: '#EEF2FB', card: '#FFFFFF', ink: '#0B2545', accent: '#003A72', serif: false },
  terracotta: { ground: '#F3ECE2', card: '#FCF9F4', ink: '#4A2314', accent: '#A3472A', serif: false },
};

function ThemeOption({ id, label, description, selected }: {
  id: ThemeId; label: string; description: string; selected: boolean;
}) {
  const sw = SWATCHES[id];
  const choose = () => {
    if (selected) return;
    // Web reloads into the new theme; a phone applies it next time the app opens.
    if (!applyTheme(id)) {
      Alert.alert('Theme saved', `Close and reopen ForMeds to switch to ${label}.`);
    }
  };
  return (
    <TouchableOpacity
      style={[styles.themeCard, selected && styles.themeCardSelected]}
      onPress={choose}
      accessibilityRole="radio"
      accessibilityState={{ checked: selected }}
      accessibilityLabel={`${label} theme. ${description}`}
      testID={`settings-theme-${id}`}
    >
      <View style={[styles.themePreview, { backgroundColor: sw.ground }]}>
        <View style={[styles.themePreviewCard, { backgroundColor: sw.card }]}>
          <Text style={[styles.themePreviewTitle, { color: sw.ink }, sw.serif && styles.serif,
            id === 'premium' && styles.jakarta]}>Aa</Text>
          <View style={[styles.themePreviewBar, { backgroundColor: sw.accent }]} />
        </View>
      </View>
      <View style={styles.themeText}>
        <View style={styles.themeLabelRow}>
          <Ionicons name={selected ? 'radio-button-on' : 'radio-button-off'} size={18}
            color={selected ? colors.teal : colors.textMuted} />
          <Text style={styles.themeLabel}>{label}</Text>
        </View>
        <Text style={styles.themeDescription}>{description}</Text>
      </View>
    </TouchableOpacity>
  );
}

function Row({ icon, label, value }: { icon: keyof typeof Ionicons.glyphMap; label: string; value?: string | null }) {
  return (
    <View style={styles.row} accessible accessibilityLabel={`${label}: ${value ?? 'not set'}`}>
      <Ionicons name={icon} size={18} color={colors.textSecondary} />
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowValue} numberOfLines={1}>{value ?? '—'}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  scroll: { paddingBottom: spacing.xxxl },
  themeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
  themeCard: {
    flexGrow: 1, flexBasis: 220, borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg,
    overflow: 'hidden', backgroundColor: colors.white,
  },
  themeCardSelected: { borderColor: colors.teal, borderWidth: 2 },
  themePreview: { height: 84, padding: spacing.md, justifyContent: 'center' },
  themePreviewCard: {
    borderRadius: radius.sm, padding: spacing.sm, gap: spacing.xs,
    borderWidth: 1, borderColor: 'rgba(0,0,0,0.06)',
  },
  themePreviewTitle: { fontSize: 20, fontFamily: 'Outfit_700Bold' },
  // Premium previews in its own face, Plus Jakarta Sans.
  jakarta: { fontFamily: 'PlusJakartaSans_800ExtraBold' },
  // The serif face itself only loads under Journal, so the preview uses the
  // platform serif to show the difference from either theme.
  serif: { fontFamily: Platform.select({ web: 'Georgia, serif', ios: 'Georgia', default: 'serif' }) },
  themePreviewBar: { height: 6, width: 56, borderRadius: 3 },
  themeText: { padding: spacing.md, gap: spacing.xs },
  themeLabelRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  themeLabel: { ...typography.label, color: colors.text },
  themeDescription: { ...typography.small, color: colors.textSecondary, lineHeight: 17 },
  section: { backgroundColor: colors.white, marginTop: spacing.md, paddingHorizontal: spacing.xl, paddingVertical: spacing.lg },
  sectionTitle: { ...typography.h3, color: colors.navy, marginBottom: spacing.md },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, minHeight: MIN_TOUCH_TARGET, paddingVertical: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.borderLight },
  rowLabel: { ...typography.body, color: colors.textSecondary, marginLeft: spacing.sm + 2, flex: 1 },
  rowValue: { ...typography.bodyStrong, color: colors.text, maxWidth: '55%', textAlign: 'right' },
  link: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm + 2, minHeight: MIN_TOUCH_TARGET, paddingVertical: spacing.md },
  linkText: { ...typography.body, color: colors.navy, flex: 1 },
});
