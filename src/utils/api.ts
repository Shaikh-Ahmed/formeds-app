import Constants from 'expo-constants';

/**
 * Hosts that belong to a development machine rather than a deployed server.
 * Only these get their address rewritten below; anything public is respected
 * verbatim so pointing dev at a staging or Render backend keeps working.
 */
function isLocalHost(host: string): boolean {
  return (
    host === 'localhost' ||
    host === '127.0.0.1' ||
    /^10\./.test(host) ||
    /^192\.168\./.test(host) ||
    /^172\.(1[6-9]|2\d|3[01])\./.test(host)
  );
}

/**
 * Works out the API base URL.
 *
 * In development the host is taken from the address the app was actually served
 * from rather than from EXPO_PUBLIC_BACKEND_URL. The env var pins a LAN IP, but
 * DHCP reassigns that address regularly — every time it moved, the app spent 15
 * seconds timing out against a machine that no longer existed and reported it as
 * "check your connection". The scheme, port and path still come from the env
 * var, so only the volatile part is derived.
 *
 * `browserHost` wins over `hostUri` when present, and that ordering is the
 * whole point. Metro advertises the LAN IP it saw when IT started, which goes
 * stale the moment DHCP moves the machine — a browser can then be loading the
 * bundle happily over `localhost:8081` while `hostUri` still claims
 * `192.168.1.3:8081`, sending every API call to an address that no longer
 * exists. `window.location.hostname` cannot be stale: it is literally where the
 * page came from. On a physical device there is no `window`, so Metro's
 * hostUri remains the right answer and is used unchanged.
 *
 * Exported for tests; prefer API_URL at call sites.
 */
export function deriveApiBase(
  configured: string,
  hostUri: string | undefined,
  isDev: boolean,
  browserHost?: string,
): string {
  if (!isDev) return configured;

  // hostUri looks like "192.168.1.3:8081" or occasionally "exp://host:port".
  const metroHost =
    browserHost || hostUri?.split('://').pop()?.split('/')[0]?.split(':')[0];
  if (!metroHost) return configured;

  const base = configured || 'http://localhost:8000';
  const parts = base.match(/^(https?:\/\/)([^/:]+)(:\d+)?(\/.*)?$/);
  if (!parts) return configured;

  const [, scheme, host, port = '', path = ''] = parts;
  // A deployed backend is a deliberate choice — never repoint it at Metro.
  if (!isLocalHost(host)) return configured;

  return `${scheme}${metroHost}${port}${path}`;
}

/** Undefined on native, where there is no document to have been served. */
const browserHost =
  typeof window !== 'undefined' && window.location?.hostname
    ? window.location.hostname
    : undefined;

const BACKEND_URL = deriveApiBase(
  process.env.EXPO_PUBLIC_BACKEND_URL || '',
  Constants.expoConfig?.hostUri,
  __DEV__,
  browserHost,
);
export const API_URL = BACKEND_URL;

const REQUEST_TIMEOUT_MS = 15000;

// AuthContext registers these so apiFetch can transparently refresh an expired
// access token once and force a logout when the session is truly dead.
type AuthHandlers = {
  refreshTokens: () => Promise<string | null>;
  onAuthFailure: () => Promise<void>;
};
let authHandlers: AuthHandlers | null = null;
export function setAuthHandlers(handlers: AuthHandlers | null) {
  authHandlers = handlers;
}

export class ApiError extends Error {
  status: number;
  /** Stable machine-readable code from the server (e.g. 'email_unverified',
   *  'kyc_required'), when it sent one. Branch on this, never on the message. */
  code?: string;
  /** Full parsed response body, for errors that carry extra fields. */
  data?: any;
  constructor(message: string, status: number, data?: any) {
    super(message);
    this.status = status;
    this.data = data;
    const detail = data?.detail;
    if (detail && typeof detail === 'object' && !Array.isArray(detail)) {
      this.code = detail.code;
    }
  }
}

async function parseBody(res: Response): Promise<any> {
  const contentType = res.headers.get('content-type') || '';
  if (contentType.includes('application/json')) {
    try {
      return await res.json();
    } catch {
      return null;
    }
  }
  return null;
}

export function detailToMessage(data: any, fallback: string): string {
  if (!data) return fallback;
  const detail = data.detail;
  if (typeof detail === 'string') return detail;
  // FastAPI validation errors arrive as a list of {loc, msg, type}
  if (Array.isArray(detail) && detail.length > 0 && detail[0].msg) {
    return detail[0].msg;
  }
  // Structured app errors: {code, message, ...}
  if (detail && typeof detail === 'object' && typeof detail.message === 'string') {
    return detail.message;
  }
  return fallback;
}

async function rawFetch(path: string, token: string | null | undefined, options: RequestInit) {
  const headers: any = { ...options.headers };
  const isFormData = options.body && typeof (options.body as any).append === 'function';
  if (!isFormData) {
    headers['Content-Type'] = headers['Content-Type'] || 'application/json';
  }
  headers['Cache-Control'] = 'no-cache, no-store, must-revalidate';
  headers['Pragma'] = 'no-cache';
  headers['Expires'] = '0';
  if (token) headers['Authorization'] = `Bearer ${token}`;

  // Force cache busting on React Native for GET requests
  const method = options.method || 'GET';
  let finalPath = path;
  if (method.toUpperCase() === 'GET') {
    finalPath = path.includes('?') ? `${path}&_t=${Date.now()}` : `${path}?_t=${Date.now()}`;
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    return await fetch(`${API_URL}${finalPath}`, {
      cache: 'no-store',
      ...options,
      headers,
      signal: controller.signal,
    });
  } catch (e: any) {
    if (e?.name === 'AbortError') {
      throw new ApiError('Request timed out. Check your connection and try again.', 0);
    }
    throw new ApiError('Network error. Check your connection and try again.', 0);
  } finally {
    clearTimeout(timer);
  }
}

export async function apiFetch(path: string, token?: string | null, options: RequestInit = {}) {
  let res = await rawFetch(path, token, options);

  // Access token expired: refresh once and retry with the new token.
  if (res.status === 401 && token && authHandlers) {
    const newToken = await authHandlers.refreshTokens();
    if (newToken) {
      res = await rawFetch(path, newToken, options);
    } else {
      await authHandlers.onAuthFailure();
    }
  }

  const data = await parseBody(res);
  if (!res.ok) {
    throw new ApiError(detailToMessage(data, `Request failed (${res.status})`), res.status, data);
  }
  return data;
}

/**
 * Same shape as `apiFetch` (auth header, one 401-refresh retry) for an
 * endpoint that returns a binary body — a PDF today — rather than JSON.
 * `parseBody` would try to JSON.parse a PDF and either throw or silently
 * hand back null, so this reads the body as a Blob instead and only falls
 * back to JSON parsing to extract an error message when the response failed.
 */
export async function apiFetchBlob(path: string, token?: string | null, options: RequestInit = {}): Promise<Blob> {
  let res = await rawFetch(path, token, options);

  if (res.status === 401 && token && authHandlers) {
    const newToken = await authHandlers.refreshTokens();
    if (newToken) {
      res = await rawFetch(path, newToken, options);
    } else {
      await authHandlers.onAuthFailure();
    }
  }

  if (!res.ok) {
    const data = await parseBody(res);
    throw new ApiError(detailToMessage(data, `Request failed (${res.status})`), res.status, data);
  }
  return res.blob();
}
