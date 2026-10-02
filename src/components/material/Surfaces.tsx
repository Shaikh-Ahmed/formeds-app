import React from 'react';
import { Platform, StyleSheet, View, type StyleProp, type ViewProps, type ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { colors, elevation, isTerracotta, materials, radius, spacing } from '../../theme';

/** The soft pool of light low on a hero: brand-light blue, or apricot in Terracotta. */
const POOL = isTerracotta ? '230,140,100' : '47,109,181';

type GradientName = keyof typeof materials.gradients;

/** A named gradient from the theme -- never an inline one-off. */
export function GradientFill({ name, style, children, ...rest }: {
  name: GradientName; style?: StyleProp<ViewStyle>; children?: React.ReactNode;
} & Omit<ViewProps, 'style'>) {
  const g = materials.gradients[name];
  return (
    <LinearGradient colors={g.colors} locations={g.locations} start={g.start} end={g.end} style={style} {...rest}>
      {children}
    </LinearGradient>
  );
}

/**
 * The page wallpaper behind every card (Material only): fills its parent and
 * sits under the content. Decorative, so hidden from assistive tech and never
 * a touch target.
 */
export function PageBackdrop() {
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none" accessible={false}
      importantForAccessibility="no-hide-descendants">
      {Platform.OS === 'web' && materials.backdropWeb
        // The picture is anchored to the viewport (background-attachment, not
        // a fixed element -- that would paint over earlier bars), so every
        // instance shows the same image and they meet without a seam.
        ? <View style={[StyleSheet.absoluteFill, {
          backgroundImage: materials.backdropWeb, backgroundAttachment: 'fixed',
        } as object]} />
        : <GradientFill name="page" style={StyleSheet.absoluteFill} />}
    </View>
  );
}

/**
 * The depth ladder: page (0) -> card (1) -> raised card (2) -> floating (3),
 * plus `featured` (priority content) and `glass` (selective translucency).
 * One place decides what each level looks like.
 */
export type SurfaceLevel = 1 | 2 | 3 | 'featured' | 'glass';

const WEB_BLUR = Platform.OS === 'web' ? ({ backdropFilter: materials.glass.blur, WebkitBackdropFilter: materials.glass.blur } as any) : null;

export function Surface({ level = 1, style, children, ...rest }: {
  level?: SurfaceLevel; style?: StyleProp<ViewStyle>; children?: React.ReactNode;
} & Omit<ViewProps, 'style'>) {
  if (level === 'featured') {
    return (
      <View style={[styles.base, styles.featured, style]} {...rest}>
        <GradientFill name="featured" style={StyleSheet.absoluteFill} pointerEvents="none" />
        {children}
      </View>
    );
  }
  return (
    <View style={[styles.base, LEVELS[level], level === 'glass' && WEB_BLUR, style]} {...rest}>
      {children}
    </View>
  );
}

/** Glass on a dark hero: a translucent chip or panel with a light edge. */
export function GlassPanel({ onDark = false, style, children, ...rest }: {
  onDark?: boolean; style?: StyleProp<ViewStyle>; children?: React.ReactNode;
} & Omit<ViewProps, 'style'>) {
  return (
    <View style={[styles.glass, onDark ? styles.glassDark : styles.glassLight, WEB_BLUR, style]} {...rest}>
      {children}
    </View>
  );
}

/**
 * A hero: the theme's deep gradient, two soft light pools for depth, and room
 * for a soft object on the right. Content is the caller's -- always real data.
 */
export function HeroCard({ children, object, compact = false, style, testID }: {
  children: React.ReactNode; object?: React.ReactNode;
  /** Phone size: tighter padding and corner, same layers. */
  compact?: boolean;
  style?: StyleProp<ViewStyle>; testID?: string;
}) {
  return (
    <View style={[styles.hero, compact && styles.heroCompact, style]} testID={testID}>
      <GradientFill name="hero" style={StyleSheet.absoluteFill} pointerEvents="none" />
      <View style={[styles.pool, styles.poolA]} pointerEvents="none" />
      <View style={[styles.pool, styles.poolB]} pointerEvents="none" />
      {Platform.OS === 'web' && materials.heroTraceWeb ? (
        <View pointerEvents="none" style={[styles.trace, {
          backgroundImage: materials.heroTraceWeb, backgroundSize: '100% 100%', backgroundRepeat: 'no-repeat',
        } as object]} />
      ) : null}
      {/* Gloss: a sheen over the top half and a bright rim on the top edge. */}
      <GradientFill name="sheen" style={StyleSheet.absoluteFill} pointerEvents="none" />
      <View style={[styles.rim, { borderRadius: compact ? radius.card : radius.sheet }]} pointerEvents="none" />
      <View style={[styles.heroRow, compact && styles.heroRowCompact]}>
        <View style={styles.heroBody}>{children}</View>
        {object ? <View style={styles.heroObject} pointerEvents="none">{object}</View> : null}
      </View>
    </View>
  );
}

