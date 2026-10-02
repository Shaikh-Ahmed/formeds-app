import { Platform } from 'react-native';
import { activeTheme, isMaterial } from './activeTheme';

/**
 * Gradients and glass for ForMeds Material.
 *
 * Every gradient in the theme is defined here -- none are invented inline --
 * and each has one job. Other themes get flat equivalents (a single colour)
 * so a component can always ask for `materials.hero` without branching.
 */
type Gradient = {
  colors: [string, string, ...string[]]; start: { x: number; y: number }; end: { x: number; y: number };
  /** Stop positions (0-1), one per colour; evenly spaced when omitted. */
  locations?: [number, number, ...number[]];
};

const MATERIAL = {
  /** Heroes: greeting, profile and organisation headers. Deep teal into navy. */
  // Deep where the text sits (left; white on it 6:1), brightening to aqua
  // on the right where the light and the soft object are.
  hero: { colors: ['#003A72', '#0B4F96', '#2A6FC0'], start: { x: 0, y: 0.2 }, end: { x: 1, y: 0.8 } } as Gradient,
  /** The primary action: a tactile deep-teal fill with a lit top edge. */
  primary: { colors: ['#1D5B9E', '#002E5C'], start: { x: 0, y: 0 }, end: { x: 0, y: 1 } } as Gradient,
  /** Featured cards: a whisper of teal across white. */
  featured: { colors: ['#FFFFFF', '#EEF3FA'], start: { x: 0, y: 0 }, end: { x: 1, y: 1 } } as Gradient,
  /** AED: red kept to AED, deepened so white text clears 4.5:1. */
  aed: { colors: ['#E25555', '#B92E37'], start: { x: 0, y: 0 }, end: { x: 1, y: 1 } } as Gradient,
  /** Locum shift date tile. */
  shift: { colors: ['#1D5B9E', '#003A72'], start: { x: 0, y: 0 }, end: { x: 1, y: 1 } } as Gradient,
  /** Page wash behind the content on wide screens. */
  page: { colors: ['#F1F5FD', '#E8EFFA'], start: { x: 0, y: 0 }, end: { x: 0, y: 1 } } as Gradient,
  /**
   * Gloss over a dark surface: light catching the top, fading out by the
   * middle, and a faint shade at the bottom edge -- the glassy depth of an
   * Apple-style card. Laid over `hero`; never used on its own.
   */
  sheen: {
    colors: ['rgba(255,255,255,0.20)', 'rgba(255,255,255,0.06)', 'rgba(255,255,255,0)', 'rgba(0,0,0,0.10)'],
    start: { x: 0, y: 0 }, end: { x: 0, y: 1 }, locations: [0, 0.35, 0.6, 1],
  } as Gradient,
};

/**
 * Terracotta: the same jobs as MATERIAL, in clay. Deep where white text sits
 * (white on #8A3A20 is 7.6:1), warming to apricot where the light falls.
 */
const TERRACOTTA: typeof MATERIAL = {
  hero: { colors: ['#86381F', '#A3472A', '#CC7550'], start: { x: 0, y: 0.2 }, end: { x: 1, y: 0.8 } },
  primary: { colors: ['#C2603D', '#863A21'], start: { x: 0, y: 0 }, end: { x: 0, y: 1 } },
  featured: { colors: ['#FDFBF7', '#F7ECE1'], start: { x: 0, y: 0 }, end: { x: 1, y: 1 } },
  aed: MATERIAL.aed,
  shift: { colors: ['#C2603D', '#A3472A'], start: { x: 0, y: 0 }, end: { x: 1, y: 1 } },
  page: { colors: ['#F7F1E8', '#F0E7DB'], start: { x: 0, y: 0 }, end: { x: 0, y: 1 } },
  sheen: MATERIAL.sheen,
};

/**
 * Premium (clinical): gradients are rare and purposeful. Teal deepening from
 * the text side into cyan light is the one hero; slate navy is the anchor
 * surface (AED, a featured panel). Buttons and cards stay flat.
 */
const PREMIUM: typeof MATERIAL = {
  hero: { colors: ['#115E59', '#0F766E', '#0891B2'], start: { x: 0, y: 0.3 }, end: { x: 1, y: 0.7 } },
  primary: { colors: ['#0F766E', '#0F766E'], start: { x: 0, y: 0 }, end: { x: 0, y: 1 } },
  featured: { colors: ['#1E293B', '#0F172A'], start: { x: 0, y: 0 }, end: { x: 1, y: 1 } },
  aed: { colors: ['#EF4444', '#B91C1C'], start: { x: 0, y: 0 }, end: { x: 1, y: 1 } },
  shift: { colors: ['#1E293B', '#0F172A'], start: { x: 0, y: 0 }, end: { x: 0, y: 1 } },
  page: { colors: ['#F8FAFC', '#F8FAFC'], start: { x: 0, y: 0 }, end: { x: 0, y: 1 } },
  sheen: {
    colors: ['rgba(255,255,255,0.10)', 'rgba(255,255,255,0)', 'rgba(255,255,255,0)', 'rgba(0,0,0,0.06)'],
    start: { x: 0, y: 0 }, end: { x: 0, y: 1 }, locations: [0, 0.4, 0.7, 1],
  },
};

