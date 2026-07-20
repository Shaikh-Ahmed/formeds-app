import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { API_URL, setAuthHandlers } from '../utils/api';
import * as secureStorage from '../utils/secureStorage';

const TOKEN_KEY = 'auth_token';
const REFRESH_KEY = 'auth_refresh_token';

interface User {
  id: string;
  email: string;
  name: string;
  role: string;
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
  [key: string]: any;
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (data: any) => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  token: null,
  loading: true,
  login: async () => {},
  register: async () => {},
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
    const res = await fetch(`${API_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(typeof data.detail === 'string' ? data.detail : 'Login failed');
    await storeSession(data.token, data.refresh_token, data.user);
  };

  const register = async (regData: any) => {
    const res = await fetch(`${API_URL}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(regData),
    });
    const data = await res.json();
    if (!res.ok) {
      const detail = data?.detail;
      const msg =
        typeof detail === 'string'
          ? detail
          : Array.isArray(detail) && detail[0]?.msg
            ? detail[0].msg
            : 'Registration failed';
      throw new Error(msg);
    }
    await storeSession(data.token, data.refresh_token, data.user);
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

  const refreshUser = async () => {
    if (token) {
      const res = await fetch(`${API_URL}/api/auth/me`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setUser(data.user);
      }
    }
  };

  return (
    <AuthContext.Provider value={{ user, token, loading, login, register, logout, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
}