/**
 * A cover band for profiles without an uploaded photo: the hero gradient,
 * soft light pools, and -- for organisations -- a faint architectural rhythm
 * of window panes. Decorative only; a real cover photo always wins.
 */
export function CoverArt({ variant = 'person' }: { variant?: 'person' | 'organization' }) {
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none" accessible={false} importantForAccessibility="no-hide-descendants">
      <GradientFill name="hero" style={StyleSheet.absoluteFill} />
      <View style={[styles.pool, styles.coverPoolA]} />
      <View style={[styles.pool, styles.coverPoolB]} />
      {variant === 'organization' ? (
        <View style={styles.panes}>
          {Array.from({ length: 12 }).map((_, i) => (
            <View key={i} style={[styles.pane, { height: 26 + ((i * 37) % 5) * 12 }]} />
          ))}
        </View>
      ) : null}
    </View>
  );
}

const LEVELS: Record<1 | 2 | 3 | 'glass', ViewStyle> = {
  1: { backgroundColor: colors.surface, borderColor: colors.borderLight, ...elevation.subtle },
  2: { backgroundColor: colors.surface, borderColor: colors.borderLight, ...elevation.standard },
  3: { backgroundColor: colors.surfaceElevated, borderColor: 'rgba(255,255,255,0.9)', ...elevation.featured },
  glass: { backgroundColor: materials.glass.fill, borderColor: materials.glass.border, ...elevation.standard },
};

const styles = StyleSheet.create({
  base: { borderRadius: radius.card, borderWidth: 1, overflow: 'hidden' },
  featured: { borderColor: colors.featuredBorder, ...elevation.standard },
  glass: { borderWidth: 1, borderRadius: radius.lg },
  glassLight: { backgroundColor: materials.glass.fill, borderColor: materials.glass.border },
  glassDark: { backgroundColor: materials.glass.fillOnDark, borderColor: materials.glass.borderOnDark },

  hero: { borderRadius: radius.sheet, overflow: 'hidden', ...elevation.featured },
  pool: { position: 'absolute', borderRadius: 999 },
  // The ECG trace runs across the right half of the hero, clear of the text.
  trace: { position: 'absolute', left: '52%', right: 0, top: '38%', bottom: '18%', opacity: 0.8 },
  // A hairline of light: brightest along the top, fading down the sides.
  rim: {
    ...StyleSheet.absoluteFillObject, borderWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.34)', borderLeftColor: 'rgba(255,255,255,0.12)',
    borderRightColor: 'rgba(255,255,255,0.12)', borderBottomColor: 'rgba(255,255,255,0.04)',
  },
  poolA: { width: 260, height: 260, right: -60, top: -110, backgroundColor: 'rgba(255,255,255,0.08)' },
  poolB: { width: 180, height: 180, left: -50, bottom: -90, backgroundColor: `rgba(${POOL},0.18)` },
  coverPoolA: { width: 340, height: 340, right: -80, top: -170, backgroundColor: 'rgba(255,255,255,0.08)' },
  coverPoolB: { width: 240, height: 240, left: '30%', bottom: -170, backgroundColor: `rgba(${POOL},0.22)` },
  panes: { position: 'absolute', right: 24, bottom: 0, flexDirection: 'row', alignItems: 'flex-end', gap: 6, opacity: 0.16 },
  pane: { width: 14, borderTopLeftRadius: 6, borderTopRightRadius: 6, backgroundColor: '#FFFFFF' },
  heroCompact: { borderRadius: radius.card },
  heroRow: { flexDirection: 'row', alignItems: 'center', padding: spacing.xxl, gap: spacing.lg },
  heroRowCompact: { padding: spacing.lg, gap: spacing.md },
  heroBody: { flex: 1, minWidth: 0, gap: spacing.xs },
  heroObject: { alignItems: 'center', justifyContent: 'center' },
});
