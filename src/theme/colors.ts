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

  // Lines & states
  border: '#E2E8F0',
  borderLight: '#F1F5F9',
  success: '#0F766E',
  successBg: '#F0FDF4',
  warning: '#B45309',
  warningBg: '#FFFBEB',
  online: '#22C55E',
} as const;

export type ColorToken = keyof typeof colors;
