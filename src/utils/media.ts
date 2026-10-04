import { API_URL } from './api';

/**
 * The address to load a stored image from.
 *
 * Storage can hand back a server-relative path ("/api/images/…" from the dev
 * and mock backends). Given to <Image> as-is, the browser asks the FRONTEND's
 * server for it and gets nothing -- which is how a profile photo showed on the
 * profile page (which resolved it) and nowhere else (which did not). Every
 * stored-image render goes through this.
 *
 * Only a leading "/" is rewritten. Full URLs and on-device ones (data:, blob:,
 * file:, content:, e.g. an upload preview) pass through untouched.
 */
export function mediaUri(url?: string | null): string | undefined {
  if (!url) return undefined;
  return url.startsWith('/') && !url.startsWith('//') ? `${API_URL}${url}` : url;
}
