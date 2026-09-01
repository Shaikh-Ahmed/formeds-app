/**
 * Jobs API client.
 *
 * This is the second module of its kind, after `profile.ts`, and for the reason
 * that file's own comment sets out: a surface with this many endpoints and a
 * discriminated union running through it earns typed wrappers. Screens with one
 * or two calls should keep using `apiFetch` with a literal path.
 *
 * `buildJobsQuery` is exported separately and deliberately pure — it is the
 * piece most likely to break silently (a filter that stops being sent looks
 * exactly like a filter that matches everything), and a pure function is the
 * cheapest thing in the app to test.
 */

import { apiFetch } from '../utils/api';
import type {
  Application, Job, JobFilters, JobsPage,
} from '../types/jobs';

/**
 * Serialise filters into a query string.
 *
 * Keys are emitted in a fixed order so the resulting URL is stable — which
 * matters because `apiFetch` appends a cache-buster per request and any
 * additional churn in the path defeats request de-duplication upstream.
 *
 * Empty strings, empty arrays, undefined and null are omitted rather than sent
 * blank: `?city=` would reach the server as a filter for the empty string and
 * silently return nothing.
 */
export function buildJobsQuery(filters: JobFilters = {}): string {
  const params = new URLSearchParams();
  const push = (key: string, value: unknown) => {
    if (value === undefined || value === null || value === '' || value === false) return;
    params.append(key, String(value));
  };

  push('q', filters.q?.trim());
  push('specialty', filters.specialty);
  push('city', filters.city);
  push('state', filters.state);
  // Repeated key, because the server reads employment_type as a list.
  for (const t of filters.employment_type ?? []) params.append('employment_type', t);
  push('work_mode', filters.work_mode);
  push('pay_min', filters.pay_min);
  push('pay_max', filters.pay_max);
  push('experience_max', filters.experience_max);
  push('urgent_only', filters.urgent_only);
  push('posted_within_days', filters.posted_within_days);
  push('org_id', filters.org_id);
  push('sort', filters.sort);

  return params.toString();
}

/** How many filters the user has actually set, for the "Filters (3)" badge. */
export function activeFilterCount(filters: JobFilters): number {
  const { sort: _sort, q: _q, ...rest } = filters;
  return Object.values(rest).filter(v => {
    if (Array.isArray(v)) return v.length > 0;
    return v !== undefined && v !== null && v !== '' && v !== false;
  }).length;
}

/** The path `usePaginatedList` should be pointed at for a given filter set. */
export function jobsPath(filters: JobFilters = {}): string {
  const query = buildJobsQuery(filters);
  return query ? `/api/jobs/?${query}` : '/api/jobs/';
}

// ── Reads ────────────────────────────────────────────────────────────────────

export const fetchJobs = (token: string | null, filters: JobFilters = {}): Promise<JobsPage> =>
  apiFetch(jobsPath(filters), token);

export const fetchJob = (token: string | null, jobId: string): Promise<Job> =>
  apiFetch(`/api/jobs/${jobId}`, token);

export const fetchSavedJobs = (token: string): Promise<Job[]> =>
  apiFetch('/api/jobs/saved', token);

export const fetchMyPostings = (token: string, status?: string): Promise<Job[]> =>
  apiFetch(`/api/jobs/mine${status ? `?status=${encodeURIComponent(status)}` : ''}`, token);

export const fetchMyApplications = (token: string): Promise<Application[]> =>
  apiFetch('/api/jobs/applications/my', token);

export const fetchApplicants = (
  token: string, jobId: string, status?: string,
): Promise<Application[]> =>
  apiFetch(`/api/jobs/${jobId}/applicants${status ? `?status=${encodeURIComponent(status)}` : ''}`, token);

// ── Writes ───────────────────────────────────────────────────────────────────

export const createJob = (token: string, data: Record<string, unknown>): Promise<Job> =>
  apiFetch('/api/jobs/', token, { method: 'POST', body: JSON.stringify(data) });

export const updateJob = (
  token: string, jobId: string, patch: Record<string, unknown>,
): Promise<Job> =>
  apiFetch(`/api/jobs/${jobId}`, token, { method: 'PATCH', body: JSON.stringify(patch) });

export const deleteJob = (token: string, jobId: string): Promise<{ message: string }> =>
  apiFetch(`/api/jobs/${jobId}`, token, { method: 'DELETE' });

export const setJobStatus = (
  token: string, jobId: string, status: string,
): Promise<{ status: string }> =>
  apiFetch(`/api/jobs/${jobId}/status`, token, {
    method: 'POST', body: JSON.stringify({ status }),
  });

export const toggleSaveJob = (token: string, jobId: string): Promise<{ saved: boolean }> =>
  apiFetch(`/api/jobs/${jobId}/save`, token, { method: 'POST' });

export const applyToJob = (
  token: string, jobId: string, coverNote = '',
): Promise<{ status: string }> =>
  apiFetch(`/api/jobs/${jobId}/apply`, token, {
    method: 'POST', body: JSON.stringify({ cover_note: coverNote }),
  });

export const setApplicationStatus = (
  token: string, applicationId: string, status: string, note = '',
): Promise<{ status: string }> =>
  apiFetch(`/api/jobs/applications/${applicationId}`, token, {
    method: 'PATCH', body: JSON.stringify({ status, note }),
  });
