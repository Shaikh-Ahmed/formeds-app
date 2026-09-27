import React, { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { spacing } from '../../../theme';
import { Sheet } from '../../Sheet';
import { Button } from '../../Button';
import { FormInput } from '../../FormInput';
import { DateTimeField } from '../../InputFields';
import { ErrorBanner } from '../../States';
import { ChoiceChips } from '../../locum/ChoiceChips';
import { nowMinuteString } from '../../../utils/validation';
import { INTERVIEW_MODE_LABELS, type InterviewInfo, type InterviewMode } from '../../../types/applicants';

/** Local "YYYY-MM-DDTHH:MM" for a stored ISO moment, for the picker. */
function toLocal(iso?: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

/**
 * Schedule or move an interview: when, how, where (an address, a meeting
 * link or a number, depending on how), and private notes. The applicant is
 * told the time, mode and place; never the notes.
 */
export function InterviewSheet({ visible, name, current, onClose, onSave, saving, error }: {
  visible: boolean; name: string; current: InterviewInfo | null; onClose: () => void;
  onSave: (v: { interview_at: string; mode: InterviewMode; location: string; notes: string }) => void;
  saving?: boolean; error?: string | null;
}) {
  const [at, setAt] = useState('');
  const [mode, setMode] = useState<InterviewMode>('in_person');
  const [location, setLocation] = useState('');
  const [notes, setNotes] = useState('');
  const [local, setLocal] = useState<string | null>(null);

  useEffect(() => {
    if (!visible) return;
    setAt(toLocal(current?.interview_at));
    setMode(current?.interview_mode ?? 'in_person');
    setLocation(current?.interview_location ?? '');
    setNotes(current?.notes ?? '');
    setLocal(null);
  }, [visible, current]);

  const save = () => {
    if (!at) { setLocal('Please choose the interview date and time.'); return; }
    if (at <= nowMinuteString()) { setLocal('Interview time cannot be in the past.'); return; }
    if (mode === 'video' && location && !/^https?:\/\//i.test(location.trim())) {
      setLocal('A video interview needs a meeting link starting with https://'); return;
    }
    setLocal(null);
    onSave({ interview_at: at, mode, location: location.trim(), notes: notes.trim() });
  };

  const place = mode === 'video' ? 'Meeting link' : mode === 'phone' ? 'Number to call (optional)' : 'Address';

  return (
    <Sheet visible={visible} onClose={onClose} title={`${current ? 'Reschedule' : 'Schedule'} interview · ${name}`}
      testID="interview-sheet"
      footer={(
        <View style={styles.footer}>
          <Button label="Cancel" variant="outline" onPress={onClose} style={styles.btn} />
          <Button label={current ? 'Reschedule' : 'Schedule'} onPress={save} loading={saving} style={styles.btn}
            testID="interview-save" />
        </View>
      )}>
      <View style={styles.body}>
        <ErrorBanner message={local || error} />
        <DateTimeField label="Date and time" value={at} onChange={setAt} min={nowMinuteString()} testID="interview-at" />
        <ChoiceChips label="How" value={mode} onChange={v => v && setMode(v)} testID="interview-mode"
          choices={(Object.keys(INTERVIEW_MODE_LABELS) as InterviewMode[]).map(m => ({ value: m, label: INTERVIEW_MODE_LABELS[m] }))} />
        <FormInput label={place} value={location} onChangeText={setLocation} maxLength={300}
          keyboardType={mode === 'video' ? 'url' : mode === 'phone' ? 'phone-pad' : 'default'}
          autoCapitalize={mode === 'video' ? 'none' : 'sentences'}
          placeholder={mode === 'video' ? 'https://meet.example.com/…' : mode === 'phone' ? '' : 'e.g. HR office, 2nd floor, main block'}
          testID="interview-location" />
        <FormInput label="Private notes (only your team sees these)" value={notes} onChangeText={setNotes}
          multiline rows={3} maxLength={1000} testID="interview-notes" />
      </View>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  body: { padding: spacing.lg, gap: spacing.xs },
  footer: { flexDirection: 'row', gap: spacing.sm },
  btn: { flex: 1 },
});
