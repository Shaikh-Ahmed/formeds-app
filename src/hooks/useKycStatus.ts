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

/**
 * Single source of KYC state for the app — the KYC screen, the settings row and
 * the "locked" banners all read this rather than each calling /api/kyc/status.
 */
export function useKycStatus() {
  const { token, refreshUser } = useAuth();
  const [state, setState] = useState<KycState | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!token) {
      setLoading(false);
      return;
    }
    setError(null);
    try {
      setState(await apiFetch('/api/kyc/status', token));
    } catch (e: any) {
      setError(e?.message || 'Could not load your verification status');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    load();
  }, [load]);

  /** Re-read status AND the user row, since approval flips `user.verified`. */
  const refresh = useCallback(async () => {
    await Promise.all([load(), refreshUser()]);
  }, [load, refreshUser]);

  return { state, loading, error, refresh };
}
