import React, { useEffect, useState } from 'react';
import { View, Text, Image, StyleSheet, Platform } from 'react-native';
import { colors, radius, isMaterial } from '../theme';
import { getRoleMeta } from '../theme/roles';
import { initialOf } from '../utils/time';
import { mediaUri } from '../utils/media';

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
  const src = mediaUri(uri);
  // A photo that fails to load falls back to the initial, never a blank disc.
  const [failed, setFailed] = useState(false);
  useEffect(() => { setFailed(false); }, [src]);

  return (
    <View style={[styles.wrap, dim]} accessible accessibilityLabel={name ? `${name}${online ? ', online' : ''}` : 'Avatar'}>
      {/* The round frame does the clipping. Relying on the Image's own
          borderRadius left the photo square on the web at small sizes (the
          top bar). The presence dot sits outside the frame so it is not cut. */}
      <View style={[dim, styles.clip]}>
        {src && !failed ? (
          <Image source={{ uri: src }} style={styles.fill} resizeMode="cover" onError={() => setFailed(true)} />
        ) : (
          <View style={[styles.fill, styles.fallback, { backgroundColor: meta.color }, GLOSSY && styles.gloss]}>
            <Text style={[styles.initial, { fontSize: size * 0.4 }]}>{initialOf(name)}</Text>
          </View>
        )}
      </View>
      {online ? <View style={[styles.dot, { width: size * 0.28, height: size * 0.28, borderRadius: size * 0.14 }]} /> : null}
    </View>
  );
}

/** Material on the web: the initial disc as a glossy bead -- lit top-left, shaded below. */
const GLOSSY = isMaterial && Platform.OS === 'web';

const styles = StyleSheet.create({
  wrap: { position: 'relative' },
  clip: { overflow: 'hidden' },
  fill: { width: '100%', height: '100%' },
  fallback: { alignItems: 'center', justifyContent: 'center' },
  initial: { color: colors.white, fontWeight: '700' },
  gloss: {
    backgroundImage: 'radial-gradient(90% 90% at 28% 18%, rgba(255,255,255,0.32) 0%, rgba(255,255,255,0) 50%), '
      + 'linear-gradient(180deg, rgba(255,255,255,0.06) 0%, rgba(0,0,0,0.20) 100%)',
    boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.35), inset 0 -2px 4px rgba(0,0,0,0.12)',
  } as object,
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
