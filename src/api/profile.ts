import { apiFetch, API_URL } from '../utils/api';
import { appendFile } from '../utils/upload';
import {
  EntryKind,
  Profile,
  ProfileEntry,
  ProfileScalars,
  Visibility,
} from '../types/profile';

/**
 * Typed wrappers over `apiFetch` for the profile surface.
 *
 * The rest of the app calls `apiFetch('/api/…')` with literal paths and no
 * endpoint-specific functions. This module is a deliberate first exception:
 * the profile has fourteen endpoints and a discriminated entry union, and
 * hand-writing those paths at every call site would put the union's narrowing
 * out of reach. Follow this pattern for new surfaces of comparable size; do not
 * retrofit it onto one-call screens.
 */

export async function fetchMyProfile(token: string): Promise<Profile> {
  return apiFetch('/api/profile/me', token);
}

export async function fetchProfile(token: string | null, userId: string): Promise<Profile> {
  return apiFetch(`/api/profile/${userId}`, token);
}

/**
 * Absent means absent and an explicit null clears — the opposite of the legacy
 * `PUT /api/profile/update`, which cannot clear a field at all.
 */
export async function patchProfile(token: string, patch: Partial<ProfileScalars>): Promise<Profile> {
  return apiFetch('/api/profile/me', token, {
    method: 'PATCH',
    body: JSON.stringify(patch),
  });
}

export async function createEntry(
  token: string,
  kind: EntryKind,
  data: Record<string, unknown>,
  visibility?: Visibility,
): Promise<ProfileEntry> {
  return apiFetch('/api/profile/entries', token, {
    method: 'POST',
    body: JSON.stringify({ kind, data, ...(visibility ? { visibility } : {}) }),
  });
}

/** `data` replaces the payload wholesale; it is never deep-merged server-side. */
export async function updateEntry(
  token: string,
  entryId: string,
  patch: { data?: Record<string, unknown>; visibility?: Visibility },
): Promise<ProfileEntry> {
  return apiFetch(`/api/profile/entries/${entryId}`, token, {
    method: 'PATCH',
    body: JSON.stringify(patch),
  });
}

export async function deleteEntry(token: string, entryId: string): Promise<void> {
  await apiFetch(`/api/profile/entries/${entryId}`, token, { method: 'DELETE' });
}

/**
 * `ids` must be the section's complete order. The server validates set equality
 * before writing anything, which makes a foreign id fail the whole request and
 * makes replaying the same payload a safe no-op.
 */
export async function reorderEntries(
  token: string,
  kind: EntryKind,
  ids: string[],
): Promise<ProfileEntry[]> {
  return apiFetch('/api/profile/entries/reorder', token, {
    method: 'POST',
    body: JSON.stringify({ kind, ids }),
  });
}

export async function setSectionVisibility(
  token: string,
  kind: EntryKind,
  visibility: Visibility,
): Promise<{ updated: number; visibility: Visibility }> {
  return apiFetch('/api/profile/entries/visibility', token, {
    method: 'PATCH',
    body: JSON.stringify({ kind, visibility }),
  });
}

export async function requestEntryVerification(token: string, entryId: string) {
  return apiFetch(`/api/profile/entries/${entryId}/request-verification`, token, {
    method: 'POST',
  });
}

/**
 * Uploads bytes; the server validates them and writes the column itself, so the
 * client never supplies an image URL.
 *
 * `appendFile` owns the platform fork — a browser needs a Blob while React
 * Native needs a { uri, name, type } descriptor. `apiFetch` detects FormData
 * and omits the JSON content-type so the multipart boundary survives.
 */
async function uploadImage(
  token: string,
  path: string,
  uri: string,
): Promise<Record<string, string>> {
  const formData = new FormData();
  await appendFile(formData, 'file', { uri });
  return apiFetch(path, token, { method: 'POST', body: formData });
}

export async function uploadAvatar(token: string, uri: string) {
  return uploadImage(token, '/api/profile/avatar', uri);
}

export async function uploadCover(token: string, uri: string) {
  return uploadImage(token, '/api/profile/cover', uri);
}

export async function removeAvatar(token: string) {
  return apiFetch('/api/profile/avatar', token, { method: 'DELETE' });
}

export async function removeCover(token: string) {
  return apiFetch('/api/profile/cover', token, { method: 'DELETE' });
}

/** Storage may hand back a relative path in the dev/mock backend. */
export function absoluteMediaUrl(url?: string | null): string | undefined {
  if (!url) return undefined;
  return url.startsWith('http') ? url : `${API_URL}${url}`;
}
