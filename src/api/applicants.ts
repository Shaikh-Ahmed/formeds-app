import { apiFetch } from '../utils/api';
import { appendFile } from '../utils/upload';
import type { ApplicationStatusKey } from '../types/jobs';
import type {
  ApplicantDetail, ApplicantPage, ApplicantQuery, InterviewMode, MyResume,
} from '../types/applicants';

/** The employer's applicant workspace, and the professional's resume. */

const json = (method: string, body?: unknown) => ({
  method, ...(body === undefined ? {} : { body: JSON.stringify(body) }),
});

export function searchApplicants(token: string, jobId: string, query: ApplicantQuery): Promise<ApplicantPage> {
  const params = new URLSearchParams();
  Object.entries(query).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== '') params.append(k, String(v));
  });
  return apiFetch(`/api/jobs/${encodeURIComponent(jobId)}/applicants/search?${params}`, token);
}

export const fetchApplicantDetail = (token: string, applicationId: string): Promise<ApplicantDetail> =>
  apiFetch(`/api/jobs/applications/${encodeURIComponent(applicationId)}/detail`, token);

/** A short-lived signed link; fetched only when the resume is actually shown. */
export const fetchApplicantResume = (
  token: string, applicationId: string,
): Promise<{ url: string; name: string; expires_in: number }> =>
  apiFetch(`/api/jobs/applications/${encodeURIComponent(applicationId)}/resume`, token);

export const scheduleInterview = (
  token: string, applicationId: string,
  body: { interview_at: string; mode: InterviewMode; location: string; notes: string },
  idempotencyKey?: string,
) => apiFetch(`/api/jobs/applications/${encodeURIComponent(applicationId)}/interview`, token,
  { ...json('POST', body), idempotencyKey });

export const bulkSetStatus = (
  token: string, jobId: string, applicationIds: string[], status: ApplicationStatusKey,
): Promise<{ moved: string[]; skipped: { id: string; reason: string }[] }> =>
  apiFetch(`/api/jobs/${encodeURIComponent(jobId)}/applications/bulk-status`, token,
    json('POST', { application_ids: applicationIds, status }));

// ── The professional's own resume ──

export const fetchMyResume = (token: string): Promise<MyResume> => apiFetch('/api/profile/resume', token);

export async function uploadResume(
  token: string, file: { uri: string; name?: string | null; mimeType?: string | null },
): Promise<MyResume> {
  const form = new FormData();
  await appendFile(form, 'file', file);
  return apiFetch('/api/profile/resume', token, { method: 'POST', body: form, timeoutMs: 60000 });
}

export const deleteMyResume = (token: string): Promise<MyResume> =>
  apiFetch('/api/profile/resume', token, json('DELETE'));

export const fetchMyResumeUrl = (token: string): Promise<{ url: string; name: string }> =>
  apiFetch('/api/profile/resume/url', token);
