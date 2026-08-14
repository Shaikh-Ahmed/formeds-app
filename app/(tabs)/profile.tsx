import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../src/context/AuthContext';
import { useRouter } from 'expo-router';
import { Avatar, RoleBadge } from '../../src/components';
import { PageGrid, WideHeader, Hoverable } from '../../src/components/web';
import { colors, spacing, radius, typography, getRoleMeta, useBreakpoint } from '../../src/theme';

export default function ProfileScreen() {
  const { user, logout, isKycApproved } = useAuth();
  const router = useRouter();
  const { isMobile } = useBreakpoint();
  const meta = getRoleMeta(user?.role);

  const handleLogout = async () => {
    await logout();
    router.replace('/');
  };

  /** Account actions. On desktop these move into the right rail so the centre
   *  column is only the professional record itself. */
  const accountMenu = (
    <View style={[styles.section, !isMobile && styles.sectionWide]}>
      <Text style={styles.sectionTitle} accessibilityRole="header">Account</Text>
      <MenuItem testID="edit-profile-btn" icon="create-outline" label="Edit Profile" onPress={() => router.push('/edit-profile')} />
      <MenuItem testID="settings-btn" icon="settings-outline" label="Settings" onPress={() => router.push('/settings')} />
      <MenuItem testID="help-btn" icon="help-circle-outline" label="Help & Support" onPress={() => router.push('/help')} last />
    </View>
  );

  const adminMenu = user?.is_admin ? (
    <View style={[styles.section, !isMobile && styles.sectionWide]}>
      <Text style={styles.sectionTitle} accessibilityRole="header">Admin</Text>
      <MenuItem
        testID="admin-kyc-btn"
        icon="shield-checkmark-outline"
        iconColor={colors.teal}
        label="KYC Review Queue"
        onPress={() => router.push('/admin/kyc')}
        last
      />
    </View>
  ) : null;

  const signOut = (
    <Hoverable
      testID="logout-btn"
      style={[styles.logoutBtn, !isMobile && styles.logoutBtnWide]}
      hoverStyle={styles.logoutBtnHover}
      onPress={handleLogout}
      accessibilityLabel="Sign out of ForMeds"
    >
      <Ionicons name="log-out-outline" size={20} color={colors.red} />
      <Text style={styles.logoutText}>Sign Out</Text>
    </Hoverable>
  );

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <WideHeader title="Profile" />

      <PageGrid
        right={
          <View style={styles.rail}>
            {adminMenu}
            {accountMenu}
            {signOut}
            <Text style={styles.version}>ForMeds v1.0.0</Text>
          </View>
        }
        contentMaxWidth={720}
        testID="profile-grid"
      >
        <ScrollView contentContainerStyle={[styles.scroll, !isMobile && styles.scrollWide]}>
          {/* Identity card. The banner gives the record a masthead instead of
              a name floating on flat background — the single biggest reason
              the mobile profile read as unfinished in a browser. */}
          <View style={[styles.profileCard, !isMobile && styles.profileCardWide]}>
            {!isMobile && <View style={[styles.banner, { backgroundColor: meta.bg }]} />}
            <View style={[styles.profileBody, !isMobile && styles.profileBodyWide]}>
              <View style={[styles.avatarWrap, !isMobile && styles.avatarWrapWide]}>
                <Avatar name={user?.name} role={user?.role} uri={user?.avatar} size={isMobile ? 80 : 104} />
              </View>
              <Text style={styles.profileName}>{user?.name}</Text>
              <View style={styles.badgeRow}>
                <RoleBadge role={user?.role} long />
                {/* Verification is a credential in a clinical network, so it is
                    stated on the record, not only enforced at the gate. */}
                <View style={[styles.kycPill, isKycApproved ? styles.kycPillOk : styles.kycPillPending]}>
                  <Ionicons
                    name={isKycApproved ? 'shield-checkmark' : 'shield-outline'}
                    size={12}
                    color={isKycApproved ? colors.teal : colors.warning}
                  />
                  <Text style={[styles.kycPillText, { color: isKycApproved ? colors.teal : colors.warning }]}>
                    {isKycApproved ? 'Verified' : 'Verification pending'}
                  </Text>
                </View>
              </View>
              <Text style={styles.profileEmail}>{user?.email}</Text>

              {!isMobile && (
                <Hoverable
                  testID="edit-profile-btn-wide"
                  onPress={() => router.push('/edit-profile')}
                  accessibilityLabel="Edit profile"
                  style={styles.editBtn}
                  hoverStyle={styles.editBtnHover}
                >
                  <Ionicons name="create-outline" size={16} color={colors.navy} />
                  <Text style={styles.editBtnText}>Edit profile</Text>
                </Hoverable>
              )}
            </View>
          </View>

          {user?.role === 'healthcare_professional' && (
            <View style={[styles.section, !isMobile && styles.sectionWide]}>
              <Text style={styles.sectionTitle} accessibilityRole="header">Professional Info</Text>
              <InfoRow icon="medkit-outline" label="Role" value={user?.professional_role || 'Doctor'} />
              <InfoRow icon="medical-outline" label="Specialty" value={user?.specialty || 'Not set'} />
              <InfoRow icon="document-text-outline" label="Registration" value={user?.registration_number || 'Not set'} />
              <InfoRow icon="location-outline" label="Location" value={`${user?.city || ''}, ${user?.state || ''}`} />
              <InfoRow icon="time-outline" label="Experience" value={`${user?.years_experience || 0} years`} />
              <InfoRow icon="ribbon-outline" label="CME Credits" value={`${user?.cme_credits || 0} credits`} last />
            </View>
          )}

          {user?.role === 'hospital' && (
            <View style={[styles.section, !isMobile && styles.sectionWide]}>
              <Text style={styles.sectionTitle} accessibilityRole="header">Hospital Info</Text>
              <InfoRow icon="business-outline" label="Type" value={user?.hospital_type || 'Private'} />
              <InfoRow icon="location-outline" label="Location" value={user?.location || 'Not set'} />
              <InfoRow icon="document-text-outline" label="License" value={user?.license_number || 'Not set'} />
              <InfoRow icon="person-outline" label="Contact" value={user?.contact_person || 'Not set'} last />
            </View>
          )}

          {user?.role === 'clinic' && (
            <View style={[styles.section, !isMobile && styles.sectionWide]}>
              <Text style={styles.sectionTitle} accessibilityRole="header">Clinic Info</Text>
              <InfoRow icon="medical-outline" label="Specialty Focus" value={user?.specialty_focus || 'Not set'} />
              <InfoRow icon="location-outline" label="Location" value={user?.location || 'Not set'} />
              <InfoRow icon="document-text-outline" label="Registration" value={user?.registration_number || 'Not set'} last />
            </View>
          )}

          {/* Below 1128px there is no right rail, so the account actions stay
              in the main column rather than disappearing. */}
          {isMobile && (
            <>
              {adminMenu}
              {accountMenu}
              {signOut}
              <Text style={styles.version}>ForMeds v1.0.0</Text>
            </>
          )}
        </ScrollView>
      </PageGrid>
    </SafeAreaView>
  );
}

