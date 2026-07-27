import { colors } from './colors';

export type Role = 'healthcare_professional' | 'hospital' | 'clinic';

export interface RoleMeta {
  /** Short label for badges (feed, people cards). */
  label: string;
  /** Full label for profile headers. */
  longLabel: string;
  color: string;
  bg: string;
}

/**
 * THE role map. Replaces the five divergent copies that previously lived in
 * feed.tsx (ROLE_TAGS), post/[id].tsx (ROLE_TAGS), people.tsx (ROLE_LABELS),
 * messages.tsx (ROLE_COLORS) and profile.tsx (ROLE_CONFIG) — which had already
 * drifted in both shape and colour. Never add a local copy again.
 */
export const ROLE_META: Record<Role, RoleMeta> = {
  healthcare_professional: {
    label: 'Professional',
    longLabel: 'Healthcare Professional',
    color: colors.teal,
    bg: colors.successBg,
  },
  hospital: {
    label: 'Hospital',
    longLabel: 'Hospital',
    color: colors.navy,
    bg: '#EFF6FF',
  },
  clinic: {
    label: 'Clinic',
    longLabel: 'Clinic',
    color: colors.teal,
    bg: colors.tealBg,
  },
};

const FALLBACK = ROLE_META.healthcare_professional;

/** Safe lookup with the same fallback behaviour the screens used inline. */
export function getRoleMeta(role?: string | null): RoleMeta {
  if (!role) return FALLBACK;
  return ROLE_META[role as Role] ?? FALLBACK;
}
