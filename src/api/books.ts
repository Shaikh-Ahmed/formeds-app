import { apiFetch, API_URL } from '../utils/api';
import {
  Book,
  PaginatedBooksResponse,
  ChapterData,
  BookAnnotation,
  BookAnnotationsResponse,
  ReadingProgressPayload,
} from '../types/books';

export interface BooksQueryParams {
  page?: number;
  limit?: number;
  include_meta?: boolean;
  q?: string;
  specialty?: string;
  category?: string;
}

/**
 * Fetch catalog of medical e-books with pagination, search, specialty, and category filtering.
 * Automatically normalizes both envelope responses and direct arrays into PaginatedBooksResponse.
 */
export async function fetchBooks(
  params: BooksQueryParams = {},
  token?: string | null
): Promise<PaginatedBooksResponse> {
  const searchParams = new URLSearchParams();
  searchParams.append('page', String(params.page || 1));
  searchParams.append('limit', String(params.limit || 10));
  searchParams.append('include_meta', 'true');
  if (params.q?.trim()) searchParams.append('q', params.q.trim());
  if (params.specialty && params.specialty !== 'All') searchParams.append('specialty', params.specialty);
  if (params.category && params.category !== 'all') searchParams.append('category', params.category);

  const queryString = searchParams.toString();
  const endpoint = `/api/learning/books${queryString ? `?${queryString}` : ''}`;
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

  const items: Book[] = res?.items || [];
  const limit = res?.limit || params.limit || 10;
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

/**
 * Fetch details for a specific book including full table of contents and reading progress.
 */
export async function fetchBookById(bookId: string, token?: string | null): Promise<Book> {
  return apiFetch(`/api/learning/books/${bookId}`, token);
}

/**
 * In-App Native Chapter Reader: fetch actual chapter text, headings, and sections.
 */
export async function fetchChapter(
  bookId: string,
  chapter: number,
  token?: string | null,
  page?: number | null
): Promise<ChapterData> {
  const q = page != null ? `?page=${page}` : '';
  return apiFetch(`/api/learning/books/${bookId}/chapters/${chapter}${q}`, token);
}

/**
 * Record that the user opened a book (ranks it at the top of their list).
 */
/**
 * In-App Native Page Reader: fetch readable page content for any sequential page (1..N).
 */
export async function fetchPageContent(
  bookId: string,
  page: number,
  token?: string | null
): Promise<ChapterData> {
  return apiFetch(`/api/learning/books/${bookId}/pages/${page}`, token);
}

export async function recordBookOpen(bookId: string, token?: string | null): Promise<{ success: boolean }> {
  return apiFetch(`/api/learning/books/${bookId}/open`, token, {
    method: 'POST',
  });
}

/**
 * Update reading progress (supports both object signature and (bookId, page, progressPct, token) signature).
 */
export async function updateReadingProgress(
  bookId: string,
  pageOrPayload: number | ReadingProgressPayload,
  progressPctOrToken?: number | string | null,
  tokenParam?: string | null
): Promise<void> {
  let payload: ReadingProgressPayload;
  let token: string | undefined;

  if (typeof pageOrPayload === 'number') {
    payload = { current_page: pageOrPayload, progress_pct: Number(progressPctOrToken || 0) };
    token = tokenParam || undefined;
  } else {
    payload = pageOrPayload;
    token = (progressPctOrToken as string) || undefined;
  }

  await apiFetch(`/api/learning/books/${bookId}/progress`, token, {
    method: 'PUT',
    body: JSON.stringify(payload),
  });
}

/**
 * Toggle favorite status of a book (Save to Library).
 */
export async function toggleFavoriteBook(
  bookId: string,
  token?: string | null
): Promise<{ is_favorite: boolean; favorited?: boolean; book_id?: string }> {
  const res = await apiFetch(`/api/learning/books/${bookId}/favorite`, token, {
    method: 'POST',
  });
  const isFav = res?.is_favorite != null ? res.is_favorite : !!res?.favorited;
  return { is_favorite: isFav, favorited: isFav, book_id: res?.book_id || bookId };
}

// Backward compatibility alias
export const toggleBookFavorite = toggleFavoriteBook;

/**
 * Fetch all books favorited by the current user.
 */
export async function fetchFavoriteBooks(token?: string | null): Promise<Book[]> {
  return apiFetch('/api/learning/books/favorites', token);
}

/**
 * Fetch all annotations (highlights, margin notes, page bookmarks) for a book.
 */
export async function fetchBookAnnotations(
  bookId: string,
  token?: string | null
): Promise<BookAnnotationsResponse> {
  const res = await apiFetch(`/api/learning/books/${bookId}/annotations`, token);
  const rawList = res?.annotations || res?.items || [];
  return {
    annotations: rawList,
    items: rawList,
    highlighted_pages: res?.highlighted_pages || [],
    bookmarked_pages: res?.bookmarked_pages || [],
    total: res?.total != null ? res.total : rawList.length,
    book_id: res?.book_id || bookId,
  };
}

/**
 * Create a new highlight, margin note, or page bookmark.
 */
export async function createAnnotation(
  bookId: string,
  data: {
    type: 'highlight' | 'note' | 'bookmark';
    page_number: number;
    selected_text?: string;
    color?: string;
    note?: string;
    cfi_range?: string;
  },
  token: string
): Promise<BookAnnotation> {
  return apiFetch(`/api/learning/books/${bookId}/annotations`, token, {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

// Backward compatibility alias
export const createBookAnnotation = createAnnotation;

/**
 * Update an existing annotation's note or highlight color.
 */
export async function updateBookAnnotation(
  bookId: string,
  annotationId: string,
  payload: { note?: string; color?: string },
  token: string
): Promise<BookAnnotation> {
  return apiFetch(`/api/learning/books/${bookId}/annotations/${annotationId}`, token, {
    method: 'PUT',
    body: JSON.stringify(payload),
  });
}

/**
 * Delete an annotation or bookmark.
 */
export async function deleteAnnotation(
  bookId: string,
  annotationId: string,
  token: string
): Promise<{ deleted: boolean }> {
  return apiFetch(`/api/learning/books/${bookId}/annotations/${annotationId}`, token, {
    method: 'DELETE',
  });
}

// Backward compatibility alias
export const deleteBookAnnotation = deleteAnnotation;

/**
 * Upload a medical textbook PDF.
 */
export async function uploadBook(
  formData: FormData,
  token?: string | null
): Promise<{ status: string; message: string; book: Book }> {
  const res = await fetch(`${API_URL}/api/learning/books/upload`, {
    method: 'POST',
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: formData,
  });
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    throw new Error(data?.detail || 'Failed to upload book');
  }
  return data;
}
