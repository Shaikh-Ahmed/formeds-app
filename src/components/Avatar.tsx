import React from 'react';
import { View, Text, Image, StyleSheet } from 'react-native';
import { colors, radius } from '../theme';
import { getRoleMeta } from '../theme/roles';
import { initialOf } from '../utils/time';

interface Props {
  name?: string | null;
  role?: string | null;
  uri?: string | null;
  size?: number;
  /** Presence dot. Pairs colour with a border so it isn't colour-only. */
  online?: boolean;
}

export function Avatar({ name, role, uri, size = 48, online }: Props) {
  const meta = getRoleMeta(role);
  const dim = { width: size, height: size, borderRadius: size / 2 };

  return (
    <View style={[styles.wrap, dim]} accessible accessibilityLabel={name ? `${name}${online ? ', online' : ''}` : 'Avatar'}>
      {uri ? (
        <Image source={{ uri }} style={[dim]} resizeMode="cover" />
      ) : (
        <View style={[dim, styles.fallback, { backgroundColor: meta.color }]}>
          <Text style={[styles.initial, { fontSize: size * 0.4 }]}>{initialOf(name)}</Text>
        </View>
      )}
      {online ? <View style={[styles.dot, { width: size * 0.28, height: size * 0.28, borderRadius: size * 0.14 }]} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'relative' },
  fallback: { alignItems: 'center', justifyContent: 'center' },
  initial: { color: colors.white, fontWeight: '700' },
  dot: {
    position: 'absolute',
    right: 0,
    bottom: 0,
    backgroundColor: colors.online,
    borderWidth: 2,
    borderColor: colors.white,
    borderRadius: radius.pill,
  },
});
