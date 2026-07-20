import React, { useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image, Dimensions } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '../src/context/AuthContext';
import { Ionicons } from '@expo/vector-icons';

const { width } = Dimensions.get('window');

export default function WelcomeScreen() {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && user) {
      router.replace('/(tabs)/feed');
    }
  }, [user, loading]);

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <Image source={require('../assets/images/formeds-logo.png')} style={styles.splashLogo} resizeMode="contain" />
      </View>
    );
  }

  return (
    <View style={styles.container} testID="welcome-screen">
      <View style={styles.topSection}>
        <Image source={require('../assets/images/formeds-logo.png')} style={styles.logo} resizeMode="contain" />
        <Text style={styles.tagline}>India&apos;s First Integrated Healthcare Platform</Text>
        <Text style={styles.mission}>Ensuring access to medical care is driven by need, not geography</Text>
      </View>

      <View style={styles.bottomSection}>
        <Text style={styles.getStartedText}>Get Started As</Text>
        
        <TouchableOpacity testID="role-professional-btn" style={[styles.roleCard, styles.professionalCard]} onPress={() => router.push({ pathname: '/register', params: { role: 'healthcare_professional' } })}>
          <View style={styles.roleIconContainer}>
            <Ionicons name="medkit" size={28} color="#0F766E" />
          </View>
          <View style={styles.roleTextContainer}>
            <Text style={styles.roleTitle}>Healthcare Professional</Text>
            <Text style={styles.roleDesc}>Doctor, Nurse, or Allied Health Worker</Text>
          </View>
          <Ionicons name="chevron-forward" size={22} color="#94A3B8" />
        </TouchableOpacity>

        <TouchableOpacity testID="role-hospital-btn" style={[styles.roleCard, styles.hospitalCard]} onPress={() => router.push({ pathname: '/register', params: { role: 'hospital' } })}>
          <View style={[styles.roleIconContainer, { backgroundColor: '#EFF6FF' }]}>
            <Ionicons name="business" size={28} color="#1A3A5C" />
          </View>
          <View style={styles.roleTextContainer}>
            <Text style={styles.roleTitle}>Hospital</Text>
            <Text style={styles.roleDesc}>Post jobs and manage staffing</Text>
          </View>
          <Ionicons name="chevron-forward" size={22} color="#94A3B8" />
        </TouchableOpacity>

        <TouchableOpacity testID="role-clinic-btn" style={[styles.roleCard, styles.clinicCard]} onPress={() => router.push({ pathname: '/register', params: { role: 'clinic' } })}>
          <View style={[styles.roleIconContainer, { backgroundColor: '#F0FDFA' }]}>
            <Ionicons name="fitness" size={28} color="#0F766E" />
          </View>
          <View style={styles.roleTextContainer}>
            <Text style={styles.roleTitle}>Clinic</Text>
            <Text style={styles.roleDesc}>Find visiting specialists</Text>
          </View>
          <Ionicons name="chevron-forward" size={22} color="#94A3B8" />
        </TouchableOpacity>

        <TouchableOpacity testID="login-link" style={styles.loginLink} onPress={() => router.push('/login')}>
          <Text style={styles.loginText}>Already have an account? <Text style={styles.loginBold}>Sign In</Text></Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#1A3A5C' },
  loadingContainer: { flex: 1, backgroundColor: '#1A3A5C', alignItems: 'center', justifyContent: 'center' },
  splashLogo: { width: 200, height: 100 },
  topSection: { flex: 0.35, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32, paddingTop: 60 },
  logo: { width: 180, height: 80, marginBottom: 16 },
  tagline: { fontSize: 18, fontWeight: '700', color: '#FFFFFF', textAlign: 'center', marginBottom: 8 },
  mission: { fontSize: 14, color: '#94A3B8', textAlign: 'center', lineHeight: 20 },
  bottomSection: { flex: 0.65, backgroundColor: '#FFFFFF', borderTopLeftRadius: 32, borderTopRightRadius: 32, paddingHorizontal: 24, paddingTop: 32 },
  getStartedText: { fontSize: 22, fontWeight: '700', color: '#0F172A', marginBottom: 20 },
  roleCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFFFFF', borderRadius: 16, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: '#E2E8F0' },
  professionalCard: {},
  hospitalCard: {},
  clinicCard: {},
  roleIconContainer: { width: 52, height: 52, borderRadius: 14, backgroundColor: '#F0FDF4', alignItems: 'center', justifyContent: 'center', marginRight: 14 },
  roleTextContainer: { flex: 1 },
  roleTitle: { fontSize: 16, fontWeight: '600', color: '#0F172A', marginBottom: 2 },
  roleDesc: { fontSize: 13, color: '#64748B' },
  loginLink: { alignItems: 'center', marginTop: 24, paddingVertical: 12 },
  loginText: { fontSize: 15, color: '#64748B' },
  loginBold: { fontWeight: '700', color: '#1A3A5C' },
});
