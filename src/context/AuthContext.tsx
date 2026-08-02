import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { API_URL, apiFetch, ApiError, setAuthHandlers } from '../utils/api';
import * as secureStorage from '../utils/secureStorage';

const TOKEN_KEY = 'auth_token';
const REFRESH_KEY = 'auth_refresh_token';

interface User {
  id: string;
  email: string;
  name: string;
  role: string;
  phone?: string;
  professional_role?: string;
  specialty?: string;
  city?: string;
  state?: string;
  years_experience?: number;
  cme_credits?: number;
  hospital_type?: string;
  location?: string;
  specialty_focus?: string;
  avatar?: string;
  email_verified?: boolean;
  phone_verified?: boolean;
  is_admin?: boolean;
  /** KYC approval — distinct from email_verified. Legacy column name. */
  verified?: boolean;
  [key: string]: any;
}

/** What registration returns: no session, just what's left to verify. */
export interface PendingVerification {
  verification_token: string;
  email: string;
  phone: string;
  email_verified: boolean;
  phone_verified: boolean;
  phone_required: boolean;
  complete: boolean;
  /** False when the provider rejected the message — the code will never arrive,
   *  so the UI must say so rather than wait on an unsatisfiable input. */
  delivered: boolean;
}

/** A verify/confirm response, which carries a session once every step passes. */
export interface VerificationResult extends Omit<PendingVerification, 'verification_token'> {
  token?: string;
  refresh_token?: string;
  user?: User;
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  loading: boolean;
  /** True once KYC has been approved — the gate on professional actions. */
  isKycApproved: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (data: RegisterInput) => Promise<PendingVerification>;
  /** Store the session handed back at the end of verification (auto sign-in). */
  completeSignup: (result: VerificationResult) => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

export interface RegisterInput {
  email: string;
  password: string;
  name: string;
  role: string;
  phone: string;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  token: null,
  loading: true,
  isKycApproved: false,
  login: async () => {},
  register: async () => {
    throw new Error('AuthProvider is missing');
  },
  completeSignup: async () => {},
  logout: async () => {},
  refreshUser: async () => {},
});

export const useAuth = () => useContext(AuthContext);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  // Single in-flight refresh shared by concurrent 401s.
  const refreshPromise = useRef<Promise<string | null> | null>(null);

  const storeSession = async (accessToken: string, refreshToken: string | undefined, nextUser: User | null) => {
    await secureStorage.setItem(TOKEN_KEY, accessToken);
    if (refreshToken) await secureStorage.setItem(REFRESH_KEY, refreshToken);
    setToken(accessToken);
    if (nextUser) setUser(nextUser);
  };

  const clearSession = useCallback(async () => {
    await secureStorage.deleteItem(TOKEN_KEY);
    await secureStorage.deleteItem(REFRESH_KEY);
    setToken(null);
    setUser(null);
  }, []);

  const doRefresh = useCallback(async (): Promise<string | null> => {
    if (refreshPromise.current) return refreshPromise.current;
    refreshPromise.current = (async () => {
      try {
        const refreshToken = await secureStorage.getItem(REFRESH_KEY);
        if (!refreshToken) return null;
        const res = await fetch(`${API_URL}/api/auth/refresh`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ refresh_token: refreshToken }),
        });
        if (!res.ok) return null;
        const data = await res.json();
        await storeSession(data.token, data.refresh_token, null);
        return data.token as string;
      } catch {
        return null;
      } finally {
        refreshPromise.current = null;
      }
    })();
    return refreshPromise.current;
  }, []);

  useEffect(() => {
    setAuthHandlers({
      refreshTokens: doRefresh,
      onAuthFailure: clearSession,
    });
    return () => setAuthHandlers(null);
  }, [doRefresh, clearSession]);

  const loadStoredAuth = useCallback(async () => {
    try {
      await secureStorage.migrateFromAsyncStorage(TOKEN_KEY);
      let storedToken = await secureStorage.getItem(TOKEN_KEY);
      if (!storedToken) {
        setLoading(false);
        return;
      }
      let res = await fetch(`${API_URL}/api/auth/me`, {
        headers: { Authorization: `Bearer ${storedToken}` },
      });
      if (res.status === 401) {
        const refreshed = await doRefresh();
        if (refreshed) {
          storedToken = refreshed;
          res = await fetch(`${API_URL}/api/auth/me`, {
            headers: { Authorization: `Bearer ${refreshed}` },
          });
        }
      }
      if (res.ok) {
        const data = await res.json();
        setUser(data.user);
        setToken(storedToken);
      } else {
        await clearSession();
      }
    } catch (e) {
      console.log('Auth load error:', e);
    } finally {
      setLoading(false);
    }
  }, [doRefresh, clearSession]);

  useEffect(() => {
    loadStoredAuth();
  }, [loadStoredAuth]);

  const login = async (email: string, password: string) => {
    // apiFetch shapes server errors (including the structured `code` the verify
    // screen branches on) — no token is passed, so its 401-refresh path is inert.
    const data = await apiFetch('/api/auth/login', null, {
      method: 'POST',
      body: JSON.stringify({ email: email.trim().toLowerCase(), password }),
    });
    await storeSession(data.token, data.refresh_token, data.user);
  };

  /**
   * Creates the account but establishes NO session — the server withholds
   * tokens until email (and phone, when SMS is configured) are verified.
   */
  const register = async (regData: RegisterInput): Promise<PendingVerification> => {
    return await apiFetch('/api/auth/register', null, {
      method: 'POST',
      body: JSON.stringify({ ...regData, email: regData.email.trim().toLowerCase() }),
    });
  };

  const completeSignup = async (result: VerificationResult) => {
    if (!result.token || !result.user) {
      throw new ApiError('Verification is not complete yet', 400);
    }
    await storeSession(result.token, result.refresh_token, result.user);
  };

  const logout = async () => {
    try {
      const refreshToken = await secureStorage.getItem(REFRESH_KEY);
      if (refreshToken) {
        // Best-effort server-side revocation; local logout must never block on it.
        await fetch(`${API_URL}/api/auth/logout`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ refresh_token: refreshToken }),
        });
      }
    } catch {}
    await clearSession();
  };

  const refreshUser = useCallback(async () => {
    if (!token) return;
    try {
      const data = await apiFetch('/api/auth/me', token);
      setUser(data.user);
    } catch {
      // A failed refresh must not blank out a working session; apiFetch has
      // already forced a logout if the session was genuinely dead.
    }
  }, [token]);

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        loading,
        isKycApproved: !!user?.verified,
        login,
        register,
        completeSignup,
        logout,
        refreshUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}
