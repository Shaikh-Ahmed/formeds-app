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
import type { OrgMember, OrgRole, Organization } from '../types/organizations';

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
  token: string, data: Record<string, unknown>,
): Promise<Organization> =>
  apiFetch('/api/organizations/', token, { method: 'POST', body: JSON.stringify(data) });

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
  token: string, orgId: string, email: string, role: OrgRole = 'recruiter',
): Promise<{ invite_token: string }> =>
  apiFetch(`/api/organizations/${orgId}/members`, token, {
    method: 'POST', body: JSON.stringify({ email, role }),
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
