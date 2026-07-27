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
}

export function FormInput({ label, icon, error, secure, testID, ...inputProps }: Props) {
  const [hidden, setHidden] = useState(true);
  return (
    <View style={styles.group}>
      <Text style={styles.label}>{label}</Text>
      <View style={[styles.wrap, error ? styles.wrapError : null]}>
        {icon ? <Ionicons name={icon} size={20} color={colors.textMuted} style={styles.icon} /> : null}
        <TextInput
          testID={testID}
          style={styles.input}
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
  icon: { marginRight: spacing.sm + 2 },
  input: { flex: 1, fontSize: 16, color: colors.text, paddingVertical: spacing.md },
  error: { color: colors.red, fontSize: 13, marginTop: 4 },
});
