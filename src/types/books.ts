export interface TableOfContentItem {
  chapter: number;
  title: string;
  page: number;
}

// Alias for backwards compatibility
export type Chapter = TableOfContentItem;

export interface Book {
  id: string;
  title: string;
  author: string;
  specialty: string;
  category: string;
  description: string;
  pages: number;
  published_year?: number;
  publisher?: string;
  isbn?: string;
  cover_url: string;
  reader_url: string;
  file_url?: string;
  pdf_url?: string;
  url?: string;
  table_of_contents: TableOfContentItem[];
  total_chapters?: number;
  is_favorite?: boolean;
  is_recent?: boolean;
  last_opened_at?: string | null;
  last_page?: number;
  progress_pct?: number;
}

export interface PaginatedBooksResponse {
  items: Book[];
  total: number;
  page: number;
  limit: number;
  total_pages: number;
}

export interface ChapterSection {
  heading: string;
  body: string;
  image_url?: string;
  page?: number;
  key_findings?: string[];
  management?: string;
  clinical_pearl?: string;
  red_flags?: string;
}

export interface ChapterData {
  book_id?: string;
  book_title?: string;
  chapter?: number;
  chapter_number?: number;
  title: string;
  page?: number;
  page_start?: number;
  page_end?: number;
  sections: ChapterSection[];
  prev_chapter?: number | null;
  next_chapter?: number | null;
  total_chapters?: number;
  user_annotations?: BookAnnotation[];
}

export interface BookAnnotation {
  id: string;
  book_id?: string;
  user_id?: string;
  type: 'highlight' | 'note' | 'bookmark';
  page_number: number;
  selected_text?: string;
  color?: string;
  note?: string;
  cfi_range?: string;
  created_at: string;
}

export interface BookAnnotationsResponse {
  annotations?: BookAnnotation[];
  items: BookAnnotation[];
  highlighted_pages: number[];
  bookmarked_pages: number[];
  total: number;
  book_id?: string;
}

export interface ReadingProgressPayload {
  current_page: number;
  progress_pct: number;
}
