import React from 'react';
import { FieldError } from '../FieldError';
import { Pressable, StyleSheet, Switch, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, fonts, radius, spacing, typography, MIN_TOUCH_TARGET } from '../../theme';
import { FormInput } from '../FormInput';
import { DateField, NumberField } from '../InputFields';
import { ChoiceChips } from '../locum/ChoiceChips';
import { isRealDate } from '../../utils/validation';
import {
  SCREENING_TYPE_LABELS, type ScreeningAnswer, type ScreeningQuestion, type ScreeningSummary, type ScreeningType,
} from '../../types/applicants';

/**
 * Screening questions, in their three appearances:
 *  - ScreeningEditor: the employer writes them in the job wizard;
 *  - ScreeningAnswerInput: the applicant answers, each type with its own
 *    control (never one text box for everything);
 *  - ScreeningAnswersView: the employer reads the answers, question and
 *    answer clearly apart, with any preference shown as met or not met.
 *
 * The rules mirror models/schemas.py; the server re-checks every one.
 */

export const MAX_QUESTIONS = 10;
const CHOICE: ScreeningType[] = ['single_choice', 'multiple_choice'];
const TYPES = Object.keys(SCREENING_TYPE_LABELS) as ScreeningType[];

export type Answers = Record<string, string | string[]>;

export function blankQuestion(): ScreeningQuestion {
  return { id: '', text: '', type: 'yes_no', required: true, options: [], preferred: '' };
}

/** Problems with the employer's questions, by index. */
export function questionErrors(questions: ScreeningQuestion[]): Record<number, string> {
  const out: Record<number, string> = {};
  const seen = new Set<string>();
  questions.forEach((q, i) => {
    const text = q.text.trim();
    if (text.length < 5) { out[i] = 'Write the question in at least 5 characters.'; return; }
    if (seen.has(text.toLowerCase())) { out[i] = 'This question is asked twice.'; return; }
    seen.add(text.toLowerCase());
    if (CHOICE.includes(q.type)) {
      const opts = q.options.map(o => o.trim()).filter(Boolean);
      if (opts.length < 2) { out[i] = 'Add at least two options.'; return; }
      if (new Set(opts.map(o => o.toLowerCase())).size !== opts.length) { out[i] = 'Each option must be different.'; return; }
    }
    if (q.type === 'single_choice' && q.preferred && !q.options.includes(q.preferred)) {
      out[i] = 'The preferred answer must be one of the options.';
    }
  });
  return out;
}

/** What is wrong with the applicant's answers, by question id. */
export function answerErrors(questions: ScreeningQuestion[], answers: Answers): Record<string, string> {
  const out: Record<string, string> = {};
  for (const q of questions) {
    const a = answers[q.id];
    const blank = a === undefined || a === '' || (Array.isArray(a) && a.length === 0);
    if (blank) { if (q.required) out[q.id] = 'Please answer this question.'; continue; }
    if (q.type === 'number') {
      const n = Number(a);
      if (!Number.isFinite(n) || n < 0 || n > 1_000_000) out[q.id] = 'Enter a number between 0 and 1,000,000.';
    }
    if (q.type === 'date' && !isRealDate(String(a))) out[q.id] = 'Choose a valid date.';
    if (q.type === 'short_text' && String(a).length > 200) out[q.id] = 'Keep this under 200 characters.';
    if (q.type === 'long_text' && String(a).length > 2000) out[q.id] = 'Keep this under 2,000 characters.';
  }
  return out;
}

/** Answers as the API expects them (blank ones left out). */
export function cleanAnswers(questions: ScreeningQuestion[], answers: Answers): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const q of questions) {
    const a = answers[q.id];
    if (a === undefined || a === '' || (Array.isArray(a) && !a.length)) continue;
    out[q.id] = q.type === 'number' ? Number(a) : typeof a === 'string' ? a.trim() : a;
  }
  return out;
}

// ── Employer: write the questions ──────────────────────────────────────────

