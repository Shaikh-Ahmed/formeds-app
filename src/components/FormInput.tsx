import React, { useRef, useState } from 'react';
import { Platform, View, Text, TextInput, StyleSheet, TouchableOpacity, TextInputProps } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, fonts, radius, spacing, typography, isPremium, MIN_TOUCH_TARGET } from '../theme';
import { FieldError, useFieldError } from './FieldError';

interface Props extends Omit<TextInputProps, 'style'> {
  label: string;
  icon?: keyof typeof Ionicons.glyphMap;
  error?: string;
  /** Renders a show/hide toggle and masks input. */
  secure?: boolean;
  /**
   * Visible rows for a multiline field. `style` is deliberately not accepted --
   * this component owns its appearance so a form cannot drift off the design
   * system -- but a paragraph field genuinely needs to be taller than a
   * single-line one, and the absence of any way to say so is why a duplicate
   * copy of this component grew inside the old jobs screen.
   */
  rows?: number;
}

const ROW_HEIGHT = 22;

export function FormInput({ label, icon, error, secure, rows, testID, ...inputProps }: Props) {
  const multiline = !!inputProps.multiline;
  const minHeight = multiline ? ROW_HEIGHT * (rows ?? 4) : undefined;
  const [hidden, setHidden] = useState(true);
  const err = useFieldError(error);
  const inputRef = useRef<TextInput>(null);
  const [focused, setFocused] = useState(false);
  return (
    <View style={styles.group}>
      <Text style={styles.label}>{label}</Text>
      <View
        style={[
          styles.wrap,
          multiline ? styles.wrapMultiline : null,
          isPremium && styles.pWrap,
          isPremium && focused && styles.pFocus,
          error ? styles.wrapError : null,
        ]}
      >
        {icon ? <Ionicons name={icon} size={20} color={colors.textMuted} style={styles.icon} /> : null}
        <TextInput
          ref={inputRef}
          testID={testID}
          style={[styles.input, multiline ? { minHeight } : null]}
          // Without this the cursor starts vertically centred on Android,
          // which looks like the field is misaligned rather than empty.
          textAlignVertical={multiline ? 'top' : undefined}
          placeholderTextColor={colors.textMuted}
          secureTextEntry={secure && hidden}
          accessibilityLabel={label}
          {...err.inputProps}
          {...inputProps}
          onFocus={e => { setFocused(true); inputProps.onFocus?.(e); }}
          onBlur={e => { setFocused(false); inputProps.onBlur?.(e); }}
        />
        {secure ? (
          <TouchableOpacity
            onPress={() => setHidden(h => !h)}
            accessibilityRole="button"
            accessibilityLabel={hidden ? 'Show password' : 'Hide password'}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          >
            <Ionicons name={hidden ? 'eye' : 'eye-off'} size={20} color={colors.textMuted} />
          </TouchableOpacity>
        ) : null}
      </View>
      <FieldError message={error} id={err.id} onFocusField={() => inputRef.current?.focus()} />
      {/* A counter for long text, once it is worth knowing: from 70% of the
          limit, so a short answer is not cluttered by "12 / 20000". */}
      {multiline && inputProps.maxLength && String(inputProps.value ?? '').length >= inputProps.maxLength * 0.7 ? (
        <Text style={styles.counter} accessibilityLiveRegion="polite">
          {String(inputProps.value ?? '').length.toLocaleString('en-IN')} / {inputProps.maxLength.toLocaleString('en-IN')}
        </Text>
      ) : null}
    </View>
  );
}


// ── ForMeds Premium: the field as a recessed well ─────────────────────────────
// A pale fill with no visible border and a faint inner shadow reads as a place
// to type; on focus it lifts to white with a teal ring. Error keeps a red ring.
const PREMIUM_WELL = {
  backgroundColor: colors.bgMuted,
  borderColor: 'transparent',
  borderRadius: radius.input,
  minHeight: 48,
  ...(Platform.OS === 'web' ? ({ boxShadow: 'inset 0 1px 2px rgba(15,23,42,0.06)', transition: 'background-color 200ms cubic-bezier(0.2,0,0,1), box-shadow 200ms cubic-bezier(0.2,0,0,1)' } as object) : {}),
};
const PREMIUM_FOCUS = Platform.OS === 'web'
  ? ({ backgroundColor: colors.white, borderColor: colors.teal, boxShadow: '0 0 0 3px rgba(15,118,110,0.14)' } as object)
  : { backgroundColor: colors.white, borderColor: colors.teal };

const styles = StyleSheet.create({
  group: { marginBottom: spacing.lg + 2 },
  label: { ...typography.label, color: colors.textBody, marginBottom: 6 },
  wrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.bg,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.lg - 2,
    minHeight: Math.max(MIN_TOUCH_TARGET, 52),
  },
  wrapError: { borderColor: colors.red },
  // A tall field aligns its icon and toggle to the first line, not the middle.
  wrapMultiline: { alignItems: 'flex-start', paddingVertical: spacing.sm },
  icon: { marginRight: spacing.sm + 2 },
  input: isPremium
    ? { flex: 1, fontSize: 15, fontFamily: fonts.body.medium, color: colors.text, paddingVertical: spacing.md }
    : { flex: 1, fontSize: 16, color: colors.text, paddingVertical: spacing.md },
  pWrap: PREMIUM_WELL,
  pFocus: PREMIUM_FOCUS,
  error: { color: colors.redText, fontSize: 13, marginTop: 4 },
  counter: { ...typography.small, color: colors.textSecondary, marginTop: 4, textAlign: 'right' },
});