const FLAT = (c: string): Gradient => ({ colors: [c, c], start: { x: 0, y: 0 }, end: { x: 0, y: 1 } });
const CLASSIC = {
  hero: FLAT('#1A3A5C'),
  primary: FLAT('#1A3A5C'),
  featured: FLAT('#FFFFFF'),
  aed: FLAT('#E84545'),
  shift: FLAT('#1A3A5C'),
  page: FLAT('#F8FAFC'),
  sheen: FLAT('transparent'),
};

/**
 * Glass: used selectively -- floating navigation, hero overlays, AED controls
 * -- never on every card. On the web it blurs what is behind it; natively it
 * falls back to the translucent fill alone (no costly blur views).
 */
const GLASS = {
  // Premium: glass only ever sits over the gradient hero or the navy anchor.
  premium: {
    fill: 'rgba(255,255,255,0.96)',
    fillOnDark: 'rgba(255,255,255,0.10)',
    border: '#E2E8F0',
    borderOnDark: 'rgba(255,255,255,0.20)',
    blur: 'blur(12px)',
  },
  terracotta: {
    fill: 'rgba(253,250,245,0.74)',
    fillOnDark: 'rgba(255,248,240,0.15)',
    border: 'rgba(255,252,247,0.70)',
    borderOnDark: 'rgba(255,245,235,0.24)',
    blur: 'blur(18px) saturate(130%)',
  },
  material: {
    fill: 'rgba(255,255,255,0.72)',
    fillOnDark: 'rgba(255,255,255,0.14)',
    border: 'rgba(255,255,255,0.65)',
    borderOnDark: 'rgba(255,255,255,0.22)',
    blur: 'blur(18px) saturate(140%)',
  },
  flat: {
    fill: '#FFFFFF',
    fillOnDark: 'rgba(255,255,255,0.12)',
    border: '#E2E8F0',
    borderOnDark: 'rgba(255,255,255,0.38)',
    blur: 'none',
  },
};

/**
 * The page wallpaper, Apple-style: an airy off-white lit by three large,
 * heavily diffused pools of colour -- teal top-left, sky blue top-right, mint
 * along the bottom -- so white cards read as objects floating in light. Pure
 * CSS on the web (no images, painted once, never animated); phones use the
 * `page` gradient, since layered radial blurs are costly to draw natively.
 */
const BACKDROP_WEB = [
  // Two soft glass bubbles at the edges: a lit rim and a clear centre.
  'radial-gradient(circle 120px at 3% 82%, rgba(255,255,255,0.0) 58%, rgba(255,255,255,0.75) 66%, rgba(200,214,250,0.35) 72%, rgba(200,214,250,0) 80%)',
  'radial-gradient(circle 70px at 97% 92%, rgba(255,255,255,0.0) 55%, rgba(255,255,255,0.7) 66%, rgba(200,214,250,0.3) 74%, rgba(200,214,250,0) 82%)',
  // A white bloom behind the content, so the centre stays bright and calm.
  'radial-gradient(45% 40% at 50% 30%, rgba(255,255,255,0.75) 0%, rgba(255,255,255,0) 100%)',
  // Light: cyan top-left, sky blue top-right, aqua along the bottom.
  'radial-gradient(50% 55% at 0% 0%, rgba(96,140,240,0.26) 0%, rgba(96,140,240,0) 70%)',
  'radial-gradient(48% 55% at 100% 0%, rgba(150,140,245,0.22) 0%, rgba(150,140,245,0) 70%)',
  'radial-gradient(60% 45% at 30% 105%, rgba(130,190,250,0.30) 0%, rgba(130,190,250,0) 72%)',
  'radial-gradient(45% 45% at 100% 100%, rgba(150,190,245,0.22) 0%, rgba(150,190,245,0) 70%)',
  'linear-gradient(180deg, #F4F6FD 0%, #ECF1FB 100%)',
].join(', ');

