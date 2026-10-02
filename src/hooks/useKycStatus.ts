import { useCallback, useEffect, useState } from 'react';
import { apiFetch } from '../utils/api';
import { useAuth } from '../context/AuthContext';

export type KycStatus = 'not_submitted' | 'pending' | 'approved' | 'rejected';

export interface KycState {
  verified: boolean;
  status: KycStatus;
  reject_reason: string | null;
  submitted_at: string | null;
  /** 'nmc' for practitioners, 'rohini' for hospitals/clinics. */
  registration_type: 'nmc' | 'rohini' | null;
}

// One status shared by every mounted reader. The feed rail, the drawer and the
// "verification required" banners can all be on screen at once; each used to
// know only "approved or not", so a member whose documents were already under
// review was still told to "complete verification". They now share one fetch,
// and a refresh from the KYC screen (after submitting) updates them all.
const STALE_MS = 60_000;
let cached: { token: string; at: number; state: KycState } | null = null;
let inflight: { token: string; promise: Promise<KycState> } | null = null;
const listeners = new Set<(s: KycState) => void>();

async function fetchStatus(token: string, force = false): Promise<KycState> {
  if (!force && cached && cached.token === token && Date.now() - cached.at < STALE_MS) return cached.state;
  if (!force && inflight && inflight.token === token) return inflight.promise;
  const promise = apiFetch('/api/kyc/status', token) as Promise<KycState>;
  inflight = { token, promise };
  try {
    const state = await promise;
    cached = { token, at: Date.now(), state };
    listeners.forEach(fn => fn(state));
    return state;
  } finally {
    if (inflight?.promise === promise) inflight = null;
  }
}

/** For tests and sign-out: forget the shared status. */
export function resetKycStatusCache() {
  cached = null;
  inflight = null;
}

/**
 * Single source of KYC state for the app — the KYC screen, the settings row and
 * the "locked" banners all read this rather than each calling /api/kyc/status.
 *
 * `enabled: false` skips the request (an approved member needs no status).
 */
export function useKycStatus({ enabled = true }: { enabled?: boolean } = {}) {
  const { token, refreshUser } = useAuth();
  const [state, setState] = useState<KycState | null>(
    cached && cached.token === token ? cached.state : null,
  );
  const [loading, setLoading] = useState(enabled);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (force = false) => {
    if (!token || !enabled) {
      setLoading(false);
      return;
    }
    setError(null);
    try {
      setState(await fetchStatus(token, force));
    } catch (e: any) {
      setError(e?.message || 'Could not load your verification status');
    } finally {
      setLoading(false);
    }
  }, [token, enabled]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    listeners.add(setState);
    return () => { listeners.delete(setState); };
  }, []);

  /** Re-read status AND the user row, since approval flips `user.verified`. */
  const refresh = useCallback(async () => {
    await Promise.all([load(true), refreshUser()]);
  }, [load, refreshUser]);

  return { state, loading, error, refresh };
}

/**
 * How to describe verification to someone who is not yet approved. "Under
 * review" must never read as "complete verification": they already did.
 */
export function kycCopy(status: KycStatus | undefined): {
  title: string; hint: string; cta: string; tone: 'warning' | 'navy' | 'danger';
} {
  if (status === 'pending') {
    return {
      title: 'Verification under review',
      hint: 'We are checking your documents. You will be notified as soon as your account is verified.',
      cta: 'View status',
      tone: 'navy',
    };
  }
  if (status === 'rejected') {
    return {
      title: 'Verification not approved',
      hint: 'Your documents could not be verified. See why and submit them again.',
      cta: 'Resubmit documents',
      tone: 'danger',
    };
  }
  return {
    title: 'Verification pending',
    hint: 'Verified members can post, comment, apply to jobs and message other professionals.',
    cta: 'Complete verification',
    tone: 'warning',
  };
}
