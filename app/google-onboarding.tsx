import React, { useState } from 'react';
import { FormScrollView } from '../src/components/FormScrollView';
import { FieldError } from '../src/components/FieldError';
import { useFormErrors } from '../src/hooks/useFormErrors';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button, ErrorBanner, FormInput } from '../src/components';
import { AuthShell } from '../src/components/web';
import { ChoiceChips } from '../src/components/locum/ChoiceChips';
import { colors, radius, spacing, typography, ROLE_META } from '../src/theme';
import type { Role } from '../src/theme';
import { PROFESSIONAL_ROLES } from '../src/data/specialties';
import { firstError, validatePhone, validateRequired } from '../src/utils/validation';
import {
  clearPendingGoogleSignup, completeGoogleSignup, pendingGoogleSignup, useGoogleResultRouter,
} from '../src/components/auth/useGoogleSignIn';
import {
  EMPTY_EDUCATION, StudentEducationFields, educationPayload, validateEducation,
  type EducationField, type StudentEducation,
} from '../src/components/students/StudentEducationFields';

// The same roles email signup offers. Recruiters have their own signup with
// its own verification; the server refuses any other role anyway.
const ROLES: Role[] = ['healthcare_professional', 'student', 'hospital', 'clinic'];

/**
 * The rest of signup for someone new who came in through Google.
 *
 * Google told us who they are and that they own their email. It did not tell
 * us what they do -- so they say, exactly as email signup asks -- and it is
 * not a medical registration: professional verification (KYC) comes next, the
 * same as for everyone.
 */
