import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, radius, spacing, typography } from '../../../theme';
import { useAuth } from '../../../context/AuthContext';
import { fetchApplicantResume } from '../../../api/applicants';
import { API_URL } from '../../../utils/api';
import { formatBytes } from '../ResumeCard';

/**
 * The applicant's resume, inside the workspace.
 *
 * The file is fetched through a five-minute signed link issued per request by
 * the Jobs API (manager-only, and recorded on the application's timeline); the
 * storage bucket itself is private. On the web the PDF renders in the
 * browser's own viewer, which brings zoom, page navigation, fullscreen and
 * download with it; on a phone it opens in the system viewer.
 */
export function ResumeViewer({ applicationId, available, name, size, height = 640 }: {
  applicationId: string; available: boolean; name: string; size: number; height?: number;
}) {
  const { token } = useAuth();
  const [url, setUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!token || !available) return null;
    setLoading(true); setError(null);
    try {
      const res = await fetchApplicantResume(token, applicationId);
      const full = res.url.startsWith('/') ? `${API_URL.replace(/\/$/, '')}${res.url}` : res.url;
      setUrl(full);
      return full;
    } catch {
      setError('Unable to load this resume. Please try again.');
      return null;
    } finally {
      setLoading(false);
    }
  }, [token, applicationId, available]);

  // Web previews inline, so the link is fetched when the panel shows it. A
  // phone has nowhere to embed it: nothing is fetched until they tap Open.
  useEffect(() => {
    setUrl(null);
    if (Platform.OS === 'web') load();
  }, [load]);

  // A signed link lasts five minutes, so each open asks for a fresh one.
  const open = async (download = false) => {
    const link = await load();
    if (!link) return;
    const target = download && link.includes('token=') ? `${link}&download=${encodeURIComponent(name || 'resume.pdf')}` : link;
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      if (download && !link.includes('token=')) {
        const a = document.createElement('a');
        a.href = link; a.download = name || 'resume.pdf'; a.rel = 'noopener';
        document.body.appendChild(a); a.click(); a.remove();
      } else {
        window.open(target, '_blank', 'noopener');
      }
    } else {
      const { Linking } = require('react-native'); // eslint-disable-line @typescript-eslint/no-require-imports
      Linking.openURL(target);
    }
  };

  if (!available) {
    return (
      <View style={styles.empty} testID="resume-none">
        <Ionicons name="document-outline" size={22} color={colors.textMuted} />
        <Text style={styles.emptyText}>No resume uploaded.</Text>
      </View>
    );
  }

  return (
    <View style={styles.wrap} testID="resume-viewer">
      <View style={styles.bar}>
        <Ionicons name="document-text" size={18} color={colors.navy} />
        <Text style={styles.name} numberOfLines={1}>{name || 'Resume.pdf'}</Text>
        {size ? <Text style={styles.size}>{formatBytes(size)}</Text> : null}
        <View style={{ flex: 1 }} />
        <Tool icon="open-outline" label="Open" onPress={() => open(false)} testID="resume-open" />
        <Tool icon="download-outline" label="Download" onPress={() => open(true)} testID="resume-download" />
      </View>
      {Platform.OS !== 'web' ? null : error ? (
        <View style={styles.empty}>
          <Text style={styles.errorText}>{error}</Text>
          <Pressable onPress={load} accessibilityRole="button" style={styles.retry}><Text style={styles.toolText}>Retry</Text></Pressable>
        </View>
      ) : loading || !url ? (
        <View style={[styles.frameBox, { height }]}><ActivityIndicator color={colors.navy} /></View>
      ) : (
        <View style={[styles.frameBox, { height }]}>
          {React.createElement('iframe', {
            src: `${url}#view=FitH`,
            title: `Resume: ${name}`,
            style: { width: '100%', height: '100%', border: 'none', borderRadius: 8, background: colors.white },
            'data-testid': 'resume-frame',
          })}
        </View>
      )}
    </View>
  );
}

function Tool({ icon, label, onPress, testID }: {
  icon: keyof typeof Ionicons.glyphMap; label: string; onPress: () => void; testID?: string;
}) {
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={`${label} resume`} testID={testID}
      style={({ pressed, hovered }: any) => [styles.tool, hovered && styles.toolHover, pressed && { opacity: 0.7 }]}>
      <Ionicons name={icon} size={16} color={colors.navy} />
      <Text style={styles.toolText}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.sm },
  bar: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, flexWrap: 'wrap' },
  name: { ...typography.label, color: colors.text, flexShrink: 1 },
  size: { ...typography.small, color: colors.textSecondary },
  tool: {
    flexDirection: 'row', alignItems: 'center', gap: 4, minHeight: 36, paddingHorizontal: spacing.md,
    borderRadius: radius.md, borderWidth: 1, borderColor: colors.border,
  },
  toolHover: { backgroundColor: colors.bgMuted },
  toolText: { ...typography.label, color: colors.navy },
  frameBox: {
    borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.bgMuted,
    overflow: 'hidden', alignItems: 'center', justifyContent: 'center',
  },
  empty: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm, padding: spacing.lg, borderRadius: radius.lg,
    borderWidth: 1, borderStyle: 'dashed', borderColor: colors.border, backgroundColor: colors.bg, flexWrap: 'wrap',
  },
  emptyText: { ...typography.body, color: colors.textSecondary },
  errorText: { ...typography.body, color: colors.redText },
  retry: { minHeight: 36, justifyContent: 'center', paddingHorizontal: spacing.md },
});
