import React from 'react';
import { Text, StyleSheet, TouchableOpacity, ActivityIndicator, ViewStyle, StyleProp } from 'react-native';
import { colors, radius, spacing, MIN_TOUCH_TARGET } from '../theme';

type Variant = 'primary' | 'secondary' | 'outline' | 'danger';

interface Props {
  label: string;
  onPress: () => void;
  variant?: Variant;
  loading?: boolean;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
  testID?: string;
  accessibilityHint?: string;
}

const VARIANTS: Record<Variant, { bg: string; fg: string; border?: string }> = {
  primary: { bg: colors.navy, fg: colors.white },
  secondary: { bg: colors.teal, fg: colors.white },
  outline: { bg: 'transparent', fg: colors.navy, border: colors.border },
  danger: { bg: colors.redBg, fg: colors.red, border: '#FEE2E2' },
};

export function Button({ label, onPress, variant = 'primary', loading, disabled, style, testID, accessibilityHint }: Props) {
  const v = VARIANTS[variant];
  const isDisabled = disabled || loading;
  return (
    <TouchableOpacity
      testID={testID}
      onPress={onPress}
      disabled={isDisabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled: !!isDisabled, busy: !!loading }}
      style={[
        styles.btn,
        { backgroundColor: v.bg },
        v.border ? { borderWidth: 1, borderColor: v.border } : null,
        isDisabled ? styles.disabled : null,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={v.fg} />
      ) : (
        <Text style={[styles.label, { color: v.fg }]}>{label}</Text>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  btn: {
    minHeight: Math.max(MIN_TOUCH_TARGET, 52),
    borderRadius: radius.xl,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
  },
  label: { fontSize: 16, fontWeight: '700' },
  disabled: { opacity: 0.6 },
});
