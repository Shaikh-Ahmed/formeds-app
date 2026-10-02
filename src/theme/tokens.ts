/** Spacing, radii, typography and shadow primitives shared by every screen. */
import { Platform } from 'react-native';
import { activeTheme } from './activeTheme';

/** Material and Terracotta share every token here but colour. */
const isMaterialFamily = activeTheme === 'material' || activeTheme === 'terracotta';

/**
 * Shadow tints for the Material family: the ink of a native shadow, and the
 * near / far rgb triplets of the web shadow stack. Blue-grey for Material,
 * warm umber for Terracotta, so depth matches the palette.
 */
const SHADOW = activeTheme === 'terracotta'
  ? { ink: '#4A2312', near: '60,30,15', far: '120,62,32' }
  : { ink: '#142C63', near: '20,40,90', far: '30,60,140' };

/**
 * Brand families, per `design_guidelines.json`: Outfit for headings ("clean,
 * authoritative"), IBM Plex Sans for body ("highly legible, objective — good
 * for dense medical data").
 *
 * Each weight is its own family name, and that is deliberate: React Native
 * does NOT synthesise weights for custom fonts. `fontFamily: 'Outfit'` plus
 * `fontWeight: '700'` renders unpredictably on Android — it either ignores the
 * weight or fakes a bold on top of one that is already bold. So a style names
 * the weighted family and omits `fontWeight` entirely.
 *
 * Raw styles that still carry a bare `fontWeight` render in the SYSTEM font,
 * not the brand one. When you touch such a style, give it a family from here.
 */
const HEADING_FAMILIES = {
  classic: {
    regular: 'Outfit_400Regular',
    medium: 'Outfit_500Medium',
    semibold: 'Outfit_600SemiBold',
    bold: 'Outfit_700Bold',
  },
  // The Journal theme sets headings in a serif, as a journal would.
  journal: {
    regular: 'SourceSerif4_400Regular',
    medium: 'SourceSerif4_500Medium',
    semibold: 'SourceSerif4_600SemiBold',
    bold: 'SourceSerif4_700Bold',
  },
};
// Premium keeps the brand pairing -- Outfit headings, IBM Plex Sans body --
// and earns its character from hierarchy and spacing, not a new face.
const HEADING_BY_THEME = {
  classic: HEADING_FAMILIES.classic, journal: HEADING_FAMILIES.journal,
  premium: HEADING_FAMILIES.classic, material: HEADING_FAMILIES.classic, terracotta: HEADING_FAMILIES.classic,
};

export const fonts = {
  heading: HEADING_BY_THEME[activeTheme],
  body: {
    regular: 'IBMPlexSans_400Regular',
    medium: 'IBMPlexSans_500Medium',
    semibold: 'IBMPlexSans_600SemiBold',
    bold: 'IBMPlexSans_700Bold',
  },
} as const;

const SPACING = { xs: 4, sm: 8, md: 12, lg: 16, xl: 20, xxl: 24, xxxl: 32 } as const;
// Material runs a touch tighter -- about 12-15% less at every step -- so its
// layered surfaces sit closer together. Touch targets are separate
// (MIN_TOUCH_TARGET) and unaffected.
const MATERIAL_SPACING = { xs: 4, sm: 7, md: 10, lg: 14, xl: 17, xxl: 20, xxxl: 28 } as const;

export const spacing: { [K in keyof typeof SPACING]: number } =
  isMaterialFamily ? MATERIAL_SPACING : SPACING;

const RADIUS = {
  classic: { sm: 8, md: 10, lg: 12, xl: 14, pill: 999, input: 12, button: 14, card: 12, sheet: 16 },
  journal: { sm: 8, md: 10, lg: 12, xl: 14, pill: 999, input: 12, button: 14, card: 12, sheet: 16 },
  premium: { sm: 8, md: 10, lg: 12, xl: 16, pill: 999, input: 10, button: 10, card: 14, sheet: 20 },
  // Material: soft, tactile rounding -- cards 18, sheets 24 -- with tags and
  // floating controls as pills, inputs and buttons in between.
  material: { sm: 8, md: 12, lg: 14, xl: 17, pill: 999, input: 14, button: 14, card: 18, sheet: 24 },
};

/** Corner radii. `input`, `button`, `card` and `sheet` name the use; prefer them. */
export const radius = RADIUS[isMaterialFamily ? 'material' : (activeTheme as Exclude<typeof activeTheme, 'terracotta'>)];

