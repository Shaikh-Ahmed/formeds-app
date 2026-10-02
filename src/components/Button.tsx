import React, { useEffect, useRef, useState } from 'react';
import { Animated, Platform, Text, StyleSheet, TouchableOpacity, ActivityIndicator, ViewStyle, StyleProp, View } from 'react-native';
import { colors, radius, spacing, fonts, isRefined, isMaterial, isPremium, elevation, gloss, materials, MIN_TOUCH_TARGET } from '../theme';
import { GradientFill } from './material/Surfaces';
import { useReducedMotion } from '../hooks/useReducedMotion';

type Variant = 'primary' | 'secondary' | 'outline' | 'danger';

// The press animation lives on the button itself, so a caller's layout
// styles (flex: 1 in a footer) keep applying to the button as before.
const AnimatedTouchable = Animated.createAnimatedComponent(TouchableOpacity);

interface Props {
  label: string;
  /**
   * May return a promise: the button then stays busy (and refuses further
   * presses) until it settles, with no `loading` bookkeeping in the caller.
   */
  onPress: () => void | Promise<unknown>;
  variant?: Variant;
  loading?: boolean;
  /** What the button says while busy -- "Saving…", "Posting…". Spinner only if omitted. */
  loadingLabel?: string;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
  testID?: string;
  accessibilityHint?: string;
}

/**
 * Premium: a filled teal pill is the one primary action; secondary is tonal
 * (a pale teal well, teal words) -- present but quieter; outline is a white
 * pill with a hairline, for the third option.
 */
const PREMIUM_VARIANTS: Record<Variant, { bg: string; fg: string; border?: string }> = {
  primary: { bg: colors.action, fg: colors.white },
  secondary: { bg: colors.tealBg, fg: colors.teal, border: colors.tealLine },
  outline: { bg: colors.white, fg: colors.text, border: colors.border },
  danger: { bg: colors.redBg, fg: colors.redText, border: colors.redLine },
};

const VARIANTS: Record<Variant, { bg: string; fg: string; border?: string }> = isPremium ? PREMIUM_VARIANTS : {
  primary: { bg: colors.navy, fg: colors.white },
  secondary: { bg: colors.teal, fg: colors.white },
  // Material: outline buttons are frosted glass with teal text (see `glass`).
  outline: isMaterial
    ? { bg: 'transparent', fg: colors.teal, border: `rgba(${materials.tint},0.24)` }
    : { bg: 'transparent', fg: colors.navy, border: colors.border },
  danger: { bg: colors.redBg, fg: colors.red, border: '#FEE2E2' },
};

export function Button({ label, onPress, variant = 'primary', loading, loadingLabel, disabled, style, testID,
  accessibilityHint }: Props) {
  const v = VARIANTS[variant];
  const [pending, setPending] = useState(false);
  const inFlight = useRef(false);
  const mounted = useRef(true);
  useEffect(() => () => { mounted.current = false; }, []);

  const busy = !!loading || pending;
  const isDisabled = disabled || busy;
  // Material: a tactile press -- the button gives slightly under the finger.
  const reduced = useReducedMotion();
  const press = useRef(new Animated.Value(1)).current;
  const squeeze = (to: number) => {
    if (!(isMaterial || isPremium) || reduced) return;
    Animated.timing(press, { toValue: to, duration: 90, useNativeDriver: true }).start();
  };
  const filled = isMaterial && (variant === 'primary' || variant === 'secondary');

  // An async handler (any `async` function returns a promise) keeps the
  // button locked until it settles. The lock is a ref, so a double tap that
  // lands before React re-renders the button as disabled is still refused.
  const handlePress = () => {
    if (isDisabled || inFlight.current) return;
    const result = onPress();
    if (result && typeof (result as Promise<unknown>).then === 'function') {
      inFlight.current = true;
      setPending(true);
      (result as Promise<unknown>).catch(() => {}).finally(() => {
        inFlight.current = false;
        if (mounted.current) setPending(false);
      });
    }
  };

  return (
    <AnimatedTouchable
      testID={testID}
      onPress={handlePress}
      onPressIn={() => squeeze(0.97)}
      onPressOut={() => squeeze(1)}
      disabled={isDisabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled: !!isDisabled, busy }}
      style={[
        styles.btn,
        { backgroundColor: v.bg },
        v.border ? { borderWidth: 1, borderColor: v.border } : null,
        filled && styles.materialFilled,
        isMaterial && variant === 'outline' && gloss.glass,
        isPremium && variant === 'primary' && styles.premiumPrimary,
        isDisabled ? styles.disabled : null,
        style,
        isMaterial || isPremium ? { transform: [{ scale: press }] } : null,
      ]}
    >
      {filled ? (
        // The tactile fill: a vertical teal gradient with a lit top edge.
        <>
          <GradientFill name={variant === 'primary' ? 'primary' : 'shift'} style={StyleSheet.absoluteFill} pointerEvents="none" />
          {/* Gloss: light catching the top half of the button. */}
          <GradientFill name="sheen" style={StyleSheet.absoluteFill} pointerEvents="none" />
        </>
      ) : null}
      {busy ? (
        loadingLabel ? (
          <View style={styles.busyRow}>
            <ActivityIndicator color={v.fg} size="small" />
            <Text style={[styles.label, { color: v.fg }]}>{loadingLabel}</Text>
          </View>
        ) : (
          <ActivityIndicator color={v.fg} />
        )
      ) : (
        <Text style={[styles.label, { color: v.fg }]}>{label}</Text>
      )}
    </AnimatedTouchable>
  );
}

const styles = StyleSheet.create({
  btn: {
    // Premium: a slightly lower, squarer button (still >= 44px to touch).
    minHeight: isPremium ? 46 : isRefined ? 48 : Math.max(MIN_TOUCH_TARGET, 52),
    borderRadius: radius.button,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
  },
  // Premium sets the label in the brand face; a bare fontWeight would fall
  // back to the system font.
  label: isPremium ? { fontSize: 14, fontFamily: fonts.body.bold, letterSpacing: 0.1 }
    : isRefined ? { fontSize: 15, fontFamily: fonts.body.semibold } : { fontSize: 16, fontWeight: '700' },
  busyRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  disabled: { opacity: 0.6 },
  // Premium: the primary pill lifts a little off the page in its own colour.
  premiumPrimary: Platform.OS === 'web'
    ? ({ boxShadow: '0 1px 2px rgba(15,23,42,0.08), 0 4px 10px -2px rgba(15,118,110,0.28)', transition: 'background-color 200ms cubic-bezier(0.2,0,0,1)' } as object)
    : { shadowColor: '#0F766E', shadowOpacity: 0.22, shadowRadius: 6, shadowOffset: { width: 0, height: 3 }, elevation: 2 },
  materialFilled: {
    overflow: 'hidden',
    borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.28)',
    ...elevation.subtle,
    // Glow and lit inner edge (web); a teal shadow natively.
    ...gloss.fill,
  },
});
