import { useCallback, useState } from 'react';
import { Platform } from 'react-native';
import { ApiError } from '../utils/api';
import { revealFirstInvalidNative } from '../utils/invalidFields';

/**
 * Bring the first invalid field into view and focus it (web).
 *
 * Inputs mark themselves `aria-invalid` when they carry an error (FormInput,
 * InputFields), so this needs no refs threaded through every form. It waits a
 * frame for the error to render, and only scrolls when the field is not
 * already on screen -- the user is not moved needlessly. On iOS and Android
 * the same happens through the field registry in utils/invalidFields.
 */
export function focusFirstInvalid(root?: ParentNode | null) {
  // iOS / Android: fields register themselves (see utils/invalidFields).
  if (Platform.OS !== 'web') { revealFirstInvalidNative(); return; }
  if (typeof document === 'undefined') return;
  requestAnimationFrame(() => {
    const el = (root ?? document).querySelector<HTMLElement>('[aria-invalid="true"]');
    if (!el) return;
    const r = el.getBoundingClientRect();
    const visible = r.top >= 0 && r.bottom <= (window.innerHeight || document.documentElement.clientHeight);
    if (!visible) el.scrollIntoView({ block: 'center', behavior: 'smooth' });
    el.focus?.({ preventScroll: true });
  });
}

type FieldMap<F extends string> = Record<string, F>;

/**
 * Where a form's errors go: onto the fields they belong to, and only what
 * belongs to no field into the form-level banner.
 *
 *   const errs = useFormErrors<LocumField>({ serverFields: { pay_amount: 'pay' } });
 *   ...
 *   if (!errs.check(validate(form))) return;          // no request sent
 *   try { await save() } catch (e) { errs.fromError(e) }
 *   <NumberField error={errs.fields.pay} ... />
 *   <ErrorBanner message={errs.formError} />
 *
 * - `serverFields` maps server field names (or nested paths like
 *   "location.city") to this form's field names; unmapped names are used
 *   as they are.
 * - `codes` places business-rule refusals that carry no field
 *   (e.g. { shift_in_past: 'shift_date' }).
 * - A server error that names no known field -- a permission refusal, a
 *   conflict, a network failure -- becomes the form error, with the server's
 *   own message rather than a generic one.
 */
export function useFormErrors<F extends string = string>({
  serverFields = {} as FieldMap<F>,
  codes = {} as FieldMap<F>,
  known,
}: {
  serverFields?: FieldMap<F>;
  codes?: FieldMap<F>;
  /** The form's fields; server errors for anything else go to the banner. */
  known?: readonly F[];
} = {}) {
  const [fields, setFields] = useState<Partial<Record<F, string>>>({});
  const [formError, setFormError] = useState<string | null>(null);

  /** Client-side validation result. True when there is nothing to fix. */
  const check = useCallback((errors: Partial<Record<F, string | null | undefined>>) => {
    const clean = Object.fromEntries(Object.entries(errors).filter(([, v]) => !!v)) as Partial<Record<F, string>>;
    setFields(clean);
    setFormError(null);
    if (Object.keys(clean).length) {
      focusFirstInvalid();
      return false;
    }
    return true;
  }, []);

  /** Place a failed submission's error. Returns true if a field took it. */
  const fromError = useCallback((e: unknown, fallback = 'Unable to save. Please try again.') => {
    const placed: Partial<Record<F, string>> = {};
    if (e instanceof ApiError) {
      for (const [name, msg] of Object.entries(e.fieldErrors)) {
        const target = (serverFields[name] ?? name) as F;
        if (!known || known.includes(target)) placed[target] = placed[target] ?? msg;
      }
      if (e.code && codes[e.code]) placed[codes[e.code]] = e.message;
    }
    const any = Object.keys(placed).length > 0;
    setFields(placed);
    setFormError(any ? null : (e instanceof Error && e.message) || fallback);
    if (any) focusFirstInvalid();
    return any;
  }, [serverFields, codes, known]);

  /** The user changed a field: its error has been dealt with. */
  const clear = useCallback((field: F) => {
    setFields(prev => {
      if (!prev[field]) return prev;
      const next = { ...prev };
      delete next[field];
      return next;
    });
  }, []);

  const reset = useCallback(() => { setFields({}); setFormError(null); }, []);

  return { fields, formError, setFormError, check, fromError, clear, reset };
}
