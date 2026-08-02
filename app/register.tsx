import React, { useState } from 'react';
import { View, Text, StyleSheet, KeyboardAvoidingView, Platform, ScrollView, TouchableOpacity } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../src/context/AuthContext';
import { Button, FormInput, ErrorBanner } from '../src/components';
import { colors, radius, spacing, typography, getRoleMeta } from '../src/theme';
import type { Role } from '../src/theme';
import { validateEmail, validatePassword, validatePhone, validateRequired, firstError } from '../src/utils/validation';

/**
 * Step 2 of signup. Deliberately minimal: name, email, password, phone.
 * Professional/hospital/clinic detail is optional and lives on the profile
 * screen — asking for it before an account exists was the main drop-off point.
 */
export default function RegisterScreen() {
  const { role: paramRole } = useLocalSearchParams<{ role?: string }>();
  const role = (paramRole || 'healthcare_professional') as Role;

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [phone, setPhone] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const { register } = useAuth();
  const router = useRouter();
  const roleMeta = getRoleMeta(role);

  const nameLabel = role === 'hospital' ? 'Hospital name' : role === 'clinic' ? 'Clinic name' : 'Full name';
  const namePlaceholder =
    role === 'hospital' ? 'e.g. City General Hospital'
      : role === 'clinic' ? 'e.g. Sunrise Care Clinic'
        : 'e.g. Dr. Anita Sharma';

  const handleRegister = async () => {
    // Same rules the server enforces, so a valid-looking form can't 422.
    const problem = firstError(
      validateRequired(name, nameLabel),
      validateEmail(email),
      validatePassword(password),
      validatePhone(phone),
    );
    if (problem) { setError(problem); return; }

    setLoading(true);
    setError(null);
    try {
      const pending = await register({ email, password, name: name.trim(), role, phone });
      router.replace({
        pathname: '/verify',
        params: {
          verificationToken: pending.verification_token,
          email: pending.email,
          phone: pending.phone,
          phoneRequired: pending.phone_required ? '1' : '0',
          delivered: pending.delivered === false ? '0' : '1',
        },
      });
    } catch (e: any) {
      setError(e?.message || 'Registration failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.flex}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <TouchableOpacity
            testID="register-back-btn"
            style={styles.backBtn}
            onPress={() => router.back()}
            accessibilityRole="button"
            accessibilityLabel="Go back"
          >
            <Ionicons name="arrow-back" size={24} color={colors.navy} />
          </TouchableOpacity>

          <View style={[styles.roleBadge, { backgroundColor: `${roleMeta.color}15` }]}>
            <Ionicons name={roleMeta.icon} size={20} color={roleMeta.color} />
            <Text style={[styles.roleBadgeText, { color: roleMeta.color }]}>{roleMeta.longLabel}</Text>
          </View>

          <Text style={styles.title} accessibilityRole="header">Create account</Text>
          <Text style={styles.subtitle}>Just four details — you can add the rest later.</Text>

          <ErrorBanner message={error} />

          <FormInput
            testID="register-name-input"
            label={nameLabel}
            icon="person-outline"
            value={name}
            onChangeText={setName}
            placeholder={namePlaceholder}
            autoCapitalize="words"
            autoComplete="name"
            returnKeyType="next"
          />
          <FormInput
            testID="register-email-input"
            label="Email address"
            icon="mail-outline"
            value={email}
            onChangeText={setEmail}
            placeholder="you@example.com"
            keyboardType="email-address"
            autoCapitalize="none"
            autoComplete="email"
            returnKeyType="next"
          />
          <FormInput
            testID="register-phone-input"
            label="Phone number"
            icon="call-outline"
            value={phone}
            onChangeText={setPhone}
            placeholder="10-digit mobile number"
            keyboardType="phone-pad"
            autoComplete="tel"
            returnKeyType="next"
          />
          <FormInput
            testID="register-password-input"
            label="Password"
            icon="lock-closed-outline"
            value={password}
            onChangeText={setPassword}
            placeholder="At least 8 characters, with a number"
            autoCapitalize="none"
            autoComplete="new-password"
            secure
            returnKeyType="done"
            onSubmitEditing={handleRegister}
          />

          <Text style={styles.legal}>
            We&apos;ll send a code to your email to confirm it&apos;s you.
          </Text>

          <Button
            testID="register-submit-btn"
            label="Continue"
            onPress={handleRegister}
            loading={loading}
            accessibilityHint="Creates your account and sends a verification code"
          />

          <TouchableOpacity style={styles.linkBtn} onPress={() => router.replace('/login')} accessibilityRole="link">
            <Text style={styles.linkText}>
              Already registered? <Text style={styles.linkBold}>Sign in</Text>
            </Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.white },
  flex: { flex: 1 },
  scroll: { paddingHorizontal: spacing.xxl, paddingTop: spacing.lg, paddingBottom: spacing.xxxl + spacing.xxl },
  backBtn: {
    width: 44, height: 44, borderRadius: radius.lg, backgroundColor: colors.bgMuted,
    alignItems: 'center', justifyContent: 'center', marginBottom: spacing.xl,
  },
  roleBadge: {
    flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', gap: spacing.sm,
    paddingHorizontal: spacing.lg - 2, paddingVertical: spacing.sm, borderRadius: radius.pill,
    marginBottom: spacing.lg,
  },
  roleBadgeText: { ...typography.label },
  title: { ...typography.h1, color: colors.text, marginBottom: spacing.xs },
  subtitle: { ...typography.body, color: colors.textSecondary, marginBottom: spacing.xxl },
  legal: { ...typography.caption, color: colors.textMuted, marginBottom: spacing.lg },
  linkBtn: { alignItems: 'center', paddingVertical: spacing.md, marginTop: spacing.lg },
  linkText: { ...typography.body, color: colors.textSecondary },
  linkBold: { fontWeight: '700', color: colors.navy },
});
