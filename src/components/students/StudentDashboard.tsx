import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { colors, radius, spacing, typography, fonts } from '../../theme';
import { useAuth } from '../../context/AuthContext';
import { apiFetch } from '../../utils/api';
import { studentLine } from '../../utils/roles';
import { EMPLOYMENT_TYPE_LABELS, type Job } from '../../types/jobs';

/**
 * The top of a student's Home: where their applications stand, what is open
 * to them, and the shortest way into Learning and AED. One request
 * (GET /api/students/me/summary); every number is real -- zero shows as zero.
 */
export interface StudentSummary {
  education: {
    student_course?: string | null; student_institution?: string | null;
    student_university?: string | null; student_year?: number | null; graduation_year?: number | null;
  };
  opportunities: { jobs: number; internships: number; total: number };
  applications: { total: number; active: number; by_status: Record<string, number> };
  recommended: Job[];
}

type IconName = React.ComponentProps<typeof Ionicons>['name'];

export function StudentDashboard() {
  const { token, user } = useAuth();
  const router = useRouter();
  const [data, setData] = useState<StudentSummary | null>(null);
  const [error, setError] = useState(false);

  const load = useCallback(() => {
    setError(false);
    apiFetch('/api/students/me/summary', token)
      .then((d: StudentSummary) => setData(d))
      .catch(() => setError(true));
  }, [token]);

  useEffect(() => { load(); }, [load]);

  const go = (path: string) => router.push(path as any);
  const first = (user?.name || '').split(' ')[0];
  const line = [studentLine(user as any), (user as any)?.student_institution].filter(Boolean).join(' · ');

  return (
    <View style={styles.wrap} testID="student-dashboard">
      <View style={styles.hello}>
        <Text style={styles.helloTitle} accessibilityRole="header">
          {first ? `Hi ${first}` : 'Welcome'}
        </Text>
        {line ? <Text style={styles.helloLine} numberOfLines={2}>{line}</Text> : null}
      </View>

      {error ? (
        <View style={styles.error} testID="student-dashboard-error">
          <Ionicons name="cloud-offline-outline" size={18} color={colors.textSecondary} />
          <Text style={styles.errorText}>Couldn't load your summary.</Text>
          <Pressable onPress={load} accessibilityRole="button" style={styles.retry} testID="student-dashboard-retry">
            <Text style={styles.retryText}>Try again</Text>
          </Pressable>
        </View>
      ) : !data ? (
        <View style={styles.loading} testID="student-dashboard-loading">
          <ActivityIndicator color={colors.navy} />
        </View>
      ) : (
        <>
          <View style={styles.stats}>
            <Stat testID="student-stat-applications" icon="document-text-outline"
              value={data.applications.active} label={data.applications.total === data.applications.active
                ? 'Active applications' : `Active of ${data.applications.total} applications`}
              onPress={() => go('/jobs/applications')} />
            <Stat testID="student-stat-internships" icon="school-outline"
              value={data.opportunities.internships} label="Internships open to you"
              onPress={() => go('/jobs/internships')} />
            <Stat testID="student-stat-jobs" icon="briefcase-outline"
              value={data.opportunities.jobs} label="Other roles open to students"
              onPress={() => go('/jobs')} />
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>New for students</Text>
            {data.recommended.length ? data.recommended.map(j => (
              <Pressable key={j.id} onPress={() => go(`/jobs/${j.id}`)} accessibilityRole="link"
                style={({ pressed }) => [styles.rec, pressed && styles.pressed]} testID={`student-rec-${j.id}`}>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={styles.recTitle} numberOfLines={1}>{j.title}</Text>
                  <Text style={styles.recMeta} numberOfLines={1}>
                    {[j.employer_name, EMPLOYMENT_TYPE_LABELS[j.employment_type], j.location]
                      .filter(Boolean).join(' · ')}
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={16} color={colors.textSubtle} />
              </Pressable>
            )) : (
              <Text style={styles.empty} testID="student-rec-empty">
                No openings for students right now. We'll show new internships here as employers post them.
              </Text>
            )}
          </View>
        </>
      )}

      <View style={styles.links}>
        <QuickLink testID="student-link-learning" icon="book-outline" label="Continue learning" onPress={() => go('/learning')} />
        <QuickLink testID="student-link-aed" icon="sparkles-outline" label="Ask AED" onPress={() => go('/aed-chat')} />
        <QuickLink testID="student-link-preferences" icon="options-outline" label="Career preferences" onPress={() => go('/opportunities')} />
      </View>
    </View>
  );
}

function Stat({ icon, value, label, onPress, testID }: {
  icon: IconName; value: number; label: string; onPress: () => void; testID: string;
}) {
  return (
    <Pressable onPress={onPress} accessibilityRole="link" accessibilityLabel={`${value} ${label}`}
      style={({ pressed }) => [styles.stat, pressed && styles.pressed]} testID={testID}>
      <Ionicons name={icon} size={18} color={colors.teal} />
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel} numberOfLines={2}>{label}</Text>
    </Pressable>
  );
}

function QuickLink({ icon, label, onPress, testID }: { icon: IconName; label: string; onPress: () => void; testID: string }) {
  return (
    <Pressable onPress={onPress} accessibilityRole="link"
      style={({ pressed }) => [styles.link, pressed && styles.pressed]} testID={testID}>
      <Ionicons name={icon} size={16} color={colors.navy} />
      <Text style={styles.linkText} numberOfLines={1}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: {
    backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg,
    padding: spacing.lg, gap: spacing.md, marginBottom: spacing.lg,
  },
  hello: { gap: 2 },
  helloTitle: { ...typography.h3, color: colors.text },
  helloLine: { ...typography.caption, color: colors.textSecondary },
  loading: { paddingVertical: spacing.lg, alignItems: 'center' },
  error: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, flexWrap: 'wrap' },
  errorText: { ...typography.caption, color: colors.textSecondary, flex: 1 },
  retry: { paddingVertical: spacing.xs, paddingHorizontal: spacing.sm },
  retryText: { ...typography.label, color: colors.navy },
  stats: { flexDirection: 'row', gap: spacing.sm },
  stat: {
    flex: 1, minWidth: 0, backgroundColor: colors.bgMuted, borderRadius: radius.md,
    padding: spacing.md, gap: 2,
  },
  statValue: { fontSize: 22, lineHeight: 28, fontFamily: fonts.heading.bold, color: colors.text },
  statLabel: { ...typography.small, color: colors.textSecondary },
  section: { gap: spacing.xs },
  sectionTitle: { ...typography.label, color: colors.text },
  rec: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    paddingVertical: spacing.sm, borderTopWidth: 1, borderTopColor: colors.borderLight,
  },
  recTitle: { ...typography.bodyStrong, color: colors.text },
  recMeta: { ...typography.small, color: colors.textSecondary },
  empty: { ...typography.caption, color: colors.textSecondary },
  links: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  link: {
    flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 36,
    paddingHorizontal: spacing.md, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.border,
  },
  linkText: { ...typography.label, color: colors.navy },
  pressed: { opacity: 0.7 },
});
