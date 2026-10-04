import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';

/**
 * Which look the app wears: Classic (the original, and the default), Journal
 * (ivory ground, serif headings, deep teal) or ForMeds Premium ("calm
 * authority": the same navy/teal identity with a clearer hierarchy, quieter
 * surfaces, a single verification mark and refined states).
 *
 * Themes are presentation only. Every theme runs the same screens, menus,
 * routes, data and logic; a component may vary how it LOOKS by theme (see
 * `isPremium`), never what it does.
 *
 * Every screen builds its StyleSheet once, when its module loads, from
 * `colors` and `fonts`. So the theme has to be known BEFORE any of that runs:
 * it is read synchronously here, at import time, and switching saves the
 * choice and reloads the app rather than trying to restyle a live tree.
 */
export type ThemeId = 'classic' | 'journal' | 'premium' | 'material' | 'terracotta';

export const THEMES: { id: ThemeId; label: string; description: string }[] = [
  { id: 'classic', label: 'Classic', description: 'Clean white and navy, the original ForMeds look.' },
  { id: 'journal', label: 'Journal', description: 'Warm ivory, serif headings and deep teal, like a medical journal.' },
  { id: 'premium', label: 'ForMeds Premium', description: 'Clinical and credentialed: deep teal, crisp white surfaces, verification first.' },
  { id: 'material', label: 'ForMeds Material', description: 'Tactile and layered: soft depth, cool blue, floating controls.' },
  { id: 'terracotta', label: 'ForMeds Terracotta', description: 'Material’s depth and gloss in warm off-white and terracotta.' },
];

const STORAGE_KEY = 'formeds_theme';

function isThemeId(v: unknown): v is ThemeId {
  return v === 'classic' || v === 'journal' || v === 'premium' || v === 'material' || v === 'terracotta';
}

function readSaved(): ThemeId {
  try {
    const v = Platform.OS === 'web'
      ? globalThis.localStorage?.getItem(STORAGE_KEY)
      : SecureStore.getItem(STORAGE_KEY);
    return isThemeId(v) ? v : 'classic';
  } catch {
    // Private windows, blocked storage, test environments: fall back quietly.
    return 'classic';
  }
}

export const activeTheme: ThemeId = readSaved();

/** ForMeds Premium is active: for the few visual choices tokens cannot carry. */
export const isPremium = activeTheme === 'premium';

/**
 * ForMeds Terracotta is active: Material in a warm palette -- off-white
 * surfaces, terracotta where Material is blue. Everything else is Material's.
 */
export const isTerracotta = activeTheme === 'terracotta';

/**
 * A Material-family theme is active (Material or Terracotta): depth,
 * gradients, soft objects, floating controls. The two differ only in colour.
 */
export const isMaterial = activeTheme === 'material' || isTerracotta;

/**
 * Premium OR Material. Material is built on Premium's structure -- one trust
 * mark, the opportunity-card order, designed states -- and adds its own
 * surfaces on top, so the shared improvements key off this.
 */
export const isRefined = isPremium || isMaterial;

/**
 * Save the choice and apply it. On web the page reloads straight away and
 * this returns true; on a phone the app has to be reopened, so it returns
 * false and the caller says so.
 */
export function applyTheme(id: ThemeId): boolean {
  try {
    if (Platform.OS === 'web') globalThis.localStorage?.setItem(STORAGE_KEY, id);
    else SecureStore.setItem(STORAGE_KEY, id);
  } catch {
    return false;
  }
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    window.location.reload();
    return true;
  }
  return false;
}
