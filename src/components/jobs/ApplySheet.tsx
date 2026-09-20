import React, { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { colors, radius, spacing, typography, fonts } from '../../theme';
import { useAuth } from '../../context/AuthContext';
import { Sheet } from '../Sheet';
import { Button } from '../Button';
import { Avatar } from '../Avatar';
import { ErrorBanner } from '../States';
import { KycNotice } from '../KycNotice';
import type { Job, ScreeningAnswer } from '../../types/jobs';

const MAX_NOTE = 1500;

/**
 * Apply.
 *
 * The application IS the ForMeds profile — there is no separate form to fill
 * in, and no CV upload, because the platform already holds a verified
 * professional record and asking someone to retype it is the friction this
 * whole section exists to remove. What the sheet does instead is show exactly
 * what the employer will receive, so "apply" is never a blind action.
 *
 * The one optional addition is a short note. A cover letter field that is
 * required would defeat the point; one that is absent loses the "I am
 * available from March" context that makes an application land.
 */
export function ApplySheet({
  visible, job, onClose, onSubmit, submitting, error,
}: {
  visible: boolean;
  job: Job | null;
  onClose: () => void;
  onSubmit: (coverNote: string, screeningAnswers: ScreeningAnswer[]) => void;
  submitting?: boolean;
  error?: string | null;
}) {
  const { user, isKycApproved } = useAuth();
  const router = useRouter();
  const [note, setNote] = useState('');
  const [answers, setAnswers] = useState<Record<string, 'yes' | 'no'>>({});

  useEffect(() => {
    if (visible) { setNote(''); setAnswers({}); }
  }, [visible]);

  if (!job) return null;

  const questions = job.screening_questions || [];
  const allAnswered = questions.every(q => answers[q.id]);

  const submit = () => {
    onSubmit(
      note.trim(),
      questions.map(q => ({ question_id: q.id, answer: answers[q.id] })),
    );
  };

  // Exactly the fields `public_card` puts on the wire. Anything shown here that
  // the employer does not actually receive would be a lie about the applicant's
  // own data, which is worse than showing less.
  const shared: { icon: keyof typeof Ionicons.glyphMap; label: string; value?: string }[] = [
    { icon: 'person-outline', label: 'Name', value: user?.name },
    { icon: 'reader-outline', label: 'Headline', value: user?.headline },
    { icon: 'medical-outline', label: 'Specialty', value: user?.specialty },
    {
      icon: 'time-outline',
      label: 'Experience',
      value: user?.years_experience ? `${user.years_experience} years` : undefined,
    },
    { icon: 'location-outline', label: 'Location', value: user?.city || user?.location },
  ];
  const missing = shared.filter(f => !f.value);

  return (
    <Sheet
      visible={visible}
      onClose={onClose}
      title="Apply"
      testID="apply-sheet"
      footer={
        <>
          <Button label="Cancel" variant="outline" onPress={onClose} style={styles.footerBtn} />
          <Button
            label="Submit application"
            onPress={submit}
            loading={submitting}
            disabled={!isKycApproved || !allAnswered}
            style={styles.footerBtn}
            testID="apply-submit"
          />
        </>
      }
    >
      <ScrollView
        contentContainerStyle={styles.body}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.jobLine}>
          <Text style={styles.jobTitle}>{job.title}</Text>
          <Text style={styles.jobEmployer}>
            {job.employer_name}{job.location ? ` · ${job.location}` : ''}
          </Text>
        </View>

        {/* Verification is the gate, so it is stated before the form rather
            than sprung as an error on submit. */}
        <KycNotice action="apply for jobs" />
        <ErrorBanner message={error} />

        <View style={styles.profileCard}>
          <View style={styles.profileHeader}>
            <Avatar name={user?.name} uri={user?.avatar} role={user?.role} size={40} />
            <View style={styles.profileHeaderText}>
              <Text style={styles.profileName}>{user?.name}</Text>
              <Text style={styles.profileHint}>
                Your ForMeds profile is sent as your application.
              </Text>
            </View>
          </View>

          <View style={styles.fieldList}>
            {shared.map(field => (
              <View key={field.label} style={styles.field}>
                <Ionicons
                  name={field.value ? 'checkmark-circle' : 'ellipse-outline'}
                  size={16}
                  color={field.value ? colors.teal : colors.textMuted}
                />
                <Text style={styles.fieldLabel}>{field.label}</Text>
                <Text
                  style={[styles.fieldValue, !field.value && styles.fieldMissing]}
                  numberOfLines={1}
                >
                  {field.value || 'Not added'}
                </Text>
              </View>
            ))}
          </View>

          {missing.length ? (
            <View style={styles.nudge}>
              <Text style={styles.nudgeText}>
                {missing.length} {missing.length === 1 ? 'detail is' : 'details are'} missing.
                Employers see this profile before anything else.
              </Text>
              <Button
                label="Complete profile"
                variant="outline"
                onPress={() => { onClose(); router.push('/edit-profile' as any); }}
              />
            </View>
          ) : null}
        </View>

        {questions.length ? (
          <View style={styles.questionsBlock}>
            <Text style={styles.noteLabel}>Screening questions</Text>
            {questions.map(q => (
              <View key={q.id} style={styles.questionRow} testID={`apply-question-${q.id}`}>
                <Text style={styles.questionText}>{q.text}</Text>
                <View style={styles.answerChips}>
                  {(['yes', 'no'] as const).map(v => (
                    <Pressable
                      key={v}
                      onPress={() => setAnswers(prev => ({ ...prev, [q.id]: v }))}
                      accessibilityRole="radio"
                      accessibilityState={{ selected: answers[q.id] === v }}
                      accessibilityLabel={`${v === 'yes' ? 'Yes' : 'No'} to: ${q.text}`}
                      testID={`apply-question-${q.id}-${v}`}
                      style={({ pressed }) => [
                        styles.answerChip,
                        answers[q.id] === v && styles.answerChipOn,
                        pressed && styles.pressed,
                      ]}
                    >
                      <Text style={[styles.answerChipText, answers[q.id] === v && styles.answerChipTextOn]}>
                        {v === 'yes' ? 'Yes' : 'No'}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              </View>
            ))}
          </View>
        ) : null}

        <View style={styles.noteBlock}>
          <Text style={styles.noteLabel}>Add a note (optional)</Text>
          <TextInput
            testID="apply-note"
            style={styles.noteInput}
            value={note}
            onChangeText={t => setNote(t.slice(0, MAX_NOTE))}
            placeholder="Availability, notice period, or why this role suits you."
            placeholderTextColor={colors.textMuted}
            multiline
            textAlignVertical="top"
            accessibilityLabel="Note to the employer"
          />
          <Text style={styles.counter}>{note.length}/{MAX_NOTE}</Text>
        </View>
      </ScrollView>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  body: { padding: spacing.xl, paddingTop: spacing.md, gap: spacing.lg },
  jobLine: { gap: 2 },
  jobTitle: { ...typography.h3, color: colors.text },
  jobEmployer: { ...typography.caption, color: colors.textSecondary },

  profileCard: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    backgroundColor: colors.bg,
    padding: spacing.lg,
    gap: spacing.md,
  },
  profileHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  profileHeaderText: { flex: 1, gap: 2 },
  profileName: { ...typography.bodyStrong, color: colors.text },
  profileHint: { ...typography.small, color: colors.textSecondary },

  fieldList: { gap: spacing.sm },
  field: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  fieldLabel: { ...typography.caption, color: colors.textSecondary, width: 84 },
  fieldValue: { ...typography.caption, color: colors.text, flex: 1 },
  fieldMissing: { color: colors.textMuted, fontStyle: 'italic' },

  nudge: {
    gap: spacing.sm,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  nudgeText: { ...typography.small, color: colors.warning },

  questionsBlock: { gap: spacing.md },
  questionRow: { gap: spacing.sm },
  questionText: { ...typography.body, color: colors.text },
  answerChips: { flexDirection: 'row', gap: spacing.sm },
  answerChip: {
    minWidth: 64,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.bg,
    alignItems: 'center',
  },
  answerChipOn: { backgroundColor: colors.navy, borderColor: colors.navy },
  answerChipText: { ...typography.caption, color: colors.textSecondary },
  answerChipTextOn: { color: colors.white, fontFamily: fonts.body.semibold },
  pressed: { opacity: 0.7 },

  noteBlock: { gap: spacing.xs },
  noteLabel: { ...typography.label, color: colors.text },
  noteInput: {
    ...typography.body,
    color: colors.text,
    backgroundColor: colors.bg,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    padding: spacing.md,
    minHeight: 96,
  },
  counter: { ...typography.small, color: colors.textMuted, alignSelf: 'flex-end' },
  footerBtn: { flex: 1 },
});
