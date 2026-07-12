const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL || '';
export const API_URL = BACKEND_URL;

export async function apiFetch(path: string, token?: string | null, options: RequestInit = {}) {
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

  const res = await fetch(`${API_URL}${finalPath}`, { cache: 'no-store', ...options, headers });
  const data = await res.json();
  if (!res.ok) throw new Error(data.detail || 'Request failed');
  return data;
}
