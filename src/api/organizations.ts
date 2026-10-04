/**
 * Organisations API client.
 *
 * Same shape as `profile.ts` and `jobs.ts`: thin typed wrappers, token first,
 * parsed body back.
 *
 * Note what is NOT here. There is no `verifyOrganization` — verification is
 * granted by an admin approving a submitted document and by nothing else, so
 * the client can ask for a review (`submitOrgKyc`) but has no call that could
 * set the status itself.
 */

import { apiFetch } from '../utils/api';
import { appendFile } from '../utils/upload';
import type {
  OrgAffiliationRequest, OrgMember, OrgPhoto, OrgProfilePage, OrgRole, Organization,
} from '../types/organizations';

export interface OrgDirectoryFilters {
  q?: string;
  city?: string;
  org_type?: string;
  verified_only?: boolean;
}

export function buildOrgQuery(filters: OrgDirectoryFilters = {}): string {
  const params = new URLSearchParams();
  if (filters.q?.trim()) params.append('q', filters.q.trim());
  if (filters.city) params.append('city', filters.city);
  if (filters.org_type) params.append('org_type', filters.org_type);
  if (filters.verified_only) params.append('verified_only', 'true');
  return params.toString();
}

// ── Reads ────────────────────────────────────────────────────────────────────

export const fetchOrganizations = (
  token: string | null, filters: OrgDirectoryFilters = {},
): Promise<Organization[]> => {
  const qs = buildOrgQuery(filters);
  return apiFetch(`/api/organizations/${qs ? `?${qs}` : ''}`, token);
};

export const fetchOrganization = (
  token: string | null, orgId: string,
): Promise<Organization> => apiFetch(`/api/organizations/${orgId}`, token);

/** Everything this account may post under — drives the "post as" picker. */
export const fetchMyOrganizations = (token: string): Promise<Organization[]> =>
  apiFetch('/api/organizations/mine', token);

export const fetchOrgJobs = (token: string | null, orgId: string): Promise<any[]> =>
  apiFetch(`/api/organizations/${orgId}/jobs`, token);

export const fetchOrgMembers = (token: string, orgId: string): Promise<OrgMember[]> =>
  apiFetch(`/api/organizations/${orgId}/members`, token);

// ── Writes ───────────────────────────────────────────────────────────────────

export const createOrganization = (
  token: string, data: Record<string, unknown>, idempotencyKey?: string,
): Promise<Organization> =>
  apiFetch('/api/organizations/', token, { method: 'POST', body: JSON.stringify(data), idempotencyKey });

export const updateOrganization = (
  token: string, orgId: string, patch: Record<string, unknown>,
): Promise<Organization> =>
  apiFetch(`/api/organizations/${orgId}`, token, {
    method: 'PATCH', body: JSON.stringify(patch),
  });

export const deleteOrganization = (
  token: string, orgId: string,
): Promise<{ message: string }> =>
  apiFetch(`/api/organizations/${orgId}`, token, { method: 'DELETE' });

/**
 * Returns the invite token, which the inviter shares as a link. It is returned
 * to the INVITER only and never appears in the members list — anyone holding
 * one can join the organisation.
 */
export const inviteMember = (
  token: string, orgId: string, email: string, role: OrgRole = 'recruiter', idempotencyKey?: string,
): Promise<{ invite_token: string }> =>
  apiFetch(`/api/organizations/${orgId}/members`, token, {
    method: 'POST', body: JSON.stringify({ email, role }), idempotencyKey,
  });

export const acceptInvite = (
  token: string, inviteToken: string,
): Promise<{ org_id: string }> =>
  apiFetch(`/api/organizations/invites/${inviteToken}/accept`, token, { method: 'POST' });

export const setMemberRole = (
  token: string, orgId: string, memberId: string, role: OrgRole,
): Promise<{ role: string }> =>
  apiFetch(`/api/organizations/${orgId}/members/${memberId}`, token, {
    method: 'PATCH', body: JSON.stringify({ role }),
  });

export const removeMember = (
  token: string, orgId: string, memberId: string,
): Promise<{ message: string }> =>
  apiFetch(`/api/organizations/${orgId}/members/${memberId}`, token, { method: 'DELETE' });

