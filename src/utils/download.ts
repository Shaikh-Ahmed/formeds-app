import { Platform } from 'react-native';

/**
 * Open a Blob the platform's native viewer/share sheet already knows how to
 * present — a PDF today, but nothing here is PDF-specific.
 *
 * The two platforms have no shared primitive for this: a browser can turn a
 * Blob into a same-origin object URL and just navigate to it, but there is no
 * "open" concept on native without first writing the bytes to disk and
 * handing the resulting file off to the OS share sheet.
 */
export async function openBlob(blob: Blob, filename: string): Promise<void> {
  if (Platform.OS === 'web') {
    const url = URL.createObjectURL(blob);
    // A new tab, not `<a download>`: this is a document someone wants to
    // read (a resume), and forcing a silent download would just make them
    // go find it in their downloads folder to look at it.
    const win = window.open(url, '_blank');
    // Popup blockers reject window.open silently; the object URL would
    // otherwise leak for the life of the page with no way to view it anyway.
    if (!win) URL.revokeObjectURL(url);
    else setTimeout(() => URL.revokeObjectURL(url), 60_000);
    return;
  }

  // Both are native-only; importing them on web would pull in unused native
  // module bindings, so the import is deferred to this branch.
  const { File, Paths } = await import('expo-file-system');
  const Sharing = await import('expo-sharing');

  const bytes = new Uint8Array(await blob.arrayBuffer());
  const file = new File(Paths.cache, filename);
  file.create({ overwrite: true });
  file.write(bytes);

  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(file.uri, { mimeType: blob.type || 'application/octet-stream' });
  } else {
    // No share sheet (rare — some Android builds), but the file is saved;
    // nothing more this function can offer without a UI of its own to build.
    throw new Error('Sharing is not available on this device.');
  }
}
