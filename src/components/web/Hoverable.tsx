import React, { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import type { StyleProp, ViewStyle } from 'react-native';

/**
 * Hover + focus affordances, which a phone-only UI never needed.
 *
 * A pointer user expects a target to respond before they commit to a click.
 * `TouchableOpacity` gives nothing on hover, so every clickable surface on
 * desktop looked inert. This wraps Pressable and exposes the hovered state so
 * a caller can tint the background, without any screen hand-rolling mouse
 * handlers.
 *
 * Focus is deliberately NOT styled here — the global `:focus-visible` rule in
 * app/+html.tsx draws one consistent ring for keyboard users across the whole
 * app, which is both less code and harder to accidentally remove.
 */
export function Hoverable({
  children,
  onPress,
  style,
  hoverStyle,
  disabled,
  accessibilityLabel,
  accessibilityRole = 'button',
  accessibilityState,
  testID,
  /** Render as a plain View when there is no press handler (e.g. static cards). */
  as,
}: {
  children: React.ReactNode | ((state: { hovered: boolean }) => React.ReactNode);
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
  hoverStyle?: StyleProp<ViewStyle>;
  disabled?: boolean;
  accessibilityLabel?: string;
  accessibilityRole?: 'button' | 'link' | 'tab' | 'none';
  accessibilityState?: { selected?: boolean; disabled?: boolean };
  testID?: string;
  as?: 'view';
}) {
  const [hovered, setHovered] = useState(false);
  const render = () => (typeof children === 'function' ? children({ hovered }) : children);

  if (as === 'view' || !onPress) {
    return (
      <View style={style} testID={testID}>
        {render()}
      </View>
    );
  }

  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      disabled={disabled}
      accessibilityRole={accessibilityRole}
      accessibilityLabel={accessibilityLabel}
      accessibilityState={accessibilityState}
      onHoverIn={() => setHovered(true)}
      onHoverOut={() => setHovered(false)}
      style={({ pressed }) => [
        style,
        hovered && !disabled && (hoverStyle ?? styles.defaultHover),
        // Touch devices get the press feedback they already had.
        pressed && !disabled && styles.pressed,
        disabled && styles.disabled,
      ]}
    >
      {render()}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  defaultHover: { backgroundColor: 'rgba(15, 23, 42, 0.04)' },
  pressed: { opacity: 0.7 },
  disabled: { opacity: 0.5 },
});
