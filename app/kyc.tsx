import React, { useState } from 'react';
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

const MAX_DOCUMENT_BYTES = 10 * 1024 * 1024; // mirrors services/files.py

interface PickedDocument {
  uri: string;
  name: string;
  mimeType: string;
  size?: number;
}

/**
 * Professional verification (KYC). Shown right after first sign-in and reachable
 * from Settings. Approval is always manual — nothing here can self-approve.
 */
export default function KycScreen() {
  const { user, token } = useAuth();
  const { state, loading, refresh } = useKycStatus();
  const router = useRouter();

  const isProfessional = user?.role === 'healthcare_professional';
  const [registrationNumber, setRegistrationNumber] = useState('');
  const [stateCouncil, setStateCouncil] = useState('');
  const [document, setDocument] = useState<PickedDocument | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const docLabel = isProfessional
    ? 'Medical registration certificate'
    : 'Facility registration certificate';
  const numberLabel = isProfessional ? 'Medical registration number' : 'Registration / ROHINI ID';

  const pickDocument = async () => {
    setError(null);
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      setError('Photo access is needed to attach your certificate. Enable it in Settings.');
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

  const submit = async () => {
    const problem = firstError(
      validateRequired(registrationNumber, numberLabel),
      isProfessional ? validateRequired(stateCouncil, 'State medical council') : null,
      document ? null : 'Attach your registration certificate',
    );
    if (problem) { setError(problem); return; }

    setSubmitting(true);
    setError(null);
    try {
      const form = new FormData();
      form.append('registration_number', registrationNumber.trim());
      if (isProfessional) form.append('state_council', stateCouncil.trim());
      form.append('document', {
        uri: document!.uri,
        name: document!.name,
        type: document!.mimeType,
      } as any);

      // Sent with fetch rather than apiFetch: React Native must set its own
      // multipart boundary, which apiFetch's JSON default would clobber.
      const res = await fetch(`${API_URL}/api/kyc/submit`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: form,
      });
      const body = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error(detailToMessage(body, 'Could not submit your document.'));
      }
      await refresh();
    } catch (e: any) {
      setError(e?.message || 'Could not submit your document. Please try again.');
    } finally {
      setSubmitting(false);
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
        body="Your registration has been approved. You have full access to ForMeds."
        actionLabel="Continue"
        onAction={() => router.replace('/(tabs)/feed')}
      />
    );
  }

  if (status === 'pending') {
    return (
      <StatusScreen
        icon="hourglass-outline"
        tone={colors.warning}
        title="Under review"
        body="Our team is checking your certificate. This usually takes 1–2 working days. You can keep exploring ForMeds while you wait — posting and job applications unlock once you're approved."
        actionLabel="Explore ForMeds"
        onAction={() => router.replace('/(tabs)/feed')}
      />
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScreenHeader title="Verification" onBack={() => router.replace('/(tabs)/feed')} />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.flex}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
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
            {isProfessional
              ? 'Upload the medical registration certificate that authorises you to practise in India. A reviewer checks every document by hand.'
              : 'Upload the registration certificate for your facility. A reviewer checks every document by hand.'}
          </Text>

          <ErrorBanner message={error} />

          <FormInput
            testID="kyc-number-input"
            label={numberLabel}
            icon="document-text-outline"
            value={registrationNumber}
            onChangeText={setRegistrationNumber}
            placeholder={isProfessional ? 'e.g. MH-12345' : 'e.g. 1234567890123'}
            autoCapitalize="characters"
          />

          {isProfessional ? (
            <FormInput
              testID="kyc-council-input"
              label="State medical council"
              icon="business-outline"
              value={stateCouncil}
              onChangeText={setStateCouncil}
              placeholder="e.g. Maharashtra Medical Council"
              autoCapitalize="words"
            />
          ) : null}

          <Text style={styles.label}>{docLabel}</Text>
          <TouchableOpacity
            testID="kyc-document-picker"
            style={styles.picker}
            onPress={pickDocument}
            accessibilityRole="button"
            accessibilityLabel={document ? 'Change attached certificate' : 'Attach your certificate'}
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
                  <Text style={styles.fileName}>Attach certificate</Text>
                  <Text style={styles.fileHint}>Photo or scan, up to 10MB</Text>
                </View>
              </>
            )}
          </TouchableOpacity>

          <Text style={styles.privacy}>
            Your document is stored privately and is only visible to our verification team.
          </Text>

          <Button
            testID="kyc-submit-btn"
            label={status === 'rejected' ? 'Resubmit for review' : 'Submit for review'}
            onPress={submit}
            loading={submitting}
          />

          <TouchableOpacity
            testID="kyc-skip-btn"
            style={styles.skip}
            onPress={() => router.replace('/(tabs)/feed')}
            accessibilityRole="button"
          >
            <Text style={styles.skipText}>I&apos;ll do this later</Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
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
      <ScreenHeader title="Verification" onBack={onAction} />
      <View style={styles.statusWrap}>
        <View style={[styles.statusIcon, { backgroundColor: `${tone}15` }]}>
          <Ionicons name={icon} size={40} color={tone} />
        </View>
        <Text style={styles.statusTitle} accessibilityRole="header">{title}</Text>
        <Text style={styles.statusBody}>{body}</Text>
        <Button label={actionLabel} onPress={onAction} style={styles.statusAction} />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.white },
  flex: { flex: 1 },
  scroll: { padding: spacing.xxl, paddingBottom: spacing.xxxl + spacing.xl },
  lead: { ...typography.body, color: colors.textSecondary, lineHeight: 22, marginBottom: spacing.xl },
  label: { ...typography.label, color: '#334155', marginBottom: 6 },
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
