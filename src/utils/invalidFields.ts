import { createContext } from 'react';
import { Dimensions, Platform, type View } from 'react-native';

/**
 * Bringing the first invalid field into view on iOS and Android.
 *
 * The web version (useFormErrors.focusFirstInvalid) asks the DOM for the first
 * `[aria-invalid="true"]` element. A phone has no DOM, so fields announce
 * themselves instead: every FieldError that is showing a message registers
 * here, together with the FormScrollView it sits in (via context) and, when
 * it has one, the input to focus.
 */

/** What a FormScrollView offers the fields inside it. */
export interface FormScrollTarget {
  /** Scroll so this view sits comfortably inside the visible area. */
  reveal: (node: View) => void;
}

export const FormScrollContext = createContext<FormScrollTarget | null>(null);

export interface InvalidField {
  anchor: { current: View | null };
  scroll: FormScrollTarget | null;
  focus?: () => void;
}

const invalid = new Set<InvalidField>();

/** Called by FieldError while it shows a message; returns the unregister. */
export function registerInvalidField(field: InvalidField): () => void {
  invalid.add(field);
  return () => { invalid.delete(field); };
}

/** Room left above a revealed field, so its label shows too. */
const MARGIN = 96;

function measure(field: InvalidField): Promise<{ field: InvalidField; y: number; h: number } | null> {
  return new Promise(resolve => {
    const node = field.anchor.current as any;
    if (!node || typeof node.measureInWindow !== 'function') { resolve(null); return; }
    try {
      node.measureInWindow((_x: number, y: number, w: number, h: number) => {
        // A screen further back in the stack still has its fields mounted;
        // they measure as zero-sized and are not what the person is looking at.
        resolve(w === 0 && h === 0 ? null : { field, y, h });
      });
    } catch {
      resolve(null);
    }
  });
}

/**
 * Native: scroll the topmost invalid field into view (only if it is not
 * already visible) and focus its input. Waits a frame so fields that have
 * just turned invalid have rendered and registered.
 */
export function revealFirstInvalidNative() {
  if (Platform.OS === 'web') return;
  const run = async () => {
    const measured = (await Promise.all([...invalid].map(measure))).filter(Boolean) as
      { field: InvalidField; y: number; h: number }[];
    if (!measured.length) return;
    measured.sort((a, b) => a.y - b.y);
    const { field, y, h } = measured[0];
    const screen = Dimensions.get('window').height;
    // The error line sits under its field: the field itself is just above it.
    const visible = y - MARGIN >= 0 && y + h <= screen - MARGIN;
    if (!visible && field.anchor.current) field.scroll?.reveal(field.anchor.current);
    // After the scroll has started, so the keyboard does not fight it.
    setTimeout(() => field.focus?.(), visible ? 0 : 300);
  };
  const raf = (globalThis as any).requestAnimationFrame as ((cb: () => void) => void) | undefined;
  if (raf) raf(() => { run(); });
  else setTimeout(() => { run(); }, 16);
}
