/**
 * Responsive breakpoints — the missing half of the design system.
 *
 * Every screen in this app was written as a single fixed column, which is
 * correct on a phone and wrong in a 1440px browser window. These tokens are
 * the one place a width threshold is allowed to be written down; screens ask
 * `useBreakpoint()` rather than comparing pixel numbers inline.
 *
 * Thresholds follow the sizes the layout is actually verified at
 * (320 / 375 / 414 / 768 / 1024 / 1440):
 *   mobile  — phones, the existing UI, deliberately unchanged
 *   tablet  — portrait tablets and split-screen browsers: 2 columns
 *   desktop — the LinkedIn-style 3-column shell
 */

import { useWindowDimensions } from 'react-native';
import { useEffect, useState } from 'react';

export const breakpoints = {
  /** At or above this, the bottom tab bar is replaced by the top nav bar. */
  tablet: 768,
  /** At or above this, the right-hand contextual rail appears. */
  desktop: 1128,
} as const;

/**
 * Layout widths. 1128 is the full three-column grid; the centre column is
 * capped near 65–75ch so post and case text stays readable instead of
 * spanning the whole monitor.
 */
export const layout = {
  /** Max width of the whole 3-column grid. */
  maxWidth: 1128,
  /** Left identity/nav rail. */
  railLeft: 240,
  /** Right contextual rail (KYC, suggestions, AED). */
  railRight: 300,
  /** Cap for the centre content column — keeps line length readable. */
  contentMax: 612,
  /** Cap for single-column pages (settings, forms, conversations). */
  narrowMax: 720,
  /** Height of the persistent desktop top bar. */
  topBar: 56,
  /** Gutter between grid columns. */
  gutter: 24,
} as const;

export type Breakpoint = 'mobile' | 'tablet' | 'desktop';

function resolve(width: number): Breakpoint {
  if (width >= breakpoints.desktop) return 'desktop';
  if (width >= breakpoints.tablet) return 'tablet';
  return 'mobile';
}

/**
 * Current breakpoint plus the two booleans screens actually branch on.
 *
 * Returns `mobile` on the very first render even in a wide browser. The web
 * build is statically exported, so there is no window at render time; if the
 * first client paint disagreed with the server HTML React would throw a
 * hydration mismatch. Committing to mobile until after mount makes the two
 * agree, and the layout upgrades in the same frame.
 */
export function useBreakpoint(): {
  breakpoint: Breakpoint;
  isMobile: boolean;
  isTablet: boolean;
  isDesktop: boolean;
  /** True once the real viewport width is known. */
  isWide: boolean;
  width: number;
} {
  const { width } = useWindowDimensions();
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  const breakpoint = mounted ? resolve(width) : 'mobile';

  return {
    breakpoint,
    isMobile: breakpoint === 'mobile',
    isTablet: breakpoint === 'tablet',
    isDesktop: breakpoint === 'desktop',
    isWide: breakpoint !== 'mobile',
    width,
  };
}
