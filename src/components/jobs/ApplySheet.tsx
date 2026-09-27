import React, { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { colors, radius, spacing, typography } from '../../theme';
import { useAuth } from '../../context/AuthContext';
import { Sheet } from '../Sheet';
import { Button } from '../Button';
import { Avatar } from '../Avatar';
import { ErrorBanner } from '../States';
import { KycNotice } from '../KycNotice';
import type { Job } from '../../types/jobs';
import type { MyResume } from '../../types/applicants';
import { ResumeCard } from './ResumeCard';
import { type Answers, ScreeningAnswerInput, answerErrors, cleanAnswers } from './Screening';

const MAX_NOTE = 1500;

type Step = 'profile' | 'questions' | 'review';

export interface ApplyExtras { answers: Record<string, unknown>; include_resume: boolean }

/**
 * Apply, in up to three steps: profile and resume, the employer's screening
 * questions (only when the job has any), then a review of exactly what will
 * be sent.
 *
 * The application IS the ForMeds profile — there is no form to retype it
 * into. What the sheet adds is what a profile cannot carry: an optional note,
 * the resume the professional chooses to attach, and the answers to this
 * employer's questions, which are stored with this application only.
 */
export function ApplySheet({
  visible, job, onClose, onSubmit, submitting, error,
}: {
  visible: boolean;
  job: Job | null;
  onClose: () => void;
  onSubmit: (coverNote: string, extras: ApplyExtras) => void;
  submitting?: boolean;
  error?: string | null;
}) {
  const { user, isKycApproved } = useAuth();
  const router = useRouter();
  const [note, setNote] = useState('');
  const [step, setStep] = useState<Step>('profile');
  const [answers, setAnswers] = useState<Answers>({});
  const [attempted, setAttempted] = useState(false);
  const [resume, setResume] = useState<MyResume | null>(null);
  const [includeResume, setIncludeResume] = useState(true);

  useEffect(() => {
    if (visible) { setNote(''); setStep('profile'); setAnswers({}); setAttempted(false); setIncludeResume(true); }
  }, [visible]);

  if (!job) return null;

  const questions = job.screening_questions ?? [];
  const errors = attempted ? answerErrors(questions, answers) : {};
  const answeredCount = questions.filter(q => {
    const a = answers[q.id];
    return a !== undefined && a !== '' && !(Array.isArray(a) && !a.length);
  }).length;
  const steps: Step[] = questions.length ? ['profile', 'questions', 'review'] : ['profile', 'review'];
  const idx = steps.indexOf(step);
  const attach = includeResume && !!resume?.has_resume;

  const next = () => {
    if (step === 'questions') {
      setAttempted(true);
      if (Object.keys(answerErrors(questions, answers)).length) return;
    }
    setStep(steps[Math.min(idx + 1, steps.length - 1)]);
  };
  const submit = () => onSubmit(note.trim(), { answers: cleanAnswers(questions, answers), include_resume: attach });

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
  const stepName = (s: Step) => (s === 'profile' ? 'Profile' : s === 'questions' ? 'Questions' : 'Review');

  return (
    <Sheet
      visible={visible}
      onClose={onClose}
      title="Apply"
      testID="apply-sheet"
      footer={
        <>
          <Button label={idx === 0 ? 'Cancel' : 'Back'} variant="outline" style={styles.footerBtn} testID="apply-back"
            onPress={() => (idx === 0 ? onClose() : setStep(steps[idx - 1]))} />
          {step === 'review' ? (
            <Button
              label="Submit application"
              onPress={submit}
              loading={submitting}
              disabled={!isKycApproved}
              style={styles.footerBtn}
              testID="apply-submit"
            />
          ) : (
            <Button label="Continue" onPress={next} disabled={!isKycApproved} style={styles.footerBtn}
              testID="apply-next" />
          )}
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

        <View style={styles.stepper} testID="apply-steps"
          accessibilityLabel={`Step ${idx + 1} of ${steps.length}: ${stepName(step)}`}>
          {steps.map((s, i) => (
            <View key={s} style={styles.stepItem}>
              <View style={[styles.stepDot, i <= idx && styles.stepDotOn]}>
                {i < idx ? <Ionicons name="checkmark" size={13} color={colors.white} />
                  : <Text style={[styles.stepNum, i <= idx && styles.stepNumOn]}>{i + 1}</Text>}
              </View>
              <Text style={[styles.stepLabel, i === idx && styles.stepLabelOn]}>{stepName(s)}</Text>
            </View>
          ))}
        </View>

        {/* Verification is the gate, so it is stated before the form rather
            than sprung as an error on submit. */}
        <KycNotice action="apply for jobs" />
        <ErrorBanner message={error} />

        {step === 'profile' ? (
          <>
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

            <ResumeCard compact onChange={setResume} />
            {resume?.has_resume ? (
              <View style={styles.attachRow}>
                <Text style={styles.attachText}>Attach my resume to this application</Text>
                <Switch value={includeResume} onValueChange={setIncludeResume} accessibilityLabel="Attach my resume"
                  trackColor={{ true: colors.teal, false: colors.border }} thumbColor={colors.white}
                  testID="apply-attach-resume" />
              </View>
            ) : null}

            <View style={styles.noteBlock}>
              <Text style={styles.noteLabel}>Add a note (optional)</Text>
              <TextInput maxLength={MAX_NOTE}
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
          </>
        ) : null}

        {step === 'questions' ? (
          <View testID="apply-questions">
            <Text style={styles.sectionHint}>
              {job.employer_name || 'The employer'} asks {questions.length} question{questions.length === 1 ? '' : 's'}.
              {' '}Required ones are marked *. Your answers go with this application only.
            </Text>
            {questions.map((q, i) => (
              <ScreeningAnswerInput key={q.id} index={i} question={q} value={answers[q.id]} error={errors[q.id]}
                onChange={v => setAnswers(prev => ({ ...prev, [q.id]: v }))} />
            ))}
          </View>
        ) : null}

        {step === 'review' ? (
          <View style={styles.review} testID="apply-review">
            <Text style={styles.reviewTitle}>Review your application</Text>
            <ReviewRow ok label="Profile" detail="Your ForMeds profile" onEdit={() => setStep('profile')} />
            <ReviewRow ok={attach} label="Resume" onEdit={() => setStep('profile')}
              detail={attach ? resume?.name || 'Attached' : resume?.has_resume ? 'Not attached' : 'No resume uploaded'} />
            {questions.length ? (
              <ReviewRow ok label="Screening questions" onEdit={() => setStep('questions')}
                detail={`${answeredCount} of ${questions.length} answered`} />
            ) : null}
            <ReviewRow ok={!!note.trim()} label="Note" onEdit={() => setStep('profile')}
              detail={note.trim() ? `${note.trim().slice(0, 60)}${note.trim().length > 60 ? '…' : ''}` : 'None'} />
          </View>
        ) : null}
      </ScrollView>
    </Sheet>
  );
}

function ReviewRow({ ok, label, detail, onEdit }: { ok: boolean; label: string; detail: string; onEdit: () => void }) {
  return (
    <View style={styles.reviewRow}>
      <Ionicons name={ok ? 'checkmark-circle' : 'remove-circle-outline'} size={20} color={ok ? colors.teal : colors.textMuted} />
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={styles.reviewLabel}>{label}</Text>
        <Text style={styles.reviewDetail} numberOfLines={1}>{detail}</Text>
      </View>
      <Pressable onPress={onEdit} accessibilityRole="button" accessibilityLabel={`Edit ${label}`} hitSlop={8}>
        <Text style={styles.reviewEdit}>Edit</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  body: { padding: spacing.xl, paddingTop: spacing.md, gap: spacing.lg },
  jobLine: { gap: 2 },
  jobTitle: { ...typography.h3, color: colors.text },
  jobEmployer: { ...typography.caption, color: colors.textSecondary },

  stepper: { flexDirection: 'row', gap: spacing.lg, flexWrap: 'wrap' },
  stepItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  stepDot: {
    width: 22, height: 22, borderRadius: 11, borderWidth: 1, borderColor: colors.border,
    alignItems: 'center', justifyContent: 'center', backgroundColor: colors.white,
  },
  stepDotOn: { backgroundColor: colors.navy, borderColor: colors.navy },
  stepNum: { ...typography.small, color: colors.textSecondary },
  stepNumOn: { color: colors.white },
  stepLabel: { ...typography.caption, color: colors.textSecondary },
  stepLabelOn: { color: colors.navy },

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

  attachRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.md },
  attachText: { ...typography.caption, color: colors.text, flex: 1 },

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

  sectionHint: { ...typography.caption, color: colors.textSecondary, marginBottom: spacing.lg },
  review: { gap: spacing.sm },
  reviewTitle: { ...typography.h3, color: colors.text, marginBottom: spacing.xs },
  reviewRow: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.md,
    borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.white,
  },
  reviewLabel: { ...typography.bodyStrong, color: colors.text },
  reviewDetail: { ...typography.caption, color: colors.textSecondary },
  reviewEdit: { ...typography.label, color: colors.navy },

  footerBtn: { flex: 1 },
});
