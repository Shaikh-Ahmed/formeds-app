import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { colors, spacing, typography } from '../../theme';
import { Button } from '../Button';
import { FormInput } from '../FormInput';
import { DateTimeField } from '../InputFields';
import { nowMinuteString } from '../../utils/validation';
import { Sheet } from '../Sheet';
import { ErrorBanner } from '../States';
import { ChoiceChips } from './ChoiceChips';
import type { ManagedLocumApplication } from '../../types/locum';

export type InterviewResult = 'scheduled' | 'passed' | 'failed';

const AT_RE = /^\d{4}-\d{2}-\d{2}T([01]\d|2[0-3]):[0-5]\d$/;

/**
 * Record an interview: when it is, or how it went. Deliberately three choices
 * and a note -- this is a quick staffing decision, not an ATS scorecard.
 *
 * A pass is remembered for this hospital, which the sheet says out loud, so
 * the hospital knows why the next application from this person will arrive
 * already cleared.
 */
export function LocumInterviewSheet({
  app, initialResult = 'scheduled', onClose, onSubmit, submitting, error,
}: {
  app: ManagedLocumApplication | null;
  initialResult?: InterviewResult;
  onClose: () => void;
  onSubmit: (data: { result: InterviewResult; interview_at?: string; notes?: string }) => void;
  submitting?: boolean;
  error?: string | null;
}) {
  const [result, setResult] = useState<InterviewResult>(initialResult);
  const [at, setAt] = useState('');
  const [notes, setNotes] = useState('');
  const [localError, setLocalError] = useState<string | null>(null);

  useEffect(() => {
    if (!app) return;
    setResult(initialResult);
    setAt(app.interview_at ? toLocalInput(app.interview_at) : '');
    setNotes(app.interview_notes || '');
    setLocalError(null);
  }, [app, initialResult]);

  const submit = () => {
    if (result === 'scheduled' && at) {
      // Under the date field, where it can be fixed.
      if (!AT_RE.test(at)) { setLocalError('Please choose a valid interview date and time.'); return; }
      if (at <= nowMinuteString()) { setLocalError('Interview time cannot be in the past.'); return; }
    }
    setLocalError(null);
    return onSubmit({
      result,
      interview_at: result === 'scheduled' && at ? at : undefined,
      notes: notes.trim() || undefined,
    });
  };

  return (
    <Sheet
      visible={!!app}
      onClose={onClose}
      title={app?.applicant?.name ? `Interview · ${app.applicant.name}` : 'Interview'}
      testID="locum-interview-sheet"
      footer={
        <>
          <Button label="Cancel" variant="outline" onPress={onClose} style={styles.flex} />
          <Button label="Save" loadingLabel="Saving…" onPress={submit} loading={submitting} style={styles.flex}
            testID="locum-interview-save" />
        </>
      }
    >
      <View style={styles.body}>
        <ChoiceChips
          label="Interview"
          choices={[
            { value: 'scheduled', label: 'Schedule', icon: 'calendar-outline' },
            { value: 'passed', label: 'Passed', icon: 'checkmark-circle-outline' },
            { value: 'failed', label: 'Not cleared', icon: 'close-circle-outline' },
          ]}
          value={result}
          onChange={v => v && setResult(v)}
          testID="locum-interview-result"
        />
        {result === 'scheduled' ? (
          <DateTimeField label="When (optional)" value={at} min={nowMinuteString()} clearable
            helper="Before the shift starts." testID="locum-interview-at" error={localError}
            onChange={v => { setAt(v); setLocalError(null); }} />
        ) : (
          <Text style={styles.hint}>
            {result === 'passed'
              ? 'A pass is remembered for your hospital: next time this professional applies, they will show as Interview cleared and can be selected directly.'
              : 'They will not be considered further for this locum.'}
          </Text>
        )}
        <FormInput label="Private notes (only your team sees these)" value={notes}
          onChangeText={setNotes} multiline rows={3} maxLength={1000} testID="locum-interview-notes" />
        <ErrorBanner message={error} />
      </View>
    </Sheet>
  );
}

/** An ISO instant as "YYYY-MM-DD HH:MM" in the device's local time. */
function toLocalInput(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  body: { paddingHorizontal: spacing.xl, paddingBottom: spacing.md, gap: spacing.md },
  hint: { ...typography.caption, color: colors.textSecondary, lineHeight: 19 },
});
