import React, { useState } from 'react';
import { FormScrollView } from '../src/components/FormScrollView';
import { useSubmit } from '../src/hooks/useSubmit';
import { useFormErrors } from '../src/hooks/useFormErrors';
import { FieldError } from '../src/components/FieldError';
import { ApiError } from '../src/utils/api';
import { View, Text, StyleSheet, ScrollView, KeyboardAvoidingView, Platform, TouchableOpacity, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useAuth } from '../src/context/AuthContext';
import { useKycStatus } from '../src/hooks/useKycStatus';
import { API_URL, detailToMessage } from '../src/utils/api';
import { Button, FormInput, ErrorBanner, LoadingState, ScreenHeader } from '../src/components';
import { colors, radius, spacing, typography } from '../src/theme';
import { validateRequired, firstError } from '../src/utils/validation';
import { appendFile } from '../src/utils/upload';
import { PageColumn } from '../src/components/web';
import {
  StudentEducationFields, validateEducation, type EducationField, type StudentEducation,
} from '../src/components/students/StudentEducationFields';

const MAX_DOCUMENT_BYTES = 10 * 1024 * 1024; // mirrors services/files.py

interface PickedDocument {
  uri: string;
  name: string;
  mimeType: string;
  size?: number;
}

/**
 * Verification (KYC). Shown right after first sign-in and reachable from
 * Settings. Approval is always manual — nothing here can self-approve.
 *
 * A professional sends a registration certificate; an organisation its
 * facility registration; a student their college ID with their education,
 * which is where a student's course and college are first captured.
 */
