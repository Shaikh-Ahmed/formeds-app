import { activeTheme, type ThemeId } from './activeTheme';

/**
 * Brand palette — single source of truth, mirrors design_guidelines.json.
 * Never hardcode a hex literal in a screen; add a token here instead.
 *
 * This is the Classic theme. Other themes override tokens below; `colors`
 * is whichever one is active (see activeTheme.ts).
 */
const classic = {
  // Brand
  navy: '#1A3A5C',
  navyLight: '#2A527D',
  navyDark: '#0F243A',
  /**
   * Fill for primary buttons and the active state of tabs, chips and
   * segmented controls. Every theme but Material leaves it equal to its own
   * `navy` (filled in below), so those themes render exactly as before.
   */
  action: '#1A3A5C',
  actionHover: '#2A527D',
  /**
   * Fill for small CONTROLS that have always been navy -- active chips and
   * tabs, step and progress marks, the sent message bubble, badges. Equal to
   * `navy` in every theme but Premium, where navy is the dark anchor surface
   * and controls are teal. Surfaces that are meant to be dark keep `navy`.
   */
  primaryFill: '#1A3A5C',
  /** A pale tint behind a small icon or selected control. Blue in every theme but Premium (teal). */
  tintBg: '#EFF6FF',
  /**
   * Hairlines and ink for tinted chips and status pills: the edge of a pale
   * tint in its own hue, and the darker teal its words are set in. Premium's
   * tags and pills draw on these; no other theme uses them.
   */
  tealLine: '#99F6E4',
  tealInk: '#115E59',
  infoLine: '#A5F3FC',
  redLine: '#FECACA',
  warningLine: '#FDE68A',
  teal: '#0F766E',
  tealLight: '#14B8A6',
  tealBg: '#F0FDFA',
  /** Reserved for critical/urgent actions only (AED bubble, destructive). */
  red: '#E84545',
  redHover: '#D13D3D',
  redBg: '#FEF2F2',
  /**
   * Red for TEXT on a light red surface. `red` itself only reaches 3.6:1 on
   * `redBg` — fine for an icon or a filled button, below the 4.5:1 body-text
   * minimum. Use this whenever red words sit on `redBg`.
   */
  redText: '#B91C1C',

  // Surfaces
  white: '#FFFFFF',
  bg: '#F8FAFC',
  bgMuted: '#F1F5F9',
  card: '#FFFFFF',

  // Text
  text: '#0F172A',
  textSecondary: '#475569',
  textMuted: '#94A3B8',
  /** Long-form body copy and form labels: a step softer than `text`. */
  textBody: '#334155',
  /** Metadata, inactive tab labels and dismiss icons. */
  textSubtle: '#64748B',
  /** The large faint glyph in a plain empty state. Decorative only. */
  iconFaint: '#CBD5E1',
  textOnDark: '#FFFFFF',
  /** Secondary text on a navy surface (the recruiter dashboard hero). */
  textOnDarkMuted: 'rgba(255,255,255,0.78)',
  /** A raised chip or outline on a navy surface. */
  onDarkSurface: 'rgba(255,255,255,0.12)',
  onDarkBorder: 'rgba(255,255,255,0.38)',

  // Lines & states
  border: '#E2E8F0',
  borderLight: '#F1F5F9',
  success: '#0F766E',
  successBg: '#F0FDF4',
  warning: '#B45309',
  warningBg: '#FFFBEB',
  online: '#22C55E',

  // Recruiter accounts and the Verified Recruiter mark.
  recruiter: '#6D28D9',
  recruiterBg: '#F5F3FF',

  // ── Semantic roles ────────────────────────────────────────────────────────
  // Named for what they mean rather than how they look, so a theme can
  // restyle "verified" or "featured" everywhere at once. In Classic each one
  // equals the value the app already used for that job, so Classic is
  // unchanged by their existence.
  /** Standard content surface (cards, panels). */
  surface: '#FFFFFF',
  /** A surface lifted above its neighbours (menus, the selected row). */
  surfaceElevated: '#FFFFFF',
  /** Featured / priority content: the one thing on a screen to look at first. */
  featured: '#FFFFFF',
  featuredBorder: '#E2E8F0',
  /** The trust colour: verified people and organisations, cleared credentials. */
  verified: '#0F766E',
  verifiedBg: '#F0FDFA',
  info: '#1A3A5C',
  infoBg: '#F1F5F9',
  /** AED Assist and urgent clinical states only. */
  aed: '#E84545',
  aedBg: '#FEF2F2',
  disabled: '#94A3B8',
  disabledBg: '#F1F5F9',
  /** A hovered / pressed row or control. */
  hover: '#F1F5F9',
  /** The selected row in a list-detail split. */
  selected: '#EFF6FF',
} as const;