/**
 * Weights live in the family name, never in `fontWeight` — see `fonts` above.
 *
 * Headings carry slight negative tracking, which is what the guidelines mean by
 * "tracking-tight for clinical precision without feeling dated"; Outfit is a
 * wide face and reads loose at display sizes otherwise.
 */
const CLASSIC_TYPOGRAPHY = {
  h1: { fontSize: 28, fontFamily: fonts.heading.bold, letterSpacing: -0.4 },
  h2: { fontSize: 22, fontFamily: fonts.heading.bold, letterSpacing: -0.3 },
  h3: { fontSize: 17, fontFamily: fonts.heading.bold, letterSpacing: -0.1 },
  body: { fontSize: 15, fontFamily: fonts.body.regular },
  bodyStrong: { fontSize: 15, fontFamily: fonts.body.semibold },
  label: { fontSize: 14, fontFamily: fonts.body.semibold },
  caption: { fontSize: 13, fontFamily: fonts.body.regular },
  small: { fontSize: 12, fontFamily: fonts.body.regular },
  /**
   * The resume section label — teal, uppercase, wide-tracked.
   *
   * This is the single strongest "you are reading a CV, not a settings page"
   * signal available, and it is already sanctioned brand: `design_guidelines
   * .json` specifies `text-xs font-semibold uppercase tracking-[0.2em]` in the
   * secondary teal. 0.2em at 12px would be 2.4px; 1.8px keeps the editorial
   * feel while staying comfortable to read on a phone.
   */
  overline: {
    fontSize: 12,
    // A serif in wide-tracked capitals reads as ornament; Journal keeps its
    // small labels in the sans, as a journal's section heads are.
    fontFamily: activeTheme === 'journal' ? fonts.body.semibold : fonts.heading.semibold,
    letterSpacing: 1.8,
    textTransform: 'uppercase',
  },
} as const;

/**
 * Premium type scale. Larger, tighter display sizes and real line heights:
 * the important line is visibly louder, the metadata visibly quieter.
 */
const PREMIUM_TYPOGRAPHY = {
  h1: { fontSize: 30, lineHeight: 36, fontFamily: fonts.heading.bold, letterSpacing: -0.6 },
  h2: { fontSize: 22, lineHeight: 28, fontFamily: fonts.heading.semibold, letterSpacing: -0.3 },
  h3: { fontSize: 17, lineHeight: 23, fontFamily: fonts.heading.semibold, letterSpacing: -0.15 },
  body: { fontSize: 15, lineHeight: 22, fontFamily: fonts.body.regular },
  bodyStrong: { fontSize: 15, lineHeight: 22, fontFamily: fonts.body.semibold },
  label: { fontSize: 14, lineHeight: 20, fontFamily: fonts.body.semibold },
  caption: { fontSize: 13, lineHeight: 18, fontFamily: fonts.body.regular },
  small: { fontSize: 12, lineHeight: 16, fontFamily: fonts.body.regular },
  overline: {
    fontSize: 11,
    lineHeight: 16,
    fontFamily: fonts.body.semibold,
    letterSpacing: 1.4,
    textTransform: 'uppercase',
  },
} as const;

/** Material: Premium's scale with a larger display size for heroes. */
const MATERIAL_TYPOGRAPHY = {
  ...PREMIUM_TYPOGRAPHY,
  h1: { fontSize: 32, lineHeight: 38, fontFamily: fonts.heading.semibold, letterSpacing: -0.8 },
  h2: { fontSize: 23, lineHeight: 29, fontFamily: fonts.heading.semibold, letterSpacing: -0.4 },
} as const;

export const typography: typeof CLASSIC_TYPOGRAPHY =
  activeTheme === 'premium' ? (PREMIUM_TYPOGRAPHY as unknown as typeof CLASSIC_TYPOGRAPHY)
    : isMaterialFamily ? (MATERIAL_TYPOGRAPHY as unknown as typeof CLASSIC_TYPOGRAPHY)
      : CLASSIC_TYPOGRAPHY;

/** Minimum accessible touch target (iOS HIG / Material both ≈44–48dp). */
export const MIN_TOUCH_TARGET = 44;

