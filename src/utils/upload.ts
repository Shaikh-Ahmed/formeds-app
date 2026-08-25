import { Platform } from 'react-native';

/**
 * Attach a picked file to a FormData in the shape the current platform needs.
 *
 * The two platforms disagree, and getting it wrong fails in a way that looks
 * like a server bug:
 *
 * - React Native's FormData understands a `{ uri, name, type }` descriptor and
 *   streams the file from disk itself.
 * - A browser's FormData does not. `append()` takes a Blob or a string, and
 *   anything else is coerced via String(), so that descriptor arrives as the
 *   literal text "[object Object]". FastAPI then reports
 *   `Expected UploadFile, received: <class 'str'>` — which reads like a
 *   validation problem rather than a missing platform branch.
 *
 * This lived inline in four screens; kyc.tsx was the one copy that never got
 * the web branch, so document upload was broken on the web build from the day
 * it shipped. Call this instead of appending by hand.
 */
export async function appendFile(
  form: FormData,
  field: string,
  file: { uri: string; name?: string | null; mimeType?: string | null },
): Promise<void> {
  const name = file.name || file.uri.split('/').pop() || 'upload';

  if (Platform.OS === 'web') {
    // The picker hands back a blob:/data: URI; fetching it is how you get the
    // bytes back out in a browser.
    const blob = await (await fetch(file.uri)).blob();
    form.append(field, blob, name);
    return;
  }

  const ext = name.split('.').pop()?.toLowerCase();
  const fallback = ext === 'pdf' ? 'application/pdf' : `image/${ext || 'jpeg'}`;
  form.append(field, { uri: file.uri, name, type: file.mimeType || fallback } as any);
}
