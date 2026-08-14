import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, Linking } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import Constants from 'expo-constants';
import { useAuth } from '../src/context/AuthContext';
import { ScreenHeader, Button } from '../src/components';
import { colors, spacing, typography, MIN_TOUCH_TARGET } from '../src/theme';
import { PageColumn } from '../src/components/web';

const SUPPORT_EMAIL = 'support@formeds.in';

export default function SettingsScreen() {
  const { user, logout } = useAuth();
  const router = useRouter();
  const [loggingOut, setLoggingOut] = useState(false);

  const version = Constants.expoConfig?.version ?? '1.0.0';

  const handleLogout = async () => {
    setLoggingOut(true);
    await logout();
    router.replace('/login');
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
            onPress={() => router.push('/kyc')}
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
  section: { backgroundColor: colors.white, marginTop: spacing.md, paddingHorizontal: spacing.xl, paddingVertical: spacing.lg },
  sectionTitle: { ...typography.h3, color: colors.navy, marginBottom: spacing.md },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, minHeight: MIN_TOUCH_TARGET, paddingVertical: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.borderLight },
  rowLabel: { ...typography.body, color: colors.textSecondary, marginLeft: spacing.sm + 2, flex: 1 },
  rowValue: { ...typography.bodyStrong, color: colors.text, maxWidth: '55%', textAlign: 'right' },
  link: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm + 2, minHeight: MIN_TOUCH_TARGET, paddingVertical: spacing.md },
  linkText: { ...typography.body, color: colors.navy, flex: 1 },
});
