import React, { useEffect, useRef, useState } from 'react';
import {
  AccessibilityInfo, Animated, StyleSheet, View,
  type DimensionValue, type StyleProp, type ViewStyle,
} from 'react-native';
import { colors, radius, spacing } from '../theme';

/**
 * Loading placeholders shaped like the content that is coming.
 *
 * The app had no skeletons at all — every list showed a centred spinner, which
 * tells the user something is happening but not what, and collapses the layout
 * so the first paint jumps. A block roughly the size of the real row keeps the
 * page still and makes the wait feel shorter than the same wait behind a
 * spinner.
 *
 * The pulse honours reduce-motion by simply not animating: a still block is a
 * perfectly good placeholder, and a looping opacity animation is exactly the
 * kind of ambient movement that setting exists to stop.
 */

const PULSE_MS = 900;
const DIM = 0.45;

function usePulse(): Animated.AnimatedInterpolation<number> | number {
  const value = useRef(new Animated.Value(1)).current;
  const [reduceMotion, setReduceMotion] = useState(false);

  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled().then(setReduceMotion).catch(() => {});
  }, []);

  useEffect(() => {
    if (reduceMotion) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(value, { toValue: DIM, duration: PULSE_MS, useNativeDriver: true }),
        Animated.timing(value, { toValue: 1, duration: PULSE_MS, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [reduceMotion, value]);

  return reduceMotion ? DIM : value;
}

export function Skeleton({
  width = '100%',
  height = 12,
  radius: r = radius.sm,
  style,
}: {
  width?: DimensionValue;
  height?: number;
  radius?: number;
  style?: StyleProp<ViewStyle>;
}) {
  const opacity = usePulse();
  return (
    <Animated.View
      // Placeholders are decorative: a screen reader announcing six empty
      // blocks is worse than silence. The list itself announces the load.
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[{ width, height, borderRadius: r, backgroundColor: colors.bgMuted, opacity }, style]}
    />
  );
}

/** A paragraph of placeholder lines, last one short so it reads as prose. */
export function SkeletonText({ lines = 3, gap = spacing.sm }: { lines?: number; gap?: number }) {
  return (
    <View style={{ gap }}>
      {Array.from({ length: lines }, (_, i) => (
        <Skeleton key={i} height={10} width={i === lines - 1 ? '60%' : '100%'} />
      ))}
    </View>
  );
}

export const skeletonStyles = StyleSheet.create({
  card: {
    backgroundColor: colors.card,
    borderRadius: radius.xl + 2,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    gap: spacing.md,
  },
});
