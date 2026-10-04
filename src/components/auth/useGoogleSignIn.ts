import { useCallback, useState } from 'react';
import { useRouter } from 'expo-router';
import { useAuth, type VerificationResult } from '../../context/AuthContext';
import { apiFetch } from '../../utils/api';

/**
 * What the API answers after verifying a Google ID token. Every branch ends
 * in the SAME session the email login makes -- there is no "Google session".
 */
export type GoogleSignInResult =
  | ({ status: 'signed_in'; linked?: boolean } & Required<Pick<VerificationResult, 'token' | 'user'>> & VerificationResult)
  | { status: 'verify'; verification_token: string; email: string; phone: string; delivered: boolean; phone_required: boolean }
  | GoogleOnboarding;

export interface GoogleOnboarding {
  status: 'onboarding';
  signup_token: string;
  email: string;
  name: string;
  photo_available: boolean;
  phone_required: boolean;
  /** The role picked on the register screen, offered as the default. */
  roleHint?: string;
}

// The signup ticket for a new Google user, held in memory between the sign-in
// screen and the onboarding form. Deliberately not a URL parameter: on the web
// that would put it in browser history.
let pending: GoogleOnboarding | null = null;
export const pendingGoogleSignup = () => pending;
export const clearPendingGoogleSignup = () => { pending = null; };

export interface GoogleCompleteInput {
  signup_token: string;
  role: string;
  name: string;
  phone: string;
  professional_role?: string;
  use_google_photo?: boolean;
  course?: string;
  institution?: string;
  university?: string;
  current_year?: number;
  graduation_year?: number;
}

export const completeGoogleSignup = (input: GoogleCompleteInput): Promise<GoogleSignInResult> =>
  apiFetch('/api/auth/google/complete', null, { method: 'POST', body: JSON.stringify(input) });

/**
 * Turn a Google result into the next screen: signed in (RootNavigator takes it
 * from there, to KYC for a new account), finish phone verification, or
 * onboarding for someone new to ForMeds.
 */
export function useGoogleResultRouter() {
  const router = useRouter();
  const { completeSignup } = useAuth();
  return useCallback(async (result: GoogleSignInResult, roleHint?: string) => {
    if (result.status === 'signed_in') {
      clearPendingGoogleSignup();
      await completeSignup({ ...result, complete: true });
      return;
    }
    if (result.status === 'verify') {
      router.replace({
        pathname: '/verify',
        params: {
          verificationToken: result.verification_token, email: result.email, phone: result.phone,
          phoneRequired: '1', start: 'phone', delivered: result.delivered === false ? '0' : '1',
        },
      });
      return;
    }
    pending = { ...result, roleHint };
    router.push('/google-onboarding' as any);
  }, [router, completeSignup]);
}

export function useGoogleSignIn(roleHint?: string) {
  const route = useGoogleResultRouter();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const signIn = useCallback(async (credential: string, nonceToken: string) => {
    setError(null);
    setBusy(true);
    try {
      const result: GoogleSignInResult = await apiFetch('/api/auth/google', null, {
        method: 'POST', body: JSON.stringify({ credential, nonce_token: nonceToken }),
      });
      await route(result, roleHint);
    } catch (e: any) {
      // The server's messages are written for people; nothing raw from Google
      // ever reaches this far.
      setError(e?.message || 'Google sign-in did not work. Please try again.');
    } finally {
      setBusy(false);
    }
  }, [route, roleHint]);
  return { signIn, error, setError, busy };
}
