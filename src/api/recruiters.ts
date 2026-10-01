/**
 * Recruiter module client. Jobs and locum shifts themselves go through the
 * existing jobs/locum clients -- a recruiter posts like any employer.
 */

import { apiFetch } from '../utils/api';
import { appendFile } from '../utils/upload';
import type {
  AdminAction, AdminRecruiterDetail, AdminRecruiterRow, AvailabilitySlot, CandidatePage,
  DiscoverySettings, HistoryItem, Invitation, PublicRecruiter, RecruiterAccount,
  RecruiterDashboard, RecruiterDocType, StatusEvent,
} from '../types/recruiters';

const json = (method: string, body?: unknown) => ({
  method, ...(body === undefined ? {} : { body: JSON.stringify(body) }),
});

// ── Account ──
export interface RecruiterSignup {
  name: string; email: string; phone: string; password: string; company_name: string;
}
export const registerRecruiter = (data: RecruiterSignup) =>
  apiFetch('/api/recruiters/register', null, json('POST', data));

export const fetchRecruiterAccount = (token: string): Promise<RecruiterAccount> =>
  apiFetch('/api/recruiters/me', token);

export const updateRecruiterAccount = (token: string, patch: Partial<RecruiterAccount>): Promise<RecruiterAccount> =>
  apiFetch('/api/recruiters/me', token, json('PATCH', patch));

export const submitRecruiterReview = (token: string): Promise<RecruiterAccount> =>
  apiFetch('/api/recruiters/me/submit', token, json('POST'));

export const fetchRecruiterEvents = (token: string): Promise<StatusEvent[]> =>
  apiFetch('/api/recruiters/me/events', token);

export async function uploadRecruiterDocument(
  token: string, docType: RecruiterDocType, file: { uri: string; name?: string | null; mimeType?: string | null },
): Promise<RecruiterAccount> {
  const form = new FormData();
  form.append('doc_type', docType);
  await appendFile(form, 'document', file);
  return apiFetch('/api/recruiters/me/documents', token, { method: 'POST', body: form, timeoutMs: 60000 });
}

export const deleteRecruiterDocument = (token: string, id: string): Promise<RecruiterAccount> =>
  apiFetch(`/api/recruiters/me/documents/${encodeURIComponent(id)}`, token, json('DELETE'));

export const fetchRecruiterDashboard = (token: string): Promise<RecruiterDashboard> =>
  apiFetch('/api/recruiters/dashboard', token);

export const fetchRecruiterHistory = (token: string): Promise<HistoryItem[]> =>
  apiFetch('/api/recruiters/history', token);

// ── Candidates and invitations ──
export interface CandidateQuery {
  q?: string; specialty?: string; role?: string; experience_min?: number;
  city?: string; radius_km?: number; availability?: 'any' | 'jobs' | 'locum'; page?: number;
}
export function searchCandidates(token: string, query: CandidateQuery): Promise<CandidatePage> {
  const params = new URLSearchParams();
  Object.entries(query).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== '') params.append(k, String(v));
  });
  return apiFetch(`/api/recruiters/candidates?${params.toString()}`, token);
}

export const fetchCities = (token: string): Promise<string[]> => apiFetch('/api/recruiters/cities', token);

export const sendInvitation = (
  token: string, body: { professional_id: string; job_id?: string; locum_id?: string; message?: string },
): Promise<Invitation> => apiFetch('/api/recruiters/invitations', token, json('POST', body));

export const fetchSentInvitations = (token: string): Promise<Invitation[]> =>
  apiFetch('/api/recruiters/invitations', token);

export const fetchPublicRecruiter = (token: string, id: string): Promise<PublicRecruiter> =>
  apiFetch(`/api/recruiters/${encodeURIComponent(id)}/public`, token);

// ── Professional side ──
export const fetchDiscovery = (token: string): Promise<DiscoverySettings> =>
  apiFetch('/api/opportunities/settings', token);

export const saveDiscovery = (token: string, patch: Partial<DiscoverySettings>): Promise<DiscoverySettings> =>
  apiFetch('/api/opportunities/settings', token, json('PUT', patch));

export const fetchAvailability = (token: string): Promise<AvailabilitySlot[]> =>
  apiFetch('/api/opportunities/availability', token);

export const saveAvailability = (token: string, slots: AvailabilitySlot[]): Promise<AvailabilitySlot[]> =>
  apiFetch('/api/opportunities/availability', token, json('PUT', {
    slots: slots.map(({ id: _id, ...s }) => s),
  }));

export const fetchMyInvitations = (token: string): Promise<Invitation[]> =>
  apiFetch('/api/opportunities/invitations', token);

export const markInvitationViewed = (token: string, id: string): Promise<Invitation> =>
  apiFetch(`/api/opportunities/invitations/${encodeURIComponent(id)}/view`, token, json('POST'));

export const declineInvitation = (token: string, id: string): Promise<Invitation> =>
  apiFetch(`/api/opportunities/invitations/${encodeURIComponent(id)}/decline`, token, json('POST'));

export const blockRecruiter = (token: string, recruiterId: string) =>
  apiFetch(`/api/opportunities/blocks/${encodeURIComponent(recruiterId)}`, token, json('POST'));

export const unblockRecruiter = (token: string, recruiterId: string) =>
  apiFetch(`/api/opportunities/blocks/${encodeURIComponent(recruiterId)}`, token, json('DELETE'));

export const reportUser = (
  token: string, userId: string, body: { reason: string; details?: string; context?: string },
) => apiFetch(`/api/reports/${encodeURIComponent(userId)}`, token, json('POST', body));

// ── Admin ──
export const adminListRecruiters = (token: string, status?: string): Promise<AdminRecruiterRow[]> =>
  apiFetch(`/api/admin/recruiters/${status ? `?status=${status}` : ''}`, token);

export const adminRecruiterDetail = (token: string, id: string): Promise<AdminRecruiterDetail> =>
  apiFetch(`/api/admin/recruiters/${encodeURIComponent(id)}`, token);

export const adminRecruiterAction = (
  token: string, id: string, action: AdminAction, reason = '',
): Promise<AdminRecruiterDetail> =>
  apiFetch(`/api/admin/recruiters/${encodeURIComponent(id)}/action`, token, json('POST', { action, reason }));

export const adminRecruiterDocument = (token: string, id: string, docId: string): Promise<{ url: string }> =>
  apiFetch(`/api/admin/recruiters/${encodeURIComponent(id)}/documents/${encodeURIComponent(docId)}`, token);
