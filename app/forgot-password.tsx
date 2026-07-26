import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput, KeyboardAvoidingView, Platform, ScrollView, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { apiFetch } from '../src/utils/api';

export default function ForgotPasswordScreen() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');
  const router = useRouter();

  const handleSubmit = async () => {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) { setError('Please enter a valid email'); return; }
    setLoading(true); setError('');
    try {
      await apiFetch('/api/auth/password/forgot', null, { method: 'POST', body: JSON.stringify({ email: email.trim() }) });
      setSent(true);
    } catch (e: any) {
      setError(e.message || 'Something went wrong');
    } finally { setLoading(false); }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.flex}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={24} color="#1A3A5C" />
          </TouchableOpacity>

          {sent ? (
            <View style={styles.center}>
              <Ionicons name="mail-open-outline" size={64} color="#0F766E" />
              <Text style={styles.title}>Check your email</Text>
              <Text style={styles.subtitle}>If {email} is registered, we&apos;ve sent a link to reset your password. The link expires in 1 hour.</Text>
              <TouchableOpacity style={styles.submitBtn} onPress={() => router.replace('/login')}>
                <Text style={styles.submitText}>Back to Sign In</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <>
              <Text style={styles.title}>Forgot password?</Text>
              <Text style={styles.subtitle}>Enter your email and we&apos;ll send you a reset link.</Text>

              {error ? <View style={styles.errorBox}><Ionicons name="alert-circle" size={18} color="#E84545" /><Text style={styles.errorText}>{error}</Text></View> : null}

              <View style={styles.inputGroup}>
                <Text style={styles.label}>Email</Text>
                <View style={styles.inputWrap}>
                  <Ionicons name="mail-outline" size={20} color="#94A3B8" style={styles.inputIcon} />
                  <TextInput style={styles.input} placeholder="you@example.com" placeholderTextColor="#94A3B8" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" />
                </View>
              </View>

              <TouchableOpacity style={styles.submitBtn} onPress={handleSubmit} disabled={loading}>
                {loading ? <ActivityIndicator color="#FFF" /> : <Text style={styles.submitText}>Send reset link</Text>}
              </TouchableOpacity>
            </>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#FFFFFF' },
  flex: { flex: 1 },
  scroll: { paddingHorizontal: 24, paddingTop: 16, paddingBottom: 40 },
  center: { alignItems: 'center', paddingTop: 40 },
  backBtn: { width: 44, height: 44, borderRadius: 12, backgroundColor: '#F1F5F9', alignItems: 'center', justifyContent: 'center', marginBottom: 24 },
  title: { fontSize: 28, fontWeight: '700', color: '#0F172A', marginBottom: 4, textAlign: 'center' },
  subtitle: { fontSize: 15, color: '#64748B', marginBottom: 28, textAlign: 'center' },
  errorBox: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FEF2F2', borderRadius: 10, padding: 12, marginBottom: 16 },
  errorText: { color: '#E84545', fontSize: 14, marginLeft: 8, flex: 1 },
  inputGroup: { marginBottom: 18 },
  label: { fontSize: 14, fontWeight: '600', color: '#334155', marginBottom: 6 },
  inputWrap: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F8FAFC', borderRadius: 12, borderWidth: 1, borderColor: '#E2E8F0', paddingHorizontal: 14, height: 52 },
  inputIcon: { marginRight: 10 },
  input: { flex: 1, fontSize: 16, color: '#0F172A' },
  submitBtn: { backgroundColor: '#1A3A5C', borderRadius: 14, height: 52, alignItems: 'center', justifyContent: 'center', marginTop: 8, marginBottom: 20, alignSelf: 'stretch' },
  submitText: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },
});