export type ColorToken = keyof typeof classic;
type Palette = { [K in ColorToken]: string };

/**
 * Journal: warm ivory ground, ink text, a deeper teal and hairline borders in
 * the same warm family. Navy, red and the recruiter violet stay the brand's.
 */
const journal: Partial<Palette> = {
  teal: '#0F5E57',
  tealLight: '#2A8C82',
  tealBg: '#E7F1EF',
  bg: '#FAF8F4',
  bgMuted: '#F3EFE7',
  text: '#1C2430',
  textSecondary: '#5E6673',
  textMuted: '#8A8F98',
  border: '#E6E0D4',
  borderLight: '#EFEAE0',
  success: '#0F5E57',
  successBg: '#EEF6F2',
  warning: '#9A5B13',
  warningBg: '#FBF3E6',
};

/**
 * ForMeds Premium -- clinical and credentialed.
 *
 * One hue, used with discipline: a deep clinical teal is THE action and trust
 * colour (buttons, the active tab, salaries, the verified tick); its pale
 * tints carry chips and selected states. Slate navy is the anchor -- the one
 * dark surface a screen may have (AED, a featured panel) -- and cyan only
 * ever appears inside a gradient, as light. Everything else is slate grey, so
 * colour always means something. Red stays AED's and urgency's alone.
 *
 * Contrast on white: text 17.9:1, textBody 10.4:1, textSecondary 7.6:1,
 * textSubtle 4.8:1 (metadata), teal 5.5:1; white on teal 5.5:1, on navy
 * 17.9:1. textMuted (2.6:1) is for placeholders and decoration only.
 */
const premium: Partial<Palette> = {
  navy: '#0F172A',
  navyLight: '#1E293B',
  navyDark: '#0A0F1D',
  action: '#0F766E',
  actionHover: '#115E59',
  primaryFill: '#0F766E',
  tintBg: '#F0FDFA',
  teal: '#0F766E',
  tealLight: '#14B8A6',
  tealBg: '#F0FDFA',
  bg: '#F8FAFC',
  bgMuted: '#F1F5F9',
  card: '#FFFFFF',
  text: '#0F172A',
  textBody: '#334155',
  textSecondary: '#475569',
  textSubtle: '#64748B',
  textMuted: '#94A3B8',
  iconFaint: '#CBD5E1',
  border: '#E2E8F0',
  borderLight: '#F1F5F9',
  // Done is green, never the action teal: "complete" must not read as "tap".
  success: '#15803D',
  successBg: '#F0FDF4',
  warning: '#B45309',
  warningBg: '#FFFBEB',
  online: '#10B981',
  surface: '#FFFFFF',
  surfaceElevated: '#FFFFFF',
  featured: '#FFFFFF',
  featuredBorder: '#99F6E4',
  verified: '#0F766E',
  verifiedBg: '#F0FDFA',
  info: '#0E7490',
  infoBg: '#ECFEFF',
  aed: '#DC2626',
  aedBg: '#FEF2F2',
  disabled: '#94A3B8',
  disabledBg: '#F1F5F9',
  hover: '#F1F5F9',
  selected: '#F0FDFA',
};

/**
 * ForMeds Material -- tactile and layered. A soft teal-tinted ground so white
 * surfaces read as raised objects; deep teal as the signature (navigation,
 * heroes, primary actions), navy kept for authority text, red kept for AED.
 *
 * Contrast on white: text 16.9:1, textSecondary 6.9:1, deep teal 8.9:1,
 * teal 5.6:1. White on deep teal 8.9:1.
 */
