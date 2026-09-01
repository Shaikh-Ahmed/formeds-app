import { Platform, Share } from 'react-native';

/**
 * One share entry point, replacing the four inlined `Share.share()` calls that
 * had drifted apart in feed, cases, posts and profile.
 *
 * The platform fork is the reason this is worth centralising: iOS reads `url`
 * as a first-class field and shows a rich preview, Android ignores it entirely
 * and shares only `message` — so on Android the link has to be folded into the
 * message text or it is silently dropped. Getting that wrong produces a share
 * that looks fine in the sheet and arrives without the link.
 *
 * Returns false when the user dismissed the sheet, so callers can skip a
 * "Copied!" confirmation for a share that never happened.
 */
export async function shareLink({
  url,
  title,
  message,
}: {
  url: string;
  title?: string;
  message?: string;
}): Promise<boolean> {
  const body = [message, url].filter(Boolean).join('\n\n');
  try {
    const result = await Share.share(
      Platform.OS === 'ios'
        ? { url, message: message || undefined, title }
        : { message: body, title },
      { dialogTitle: title },
    );
    return result.action !== Share.dismissedAction;
  } catch {
    // A share sheet the OS refused to open is not worth an error banner.
    return false;
  }
}
