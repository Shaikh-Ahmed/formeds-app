/**
 * Locum API client. Same shape as `api/jobs.ts`: typed wrappers over
 * `apiFetch`, with the one pure function -- the query builder -- exported for
 * testing, because a filter that silently stops being sent looks exactly like
 * one that matches everything.
 */

import { apiFetch } from '../utils/api';
import type {
  Locum, LocumCancelReason, LocumFilters, LocumHistoryEvent, LocumRebooking, LocumReliability,
  LocumReview, LocumStrike, LocumsPage, ManagedLocumApplication, ManagedShifts,
  MyLocumApplication, ProfessionalShifts, UnblockCheckout,
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

export const createLocum = (token: string, data: Record<string, unknown>, idempotencyKey?: string): Promise<Locum> =>
  apiFetch('/api/locums/', token, { method: 'POST', body: JSON.stringify(data), idempotencyKey });

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
  token: string, id: string, note = '', idempotencyKey?: string,
): Promise<MyLocumApplication> =>
  apiFetch(`/api/locums/${id}/apply`, token, {
    method: 'POST', body: JSON.stringify({ note }), idempotencyKey,
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
  idempotencyKey?: string,
): Promise<{ application: ManagedLocumApplication }> =>
  apiFetch(`/api/locums/applications/${applicationId}/interview`, token, {
    method: 'POST', body: JSON.stringify(data), idempotencyKey,
  });

// ── Shifts ───────────────────────────────────────────────────────────────────
// Every time rule and every amount is the server's. These send intent only.

const post = <T>(token: string, path: string, body: unknown = {}, idempotencyKey?: string): Promise<T> =>
  apiFetch(`/api/locums/${path}`, token, { method: 'POST', body: JSON.stringify(body), idempotencyKey });

export const fetchMyShifts = (token: string): Promise<ProfessionalShifts> =>
  apiFetch('/api/locums/shifts/mine', token);

export const fetchManagedShifts = (token: string): Promise<ManagedShifts> =>
  apiFetch('/api/locums/shifts/managed', token);

export const fetchMyReliability = (token: string): Promise<LocumReliability> =>
  apiFetch('/api/locums/reliability', token);

export const markArrival = (token: string, applicationId: string) =>
  post<{ application: MyLocumApplication }>(token, `applications/${applicationId}/arrive`);

export const cancelShift = (token: string, applicationId: string, reason: LocumCancelReason, details = '') =>
  post<{ application: MyLocumApplication }>(token, `applications/${applicationId}/cancel`, { reason, details });

export const disputeNoShow = (token: string, applicationId: string, reason: string) =>
  post<{ strike: LocumStrike }>(token, `applications/${applicationId}/dispute`, { reason });

export const approveAttendance = (token: string, applicationId: string) =>
  post<{ application: ManagedLocumApplication }>(token, `applications/${applicationId}/attendance/approve`);

export const reportNoShow = (token: string, applicationId: string) =>
  post<{ application: ManagedLocumApplication; strike: LocumStrike }>(token, `applications/${applicationId}/no-show`);

export interface LocumReviewInput {
  overall: number;
  punctuality?: number;
  professionalism?: number;
  communication?: number;
  clinical?: number;
  review?: string;
}

export const reviewShift = (token: string, applicationId: string, data: LocumReviewInput, idempotencyKey?: string) =>
  post<{ review: LocumReview }>(token, `applications/${applicationId}/review`, data, idempotencyKey);

export interface LocumRebookInput {
  source_application_id: string;
  shift_date: string;
  start_time: string;
  end_time: string;
  shift_type?: string;
  pay_amount: number;
  pay_type?: string;
  specialty?: string;
  city?: string;
  address?: string;
  notes?: string;
  message?: string;
  require_interview?: boolean;
  allow_outside_availability?: boolean;
}

export const requestAgain = (token: string, data: LocumRebookInput, idempotencyKey?: string) =>
  post<LocumRebooking>(token, 'rebookings', data, idempotencyKey);

export const acceptRebooking = (token: string, id: string, note = '') =>
  post<LocumRebooking & { application: MyLocumApplication }>(token, `rebookings/${id}/accept`, { note });

export const rejectRebooking = (token: string, id: string, note = '') =>
  post<LocumRebooking>(token, `rebookings/${id}/reject`, { note });

export const cancelRebooking = (token: string, id: string) =>
  post<LocumRebooking>(token, `rebookings/${id}/cancel`);

export const startUnblockCheckout = (token: string) =>
  post<UnblockCheckout>(token, 'reliability/unblock/checkout');

export const payUnblock = (
  token: string, paymentId: string, outcome: 'success' | 'failure', method: 'card' | 'upi' | 'netbanking',
  idempotencyKey?: string,
) => post<{ status: string; already_processed: boolean; checkout: UnblockCheckout }>(
  token, `reliability/unblock/${paymentId}/demo-pay`, { outcome, method }, idempotencyKey,
);