const material: Partial<Palette> = {
  // Blue: royal blue for actions and accents, deep blue for authority, a cool
  // periwinkle page so white surfaces read as raised. Red stays AED's alone;
  // success stays green, so "done" never reads as "clickable".
  // The brand blue is rgb(0, 58, 114) -- #003A72 -- for actions and accents.
  // Contrast: text 15.4:1 on bg; textSecondary 7.1:1 and textSubtle 6.0:1 on
  // white; brand blue 11.4:1 on white, and white on it the same.
  navy: '#0B2545',
  navyLight: '#1B3F6B',
  navyDark: '#061A33',
  teal: '#003A72',
  tealLight: '#2F6DB5',
  tealBg: '#E6EEF7',
  bg: '#EEF2FB',
  bgMuted: '#E4EBF8',
  card: '#FFFFFF',
  text: '#0E1A33',
  textSecondary: '#4A5878',
  textMuted: '#7D8AA5',
  textBody: '#2A3858',
  textSubtle: '#55647F',
  iconFaint: '#BAC6DC',
  border: '#DCE4F2',
  borderLight: '#E9EEF8',
  success: '#16794F',
  successBg: '#E7F6EE',
  warning: '#9A5800',
  warningBg: '#FBF3E3',
  surface: '#FFFFFF',
  surfaceElevated: '#FFFFFF',
  featured: '#F5F8FE',
  featuredBorder: '#D2DDF3',
  verified: '#003A72',
  verifiedBg: '#E6EEF7',
  info: '#1B3F6B',
  infoBg: '#EAF0FB',
  aed: '#D83B3B',
  aedBg: '#FCEEEE',
  disabled: '#9AA6BD',
  disabledBg: '#E9EEF8',
  hover: '#EDF2F9',
  selected: '#E3ECF6',
  action: '#003A72',
  actionHover: '#002E5C',
};

/**
 * ForMeds Terracotta -- Material's structure in a warm palette. Every surface
 * that is white elsewhere is a soft off-white, on a slightly deeper sand page
 * so cards still read as raised. Terracotta takes the brand blue's jobs
 * (actions, accents, heroes); a deep clay-brown takes navy's. Red stays AED's
 * alone and success stays green.
 *
 * Contrast: text 15.6:1 on card; textSecondary 6.4:1 and textSubtle 5.2:1 on
 * card; terracotta 5.6:1 on card, and off-white on it the same.
 */
const terracotta: Partial<Palette> = {
  navy: '#4A2314',
  navyLight: '#6E3520',
  navyDark: '#2E150B',
  teal: '#A3472A',
  tealLight: '#D07650',
  tealBg: '#F6E8DF',
  white: '#FCF9F4',
  bg: '#F3ECE2',
  bgMuted: '#ECE2D5',
  card: '#FCF9F4',
  text: '#2A1C15',
  textSecondary: '#6A564B',
  textMuted: '#9A887D',
  textBody: '#3D2C23',
  textSubtle: '#76635A',
  iconFaint: '#D9CABD',
  textOnDark: '#FCF9F4',
  textOnDarkMuted: 'rgba(252,249,244,0.80)',
  border: '#E6DACC',
  borderLight: '#EFE7DC',
  success: '#2F7A4E',
  successBg: '#E8F3EA',
  warning: '#8F5410',
  warningBg: '#FAEFDD',
  surface: '#FCF9F4',
  surfaceElevated: '#FDFBF7',
  featured: '#FAF2E9',
  featuredBorder: '#E9D5C4',
  verified: '#A3472A',
  verifiedBg: '#F6E8DF',
  info: '#6E3520',
  infoBg: '#F5ECE4',
  aed: '#D33A3A',
  aedBg: '#FBECEA',
  disabled: '#B2A296',
  disabledBg: '#EFE6DC',
  hover: '#F4EBE1',
  selected: '#F2E2D6',
  action: '#A3472A',
  actionHover: '#883A21',
};

const OVERRIDES: Record<ThemeId, Partial<Palette>> = { classic: {}, journal, premium, material, terracotta };

const merged: Palette = { ...classic, ...OVERRIDES[activeTheme] };
// A theme that does not set its own action colour keeps using its navy.
if (!OVERRIDES[activeTheme].action) {
  merged.action = merged.navy;
  merged.actionHover = merged.navyLight;
}
// Likewise controls that were navy stay that theme's navy unless it says so.
if (!OVERRIDES[activeTheme].primaryFill) merged.primaryFill = merged.navy;
export const colors: Palette = merged;