/**
 * Sizing for dense icon+count rows — post like / comment / share.
 *
 * Such a row is mostly whitespace at 44px per button, and in a feed that cost
 * repeats on every card. So the button is *painted* at 32px and the missing
 * 12px is added back as hit slop, leaving the touchable area at
 * MIN_TOUCH_TARGET while the row occupies less height.
 *
 * The two numbers are a pair: shrink `height` without growing `hitSlop` and
 * the target silently drops below the minimum. `theme.test.ts` asserts they
 * still add up.
 */
export const compactAction = {
  height: 28,
  hitSlop: { top: 8, bottom: 8, left: 6, right: 6 },
} as const;

const CLASSIC_CARD_SHADOW = {
  shadowColor: '#0F172A',
  shadowOpacity: 0.06,
  shadowRadius: 8,
  shadowOffset: { width: 0, height: 2 },
  elevation: 2,
};

/**
 * Elevation levels -- page, standard content, featured content -- so hierarchy
 * comes from a small, consistent set rather than one-off shadows. Premium keeps
 * them faint (calm authority: no giant shadows); borders do most of the work.
 */
const ELEVATION = {
  classic: {
    none: {},
    subtle: CLASSIC_CARD_SHADOW,
    standard: CLASSIC_CARD_SHADOW,
    featured: { ...CLASSIC_CARD_SHADOW, shadowOpacity: 0.08, shadowRadius: 14, shadowOffset: { width: 0, height: 4 }, elevation: 3 },
  },
  premium: {
    none: {},
    subtle: { shadowColor: '#0B1E33', shadowOpacity: 0.04, shadowRadius: 4, shadowOffset: { width: 0, height: 1 }, elevation: 1 },
    standard: { shadowColor: '#0B1E33', shadowOpacity: 0.06, shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, elevation: 2 },
    featured: { shadowColor: '#0B1E33', shadowOpacity: 0.08, shadowRadius: 20, shadowOffset: { width: 0, height: 8 }, elevation: 4 },
  },
  // Material: soft, wide, teal-tinted shadows -- depth you feel rather than see.
  material: {
    none: {},
    subtle: { shadowColor: SHADOW.ink, shadowOpacity: 0.06, shadowRadius: 10, shadowOffset: { width: 0, height: 3 }, elevation: 2 },
    standard: { shadowColor: SHADOW.ink, shadowOpacity: 0.09, shadowRadius: 22, shadowOffset: { width: 0, height: 8 }, elevation: 4 },
    featured: { shadowColor: SHADOW.ink, shadowOpacity: 0.14, shadowRadius: 34, shadowOffset: { width: 0, height: 14 }, elevation: 8 },
  },
};

// Material on the web: gloss comes from a lit inner top edge, and depth from
// a soft, blue-tinted shadow that spreads wide and fades -- one CSS shadow
// stack per level instead of the native shadow props.
const GLOSS_EDGE = 'inset 0 1px 0 rgba(255,255,255,0.95)';
const MATERIAL_WEB_ELEVATION = {
  none: {},
  subtle: { boxShadow: `${GLOSS_EDGE}, 0 1px 2px rgba(${SHADOW.near},0.05), 0 8px 20px -8px rgba(${SHADOW.far},0.16)` },
  standard: { boxShadow: `${GLOSS_EDGE}, 0 1px 2px rgba(${SHADOW.near},0.05), 0 16px 36px -12px rgba(${SHADOW.far},0.22)` },
  featured: { boxShadow: `${GLOSS_EDGE}, 0 2px 4px rgba(${SHADOW.near},0.06), 0 26px 52px -16px rgba(${SHADOW.far},0.28)` },
} as unknown as typeof ELEVATION.material;
export const elevation = activeTheme === 'premium' ? ELEVATION.premium
  : isMaterialFamily ? (Platform.OS === 'web' ? MATERIAL_WEB_ELEVATION : ELEVATION.material) : ELEVATION.classic;

export const shadow = {
  // The default card shadow. Premium uses its quieter "subtle" level.
  card: activeTheme === 'premium' ? ELEVATION.premium.subtle
    : isMaterialFamily ? (Platform.OS === 'web' ? MATERIAL_WEB_ELEVATION.standard : ELEVATION.material.standard)
      : CLASSIC_CARD_SHADOW,
} as const;

/**
 * Motion: short and restrained. Every animation also checks the platform's
 * reduce-motion setting and skips itself when it is on.
 */
export const motion = {
  fast: 120,
  base: 200,
  slow: 320,
} as const;
