import React, { useEffect, useRef } from 'react';
import { Animated, Easing, Platform, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { fonts, isTerracotta } from '../../theme';
import { useReducedMotion } from '../../hooks/useReducedMotion';

/**
 * Soft 3D healthcare objects for ForMeds Material.
 *
 * Built from layered gradients, a specular highlight and a contact shadow --
 * no image files, so they cost nothing to download, stay crisp at any size,
 * and recolour with the theme. Used sparingly: heroes, AED, empty states and
 * the locum shift tile. Purely decorative, so hidden from screen readers.
 */

/**
 * The objects' colours: a lit off-white face, and the brand colour from light
 * to deep. Material blue, or Terracotta's clay.
 */
type Pair = [string, string];
export const objectTones: { light: Pair; capsuleLight: Pair; brand: Pair; brandDeep: Pair; tile: Pair; orb: [string, string, string] } = isTerracotta
  ? {
    light: ['#FDFBF7', '#F2E4D7'], capsuleLight: ['#FDFBF7', '#F1E3D5'],
    brand: ['#CF7A55', '#A3472A'], brandDeep: ['#CF7A55', '#863A21'],
    tile: ['#C2603D', '#A3472A'], orb: ['#F0BFA2', '#C2603D', '#863A21'],
  }
  : {
    light: ['#FFFFFF', '#E3ECF7'], capsuleLight: ['#FFFFFF', '#E3EAF6'],
    brand: ['#3E7CC4', '#003A72'], brandDeep: ['#3E7CC4', '#002E5C'],
    tile: ['#1D5B9E', '#003A72'], orb: ['#9CC2EE', '#2F6DB5', '#002E5C'],
  };

const HIDDEN = { accessible: false, importantForAccessibility: 'no-hide-descendants' as const };

/** Web-only soft edge; native keeps the plain translucent shape. */
const soften = (px: number) => (Platform.OS === 'web' ? ({ filter: `blur(${px}px)` } as object) : null);

/** A contact shadow under an object, so it sits on the surface. */
function Contact({ width }: { width: number }) {
  return <View style={[styles.contact, { width: width * 0.7, height: width * 0.12, borderRadius: width }, soften(width * 0.05)]} />;
}

/**
 * AED's AI orb: a glassy teal sphere with a highlight and an inner glow.
 * Breathes gently while `thinking` (skipped under reduce-motion).
 */
export function AiOrb({ size = 120, thinking = false }: { size?: number; thinking?: boolean }) {
  const reduced = useReducedMotion();
  const pulse = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (reduced) return;
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(pulse, { toValue: 1, duration: thinking ? 700 : 2400, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
      Animated.timing(pulse, { toValue: 0, duration: thinking ? 700 : 2400, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
    ]));
    loop.start();
    return () => loop.stop();
  }, [pulse, reduced, thinking]);
  const scale = pulse.interpolate({ inputRange: [0, 1], outputRange: [1, thinking ? 1.06 : 1.03] });
  return (
    <View style={{ alignItems: 'center' }} {...HIDDEN}>
      {/* Halo: the orb's light on the surface around it. */}
      <View style={[styles.halo, { width: size * 1.5, height: size * 1.5, borderRadius: size }]} />
      <Animated.View style={{ width: size, height: size, transform: [{ scale }] }}>
        <LinearGradient colors={objectTones.orb} start={{ x: 0.2, y: 0.1 }} end={{ x: 0.85, y: 0.95 }}
          style={[styles.sphere, { borderRadius: size / 2 }]} />
        {/* Light passing through the glass, pooling low on the far side... */}
        <View style={[styles.innerGlow, { width: size * 0.5, height: size * 0.4, borderRadius: size,
          right: size * 0.1, bottom: size * 0.1 }, soften(size * 0.08)]} />
        {/* ...and one soft specular highlight, upper left, where the light hits. */}
        <LinearGradient colors={['rgba(255,255,255,0.9)', 'rgba(255,255,255,0)']} start={{ x: 0.3, y: 0 }} end={{ x: 0.6, y: 1 }}
          style={[{ position: 'absolute', width: size * 0.36, height: size * 0.22, borderRadius: size,
            left: size * 0.18, top: size * 0.12, transform: [{ rotate: '-28deg' }] }, soften(size * 0.02)]} />
      </Animated.View>
      <Contact width={size} />
    </View>
  );
}

