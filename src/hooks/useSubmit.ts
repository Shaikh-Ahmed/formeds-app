import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * After a success, the same content keeps its key this long: a stray second
 * click while the screen navigates away replays the first result rather than
 * creating a twin. Anything different, or anything later, is a new submission.
 */
const SUCCESS_REPLAY_MS = 10_000;

/** A fresh key for one logical submission (not a secret, just unique). */
export function newIdempotencyKey(): string {
  const c: any = (globalThis as any).crypto;
  if (c?.randomUUID) return c.randomUUID();
  // Older runtimes: time plus randomness is unique enough for a request key.
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}-${Math.random().toString(36).slice(2)}`;
}

/**
 * Submit once. The single pathway every save / post / apply / pay goes through.
 *
 *   const { submitting, run } = useSubmit();
 *   const save = () => run(key => createLocum(token, payload, key), payload);
 *
 * - While a submission is in flight, `run` returns undefined immediately: a
 *   double click, a double tap, Enter plus a click, or a second handler firing
 *   cannot start a second request. The guard is a ref, so it holds even
 *   before React re-renders the button as disabled.
 * - `fn` receives an idempotency key to send with the request. The SAME key is
 *   reused for a retry of the same content (after a timeout, a lost response),
 *   so the server returns the record it already created instead of making
 *   another -- including a stray click just after it succeeded. Changed
 *   content gets a new key, so a genuinely new submission is never blocked;
 *   `reset()` starts over explicitly ("Create another").
 * - Errors are re-thrown to the caller, which decides where they belong
 *   (see useFormErrors). `submitting` always returns to false.
 */
export function useSubmit() {
  const inFlight = useRef(false);
  const pending = useRef<{ signature: string; key: string; doneAt?: number } | null>(null);
  const mounted = useRef(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);

  const run = useCallback(async <T,>(
    fn: (idempotencyKey: string) => Promise<T>,
    /** What is being submitted; a retry of the same content reuses the key. */
    content?: unknown,
  ): Promise<T | undefined> => {
    if (inFlight.current) return undefined;
    inFlight.current = true;
    setSubmitting(true);
    let signature = '';
    try {
      signature = content === undefined ? '' : JSON.stringify(content);
    } catch {
      signature = String(Math.random());
    }
    const prev = pending.current;
    const stale = prev?.doneAt !== undefined && Date.now() - prev.doneAt > SUCCESS_REPLAY_MS;
    // No content given: nothing to recognise a repeat by, so every call is new
    // (the in-flight guard above still stops double clicks).
    if (content === undefined || !prev || prev.signature !== signature || stale) {
      pending.current = { signature, key: newIdempotencyKey() };
    }
    const attempt = pending.current!;
    try {
      const result = await fn(attempt.key);
      attempt.doneAt = Date.now();
      return result;
    } finally {
      inFlight.current = false;
      if (mounted.current) setSubmitting(false);
    }
  }, []);

  /** Forget the last submission: the next one is new even if identical. */
  const reset = useCallback(() => { pending.current = null; }, []);

  return { submitting, run, reset };
}