export default function KycScreen() {
  const { user, token } = useAuth();
  const { state, loading, refresh } = useKycStatus();
  const router = useRouter();

  const isProfessional = user?.role === 'healthcare_professional';
  const isStudent = user?.role === 'student';
  const [education, setEducation] = useState<StudentEducation>({
    course: user?.student_course ?? '',
    institution: user?.student_institution ?? '',
    university: user?.student_university ?? '',
    current_year: user?.student_year ? String(user.student_year) : '',
    graduation_year: user?.graduation_year ? String(user.graduation_year) : '',
  });
  const [registrationNumber, setRegistrationNumber] = useState('');
  const [stateCouncil, setStateCouncil] = useState('');
  const [document, setDocument] = useState<PickedDocument | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { submitting, run } = useSubmit();
  const errs = useFormErrors<'number' | 'council' | 'document' | EducationField>({
    known: ['number', 'council', 'document', 'course', 'institution', 'current_year', 'graduation_year'],
    serverFields: { registration_number: 'number', state_council: 'council', document: 'document' },
  });

  const docLabel = isStudent ? 'College ID card or bonafide certificate'
    : isProfessional ? 'Medical registration certificate'
      : 'Facility registration certificate';
  const numberLabel = isStudent ? 'Enrolment / roll number'
    : isProfessional ? 'Medical registration number' : 'Registration / ROHINI ID';

  const pickDocument = async () => {
    setError(null);
    errs.clear('document');
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      setError(`Photo access is needed to attach your ${isStudent ? 'college ID' : 'certificate'}. Enable it in Settings.`);
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.8,
    });
    if (result.canceled || !result.assets?.length) return;

    const asset = result.assets[0];
    // Reject oversize files here rather than after a slow failed upload.
    if (asset.fileSize && asset.fileSize > MAX_DOCUMENT_BYTES) {
      setError('That file is larger than 10MB. Please attach a smaller photo.');
      return;
    }
    setDocument({
      uri: asset.uri,
      name: asset.fileName || 'certificate.jpg',
      mimeType: asset.mimeType || 'image/jpeg',
      size: asset.fileSize,
    });
  };

  const submit = () => {
    const valid = errs.check({
      number: validateRequired(registrationNumber, numberLabel),
      council: isProfessional ? validateRequired(stateCouncil, 'State medical council') : null,
      document: document ? null : isStudent ? 'Attach your college ID card or bonafide certificate.' : 'Attach your registration certificate.',
      ...(isStudent ? validateEducation(education) : {}),
    });
    if (!valid) return;
    // One submission per press; a retry of the same documents reuses its key.
    return run(key => send(key), { registrationNumber, stateCouncil, doc: document?.uri, education });
  };

  const send = async (key: string) => {
    setError(null);
    try {
      const form = new FormData();
      form.append('registration_number', registrationNumber.trim());
      if (isProfessional) form.append('state_council', stateCouncil.trim());
      if (isStudent) {
        form.append('course', education.course);
        form.append('institution', education.institution.trim());
        if (education.university.trim()) form.append('university', education.university.trim());
        form.append('current_year', education.current_year);
        form.append('graduation_year', education.graduation_year);
      }
      // Platform-correct: a browser's FormData stringifies the React Native
      // { uri, name, type } descriptor into "[object Object]", which the API
      // rejects as `Expected UploadFile, received: <class 'str'>`.
      await appendFile(form, 'document', document!);

      // Sent with fetch rather than apiFetch: React Native must set its own
      // multipart boundary, which apiFetch's JSON default would clobber.
      const res = await fetch(`${API_URL}/api/kyc/submit`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Idempotency-Key': key },
        body: form,
      });
      const body = await res.json().catch(() => null);
      if (!res.ok) {
        throw new ApiError(detailToMessage(body, 'Could not submit your document.'), res.status, body);
      }
      await refresh();
    } catch (e: any) {
      // A refused registration number goes under that field; anything else here.
      if (!errs.fromError(e)) setError(e?.message || 'Could not submit your document. Please try again.');
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <ScreenHeader title="Verification" />
        <LoadingState label="Checking your verification status…" />
      </SafeAreaView>
    );
  }

  const status = state?.status ?? 'not_submitted';

  if (status === 'approved') {
    return (
      <StatusScreen
        icon="shield-checkmark"
        tone={colors.teal}
        title="You're verified"
        body={isStudent
          ? 'Your student status has been confirmed. You can apply to internships and roles open to students.'
          : 'Your registration has been approved. You have full access to ForMeds.'}
        actionLabel="Continue"
        onAction={() => router.replace('/(tabs)/community')}
      />
    );
  }

  if (status === 'pending') {
    return (
      <StatusScreen
        icon="hourglass-outline"
        tone={colors.warning}
        title="Under review"
        body={isStudent
          ? "Our team is checking your college ID. This usually takes 1–2 working days. You can keep exploring ForMeds while you wait — applying to internships unlocks once you're approved."
          : "Our team is checking your certificate. This usually takes 1–2 working days. You can keep exploring ForMeds while you wait — posting and job applications unlock once you're approved."}
        actionLabel="Explore ForMeds"
        onAction={() => router.replace('/(tabs)/community')}
      />
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <PageColumn maxWidth={640} testID="kyc-column">
      <ScreenHeader title="Verification" onBack={() => router.replace('/(tabs)/community')} />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.flex}>
        <FormScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          {status === 'rejected' && state?.reject_reason ? (
            <View style={styles.rejected} accessibilityRole="alert">
              <Ionicons name="close-circle" size={20} color={colors.red} />
              <View style={styles.flex}>
                <Text style={styles.rejectedTitle}>Previous submission rejected</Text>
                <Text style={styles.rejectedReason}>{state.reject_reason}</Text>
              </View>
            </View>
          ) : null}

          <Text style={styles.lead}>
            {isStudent
              ? 'Confirm you are a student: add your course and college, then upload your college ID card or bonafide certificate. A reviewer checks every document by hand.'
              : isProfessional
                ? 'Upload the medical registration certificate that authorises you to practise in India. A reviewer checks every document by hand.'
                : 'Upload the registration certificate for your facility. A reviewer checks every document by hand.'}
          </Text>

          <ErrorBanner message={error} />

          {isStudent ? (
            <StudentEducationFields
              value={education}
              onChange={(field, v) => { setEducation(e => ({ ...e, [field]: v })); errs.clear(field as EducationField); }}
              errors={errs.fields}
              testIDPrefix="kyc-student"
            />
          ) : null}

          <FormInput
            testID="kyc-number-input"
            label={numberLabel}
            icon="document-text-outline"
            value={registrationNumber}
            onChangeText={v => { setRegistrationNumber(v); errs.clear('number'); }}
            error={errs.fields.number}
            placeholder={isStudent ? 'e.g. 21MBBS0042' : isProfessional ? 'e.g. MH-12345' : 'e.g. 1234567890123'}
            autoCapitalize="characters"
            maxLength={80}
          />

          {isProfessional ? (
            <FormInput
              testID="kyc-council-input"
              label="State medical council"
              icon="business-outline"
              value={stateCouncil}
              onChangeText={v => { setStateCouncil(v); errs.clear('council'); }}
              error={errs.fields.council}
              placeholder="e.g. Maharashtra Medical Council"
              autoCapitalize="words"
              maxLength={120}
            />
          ) : null}

          <Text style={styles.label}>{docLabel}</Text>
          <TouchableOpacity
            testID="kyc-document-picker"
            style={styles.picker}
            onPress={pickDocument}
            accessibilityRole="button"
            accessibilityLabel={document ? `Change attached ${isStudent ? 'document' : 'certificate'}` : `Attach your ${isStudent ? 'college ID' : 'certificate'}`}
          >
            {document ? (
              <>
                <Image source={{ uri: document.uri }} style={styles.thumb} />
                <View style={styles.flex}>
                  <Text style={styles.fileName} numberOfLines={1}>{document.name}</Text>
                  <Text style={styles.fileHint}>Tap to choose a different file</Text>
                </View>
                <Ionicons name="checkmark-circle" size={22} color={colors.teal} />
              </>
            ) : (
              <>
                <Ionicons name="cloud-upload-outline" size={24} color={colors.textMuted} />
                <View style={styles.flex}>
                  <Text style={styles.fileName}>{isStudent ? 'Attach college ID' : 'Attach certificate'}</Text>
                  <Text style={styles.fileHint}>Photo or scan, up to 10MB</Text>
                </View>
              </>
            )}
          </TouchableOpacity>

          <FieldError message={errs.fields.document} />

          <Text style={styles.privacy}>
            Your document is stored privately and is only visible to our verification team.
          </Text>

          <Button
            testID="kyc-submit-btn"
            label={status === 'rejected' ? 'Resubmit for review' : 'Submit for review'}
            loadingLabel="Submitting…"
            onPress={submit}
            loading={submitting}
          />

          <TouchableOpacity
            testID="kyc-skip-btn"
            style={styles.skip}
            onPress={() => router.replace('/(tabs)/community')}
            accessibilityRole="button"
          >
            <Text style={styles.skipText}>I&apos;ll do this later</Text>
          </TouchableOpacity>
        </FormScrollView>
      </KeyboardAvoidingView>
      </PageColumn>
    </SafeAreaView>
  );
}