function MenuItem({
  testID,
  icon,
  label,
  onPress,
  iconColor = colors.navy,
  last,
}: {
  testID?: string;
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
  iconColor?: string;
  last?: boolean;
}) {
  return (
    <Hoverable
      testID={testID}
      onPress={onPress}
      accessibilityLabel={label}
      style={[styles.menuItem, last && styles.menuItemLast]}
      hoverStyle={styles.menuItemHover}
    >
      <View style={styles.menuIcon}>
        <Ionicons name={icon} size={20} color={iconColor} />
      </View>
      <Text style={styles.menuText}>{label}</Text>
      <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
    </Hoverable>
  );
}

function InfoRow({
  icon,
  label,
  value,
  last,
}: {
  icon: string;
  label: string;
  value: string;
  last?: boolean;
}) {
  return (
    <View style={[styles.infoRow, last && styles.infoRowLast]}>
      <Ionicons name={icon as any} size={18} color={colors.textSecondary} />
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  scroll: { paddingBottom: 100 },
  scrollWide: { paddingTop: spacing.xxl, paddingBottom: spacing.xxxl, gap: spacing.lg },

  profileCard: { backgroundColor: colors.white, alignItems: 'center', paddingVertical: 28, borderBottomWidth: 1, borderBottomColor: colors.border },
  profileCardWide: {
    paddingVertical: 0,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    overflow: 'hidden',
    alignItems: 'stretch',
  },
  banner: { height: 96 },
  profileBody: { alignItems: 'center' },
  profileBodyWide: { alignItems: 'flex-start', paddingHorizontal: spacing.xxl, paddingBottom: spacing.xxl },
  avatarWrap: { marginBottom: 14 },
  avatarWrapWide: {
    marginTop: -52,
    marginBottom: spacing.md,
    borderWidth: 4,
    borderColor: colors.white,
    borderRadius: radius.pill,
    backgroundColor: colors.white,
  },
  profileName: { ...typography.h2, color: colors.text, marginBottom: 6 },
  badgeRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: spacing.sm, marginBottom: 6 },
  kycPill: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: spacing.sm, paddingVertical: 3, borderRadius: radius.sm },
  kycPillOk: { backgroundColor: colors.successBg },
  kycPillPending: { backgroundColor: colors.warningBg },
  kycPillText: { fontSize: 11, fontWeight: '700' },
  profileEmail: { ...typography.body, color: colors.textSecondary },
  editBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.lg,
    paddingHorizontal: spacing.lg,
    minHeight: 40,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.navy,
    justifyContent: 'center',
    alignSelf: 'flex-start',
  },
  editBtnHover: { backgroundColor: colors.bgMuted },
  editBtnText: { ...typography.label, color: colors.navy },

  rail: { gap: spacing.lg },
  section: { backgroundColor: colors.white, marginTop: 12, paddingHorizontal: 20, paddingVertical: 16 },
  sectionWide: { marginTop: 0, borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg },
  sectionTitle: { ...typography.h3, color: colors.navy, marginBottom: 14 },

  infoRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: colors.borderLight },
  infoRowLast: { borderBottomWidth: 0 },
  infoLabel: { ...typography.body, fontSize: 14, color: colors.textSecondary, marginLeft: 10, flex: 1 },
  infoValue: { fontSize: 14, fontWeight: '500', color: colors.text, textAlign: 'right', flexShrink: 1 },

  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: spacing.sm,
    marginHorizontal: -spacing.sm,
    borderRadius: radius.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
  },
  menuItemLast: { borderBottomWidth: 0 },
  menuItemHover: { backgroundColor: colors.bgMuted },
  menuIcon: { width: 36, height: 36, borderRadius: 10, backgroundColor: colors.bgMuted, alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  menuText: { flex: 1, ...typography.body, color: colors.text, fontWeight: '500' },

  logoutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginHorizontal: 20,
    marginTop: 20,
    paddingVertical: 14,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: '#FEE2E2',
    backgroundColor: colors.redBg,
  },
  logoutBtnWide: { marginHorizontal: 0, marginTop: 0 },
  logoutBtnHover: { backgroundColor: '#FEE2E2' },
  logoutText: { fontSize: 16, fontWeight: '600', color: colors.red },

  version: { textAlign: 'center', ...typography.small, color: colors.textMuted, marginTop: 20, marginBottom: 20 },
});
