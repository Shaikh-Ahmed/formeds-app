import React, { useEffect, useRef } from 'react';
import { Animated, Easing, Platform, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../theme';
import { useReducedMotion } from '../hooks/useReducedMotion';
import { HEART_CSS, HEART_RED, heartSvg } from '../utils/heartLoaderSvg';

/**
 * The ForMeds loading heart, for the app's own full-screen loading states
 * (fonts, restoring the session). The very first load is covered by the same
 * heart in the HTML shell; this one takes over whenever the app is waiting
 * again later, so loading always looks the same.
 *
 * Web draws the full heart -- ECG trace and rising fill -- from the shared
 * SVG. Native has no SVG renderer in this app, so it fills an outlined heart
 * icon from the bottom with a gentle beat: the same idea, no new dependency.
 */
export function HeartLoader({ size = 120 }: { size?: number }) {
  return (
    <View
      style={[styles.fill, { backgroundColor: colors.bg }]}
      accessibilityRole="progressbar"
      accessibilityLabel="Loading ForMeds"
      testID="heart-loader"
    >
      {Platform.OS === 'web' ? <WebHeart size={size} /> : <NativeHeart size={size * 0.6} />}
    </View>
  );
}

let cssInjected = false;

function WebHeart({ size }: { size: number }) {
  useEffect(() => {
    // The shell already carries the CSS on a full page load; a client-only
    // render (tests, a dev reload) may not, so add it once if missing.
    if (cssInjected || typeof document === 'undefined') return;
    cssInjected = true;
    if (document.getElementById('fm-heart-css')) return;
    const style = document.createElement('style');
    style.id = 'fm-heart-css';
    style.textContent = HEART_CSS;
    document.head.appendChild(style);
  }, []);
  return React.createElement('div', {
    style: { display: 'flex' },
    dangerouslySetInnerHTML: { __html: heartSvg('fm-app', { loop: true, size }) },
  });
}

function NativeHeart({ size }: { size: number }) {
  const reduced = useReducedMotion();
  const level = useRef(new Animated.Value(0)).current;
  const beat = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (reduced) {
      level.setValue(0.6);
      return;
    }
    const fill = Animated.loop(Animated.timing(level, {
      toValue: 1, duration: 2200, easing: Easing.inOut(Easing.ease), useNativeDriver: false,
    }));
    const pulse = Animated.loop(Animated.sequence([
      Animated.timing(beat, { toValue: 1, duration: 180, useNativeDriver: true }),
      Animated.timing(beat, { toValue: 0, duration: 220, useNativeDriver: true }),
      Animated.delay(900),
    ]));
    fill.start();
    pulse.start();
    return () => { fill.stop(); pulse.stop(); };
  }, [reduced, level, beat]);

  const height = level.interpolate({ inputRange: [0, 1], outputRange: [0, size] });
  const scale = beat.interpolate({ inputRange: [0, 1], outputRange: [1, 1.06] });
  return (
    <Animated.View style={{ width: size, height: size, transform: [{ scale }] }}>
      <Ionicons name="heart-outline" size={size} color={HEART_RED} style={StyleSheet.absoluteFill} />
      <Animated.View style={[styles.rise, { height }]}>
        <Ionicons name="heart" size={size} color={HEART_RED} style={{ position: 'absolute', bottom: 0 }} />
      </Animated.View>
    </Animated.View>
  );
}

/**
 * Tell the HTML shell's boot heart the app is ready, so it fills to the top
 * and fades. Safe to call more than once and off the web.
 */
export function signalBootDone() {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return;
  (window as any).__formedsBootDone?.();
}

const styles = StyleSheet.create({
  fill: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  rise: { position: 'absolute', left: 0, right: 0, bottom: 0, overflow: 'hidden' },
});