function StatusScreen({
  icon, tone, title, body, actionLabel, onAction,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  tone: string;
  title: string;
  body: string;
  actionLabel: string;
  onAction: () => void;
}) {
  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <PageColumn maxWidth={640} testID="kyc-status-column">
      <ScreenHeader title="Verification" onBack={onAction} />
      <View style={styles.statusWrap}>
        <View style={[styles.statusIcon, { backgroundColor: `${tone}15` }]}>
          <Ionicons name={icon} size={40} color={tone} />
        </View>
        <Text style={styles.statusTitle} accessibilityRole="header">{title}</Text>
        <Text style={styles.statusBody}>{body}</Text>
        <Button label={actionLabel} onPress={onAction} style={styles.statusAction} />
      </View>
      </PageColumn>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.white },
  flex: { flex: 1 },
  scroll: { padding: spacing.xxl, paddingBottom: spacing.xxxl + spacing.xl },
  lead: { ...typography.body, color: colors.textSecondary, lineHeight: 22, marginBottom: spacing.xl },
  label: { ...typography.label, color: colors.textBody, marginBottom: 6 },
  picker: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.md,
    backgroundColor: colors.bg, borderRadius: radius.lg, borderWidth: 1,
    borderColor: colors.border, borderStyle: 'dashed', padding: spacing.lg, minHeight: 72,
  },
  thumb: { width: 44, height: 44, borderRadius: radius.sm, backgroundColor: colors.bgMuted },
  fileName: { ...typography.bodyStrong, color: colors.text },
  fileHint: { ...typography.caption, color: colors.textMuted, marginTop: 2 },
  privacy: { ...typography.caption, color: colors.textMuted, marginTop: spacing.md, marginBottom: spacing.xl },
  rejected: {
    flexDirection: 'row', gap: spacing.md, alignItems: 'flex-start',
    backgroundColor: colors.redBg, borderRadius: radius.lg, padding: spacing.lg, marginBottom: spacing.xl,
  },
  rejectedTitle: { ...typography.bodyStrong, color: colors.red },
  rejectedReason: { ...typography.caption, color: colors.textSecondary, marginTop: 2 },
  skip: { alignItems: 'center', paddingVertical: spacing.lg, minHeight: 44 },
  skipText: { ...typography.body, color: colors.textSecondary },
  statusWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: spacing.xxxl, gap: spacing.md },
  statusIcon: { width: 88, height: 88, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center' },
  statusTitle: { ...typography.h2, color: colors.text, marginTop: spacing.sm },
  statusBody: { ...typography.body, color: colors.textSecondary, textAlign: 'center', lineHeight: 22 },
  statusAction: { marginTop: spacing.lg, alignSelf: 'stretch' },
});
