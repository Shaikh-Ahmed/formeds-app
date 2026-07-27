import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { radius, spacing } from '../theme';
import { getRoleMeta } from '../theme/roles';

interface Props {
  role?: string | null;
  /** Use the full label ("Healthcare Professional") instead of the short one. */
  long?: boolean;
}

export function RoleBadge({ role, long }: Props) {
  const meta = getRoleMeta(role);
  const text = long ? meta.longLabel : meta.label;
  return (
    <View style={[styles.badge, { backgroundColor: meta.bg }]} accessible accessibilityLabel={`Role: ${text}`}>
      <Text style={[styles.text, { color: meta.color }]}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: 3,
    borderRadius: radius.sm,
    alignSelf: 'flex-start',
  },
  text: { fontSize: 11, fontWeight: '700' },
});
