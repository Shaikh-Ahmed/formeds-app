import { useState, useCallback, useRef } from 'react';
import { apiFetch } from '../utils/api';

const PAGE_SIZE = 20; // must not exceed the server's max (50)

interface Options {
  /** Path without pagination params, e.g. '/api/jobs/permanent' or '/api/feed/?specialty=x' */
  path: string;
  token?: string | null;
  /** Server returns either a bare array or { items: [...] }. */
  extract?: (raw: any) => any[];
  enabled?: boolean;
}

/**
 * Cursor-free page-based list loader for the endpoints paginated in Phase 4.
 * Handles first load, pull-to-refresh, and append-on-scroll while guarding
 * against overlapping requests and stale responses.
 */
/** Whatever an enveloped endpoint reported alongside its page of items. */
export interface ListMeta {
  total?: number;
  total_capped?: boolean;
}

export function usePaginatedList<T = any>({ path, token, extract, enabled = true }: Options) {
  const [items, setItems] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(true);
  // Endpoints returning a bare array simply never populate this, so every
  // existing caller is unaffected.
  const [meta, setMeta] = useState<ListMeta>({});

  const pageRef = useRef(1);
  const inFlight = useRef(false);
  // Invalidates responses from a superseded refresh.
  const generation = useRef(0);

  const buildUrl = (page: number) => {
    const sep = path.includes('?') ? '&' : '?';
    return `${path}${sep}page=${page}&limit=${PAGE_SIZE}`;
  };

  const fetchPage = useCallback(
    async (page: number, mode: 'first' | 'refresh' | 'more') => {
      if (!enabled || inFlight.current) return;
      inFlight.current = true;
      const gen = mode === 'more' ? generation.current : ++generation.current;

      if (mode === 'first') setLoading(true);
      if (mode === 'refresh') setRefreshing(true);
      if (mode === 'more') setLoadingMore(true);
      if (mode !== 'more') setError(null);

      try {
        const raw = await apiFetch(buildUrl(page), token);
        if (gen !== generation.current) return; // superseded
        const batch: T[] = extract ? extract(raw) : Array.isArray(raw) ? raw : (raw?.items ?? []);
        setItems(prev => (mode === 'more' ? [...prev, ...batch] : batch));
        if (raw && !Array.isArray(raw)) {
          setMeta({ total: raw.total, total_capped: raw.total_capped });
        }
        // Trust an explicit has_more when the endpoint sends one; a short page
        // is only a proxy for the end of the list, and it guesses wrong when
        // the last page happens to be exactly PAGE_SIZE long.
        setHasMore(
          typeof raw?.has_more === 'boolean' ? raw.has_more : batch.length >= PAGE_SIZE,
        );
        pageRef.current = page;
      } catch (e: any) {
        if (gen === generation.current) setError(e?.message || 'Could not load. Pull to retry.');
      } finally {
        inFlight.current = false;
        setLoading(false);
        setRefreshing(false);
        setLoadingMore(false);
      }
    },
    [path, token, extract, enabled],
  );

  const load = useCallback(() => fetchPage(1, 'first'), [fetchPage]);
  const refresh = useCallback(() => fetchPage(1, 'refresh'), [fetchPage]);
  const loadMore = useCallback(() => {
    if (hasMore && !inFlight.current && !loading) fetchPage(pageRef.current + 1, 'more');
  }, [hasMore, loading, fetchPage]);

  return { items, setItems, loading, refreshing, loadingMore, error, hasMore, meta, load, refresh, loadMore };
}
