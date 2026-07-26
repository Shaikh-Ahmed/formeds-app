import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput, KeyboardAvoidingView, Platform, ScrollView, ActivityIndicator } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { apiFetch } from '../src/utils/api';

export default function ResetPasswordScreen() {
  const { token } = useLocalSearchParams<{ token?: string }>();
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);
  const router = useRouter();

  const handleSubmit = async () => {
    if (!token) { setError('This reset link is invalid.'); return; }
    if (password.length < 8 || !/[a-zA-Z]/.test(password) || !/\d/.test(password)) {
      setError('Password must be at least 8 characters and include a letter and a number');
      return;
    }
    setLoading(true); setError('');
    try {
      await apiFetch('/api/auth/password/reset', null, { method: 'POST', body: JSON.stringify({ token, new_password: password }) });
      setDone(true);
    } catch (e: any) {
      setError(e.message || 'Could not reset password. The link may have expired.');
    } finally { setLoading(false); }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.flex}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          {done ? (
            <View style={styles.center}>
              <Ionicons name="checkmark-circle" size={64} color="#0F766E" />
              <Text style={styles.title}>Password updated</Text>
              <Text style={styles.subtitle}>You can now sign in with your new password.</Text>
              <TouchableOpacity style={styles.submitBtn} onPress={() => router.replace('/login')}>
                <Text style={styles.submitText}>Sign In</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <>
              <Text style={styles.title}>Set a new password</Text>
              <Text style={styles.subtitle}>Choose a strong password for your account.</Text>

              {error ? <View style={styles.errorBox}><Ionicons name="alert-circle" size={18} color="#E84545" /><Text style={styles.errorText}>{error}</Text></View> : null}

              <View style={styles.inputGroup}>
                <Text style={styles.label}>New password</Text>
                <View style={styles.inputWrap}>
                  <Ionicons name="lock-closed-outline" size={20} color="#94A3B8" style={styles.inputIcon} />
                  <TextInput style={styles.input} placeholder="Min 8 chars, letter + number" placeholderTextColor="#94A3B8" value={password} onChangeText={setPassword} secureTextEntry={!showPw} />
                  <TouchableOpacity onPress={() => setShowPw(!showPw)}><Ionicons name={showPw ? 'eye-off' : 'eye'} size={20} color="#94A3B8" /></TouchableOpacity>
                </View>
              </View>

              <TouchableOpacity style={styles.submitBtn} onPress={handleSubmit} disabled={loading}>
                {loading ? <ActivityIndicator color="#FFF" /> : <Text style={styles.submitText}>Update password</Text>}
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
  scroll: { paddingHorizontal: 24, paddingTop: 40, paddingBottom: 40 },
  center: { alignItems: 'center', paddingTop: 40 },
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
