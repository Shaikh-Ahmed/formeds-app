import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { apiFetch } from '../src/utils/api';
import { useAuth } from '../src/context/AuthContext';

export default function VerifyEmailScreen() {
  const { token } = useLocalSearchParams<{ token?: string }>();
  const [status, setStatus] = useState<'loading' | 'ok' | 'error'>('loading');
  const router = useRouter();
  const { user, refreshUser } = useAuth();

  useEffect(() => {
    (async () => {
      if (!token) { setStatus('error'); return; }
      try {
        await apiFetch('/api/auth/verify-email/confirm', null, { method: 'POST', body: JSON.stringify({ token }) });
        setStatus('ok');
        if (user) refreshUser();
      } catch {
        setStatus('error');
      }
    })();
  }, [token]);

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.center}>
        {status === 'loading' && (
          <>
            <ActivityIndicator size="large" color="#1A3A5C" />
            <Text style={styles.subtitle}>Verifying your email…</Text>
          </>
        )}
        {status === 'ok' && (
          <>
            <Ionicons name="checkmark-circle" size={72} color="#0F766E" />
            <Text style={styles.title}>Email verified</Text>
            <Text style={styles.subtitle}>Your email is confirmed. You now have full access to ForMeds.</Text>
            <TouchableOpacity style={styles.submitBtn} onPress={() => router.replace(user ? '/(tabs)/feed' : '/login')}>
              <Text style={styles.submitText}>{user ? 'Go to Feed' : 'Sign In'}</Text>
            </TouchableOpacity>
          </>
        )}
        {status === 'error' && (
          <>
            <Ionicons name="close-circle" size={72} color="#E84545" />
            <Text style={styles.title}>Link invalid or expired</Text>
            <Text style={styles.subtitle}>This verification link is no longer valid. You can request a new one from your profile.</Text>
            <TouchableOpacity style={styles.submitBtn} onPress={() => router.replace(user ? '/(tabs)/profile' : '/login')}>
              <Text style={styles.submitText}>{user ? 'Go to Profile' : 'Sign In'}</Text>
            </TouchableOpacity>
          </>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#FFFFFF' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32, gap: 8 },
  title: { fontSize: 26, fontWeight: '700', color: '#0F172A', marginTop: 12, textAlign: 'center' },
  subtitle: { fontSize: 15, color: '#64748B', marginTop: 4, marginBottom: 24, textAlign: 'center' },
  submitBtn: { backgroundColor: '#1A3A5C', borderRadius: 14, height: 52, paddingHorizontal: 40, alignItems: 'center', justifyContent: 'center' },
  submitText: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },
});
