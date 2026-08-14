import { Ionicons } from '@expo/vector-icons';
import { colors } from './colors';

export type Role = 'healthcare_professional' | 'hospital' | 'clinic';

export interface RoleMeta {
  /** Short label for badges (feed, people cards). */
  label: string;
  /** Full label for profile headers. */
  longLabel: string;
  color: string;
  bg: string;
  /** Icon for role pickers and badges (welcome + register screens). */
  icon: keyof typeof Ionicons.glyphMap;
  /** One-line description shown on the "Get Started As" cards. */
  description: string;
}

/**
 * THE role map. Replaces the five divergent copies that previously lived in
 * community.tsx (ROLE_TAGS), post/[id].tsx (ROLE_TAGS), people.tsx (ROLE_LABELS),
 * messages.tsx (ROLE_COLORS) and profile.tsx (ROLE_CONFIG) — which had already
 * drifted in both shape and colour. Never add a local copy again.
 */
export const ROLE_META: Record<Role, RoleMeta> = {
  healthcare_professional: {
    label: 'Professional',
    longLabel: 'Healthcare Professional',
    color: colors.teal,
    bg: colors.successBg,
    icon: 'medkit',
    description: 'Doctor, Nurse, or Allied Health Worker',
  },
  hospital: {
    label: 'Hospital',
    longLabel: 'Hospital',
    color: colors.navy,
    bg: '#EFF6FF',
    icon: 'business',
    description: 'Post jobs and manage staffing',
  },
  clinic: {
    label: 'Clinic',
    longLabel: 'Clinic',
    color: colors.teal,
    bg: colors.tealBg,
    icon: 'fitness',
    description: 'Find visiting specialists',
  },
};

const FALLBACK = ROLE_META.healthcare_professional;

/** Safe lookup with the same fallback behaviour the screens used inline. */
export function getRoleMeta(role?: string | null): RoleMeta {
  if (!role) return FALLBACK;
  return ROLE_META[role as Role] ?? FALLBACK;
}
