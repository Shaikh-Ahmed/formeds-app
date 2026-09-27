import React from 'react';
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, fonts } from '../../theme';

/**
 * The AED mark: the internationally recognised defibrillator sign -- "AED" in
 * a small outlined plate above a heart with a lightning bolt -- in white on a
 * red rounded badge.
 *
 * Built from Views, Text and Ionicons rather than an SVG, so it adds no
 * dependency and renders identically on iOS, Android and web.
 *
 *  - `badge` (default): the full mark on red. Below BADGE_TEXT_MIN the "AED"
 *    plate is dropped, because letters that small are a smudge.
 *  - `glyph`: just the heart-and-bolt, in `color`, for inline use on a light
 *    surface (the desktop top-bar pill).
 */

const BADGE_TEXT_MIN = 30;

export function AedLogo({
  size = 40,
  variant = 'badge',
  color = colors.red,
  round = false,
  style,
  testID,
}: {
  size?: number;
  variant?: 'badge' | 'glyph';
  color?: string;
  /** A circle instead of the rounded square -- for the floating button. */
  round?: boolean;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}) {
  if (variant === 'glyph') {
    return <HeartBolt size={size} color={color} style={style} testID={testID} />;
  }

  const withText = size >= BADGE_TEXT_MIN;
  const heart = withText ? size * 0.46 : size * 0.62;

  return (
    <View
      testID={testID}
      accessibilityLabel="AED"
      style={[
        styles.badge,
        { width: size, height: size, borderRadius: round ? size / 2 : size * 0.26 },
        style,
      ]}
    >
      {withText ? (
        <View style={[styles.plate, { borderWidth: Math.max(1, size * 0.03), paddingHorizontal: size * 0.05 }]}>
          <Text style={[styles.plateText, { fontSize: size * 0.2, lineHeight: size * 0.24 }]}>AED</Text>
        </View>
      ) : null}
      <HeartBolt size={heart} color={colors.white} />
    </View>
  );
}

function HeartBolt({
  size, color, style, testID,
}: { size: number; color: string; style?: StyleProp<ViewStyle>; testID?: string }) {
  return (
    <View testID={testID} style={[{ width: size, height: size }, styles.center, style]}>
      <Ionicons name="heart-outline" size={size} color={color} />
      <View style={[StyleSheet.absoluteFill, styles.center, { paddingTop: size * 0.06 }]}>
        <Ionicons name="flash" size={size * 0.46} color={color} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    backgroundColor: colors.red,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 1,
  },
  plate: { borderColor: colors.white, borderRadius: 3 },
  plateText: { color: colors.white, fontFamily: fonts.heading.bold, letterSpacing: 0.5 },
  center: { alignItems: 'center', justifyContent: 'center' },
});
