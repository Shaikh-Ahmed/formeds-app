const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL || '';
export const API_URL = BACKEND_URL;

export async function apiFetch(path: string, token?: string | null, options: RequestInit = {}) {
  const headers: any = { 'Content-Type': 'application/json', ...options.headers };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const res = await fetch(`${API_URL}${path}`, { cache: 'no-store', ...options, headers });
  const data = await res.json();
  if (!res.ok) throw new Error(data.detail || 'Request failed');
  return data;
}
