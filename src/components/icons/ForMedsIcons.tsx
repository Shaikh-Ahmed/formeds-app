import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../theme';

/**
 * A small ForMeds icon family for the product-defining concepts only; every
 * utility action keeps its standard icon. Built by composing the existing
 * outline icon set (one stroke weight throughout), so they sit at the same
 * visual weight as the icons beside them and stay legible at 20-24 px.
 */

/**
 * Locum: a shift -- a calendar day with a clock on it. Reads as "scheduled
 * clinical cover" where a plain calendar would read as "an event".
 */
export function LocumIcon({ size = 20, color = colors.navy, badgeBg = colors.white }: {
  size?: number; color?: string; badgeBg?: string;
}) {
  const badge = Math.round(size * 0.58);
  return (
    <View style={{ width: size, height: size }} accessible={false} importantForAccessibility="no">
      <Ionicons name="calendar-outline" size={size} color={color} />
      <View style={[styles.badge, {
        width: badge, height: badge, borderRadius: badge / 2, backgroundColor: badgeBg,
        right: -badge * 0.28, bottom: -badge * 0.22,
      }]}>
        <Ionicons name="time" size={badge} color={color} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: { position: 'absolute', alignItems: 'center', justifyContent: 'center' },
});
