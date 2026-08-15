import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useAuth } from '../../src/context/AuthContext';
import { apiFetch } from '../../src/utils/api';
import { Button, ScreenHeader, LoadingState, ErrorState, ErrorBanner } from '../../src/components';
import { colors, spacing, typography, radius } from '../../src/theme';
import { PageColumn } from '../../src/components/web';

interface Lesson {
  id: string;
  title: string;
  specialty: string;
  description: string;
  duration: string;
  credits: number;
  quiz_questions: number;
  pass_score?: number;
}

export default function LessonScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { token, refreshUser } = useAuth();
  const router = useRouter();

  const [lesson, setLesson] = useState<Lesson | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [completing, setCompleting] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [completed, setCompleted] = useState(false);
  const [earned, setEarned] = useState(0);

  const load = useCallback(async () => {
    setLoading(true); setLoadError(null);
    try {
      const [lessons, progress] = await Promise.all([
        apiFetch('/api/learning/cme', token),
        apiFetch('/api/learning/cme/my-progress', token).catch(() => []),
      ]);
      const found = (lessons || []).find((l: Lesson) => String(l.id) === String(id)) ?? null;
      if (!found) { setLoadError('This lesson is no longer available.'); }
      setLesson(found);
      const done = (progress || []).find((p: any) => String(p.lesson_id) === String(id) && p.passed);
      if (done) { setCompleted(true); setEarned(done.credits_earned ?? 0); }
    } catch (e: any) {
      setLoadError(e?.message || 'Could not load this lesson.');
    } finally {
      setLoading(false);
    }
  }, [id, token]);

  useEffect(() => { load(); }, [load]);

  const complete = async () => {
    setCompleting(true); setActionError(null);
    try {
      const res = await apiFetch(`/api/learning/cme/${id}/complete`, token, { method: 'POST' });
      setCompleted(true);
      setEarned(res?.credits_earned ?? lesson?.credits ?? 0);
      await refreshUser();
    } catch (e: any) {
      setActionError(e?.message || 'Could not record completion. Please try again.');
    } finally {
      setCompleting(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <PageColumn testID="lesson-column">
      <ScreenHeader title="CME Lesson" />
      {loading ? (
        <LoadingState label="Loading lesson…" />
      ) : loadError || !lesson ? (
        <ErrorState message={loadError ?? 'Lesson not found.'} onRetry={load} />
      ) : (
        <ScrollView contentContainerStyle={styles.scroll}>
          <Text style={styles.specialty}>{lesson.specialty}</Text>
          <Text style={styles.title}>{lesson.title}</Text>

          <View style={styles.metaRow}>
            <Meta icon="time-outline" text={lesson.duration} />
            <Meta icon="ribbon-outline" text={`${lesson.credits} credits`} />
            <Meta icon="help-circle-outline" text={`${lesson.quiz_questions} questions`} />
          </View>

          <View style={styles.body}>
            <Text style={styles.sectionTitle}>About this lesson</Text>
            <Text style={styles.description}>{lesson.description}</Text>
          </View>

          <View style={styles.notice}>
            <Ionicons name="information-circle-outline" size={18} color={colors.navy} />
            <Text style={styles.noticeText}>
              The interactive quiz is coming soon. For now, review the material above and mark the
              lesson complete to record your CME credits.
            </Text>
          </View>

          <ErrorBanner message={actionError} />

          {completed ? (
            <View style={styles.done} accessibilityRole="alert">
              <Ionicons name="checkmark-circle" size={22} color={colors.teal} />
              <Text style={styles.doneText}>
                Completed{earned ? ` · ${earned} credits earned` : ''}
              </Text>
            </View>
          ) : (
            <Button label="Mark as complete" onPress={complete} loading={completing} testID="complete-lesson" />
          )}

          <Button label="Back to Learning" onPress={() => router.back()} variant="outline" style={styles.backBtn} />
        </ScrollView>
      )}
      </PageColumn>
    </SafeAreaView>
  );
}

function Meta({ icon, text }: { icon: keyof typeof Ionicons.glyphMap; text: string }) {
  return (
    <View style={styles.meta}>
      <Ionicons name={icon} size={14} color={colors.textSecondary} />
      <Text style={styles.metaText}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  scroll: { padding: spacing.xl, paddingBottom: spacing.xxxl },
  specialty: { ...typography.small, color: colors.teal, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1 },
  title: { ...typography.h2, color: colors.text, marginTop: spacing.xs, marginBottom: spacing.md },
  metaRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.lg, marginBottom: spacing.xl },
  meta: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  metaText: { ...typography.caption, color: colors.textSecondary },
  body: { backgroundColor: colors.white, borderRadius: radius.lg, padding: spacing.lg, borderWidth: 1, borderColor: colors.border },
  sectionTitle: { ...typography.h3, color: colors.navy, marginBottom: spacing.sm },
  description: { ...typography.body, color: colors.textSecondary, lineHeight: 22 },
  notice: { flexDirection: 'row', gap: spacing.sm, backgroundColor: '#EFF6FF', borderRadius: radius.md, padding: spacing.md, marginVertical: spacing.xl },
  noticeText: { ...typography.caption, color: colors.navy, flex: 1, lineHeight: 19 },
  done: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm, backgroundColor: colors.successBg, borderRadius: radius.lg, paddingVertical: spacing.lg },
  doneText: { ...typography.bodyStrong, color: colors.teal },
  backBtn: { marginTop: spacing.md },
});