export async function uploadOrgLogo(token: string, orgId: string, uri: string) {
  // `appendFile` owns the platform fork — a browser needs a Blob, React Native
  // needs a { uri, name, type } descriptor. apiFetch detects FormData and
  // leaves the Content-Type to the runtime, boundary included.
  const formData = new FormData();
  await appendFile(formData, 'file', { uri });
  return apiFetch(`/api/organizations/${orgId}/logo`, token, {
    method: 'POST', body: formData,
  }) as Promise<{ logo: string }>;
}

/** Asks for a review. Cannot grant one — only an admin approval does that. */
export async function submitOrgKyc(
  token: string,
  orgId: string,
  { uri, registrationNumber, stateCouncil = '' }:
    { uri: string; registrationNumber: string; stateCouncil?: string },
) {
  const formData = new FormData();
  await appendFile(formData, 'document', { uri });
  formData.append('registration_number', registrationNumber);
  formData.append('state_council', stateCouncil);
  return apiFetch(`/api/organizations/${orgId}/kyc`, token, {
    method: 'POST', body: formData,
  }) as Promise<{ status: string }>;
}

// ── Organisation profile ─────────────────────────────────────────────────────

/** The organisation a hospital or clinic account is presented as. The server
 *  creates it on first use, so every such account has a profile. */
export const fetchAccountOrganization = (token: string | null, userId: string): Promise<Organization> =>
  apiFetch(`/api/organizations/account/${userId}`, token);

/** The whole page in one request: organisation, team, jobs, locums. */
export const fetchOrgProfile = (token: string | null, orgId: string): Promise<OrgProfilePage> =>
  apiFetch(`/api/organizations/${orgId}/profile`, token);

async function uploadOrgImage(
  token: string, path: string, uri: string, extra: Record<string, string> = {}, idempotencyKey?: string,
) {
  const formData = new FormData();
  await appendFile(formData, 'file', { uri });
  for (const [k, v] of Object.entries(extra)) formData.append(k, v);
  return apiFetch(path, token, { method: 'POST', body: formData, idempotencyKey });
}

export const uploadOrgCover = (token: string, orgId: string, uri: string) =>
  uploadOrgImage(token, `/api/organizations/${orgId}/cover`, uri) as Promise<{ cover_photo: string }>;

export const removeOrgCover = (token: string, orgId: string) =>
  apiFetch(`/api/organizations/${orgId}/cover`, token, { method: 'DELETE' });

export const removeOrgLogo = (token: string, orgId: string) =>
  apiFetch(`/api/organizations/${orgId}/logo`, token, { method: 'DELETE' });

export const addOrgPhoto = (token: string, orgId: string, uri: string, caption = '', idempotencyKey?: string) =>
  uploadOrgImage(token, `/api/organizations/${orgId}/photos`, uri, { caption }, idempotencyKey) as Promise<{ photos: OrgPhoto[] }>;

export const removeOrgPhoto = (token: string, orgId: string, photoId: string): Promise<{ photos: OrgPhoto[] }> =>
  apiFetch(`/api/organizations/${orgId}/photos/${photoId}`, token, { method: 'DELETE' });

export const requestAffiliation = (token: string, orgId: string, title = '', department = '',
  idempotencyKey?: string) =>
  apiFetch(`/api/organizations/${orgId}/affiliations`, token, {
    method: 'POST', body: JSON.stringify({ title, department }), idempotencyKey,
  }) as Promise<{ id: string; status: string }>;

export const fetchAffiliations = (token: string, orgId: string): Promise<OrgAffiliationRequest[]> =>
  apiFetch(`/api/organizations/${orgId}/affiliations`, token);

export const decideAffiliation = (token: string, orgId: string, id: string, decision: 'approve' | 'decline') =>
  apiFetch(`/api/organizations/${orgId}/affiliations/${id}/decision`, token, {
    method: 'POST', body: JSON.stringify({ decision }),
  });

export const removeAffiliation = (token: string, orgId: string, id: string) =>
  apiFetch(`/api/organizations/${orgId}/affiliations/${id}`, token, { method: 'DELETE' });