export function ScreeningEditor({ questions, onChange, errors, hasApplicants }: {
  questions: ScreeningQuestion[];
  onChange: (next: ScreeningQuestion[]) => void;
  errors: Record<number, string>;
  /** Editing a live job: say what happens to answers already given. */
  hasApplicants?: boolean;
}) {
  const update = (i: number, patch: Partial<ScreeningQuestion>) =>
    onChange(questions.map((q, j) => (j === i ? { ...q, ...patch } : q)));
  const move = (i: number, by: number) => {
    const next = [...questions];
    const [q] = next.splice(i, 1);
    next.splice(i + by, 0, q);
    onChange(next);
  };

  return (
    <View style={styles.editor} testID="screening-editor">
      <Text style={styles.hint}>
        Up to {MAX_QUESTIONS}. Answers appear with each applicant; nobody is rejected automatically.
      </Text>
      {hasApplicants ? (
        <View style={styles.note}>
          <Ionicons name="information-circle-outline" size={16} color={colors.navy} />
          <Text style={styles.noteText}>
            People who already applied keep the questions they answered. Changes apply to new applicants.
          </Text>
        </View>
      ) : null}

      {questions.map((q, i) => (
        <View key={i} style={[styles.qCard, errors[i] ? styles.qCardError : null]} testID={`screening-q-${i}`}>
          <View style={styles.qHead}>
            <Text style={styles.qNumber}>Question {i + 1}</Text>
            <View style={styles.qTools}>
              <IconButton icon="arrow-up" label="Move up" disabled={i === 0} onPress={() => move(i, -1)} />
              <IconButton icon="arrow-down" label="Move down" disabled={i === questions.length - 1} onPress={() => move(i, 1)} />
              <IconButton icon="trash-outline" label="Remove question" danger
                onPress={() => onChange(questions.filter((_, j) => j !== i))} testID={`screening-remove-${i}`} />
            </View>
          </View>
          <FormInput label="Question" value={q.text} maxLength={200} onChangeText={t => update(i, { text: t })}
            placeholder="e.g. Are you willing to work night shifts?" testID={`screening-text-${i}`} />
          <ChoiceChips label="Answer type" value={q.type} testID={`screening-type-${i}`}
            onChange={v => v && update(i, {
              type: v, preferred: '',
              options: CHOICE.includes(v) ? (q.options.length ? q.options : ['', '']) : [],
            })}
            choices={TYPES.map(t => ({ value: t, label: SCREENING_TYPE_LABELS[t] }))} />
          {CHOICE.includes(q.type) ? (
            <View style={styles.options}>
              {q.options.map((o, k) => (
                <View key={k} style={styles.optionRow}>
                  <View style={{ flex: 1 }}>
                    <FormInput label={`Option ${k + 1}`} value={o} maxLength={80}
                      onChangeText={t => update(i, { options: q.options.map((x, m) => (m === k ? t : x)) })}
                      testID={`screening-opt-${i}-${k}`} />
                  </View>
                  {q.options.length > 2 ? (
                    <IconButton icon="close" label={`Remove option ${k + 1}`}
                      onPress={() => update(i, { options: q.options.filter((_, m) => m !== k) })} />
                  ) : null}
                </View>
              ))}
              {q.options.length < 10 ? (
                <Pressable onPress={() => update(i, { options: [...q.options, ''] })} accessibilityRole="button"
                  style={styles.addLink} testID={`screening-add-opt-${i}`}>
                  <Ionicons name="add" size={16} color={colors.navy} />
                  <Text style={styles.addLinkText}>Add option</Text>
                </Pressable>
              ) : null}
            </View>
          ) : null}
          {q.type === 'yes_no' ? (
            <ChoiceChips label="Preferred answer (optional)" value={q.preferred || ''} allowDeselect
              onChange={v => update(i, { preferred: v || '' })}
              choices={[{ value: 'yes', label: 'Yes' }, { value: 'no', label: 'No' }]} />
          ) : null}
          {q.type === 'single_choice' && q.options.filter(o => o.trim()).length >= 2 ? (
            <ChoiceChips label="Preferred answer (optional)" value={q.preferred || ''} allowDeselect
              onChange={v => update(i, { preferred: v || '' })}
              choices={q.options.filter(o => o.trim()).map(o => ({ value: o, label: o }))} />
          ) : null}
          {q.type === 'number' ? (
            <NumberField label="Preferred minimum (optional)" value={q.preferred || ''} decimals maxDigits={7}
              onChangeText={v => update(i, { preferred: v })} />
          ) : null}
          <View style={styles.requiredRow}>
            <Text style={styles.label}>Required</Text>
            <Switch value={q.required} onValueChange={v => update(i, { required: v })} accessibilityLabel="Required"
              trackColor={{ true: colors.teal, false: colors.border }} thumbColor={colors.white} />
          </View>
          <FieldError message={errors[i]} />
        </View>
      ))}

      {questions.length < MAX_QUESTIONS ? (
        <Pressable onPress={() => onChange([...questions, blankQuestion()])} accessibilityRole="button"
          style={({ pressed }) => [styles.addQuestion, pressed && { opacity: 0.8 }]} testID="screening-add">
          <Ionicons name="add-circle-outline" size={20} color={colors.navy} />
          <Text style={styles.addLinkText}>{questions.length ? 'Add another question' : 'Add a screening question'}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

function IconButton({ icon, label, onPress, disabled, danger, testID }: {
  icon: keyof typeof Ionicons.glyphMap; label: string; onPress: () => void; disabled?: boolean; danger?: boolean; testID?: string;
}) {
  return (
    <Pressable onPress={onPress} disabled={disabled} accessibilityRole="button" accessibilityLabel={label} hitSlop={6}
      testID={testID} style={({ pressed }) => [styles.iconBtn, (pressed || disabled) && { opacity: 0.4 }]}>
      <Ionicons name={icon} size={18} color={danger ? colors.redText : colors.textSecondary} />
    </Pressable>
  );
}

// ── Applicant: answer them ─────────────────────────────────────────────────

export function ScreeningAnswerInput({ question: q, value, onChange, error, index }: {
  question: ScreeningQuestion; value: string | string[] | undefined; onChange: (v: string | string[]) => void;
  error?: string; index: number;
}) {
  const label = `${index + 1}. ${q.text}${q.required ? ' *' : ''}`;
  const tid = `answer-${index}`;
  let control: React.ReactNode;
  if (q.type === 'yes_no') {
    control = (
      <ChoiceChips value={(value as string) || ''} onChange={v => onChange(v || '')} testID={tid}
        choices={[{ value: 'yes', label: 'Yes' }, { value: 'no', label: 'No' }]} />
    );
  } else if (q.type === 'single_choice') {
    control = (
      <ChoiceChips value={(value as string) || ''} onChange={v => onChange(v || '')} testID={tid}
        choices={q.options.map(o => ({ value: o, label: o }))} />
    );
  } else if (q.type === 'multiple_choice') {
    const picked = Array.isArray(value) ? value : [];
    control = (
      <View style={styles.checks}>
        {q.options.map(o => {
          const on = picked.includes(o);
          return (
            <Pressable key={o} onPress={() => onChange(on ? picked.filter(p => p !== o) : [...picked, o])}
              accessibilityRole="checkbox" accessibilityState={{ checked: on }} accessibilityLabel={o}
              style={[styles.check, on && styles.checkOn]} testID={`${tid}-${o}`}>
              <Ionicons name={on ? 'checkbox' : 'square-outline'} size={20} color={on ? colors.navy : colors.textSecondary} />
              <Text style={styles.checkText}>{o}</Text>
            </Pressable>
          );
        })}
      </View>
    );
  } else if (q.type === 'number') {
    return <NumberField label={label} value={(value as string) || ''} onChangeText={onChange} decimals maxDigits={7}
      error={error} testID={tid} />;
  } else if (q.type === 'date') {
    return <DateField label={label} value={(value as string) || ''} onChange={onChange} error={error} clearable={!q.required}
      testID={tid} />;
  } else {
    const long = q.type === 'long_text';
    return <FormInput label={label} value={(value as string) || ''} onChangeText={onChange} error={error}
      multiline={long} rows={long ? 4 : undefined} maxLength={long ? 2000 : 200} testID={tid} />;
  }
  return (
    <View style={styles.answerBlock}>
      <Text style={styles.qLabel}>{label}</Text>
      {control}
      <FieldError message={error} />
    </View>
  );
}

// ── Employer: read the answers ─────────────────────────────────────────────

export function formatAnswer(a: ScreeningAnswer): string {
  if (a.answer === null || a.answer === undefined || a.answer === '') return 'Not answered';
  if (Array.isArray(a.answer)) return a.answer.length ? a.answer.join(', ') : 'Not answered';
  if (a.type === 'yes_no') return a.answer === 'yes' ? 'Yes' : 'No';
  if (a.type === 'date') {
    const d = new Date(`${a.answer}T00:00:00`);
    return Number.isNaN(d.getTime()) ? String(a.answer)
      : d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
  }
  return String(a.answer);
}

function meetsPreference(a: ScreeningAnswer): boolean | null {
  if (!a.preferred || a.answer === null || a.answer === '') return null;
  if (a.type === 'number') return Number(a.answer) >= Number(a.preferred);
  return String(a.answer) === a.preferred;
}

export function screeningLine(s: ScreeningSummary): string {
  const parts = [`${s.answered}/${s.total} answered`];
  if (s.preferences) parts.push(s.unmet ? `${s.unmet} preference${s.unmet === 1 ? '' : 's'} not met` : 'Meets preferences');
  return parts.join(' · ');
}

export function ScreeningAnswersView({ answers, summary }: { answers: ScreeningAnswer[]; summary: ScreeningSummary }) {
  return (
    <View style={{ gap: spacing.md }} testID="screening-answers">
      <View style={[styles.summary, summary.unmet ? styles.summaryWarn : styles.summaryOk]}>
        <Ionicons name={summary.unmet ? 'alert-circle-outline' : 'checkmark-circle-outline'} size={18}
          color={summary.unmet ? colors.warning : colors.teal} />
        <Text style={[styles.summaryText, { color: summary.unmet ? colors.warning : colors.teal }]}>
          {screeningLine(summary)}
        </Text>
      </View>
      {answers.map((a, i) => {
        const met = meetsPreference(a);
        return (
          <View key={a.id || i} style={styles.qa}>
            <Text style={styles.qaQuestion}>{a.text}{a.required ? '' : ' (optional)'}</Text>
            <View style={styles.qaAnswerRow}>
              <Text style={[styles.qaAnswer, (a.answer === null || a.answer === '') && styles.qaMissing]}>
                {formatAnswer(a)}
              </Text>
              {met !== null ? (
                <View style={[styles.pref, met ? styles.prefOk : styles.prefWarn]}>
                  <Ionicons name={met ? 'checkmark' : 'alert'} size={12} color={met ? colors.teal : colors.warning} />
                  <Text style={[styles.prefText, { color: met ? colors.teal : colors.warning }]}>
                    {met ? 'Preferred' : `Preferred: ${a.type === 'number' ? `${a.preferred}+` : a.preferred === 'yes' ? 'Yes' : a.preferred === 'no' ? 'No' : a.preferred}`}
                  </Text>
                </View>
              ) : null}
            </View>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  editor: { gap: spacing.md },
  hint: { ...typography.caption, color: colors.textSecondary },
  note: {
    flexDirection: 'row', gap: spacing.sm, alignItems: 'flex-start', padding: spacing.md,
    borderRadius: radius.md, backgroundColor: colors.bgMuted,
  },
  noteText: { ...typography.caption, color: colors.text, flex: 1 },
  qCard: {
    borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg, padding: spacing.lg,
    backgroundColor: colors.white, gap: spacing.xs,
  },
  qCardError: { borderColor: colors.red },
  qHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.xs },
  qNumber: { ...typography.overline, color: colors.teal },
  qTools: { flexDirection: 'row', gap: 2 },
  iconBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center', borderRadius: radius.sm },
  label: { ...typography.label, color: colors.textSecondary },
  options: { gap: 0 },
  optionRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  addLink: { flexDirection: 'row', alignItems: 'center', gap: 4, minHeight: 36, alignSelf: 'flex-start' },
  addLinkText: { ...typography.label, color: colors.navy },
  addQuestion: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm, minHeight: 52,
    borderRadius: radius.lg, borderWidth: 1, borderStyle: 'dashed', borderColor: colors.border, backgroundColor: colors.bg,
  },
  requiredRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 44 },
  error: { ...typography.small, color: colors.redText, marginTop: 2 },

  answerBlock: { gap: spacing.sm, marginBottom: spacing.lg },
  qLabel: { ...typography.label, color: colors.text },
  checks: { gap: spacing.xs },
  check: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm, minHeight: MIN_TOUCH_TARGET,
    paddingHorizontal: spacing.md, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border,
    backgroundColor: colors.white,
  },
  checkOn: { borderColor: colors.primaryFill, backgroundColor: colors.bg },
  checkText: { ...typography.body, color: colors.text },

  summary: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, padding: spacing.md, borderRadius: radius.md },
  summaryOk: { backgroundColor: colors.tealBg },
  summaryWarn: { backgroundColor: colors.warningBg },
  summaryText: { ...typography.label },
  qa: { gap: 4, paddingBottom: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.borderLight },
  qaQuestion: { ...typography.caption, color: colors.textSecondary },
  qaAnswerRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: spacing.sm },
  qaAnswer: { ...typography.bodyStrong, color: colors.text, flexShrink: 1 },
  qaMissing: { color: colors.textMuted, fontFamily: fonts.body.regular, fontStyle: 'italic' },
  pref: { flexDirection: 'row', alignItems: 'center', gap: 3, paddingHorizontal: spacing.sm, paddingVertical: 2, borderRadius: radius.pill },
  prefOk: { backgroundColor: colors.tealBg },
  prefWarn: { backgroundColor: colors.warningBg },
  prefText: { ...typography.small, fontFamily: fonts.body.semibold },
});
