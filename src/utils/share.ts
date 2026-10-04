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

/**
 * The public web address of a page in the app. On the web that is wherever
 * the app is being served from; in the native app it is EXPO_PUBLIC_WEB_URL.
 * (The backend's address is NOT a page anyone can open.)
 */
export function webLink(path: string): string {
  const configured = (process.env.EXPO_PUBLIC_WEB_URL || '').replace(/\/$/, '');
  const origin = Platform.OS === 'web' && typeof window !== 'undefined' ? window.location.origin : configured;
  return `${origin || configured}${path.startsWith('/') ? path : `/${path}`}`;
}

export type ShareOutcome = 'shared' | 'copied' | 'dismissed';

/**
 * Share where the platform can (phones, and browsers with a share sheet);
 * otherwise -- most desktop browsers -- copy the link, so the button always
 * does something the person can see. Callers show "Link copied" on 'copied'.
 */
export async function shareOrCopy(opts: { url: string; title?: string; message?: string }): Promise<ShareOutcome> {
  if (Platform.OS === 'web' && typeof navigator !== 'undefined') {
    const nav = navigator as any;
    if (typeof nav.share === 'function') {
      try {
        await nav.share({ url: opts.url, title: opts.title, text: opts.message });
        return 'shared';
      } catch (e: any) {
        if (e?.name === 'AbortError') return 'dismissed';
      }
    }
    try {
      await nav.clipboard.writeText(opts.url);
      return 'copied';
    } catch {
      return 'dismissed';
    }
  }
  return (await shareLink(opts)) ? 'shared' : 'dismissed';
}

/** A job's shareable link and text, in one place. */
export function shareJob(job: { id: string; title: string; employer_name?: string }): Promise<ShareOutcome> {
  return shareOrCopy({
    url: webLink(`/jobs/${job.id}`),
    title: job.title,
    message: job.employer_name ? `${job.title} at ${job.employer_name}` : job.title,
  });
}
