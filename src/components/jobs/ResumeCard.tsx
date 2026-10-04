import React, { useCallback, useEffect, useState } from 'react';
import { Linking, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import { colors, radius, spacing, typography } from '../../theme';
import { useAuth } from '../../context/AuthContext';
import { ErrorBanner } from '../States';
import { deleteMyResume, fetchMyResume, fetchMyResumeUrl, uploadResume } from '../../api/applicants';
import { API_URL } from '../../utils/api';
import type { MyResume } from '../../types/applicants';

const MAX_BYTES = 5 * 1024 * 1024;

export function formatBytes(n: number): string {
  if (!n) return '';
  return n < 1024 * 1024 ? `${Math.max(1, Math.round(n / 1024))} KB` : `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

/** Open a signed file link: a new tab on the web, the system viewer on a phone. */
export function openFileUrl(url: string) {
  const full = url.startsWith('/') ? `${API_URL.replace(/\/$/, '')}${url}` : url;
  if (Platform.OS === 'web' && typeof window !== 'undefined') window.open(full, '_blank', 'noopener');
  else Linking.openURL(full);
}

/**
 * The professional's resume: one PDF, kept on their account and attached to
 * the applications they choose. Replacing it never changes what an employer
 * already received -- said here, because it is the first thing people worry
 * about.
 */
export function ResumeCard({ onChange, compact = false }: { onChange?: (r: MyResume) => void; compact?: boolean }) {
  const { token } = useAuth();
  const [resume, setResume] = useState<MyResume | null>(null);
  const [busy, setBusy] = useState<'upload' | 'remove' | 'open' | null>(null);
  const [error, setError] = useState<string | null>(null);

  const apply = useCallback((r: MyResume) => { setResume(r); onChange?.(r); }, [onChange]);

  useEffect(() => {
    if (!token) return;
    fetchMyResume(token).then(apply).catch(() => apply({ has_resume: false, name: '', size: 0 }));
  }, [token, apply]);

  const pick = async () => {
    if (!token) return;
    setError(null);
    const res = await DocumentPicker.getDocumentAsync({ type: ['application/pdf'], copyToCacheDirectory: true });
    if (res.canceled || !res.assets?.length) return;
    const file = res.assets[0];
    if (file.size && file.size > MAX_BYTES) { setError('Resume must be 5MB or smaller.'); return; }
    if (file.name && !/\.pdf$/i.test(file.name)) { setError('Upload your resume as a PDF.'); return; }
    setBusy('upload');
    try { apply(await uploadResume(token, { uri: file.uri, name: file.name, mimeType: file.mimeType })); } catch (e: any) {
      setError(e?.message || 'Could not upload your resume. Please try again.');
    } finally { setBusy(null); }
  };

  const remove = async () => {
    if (!token) return;
    setBusy('remove');
    try { apply(await deleteMyResume(token)); } catch (e: any) { setError(e?.message || 'Could not remove it.'); } finally { setBusy(null); }
  };

  const view = async () => {
    if (!token) return;
    setBusy('open');
    try { openFileUrl((await fetchMyResumeUrl(token)).url); } catch {
      setError('Unable to open your resume. Please try again.');
    } finally { setBusy(null); }
  };

  if (!resume) return <View style={[styles.card, styles.loading]} />;

  return (
    <View style={styles.card} testID="resume-card">
      <View style={styles.row}>
        <View style={[styles.icon, resume.has_resume ? styles.iconOn : null]}>
          <Ionicons name={resume.has_resume ? 'document-text' : 'document-outline'} size={20}
            color={resume.has_resume ? colors.navy : colors.textMuted} />
        </View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={styles.title}>Resume</Text>
          <Text style={styles.sub} numberOfLines={1} testID="resume-name">
            {resume.has_resume
              ? [resume.name, formatBytes(resume.size)].filter(Boolean).join(' · ')
              : 'No resume uploaded · PDF, up to 5MB'}
          </Text>
        </View>
      </View>
      <View style={styles.actions}>
        <Action label={busy === 'upload' ? 'Uploading…' : resume.has_resume ? 'Replace' : 'Upload PDF'}
          icon="cloud-upload-outline" onPress={pick} disabled={!!busy} testID="resume-upload" />
        {resume.has_resume ? (
          <>
            <Action label={busy === 'open' ? 'Opening…' : 'View'} icon="eye-outline" onPress={view} disabled={!!busy}
              testID="resume-view" />
            <Action label={busy === 'remove' ? 'Removing…' : 'Remove'} icon="trash-outline" danger onPress={remove}
              disabled={!!busy} testID="resume-remove" />
          </>
        ) : null}
      </View>
      {!compact && resume.has_resume ? (
        <Text style={styles.note}>Replacing it only affects future applications; employers keep the version you sent them.</Text>
      ) : null}
      <ErrorBanner message={error} />
    </View>
  );
}

function Action({ label, icon, onPress, disabled, danger, testID }: {
  label: string; icon: keyof typeof Ionicons.glyphMap; onPress: () => void; disabled?: boolean; danger?: boolean; testID?: string;
}) {
  return (
    <Pressable onPress={onPress} disabled={disabled} accessibilityRole="button" accessibilityLabel={label} testID={testID}
      style={({ pressed }) => [styles.action, (pressed || disabled) && { opacity: 0.6 }]}>
      <Ionicons name={icon} size={16} color={danger ? colors.redText : colors.navy} />
      <Text style={[styles.actionText, danger && { color: colors.redText }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg, backgroundColor: colors.white,
    padding: spacing.lg, gap: spacing.md,
  },
  loading: { minHeight: 96, backgroundColor: colors.bgMuted, borderColor: colors.bgMuted },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  icon: {
    width: 40, height: 40, borderRadius: radius.md, backgroundColor: colors.bgMuted, alignItems: 'center', justifyContent: 'center',
  },
  iconOn: { backgroundColor: colors.tintBg },
  title: { ...typography.bodyStrong, color: colors.text },
  sub: { ...typography.caption, color: colors.textSecondary },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  action: {
    flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 40, paddingHorizontal: spacing.md,
    borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.white,
  },
  actionText: { ...typography.label, color: colors.navy },
  note: { ...typography.small, color: colors.textSecondary },
});