/** The same wallpaper in warm light: apricot, peach and rose over sand. */
const BACKDROP_WEB_TERRACOTTA = [
  'radial-gradient(circle 120px at 3% 82%, rgba(255,255,255,0.0) 58%, rgba(255,252,247,0.75) 66%, rgba(240,200,170,0.35) 72%, rgba(240,200,170,0) 80%)',
  'radial-gradient(circle 70px at 97% 92%, rgba(255,255,255,0.0) 55%, rgba(255,252,247,0.7) 66%, rgba(240,200,170,0.3) 74%, rgba(240,200,170,0) 82%)',
  'radial-gradient(45% 40% at 50% 30%, rgba(253,250,245,0.75) 0%, rgba(253,250,245,0) 100%)',
  'radial-gradient(50% 55% at 0% 0%, rgba(214,120,80,0.20) 0%, rgba(214,120,80,0) 70%)',
  'radial-gradient(48% 55% at 100% 0%, rgba(230,150,120,0.20) 0%, rgba(230,150,120,0) 70%)',
  'radial-gradient(60% 45% at 30% 105%, rgba(235,175,120,0.26) 0%, rgba(235,175,120,0) 72%)',
  'radial-gradient(45% 45% at 100% 100%, rgba(220,160,130,0.20) 0%, rgba(220,160,130,0) 70%)',
  'linear-gradient(180deg, #F8F2EA 0%, #F1E8DC 100%)',
].join(', ');

/**
 * The brand colour as an rgb triplet, for translucent tints, glows and
 * focus rings: `rgba(${materials.tint}, 0.16)`. Material blue (#003A72) or
 * Terracotta (#A3472A); the other themes keep Material's, as before.
 */
const TINT = activeTheme === 'terracotta' ? '163,71,42' : activeTheme === 'premium' ? '15,118,110' : '0,58,114';

/**
 * Gloss and glass for controls, as style fragments to spread into a style.
 * Material only -- every other theme gets empty objects, so spreading them
 * changes nothing.
 *
 * `fill`: a coloured button with an Apple-style gloss -- light catching the
 * top, a lit inner edge, a soft glow of its own colour beneath.
 * `glass`: an outlined/secondary button as frosted glass.
 * On the web these are CSS; natively a highlight edge and coloured shadow
 * stand in for them (no costly blur views).
 */
type StyleFragment = Record<string, unknown>;
const GLOSS_MATERIAL: { fill: StyleFragment; glass: StyleFragment } = Platform.OS === 'web'
  ? {
    fill: {
      backgroundImage: 'linear-gradient(180deg, rgba(255,255,255,0.30) 0%, rgba(255,255,255,0.09) 48%, rgba(0,0,0,0.12) 100%)',
      boxShadow: `inset 0 1px 0 rgba(255,255,255,0.38), inset 0 -1px 0 rgba(0,0,0,0.10), 0 4px 14px rgba(${TINT},0.30)`,
    },
    glass: {
      backgroundColor: activeTheme === 'terracotta' ? 'rgba(253,250,245,0.62)' : 'rgba(255,255,255,0.58)',
      backdropFilter: 'blur(14px) saturate(160%)',
      WebkitBackdropFilter: 'blur(14px) saturate(160%)',
      boxShadow: `inset 0 1px 0 rgba(255,255,255,0.95), 0 2px 10px ${activeTheme === 'terracotta' ? 'rgba(80,40,20,0.08)' : 'rgba(20,44,99,0.08)'}`,
    },
  }
  : {
    fill: {
      shadowColor: `rgb(${TINT})`, shadowOpacity: 0.28, shadowRadius: 8, shadowOffset: { width: 0, height: 3 }, elevation: 3,
    },
    glass: { backgroundColor: activeTheme === 'terracotta' ? 'rgba(253,250,245,0.9)' : 'rgba(255,255,255,0.88)' },
  };

export const gloss = isMaterial ? GLOSS_MATERIAL : { fill: {} as StyleFragment, glass: {} as StyleFragment };

export const materials = {
  gradients: activeTheme === 'terracotta' ? TERRACOTTA : activeTheme === 'material' ? MATERIAL
    : activeTheme === 'premium' ? PREMIUM : CLASSIC,
  /** CSS background for the page wallpaper on the web; null outside Material. */
  backdropWeb: activeTheme === 'terracotta' ? BACKDROP_WEB_TERRACOTTA : activeTheme === 'material' ? BACKDROP_WEB : null,
  /**
   * A faint ECG trace across the hero (web, Material): the heartbeat of a
   * healthcare product, drawn as an inline SVG -- no image file.
   */
  heroTraceWeb: isMaterial
    ? `url("data:image/svg+xml;utf8,${encodeURIComponent(
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 80" preserveAspectRatio="none">'
      + '<path d="M0 46 H150 L160 46 L168 30 L176 46 L188 46 L196 8 L206 72 L214 46 L232 46 L240 38 L248 46 H400"'
      + ' fill="none" stroke="white" stroke-width="2" stroke-linejoin="round" stroke-linecap="round" opacity="0.55"/></svg>',
    )}")`
    : null,
  glass: activeTheme === 'terracotta' ? GLASS.terracotta : activeTheme === 'material' ? GLASS.material
    : activeTheme === 'premium' ? GLASS.premium : GLASS.flat,
  tint: TINT,
};
