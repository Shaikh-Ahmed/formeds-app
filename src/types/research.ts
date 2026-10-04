export interface ResearchPaper {
  id: string;
  title: string;
  authors: string;
  journal?: string;
  doi?: string;
  specialty?: string;
  abstract?: string;
  pages?: number;
  published_date?: string;
  published_year?: number | string;
  year?: number | string;
  date?: string;
  url?: string;
  file_url?: string;
  pdf_url?: string;
  reader_url?: string;
  cover_url?: string;
  source?: 'upload' | 'pubmed' | 'openalex' | string;
  is_oa?: boolean;
  is_favorite?: boolean;
  last_page?: number;
  progress_pct?: number;
  is_recent?: boolean;
  total_chapters?: number;
  keywords?: string[];
  cited_by?: number | null;
  table_of_contents?: { chapter: number; title: string; page: number }[];
}

export interface PaginatedResearchResponse {
  items: ResearchPaper[];
  total: number;
  page: number;
  limit: number;
  total_pages: number;
}

export interface ResearchQueryParams {
  page?: number;
  limit?: number;
  include_meta?: boolean;
  q?: string;
  specialty?: string;
  source?: string;
}
