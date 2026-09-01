import React, { useState } from 'react';
import { View, Text, TextInput, StyleSheet, TouchableOpacity, TextInputProps } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, radius, spacing, typography, MIN_TOUCH_TARGET } from '../theme';

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
  return (
    <View style={styles.group}>
      <Text style={styles.label}>{label}</Text>
      <View
        style={[
          styles.wrap,
          multiline ? styles.wrapMultiline : null,
          error ? styles.wrapError : null,
        ]}
      >
        {icon ? <Ionicons name={icon} size={20} color={colors.textMuted} style={styles.icon} /> : null}
        <TextInput
          testID={testID}
          style={[styles.input, multiline ? { minHeight } : null]}
          // Without this the cursor starts vertically centred on Android,
          // which looks like the field is misaligned rather than empty.
          textAlignVertical={multiline ? 'top' : undefined}
          placeholderTextColor={colors.textMuted}
          secureTextEntry={secure && hidden}
          accessibilityLabel={label}
          {...inputProps}
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
      {error ? <Text style={styles.error} accessibilityRole="alert">{error}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  group: { marginBottom: spacing.lg + 2 },
  label: { ...typography.label, color: '#334155', marginBottom: 6 },
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
  input: { flex: 1, fontSize: 16, color: colors.text, paddingVertical: spacing.md },
  error: { color: colors.red, fontSize: 13, marginTop: 4 },
});
