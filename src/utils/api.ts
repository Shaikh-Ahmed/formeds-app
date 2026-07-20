const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL || '';
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
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
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

function detailToMessage(data: any, fallback: string): string {
  if (!data) return fallback;
  if (typeof data.detail === 'string') return data.detail;
  // FastAPI validation errors arrive as a list of {loc, msg, type}
  if (Array.isArray(data.detail) && data.detail.length > 0 && data.detail[0].msg) {
    return data.detail[0].msg;
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
    throw new ApiError(detailToMessage(data, `Request failed (${res.status})`), res.status);
  }
  return data;
}
