import React, { useState } from 'react';
import { FormScrollView } from '../src/components/FormScrollView';
import { useFormErrors } from '../src/hooks/useFormErrors';
import { View, Text, KeyboardAvoidingView, Platform, ScrollView, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button, FormInput, ErrorBanner } from '../src/components';
import { colors, getRoleMeta } from '../src/theme';
import { validateEmail, validatePassword, validatePhone, validateRequired, firstError } from '../src/utils/validation';
import { AuthShell, AuthRow, AuthTopRow } from '../src/components/web';
import { registerRecruiter } from '../src/api/recruiters';
import { authStyles } from '../src/components/recruiters/authStyles';

/**
 * Recruiter signup. The account fields and email verification are the same as
 * every ForMeds account; the agency name is the one extra. Business, legal and
 * KYC detail comes after, inside the recruiter portal, where it can be saved
 * in stages.
 */
export default function RecruiterRegisterScreen() {
  const router = useRouter();
  const meta = getRoleMeta('recruiter');
  const [company, setCompany] = useState('');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const errs = useFormErrors<'company' | 'name' | 'email' | 'phone' | 'password'>({
    known: ['company', 'name', 'email', 'phone', 'password'],
    serverFields: { company_name: 'company' },
    codes: { email_taken: 'email', phone_taken: 'phone' },
  });
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    const valid = errs.check({
      company: validateRequired(company, 'Agency / company name'),
      name: validateRequired(name, 'Your full name'),
      email: validateEmail(email),
      phone: validatePhone(phone),
      password: validatePassword(password),
    });
    if (!valid || loading) return;
    setLoading(true);
    setError(null);
    try {
      const pending = await registerRecruiter({
        company_name: company.trim(), name: name.trim(), email: email.trim(), phone, password,
      });
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
      if (!errs.fromError(e)) setError(e?.message || 'Registration failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <AuthShell maxWidth={680}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.flex}>
          <FormScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
            <AuthTopRow>
            <TouchableOpacity testID="recruiter-register-back" style={[styles.backBtn, { marginBottom: 0 }]} onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))}
              accessibilityRole="button" accessibilityLabel="Go back">
              <Ionicons name="arrow-back" size={24} color={colors.navy} />
            </TouchableOpacity>

            <View style={[styles.badge, { marginBottom: 0 }, { backgroundColor: meta.bg }]}>
              <Ionicons name={meta.icon} size={18} color={meta.color} />
              <Text style={[styles.badgeText, { color: meta.color }]}>For recruiters & agencies</Text>
            </View>
            </AuthTopRow>
            <Text style={styles.title} accessibilityRole="header">Create a recruiter account</Text>
            <Text style={styles.subtitle}>
              Post jobs and locum shifts for your clients, and reach professionals who have chosen to be found.
              Every recruiter is verified before going live.
            </Text>

            <ErrorBanner message={error} />

          <AuthRow>
            <FormInput maxLength={140} testID="recruiter-company-input" label="Agency / company name" icon="business-outline"
              value={company} onChangeText={v => { setCompany(v); errs.clear('company'); }}
              error={errs.fields.company} placeholder="e.g. CarePlus Staffing" autoCapitalize="words" />
            <FormInput maxLength={120} testID="recruiter-name-input" label="Your full name" icon="person-outline"
              value={name} onChangeText={v => { setName(v); errs.clear('name'); }}
              error={errs.fields.name} placeholder="e.g. Riya Sharma" autoCapitalize="words" autoComplete="name" />
          </AuthRow>
          <AuthRow>
            <FormInput maxLength={200} testID="recruiter-email-input" label="Work email" icon="mail-outline" value={email}
              onChangeText={v => { setEmail(v); errs.clear('email'); }}
              error={errs.fields.email} placeholder="you@agency.com" keyboardType="email-address"
              autoCapitalize="none" autoComplete="email" />
            <FormInput maxLength={16} testID="recruiter-phone-input" label="Phone number" icon="call-outline" value={phone}
              onChangeText={v => { setPhone(v); errs.clear('phone'); }}
              error={errs.fields.phone} placeholder="10-digit mobile number" keyboardType="phone-pad" autoComplete="tel" />
          </AuthRow>
            <FormInput testID="recruiter-password-input" label="Password" icon="lock-closed-outline" value={password}
              onChangeText={v => { setPassword(v); errs.clear('password'); }}
              error={errs.fields.password} placeholder="8+ characters, with a number" autoCapitalize="none"
              autoComplete="new-password" secure returnKeyType="done" onSubmitEditing={submit} />

            <Button testID="recruiter-register-submit" label="Continue" loadingLabel="Creating account…" onPress={submit} loading={loading}
              accessibilityHint="Creates your recruiter account and sends a verification code" />

            <TouchableOpacity style={styles.linkBtn} onPress={() => router.replace('/recruiter-login')} accessibilityRole="link">
              <Text style={styles.linkText}>Already a recruiter? <Text style={styles.linkBold}>Sign in</Text></Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.linkBtnSmall} onPress={() => router.replace('/')} accessibilityRole="link">
              <Text style={styles.linkSmall}>Healthcare professional, hospital or clinic? Join here</Text>
            </TouchableOpacity>
          </FormScrollView>
        </KeyboardAvoidingView>
      </AuthShell>
    </SafeAreaView>
  );
}

const styles = authStyles;
