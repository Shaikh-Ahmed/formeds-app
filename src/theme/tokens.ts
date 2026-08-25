/** Spacing, radii, typography and shadow primitives shared by every screen. */

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
export const fonts = {
  heading: {
    regular: 'Outfit_400Regular',
    medium: 'Outfit_500Medium',
    semibold: 'Outfit_600SemiBold',
    bold: 'Outfit_700Bold',
  },
  body: {
    regular: 'IBMPlexSans_400Regular',
    medium: 'IBMPlexSans_500Medium',
    semibold: 'IBMPlexSans_600SemiBold',
    bold: 'IBMPlexSans_700Bold',
  },
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
} as const;

export const radius = {
  sm: 8,
  md: 10,
  lg: 12,
  xl: 14,
  pill: 999,
} as const;

/**
 * Weights live in the family name, never in `fontWeight` — see `fonts` above.
 *
 * Headings carry slight negative tracking, which is what the guidelines mean by
 * "tracking-tight for clinical precision without feeling dated"; Outfit is a
 * wide face and reads loose at display sizes otherwise.
 */
export const typography = {
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
    fontFamily: fonts.heading.semibold,
    letterSpacing: 1.8,
    textTransform: 'uppercase',
  },
} as const;

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

export const shadow = {
  card: {
    shadowColor: '#0F172A',
    shadowOpacity: 0.06,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
} as const;
