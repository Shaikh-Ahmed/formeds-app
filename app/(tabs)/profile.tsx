import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../src/context/AuthContext';
import { useRouter } from 'expo-router';

const ROLE_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  healthcare_professional: { label: 'Healthcare Professional', color: '#0F766E', bg: '#F0FDF4' },
  hospital: { label: 'Hospital', color: '#1A3A5C', bg: '#EFF6FF' },
  clinic: { label: 'Clinic', color: '#0F766E', bg: '#F0FDFA' },
};

export default function ProfileScreen() {
  const { user, logout } = useAuth();
  const router = useRouter();
  const roleConfig = ROLE_CONFIG[user?.role || ''] || ROLE_CONFIG.healthcare_professional;

  const handleLogout = async () => {
    await logout();
    router.replace('/');
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Profile</Text>
        </View>

        <View style={styles.profileCard}>
          <View style={styles.avatarLarge}>
            <Text style={styles.avatarLargeText}>{user?.name?.charAt(0) || 'U'}</Text>
          </View>
          <Text style={styles.profileName}>{user?.name}</Text>
          <View style={[styles.roleBadge, { backgroundColor: roleConfig.bg }]}>
            <Text style={[styles.roleBadgeText, { color: roleConfig.color }]}>{roleConfig.label}</Text>
          </View>
          <Text style={styles.profileEmail}>{user?.email}</Text>
        </View>

        {user?.role === 'healthcare_professional' && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Professional Info</Text>
            <InfoRow icon="medkit-outline" label="Role" value={user?.professional_role || 'Doctor'} />
            <InfoRow icon="medical-outline" label="Specialty" value={user?.specialty || 'Not set'} />
            <InfoRow icon="document-text-outline" label="Registration" value={user?.registration_number || 'Not set'} />
            <InfoRow icon="location-outline" label="Location" value={`${user?.city || ''}, ${user?.state || ''}`} />
            <InfoRow icon="time-outline" label="Experience" value={`${user?.years_experience || 0} years`} />
            <InfoRow icon="ribbon-outline" label="CME Credits" value={`${user?.cme_credits || 0} credits`} />
          </View>
        )}

        {user?.role === 'hospital' && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Hospital Info</Text>
            <InfoRow icon="business-outline" label="Type" value={user?.hospital_type || 'Private'} />
            <InfoRow icon="location-outline" label="Location" value={user?.location || 'Not set'} />
            <InfoRow icon="document-text-outline" label="License" value={user?.license_number || 'Not set'} />
            <InfoRow icon="person-outline" label="Contact" value={user?.contact_person || 'Not set'} />
          </View>
        )}

        {user?.role === 'clinic' && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Clinic Info</Text>
            <InfoRow icon="medical-outline" label="Specialty Focus" value={user?.specialty_focus || 'Not set'} />
            <InfoRow icon="location-outline" label="Location" value={user?.location || 'Not set'} />
            <InfoRow icon="document-text-outline" label="Registration" value={user?.registration_number || 'Not set'} />
          </View>
        )}

        {user?.is_admin && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Admin</Text>
            <TouchableOpacity testID="admin-kyc-btn" style={styles.menuItem} onPress={() => router.push('/admin/kyc')}>
              <View style={styles.menuIcon}><Ionicons name="shield-checkmark-outline" size={20} color="#0F766E" /></View>
              <Text style={styles.menuText}>KYC Review Queue</Text>
              <Ionicons name="chevron-forward" size={20} color="#94A3B8" />
            </TouchableOpacity>
          </View>
        )}

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Account</Text>
          <TouchableOpacity testID="edit-profile-btn" style={styles.menuItem}>
            <View style={styles.menuIcon}><Ionicons name="create-outline" size={20} color="#1A3A5C" /></View>
            <Text style={styles.menuText}>Edit Profile</Text>
            <Ionicons name="chevron-forward" size={20} color="#94A3B8" />
          </TouchableOpacity>
          <TouchableOpacity testID="settings-btn" style={styles.menuItem}>
            <View style={styles.menuIcon}><Ionicons name="settings-outline" size={20} color="#1A3A5C" /></View>
            <Text style={styles.menuText}>Settings</Text>
            <Ionicons name="chevron-forward" size={20} color="#94A3B8" />
          </TouchableOpacity>
          <TouchableOpacity testID="help-btn" style={styles.menuItem}>
            <View style={styles.menuIcon}><Ionicons name="help-circle-outline" size={20} color="#1A3A5C" /></View>
            <Text style={styles.menuText}>Help & Support</Text>
            <Ionicons name="chevron-forward" size={20} color="#94A3B8" />
          </TouchableOpacity>
        </View>

        <TouchableOpacity testID="logout-btn" style={styles.logoutBtn} onPress={handleLogout}>
          <Ionicons name="log-out-outline" size={20} color="#E84545" />
          <Text style={styles.logoutText}>Sign Out</Text>
        </TouchableOpacity>

        <Text style={styles.version}>ForMeds v1.0.0</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

function InfoRow({ icon, label, value }: { icon: string; label: string; value: string }) {
  return (
    <View style={styles.infoRow}>
      <Ionicons name={icon as any} size={18} color="#64748B" />
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#F8FAFC' },
  scroll: { paddingBottom: 100 },
  header: { paddingHorizontal: 20, paddingVertical: 14, backgroundColor: '#FFFFFF', borderBottomWidth: 1, borderBottomColor: '#E2E8F0' },
  headerTitle: { fontSize: 24, fontWeight: '700', color: '#0F172A' },
  profileCard: { backgroundColor: '#FFFFFF', alignItems: 'center', paddingVertical: 28, borderBottomWidth: 1, borderBottomColor: '#E2E8F0' },
  avatarLarge: { width: 80, height: 80, borderRadius: 40, backgroundColor: '#1A3A5C', alignItems: 'center', justifyContent: 'center', marginBottom: 14 },
  avatarLargeText: { color: '#FFF', fontSize: 32, fontWeight: '700' },
  profileName: { fontSize: 22, fontWeight: '700', color: '#0F172A', marginBottom: 6 },
  roleBadge: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 16, marginBottom: 6 },
  roleBadgeText: { fontSize: 13, fontWeight: '600' },
  profileEmail: { fontSize: 14, color: '#64748B' },
  section: { backgroundColor: '#FFFFFF', marginTop: 12, paddingHorizontal: 20, paddingVertical: 16 },
  sectionTitle: { fontSize: 17, fontWeight: '700', color: '#1A3A5C', marginBottom: 14 },
  infoRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#F1F5F9' },
  infoLabel: { fontSize: 14, color: '#64748B', marginLeft: 10, flex: 1 },
  infoValue: { fontSize: 14, fontWeight: '500', color: '#0F172A' },
  menuItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#F1F5F9' },
  menuIcon: { width: 36, height: 36, borderRadius: 10, backgroundColor: '#F1F5F9', alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  menuText: { flex: 1, fontSize: 15, color: '#0F172A', fontWeight: '500' },
  logoutBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginHorizontal: 20, marginTop: 20, paddingVertical: 14, borderRadius: 14, borderWidth: 1, borderColor: '#FEE2E2', backgroundColor: '#FEF2F2' },
  logoutText: { fontSize: 16, fontWeight: '600', color: '#E84545' },
  version: { textAlign: 'center', fontSize: 12, color: '#94A3B8', marginTop: 20, marginBottom: 20 },
});
