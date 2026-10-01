/**
 * Brand palette — single source of truth, mirrors design_guidelines.json.
 * Never hardcode a hex literal in a screen; add a token here instead.
 */
export const colors = {
  // Brand
  navy: '#1A3A5C',
  navyLight: '#2A527D',
  navyDark: '#0F243A',
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
} as const;

export type ColorToken = keyof typeof colors;