/** The medical cross, as a soft object on a disc. Heroes and empty states. */
export function SoftCross({ size = 96 }: { size?: number }) {
  const bar = size * 0.26;
  const len = size * 0.64;
  return (
    <View style={{ alignItems: 'center' }} {...HIDDEN}>
      <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
        <LinearGradient colors={objectTones.light} start={{ x: 0.2, y: 0 }} end={{ x: 0.8, y: 1 }}
          style={[styles.disc, { width: size, height: size, borderRadius: size / 2 }]} />
        {[{ width: bar, height: len }, { width: len, height: bar }].map((dim, i) => (
          <LinearGradient key={i} colors={objectTones.brand} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
            style={[styles.bar, dim, { borderRadius: bar * 0.32 }]} />
        ))}
        {/* Highlight across the top of the cross. */}
        <View style={{ position: 'absolute', width: bar * 0.55, height: len * 0.32, borderRadius: bar,
          top: size * 0.22, left: size / 2 - bar * 0.3, backgroundColor: 'rgba(255,255,255,0.45)' }} />
      </View>
      <Contact width={size} />
    </View>
  );
}

/** A two-tone capsule, tilted -- medication / clinical knowledge. */
export function SoftCapsule({ size = 80 }: { size?: number }) {
  const w = size * 0.42;
  const h = size;
  return (
    <View style={{ alignItems: 'center' }} {...HIDDEN}>
      <View style={{ width: h, height: h, alignItems: 'center', justifyContent: 'center', transform: [{ rotate: '-35deg' }] }}>
        <View style={{ width: w, height: h, borderRadius: w / 2, overflow: 'hidden', ...styles.objectShadow }}>
          <LinearGradient colors={objectTones.capsuleLight} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={{ height: h / 2 }} />
          <LinearGradient colors={objectTones.brandDeep} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={{ height: h / 2 }} />
          <View style={{ position: 'absolute', left: w * 0.18, top: h * 0.08, width: w * 0.22, height: h * 0.8,
            borderRadius: w, backgroundColor: 'rgba(255,255,255,0.5)' }} />
        </View>
      </View>
      <Contact width={size} />
    </View>
  );
}

/**
 * The locum shift tile: the date as a tactile object -- weekday, a large
 * day number and the month -- on the shift gradient.
 */
export function ShiftDateTile({ date, size = 64 }: { date: string; size?: number }) {
  const d = new Date(`${date}T00:00:00`);
  const valid = !Number.isNaN(d.getTime());
  const day = valid ? String(d.getDate()) : '–';
  const month = valid ? d.toLocaleDateString('en-IN', { month: 'short' }).toUpperCase() : '';
  const weekday = valid ? d.toLocaleDateString('en-IN', { weekday: 'short' }).toUpperCase() : '';
  return (
    <View style={[styles.tile, { width: size, borderRadius: size * 0.3 }]} {...HIDDEN}>
      <LinearGradient colors={objectTones.tile} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
        style={[StyleSheet.absoluteFill, { borderRadius: size * 0.3 }]} />
      <View style={[styles.tileShine, { borderRadius: size * 0.3 }]} />
      <Text style={[styles.tileSmall, { fontSize: size * 0.15 }]}>{weekday}</Text>
      <Text style={[styles.tileDay, { fontSize: size * 0.42, lineHeight: size * 0.5 }]}>{day}</Text>
      <Text style={[styles.tileSmall, { fontSize: size * 0.15 }]}>{month}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  contact: { marginTop: 8, backgroundColor: 'rgba(20,44,99,0.14)' },
  halo: { position: 'absolute', top: '-25%', backgroundColor: isTerracotta ? 'rgba(194,96,61,0.12)' : 'rgba(47,109,181,0.12)' },
  sphere: { ...StyleSheet.absoluteFillObject, shadowColor: '#142C63', shadowOpacity: 0.3, shadowRadius: 24, shadowOffset: { width: 0, height: 14 } },
  innerGlow: { position: 'absolute', backgroundColor: isTerracotta ? 'rgba(255,228,210,0.32)' : 'rgba(220,232,255,0.32)' },
  disc: { position: 'absolute', borderWidth: 1, borderColor: 'rgba(255,255,255,0.9)',
    shadowColor: '#142C63', shadowOpacity: 0.16, shadowRadius: 18, shadowOffset: { width: 0, height: 10 } },
  bar: { position: 'absolute', shadowColor: '#142C63', shadowOpacity: 0.22, shadowRadius: 8, shadowOffset: { width: 0, height: 4 } },
  objectShadow: { shadowColor: '#142C63', shadowOpacity: 0.22, shadowRadius: 12, shadowOffset: { width: 0, height: 8 } },
  tile: {
    paddingVertical: 8, alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
    shadowColor: '#142C63', shadowOpacity: 0.22, shadowRadius: 12, shadowOffset: { width: 0, height: 6 },
  },
  tileShine: { ...StyleSheet.absoluteFillObject, bottom: '55%', backgroundColor: 'rgba(255,255,255,0.12)' },
  tileSmall: { color: 'rgba(255,255,255,0.86)', fontFamily: fonts.body.semibold, letterSpacing: 0.8 },
  tileDay: { color: '#FFFFFF', fontFamily: fonts.heading.semibold },
});
