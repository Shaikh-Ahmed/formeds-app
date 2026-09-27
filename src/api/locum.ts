/**
 * Locum API client. Same shape as `api/jobs.ts`: typed wrappers over
 * `apiFetch`, with the one pure function -- the query builder -- exported for
 * testing, because a filter that silently stops being sent looks exactly like
 * one that matches everything.
 */

import { apiFetch } from '../utils/api';
import type {
  Locum, LocumFilters, LocumHistoryEvent, LocumsPage,
  ManagedLocumApplication, MyLocumApplication,
} from '../types/locum';

export function buildLocumQuery(filters: LocumFilters = {}): string {
  const params = new URLSearchParams();
  const push = (key: string, value: unknown) => {
    if (value === undefined || value === null || value === '' || value === false) return;
    params.append(key, String(value));
  };
  push('specialty', filters.specialty);
  push('role_required', filters.role_required);
  push('city', filters.city);
  push('shift_type', filters.shift_type);
  push('date_from', filters.date_from);
  push('date_to', filters.date_to);
  push('pay_min', filters.pay_min);
  push('verified_only', filters.verified_only);
  push('sort', filters.sort);
  return params.toString();
}

export function locumsPath(filters: LocumFilters = {}): string {
  const query = buildLocumQuery(filters);
  return query ? `/api/locums/?${query}` : '/api/locums/';
}

// ── Reads ────────────────────────────────────────────────────────────────────

export const fetchLocums = (token: string | null, filters: LocumFilters = {}): Promise<LocumsPage> =>
  apiFetch(locumsPath(filters), token);

export const fetchLocum = (token: string | null, id: string): Promise<Locum> =>
  apiFetch(`/api/locums/${id}`, token);

export const fetchMyLocums = (token: string, bucket?: 'active' | 'closed'): Promise<Locum[]> =>
  apiFetch(`/api/locums/mine${bucket ? `?bucket=${bucket}` : ''}`, token);

export const fetchMyLocumApplications = (token: string): Promise<MyLocumApplication[]> =>
  apiFetch('/api/locums/applications/my', token);

export const fetchReceivedLocumApplications = (
  token: string,
): Promise<ManagedLocumApplication[]> =>
  apiFetch('/api/locums/applications/received?limit=50', token);

export const fetchLocumApplicants = (
  token: string, locumId: string,
): Promise<ManagedLocumApplication[]> =>
  apiFetch(`/api/locums/${locumId}/applicants`, token);

export const fetchLocumApplicationHistory = (
  token: string, applicationId: string,
): Promise<LocumHistoryEvent[]> =>
  apiFetch(`/api/locums/applications/${applicationId}/history`, token);

// ── Writes ───────────────────────────────────────────────────────────────────

export const createLocum = (token: string, data: Record<string, unknown>): Promise<Locum> =>
  apiFetch('/api/locums/', token, { method: 'POST', body: JSON.stringify(data) });

export const updateLocum = (
  token: string, id: string, patch: Record<string, unknown>,
): Promise<Locum> =>
  apiFetch(`/api/locums/${id}`, token, { method: 'PATCH', body: JSON.stringify(patch) });

export const setLocumStatus = (
  token: string, id: string, status: 'open' | 'closed' | 'cancelled',
): Promise<Locum> =>
  apiFetch(`/api/locums/${id}/status`, token, {
    method: 'POST', body: JSON.stringify({ status }),
  });

export const applyToLocum = (
  token: string, id: string, note = '',
): Promise<MyLocumApplication> =>
  apiFetch(`/api/locums/${id}/apply`, token, {
    method: 'POST', body: JSON.stringify({ note }),
  });

export const withdrawLocumApplication = (
  token: string, applicationId: string,
): Promise<{ status: string }> =>
  apiFetch(`/api/locums/applications/${applicationId}/withdraw`, token, { method: 'POST' });

/** Review, contact, select or turn down. Selecting returns the updated locum
 *  so the opening count can update without a refetch. */
export const moveLocumApplication = (
  token: string, applicationId: string,
  status: 'under_review' | 'contacted' | 'selected' | 'not_selected', note = '',
): Promise<{ application: ManagedLocumApplication; locum: Locum }> =>
  apiFetch(`/api/locums/applications/${applicationId}`, token, {
    method: 'PATCH', body: JSON.stringify({ status, note }),
  });

export const recordLocumInterview = (
  token: string, applicationId: string,
  data: { result: 'scheduled' | 'passed' | 'failed'; interview_at?: string; notes?: string },
): Promise<{ application: ManagedLocumApplication }> =>
  apiFetch(`/api/locums/applications/${applicationId}/interview`, token, {
    method: 'POST', body: JSON.stringify(data),
  });