export default function GoogleOnboardingScreen() {
  const router = useRouter();
  const route = useGoogleResultRouter();
  // Read once: finishing signup clears the shared ticket, and this screen must
  // not flash "start again" in the moment before it navigates away.
  const [pending] = useState(pendingGoogleSignup);
  const hinted = ROLES.includes(pending?.roleHint as Role) ? (pending!.roleHint as Role) : null;
  const [role, setRole] = useState<Role | null>(hinted);
  const [professionalRole, setProfessionalRole] = useState<string | null>(null);
  const [name, setName] = useState(pending?.name ?? '');
  const [phone, setPhone] = useState('');
  const [usePhoto, setUsePhoto] = useState(!!pending?.photo_available);
  const [error, setError] = useState<string | null>(null);
  const [education, setEducation] = useState<StudentEducation>(EMPTY_EDUCATION);
  const errs = useFormErrors<'role' | 'name' | 'phone' | EducationField>({
    known: ['role', 'name', 'phone', 'course', 'institution', 'current_year', 'graduation_year'],
    codes: { phone_taken: 'phone' },
  });
  const [loading, setLoading] = useState(false);

  if (!pending) {
    return (
      <SafeAreaView style={styles.safe}>
        <AuthShell maxWidth={480}>
          <View style={styles.center}>
            <Ionicons name="time-outline" size={48} color={colors.textMuted} />
            <Text style={styles.title}>Let&apos;s start again</Text>
            <Text style={styles.subtitle}>Your Google sign-up was interrupted. Continue with Google once more.</Text>
            <Button label="Back to sign up" onPress={() => router.replace('/register')} />
          </View>
        </AuthShell>
      </SafeAreaView>
    );
  }

  const nameLabel = role === 'hospital' ? 'Hospital name' : role === 'clinic' ? 'Clinic name' : 'Full name';

  const submit = async () => {
    const valid = errs.check({
      role: role ? null : 'Choose what best describes you.',
      name: validateRequired(name, nameLabel),
      phone: validatePhone(phone),
      ...(role === 'student' ? validateEducation(education) : {}),
    });
    if (!valid || loading) return;
    setLoading(true);
    setError(null);
    try {
      const result = await completeGoogleSignup({
        signup_token: pending.signup_token,
        role: role!,
        name: name.trim(),
        phone,
        professional_role: role === 'healthcare_professional' ? professionalRole ?? undefined : undefined,
        use_google_photo: usePhoto,
        ...(role === 'student' ? educationPayload(education) : {}),
      });
      await route(result);
    } catch (e: any) {
      if (e?.code === 'google_signup_expired') clearPendingGoogleSignup();
      if (!errs.fromError(e)) setError(e?.message || 'Could not create your account. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <AuthShell maxWidth={520}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.flex}>
          <FormScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
            <View style={styles.googleRow}>
              <Ionicons name="logo-google" size={16} color={colors.textSecondary} />
              <Text style={styles.googleText} testID="google-onboarding-email">Signed in as {pending.email}</Text>
            </View>
            <Text style={styles.title} accessibilityRole="header">Finish creating your account</Text>
            <Text style={styles.subtitle}>A few details so ForMeds can set you up.</Text>

            <ErrorBanner message={error} />

            <Text style={styles.label}>What best describes you?</Text>
            <View style={styles.roles} accessibilityRole="radiogroup">
              {ROLES.map(r => {
                const meta = ROLE_META[r];
                const selected = role === r;
                return (
                  <Pressable key={r} onPress={() => setRole(r)} accessibilityRole="radio"
                    accessibilityState={{ selected }} testID={`google-role-${r}`}
                    style={[styles.roleCard, selected && { borderColor: meta.color, backgroundColor: meta.bg }]}>
                    <Ionicons name={meta.icon} size={20} color={meta.color} />
                    <View style={styles.flex}>
                      <Text style={styles.roleTitle}>{meta.longLabel}</Text>
                      <Text style={styles.roleDesc} numberOfLines={2}>{meta.description}</Text>
                    </View>
                    <Ionicons name={selected ? 'radio-button-on' : 'radio-button-off'} size={20}
                      color={selected ? meta.color : colors.textMuted} />
                  </Pressable>
                );
              })}
            </View>

            {role === 'healthcare_professional' ? (
              <ChoiceChips label="Your profession (optional)" allowDeselect value={professionalRole}
                onChange={setProfessionalRole} testID="google-profession"
                choices={PROFESSIONAL_ROLES.map(p => ({ value: p, label: p }))} />
            ) : null}

            {role === 'student' ? (
              <StudentEducationFields
                value={education}
                onChange={(field, v) => { setEducation(e => ({ ...e, [field]: v })); errs.clear(field); }}
                errors={errs.fields}
                testIDPrefix="google-student"
              />
            ) : null}

            <FieldError message={errs.fields.role} />
            <FormInput maxLength={120} testID="google-name-input" label={nameLabel} icon="person-outline"
              value={name} onChangeText={v => { setName(v); errs.clear('name'); }}
              error={errs.fields.name} autoCapitalize="words" />
            <FormInput maxLength={16} testID="google-phone-input" label="Phone number" icon="call-outline"
              value={phone} onChangeText={v => { setPhone(v); errs.clear('phone'); }}
              error={errs.fields.phone} placeholder="10-digit mobile number"
              keyboardType="phone-pad" autoComplete="tel" />

            {pending.photo_available ? (
              <View style={styles.switchRow}>
                <Text style={[styles.roleDesc, styles.flex]}>Use my Google profile photo (you can change it later)</Text>
                <Switch value={usePhoto} onValueChange={setUsePhoto} testID="google-use-photo"
                  accessibilityLabel="Use my Google profile photo" />
              </View>
            ) : null}

            <Text style={styles.note}>
              {role === 'healthcare_professional'
                ? 'Next, verify your medical or nursing registration. Signing in with Google does not verify your professional credentials.'
                : role === 'student'
                  ? 'You can browse and apply for jobs and internships open to students straight away.'
                  : 'Next, verify your organisation. Signing in with Google does not verify it.'}
              {pending.phone_required ? ' We will also text a code to confirm your phone.' : ''}
            </Text>

            <Button testID="google-onboarding-submit" label="Create account" loadingLabel="Creating account…" onPress={submit} loading={loading} />
          </FormScrollView>
        </KeyboardAvoidingView>
      </AuthShell>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.white },
  flex: { flex: 1 },
  scroll: { paddingHorizontal: spacing.xxl, paddingTop: spacing.xl, paddingBottom: spacing.xxxl, gap: spacing.md },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.md, padding: spacing.xxl },
  googleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  googleText: { ...typography.caption, color: colors.textSecondary },
  title: { ...typography.h1, color: colors.text },
  subtitle: { ...typography.body, color: colors.textSecondary },
  label: { ...typography.label, color: colors.text },
  roles: { gap: spacing.sm },
  roleCard: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.md,
    borderRadius: radius.lg, borderWidth: 1.5, borderColor: colors.border, minHeight: 56,
  },
  roleTitle: { ...typography.bodyStrong, color: colors.text },
  roleDesc: { ...typography.caption, color: colors.textSecondary },
  switchRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  note: { ...typography.caption, color: colors.textSecondary, lineHeight: 19 },
});
