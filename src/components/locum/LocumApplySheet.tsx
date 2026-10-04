import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, radius, spacing, typography } from '../../theme';
import { Button } from '../Button';
import { Sheet } from '../Sheet';
import { ErrorBanner } from '../States';
import { formatLocumPay, formatRoleLine, formatShiftDay, formatShiftHours } from './LocumMeta';
import type { Locum } from '../../types/locum';

const MAX_NOTE = 300;

/**
 * The whole application: confirm the shift, optionally add one line, send.
 *
 * Deliberately not ApplySheet. That one asks for a cover note sized for a
 * permanent role; a locum application is "yes, I can do that shift", and the
 * applicant's ForMeds profile -- specialty, experience, verification -- is
 * what the hospital actually screens on.
 */
export function LocumApplySheet({
  visible, locum, onClose, onSubmit, submitting, error,
}: {
  visible: boolean;
  locum: Locum | null;
  onClose: () => void;
  onSubmit: (note: string) => void;
  submitting?: boolean;
  error?: string | null;
}) {
  const [note, setNote] = useState('');
  useEffect(() => { if (visible) setNote(''); }, [visible]);

  return (
    <Sheet
      visible={visible}
      onClose={onClose}
      title="Apply for this locum"
      testID="locum-apply-sheet"
      footer={
        <>
          <Button label="Cancel" variant="outline" onPress={onClose} style={styles.flex} />
          <Button label="Send application" onPress={() => onSubmit(note.trim())}
            loading={submitting} style={styles.flex} testID="locum-apply-submit" />
        </>
      }
    >
      {locum ? (
        <View style={styles.body}>
          <View style={styles.summary}>
            <Text style={styles.title}>{formatRoleLine(locum)}</Text>
            <Text style={styles.line}>{locum.employer_name}</Text>
            <Text style={styles.line}>
              {formatShiftDay(locum.shift_date)} · {formatShiftHours(locum)}
            </Text>
            <Text style={styles.line}>{formatLocumPay(locum)}</Text>
          </View>

          <View style={styles.profile}>
            <Ionicons name="id-card-outline" size={18} color={colors.teal} />
            <Text style={styles.profileText}>
              The hospital will see your ForMeds profile, including your specialty,
              experience and verification. Your phone number and email stay private.
            </Text>
          </View>

          <Text style={styles.label}>Anything the hospital should know? (optional)</Text>
          <TextInput maxLength={300}
            value={note}
            onChangeText={v => setNote(v.slice(0, MAX_NOTE))}
            placeholder="e.g. I can arrive 30 minutes early for handover"
            placeholderTextColor={colors.textMuted}
            multiline
            style={styles.input}
            accessibilityLabel="Note to the hospital"
            testID="locum-apply-note"
          />
          <Text style={styles.count}>{note.length}/{MAX_NOTE}</Text>
          <ErrorBanner message={error} />
        </View>
      ) : null}
    </Sheet>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  body: { paddingHorizontal: spacing.xl, paddingBottom: spacing.md, gap: spacing.md },
  summary: {
    gap: 2,
    padding: spacing.md,
    borderRadius: radius.lg,
    backgroundColor: colors.bgMuted,
  },
  title: { ...typography.bodyStrong, color: colors.text },
  line: { ...typography.caption, color: colors.textSecondary },
  profile: { flexDirection: 'row', gap: spacing.sm, alignItems: 'flex-start' },
  profileText: { ...typography.caption, color: colors.textSecondary, flex: 1, lineHeight: 19 },
  label: { ...typography.label, color: colors.text },
  input: {
    ...typography.body,
    color: colors.text,
    minHeight: 72,
    padding: spacing.md,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    textAlignVertical: 'top',
  },
  count: { ...typography.small, color: colors.textMuted, alignSelf: 'flex-end' },
});
