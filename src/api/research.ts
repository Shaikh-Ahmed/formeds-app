import { apiFetch, API_URL } from '../utils/api';
import { ResearchPaper, PaginatedResearchResponse, ResearchQueryParams } from '../types/research';

export async function fetchResearchPapers(
  params: ResearchQueryParams = {},
  token?: string | null
): Promise<PaginatedResearchResponse> {
  const searchParams = new URLSearchParams();
  searchParams.append('page', String(params.page || 1));
  searchParams.append('limit', String(params.limit || 20));
  searchParams.append('include_meta', 'true');
  if (params.q?.trim()) searchParams.append('q', params.q.trim());
  if (params.specialty && params.specialty !== 'All') searchParams.append('specialty', params.specialty);
  if (params.source && params.source !== 'all') searchParams.append('source', params.source);

  const queryString = searchParams.toString();
  const endpoint = `/api/learning/research${queryString ? `?${queryString}` : ''}`;
  const res = await apiFetch(endpoint, token);

  if (Array.isArray(res)) {
    return {
      items: res,
      total: res.length,
      page: params.page || 1,
      limit: params.limit || res.length,
      total_pages: 1,
    };
  }

  const items: ResearchPaper[] = res?.items || [];
  const limit = res?.limit || params.limit || 20;
  const total = res?.total != null ? res.total : items.length;
  const total_pages = res?.total_pages != null ? res.total_pages : Math.max(1, Math.ceil(total / limit));
  const page = res?.page || params.page || 1;

  return {
    items,
    total,
    page,
    limit,
    total_pages,
  };
}

export async function fetchResearchPaperById(
  paperId: string,
  token?: string | null
): Promise<ResearchPaper> {
  return apiFetch(`/api/learning/research/${paperId}`, token);
}

export async function toggleResearchFavorite(
  paperId: string,
  token?: string | null
): Promise<{ favorited: boolean }> {
  return apiFetch(`/api/learning/research/${paperId}/favorite`, token, {
    method: 'POST',
  });
}

export async function recordResearchOpen(
  paperId: string,
  token?: string | null
): Promise<{ status: string }> {
  return apiFetch(`/api/learning/research/${paperId}/open`, token, {
    method: 'POST',
  });
}

export async function updateResearchProgress(
  paperId: string,
  payload: { current_page: number; progress_pct: number },
  token?: string | null
): Promise<void> {
  await apiFetch(`/api/learning/research/${paperId}/progress`, token, {
    method: 'PUT',
    body: JSON.stringify(payload),
  });
}

/**
 * Upload a research paper PDF.
 */
export async function uploadResearchPaper(
  formData: FormData,
  token?: string | null
): Promise<{ status: string; message: string; paper: ResearchPaper }> {
  const res = await fetch(`${API_URL}/api/learning/research/upload`, {
    method: 'POST',
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: formData,
  });
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    throw new Error(data?.detail || 'Failed to upload research paper');
  }
  return data;
}
