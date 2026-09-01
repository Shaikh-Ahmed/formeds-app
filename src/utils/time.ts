/**
 * Relative time formatting. Single implementation — replaces the four
 * near-identical copies previously inlined in feed, messages, notifications
 * and post/[id].
 */
export function timeAgo(dateString?: string | null): string {
  if (!dateString) return '';
  const then = new Date(dateString).getTime();
  if (Number.isNaN(then)) return '';

  const seconds = Math.floor((Date.now() - then) / 1000);
  if (seconds < 60) return 'now';

  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;

  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d`;

  const weeks = Math.floor(days / 7);
  if (weeks < 5) return `${weeks}w`;

  return new Date(then).toLocaleDateString();
}

/** Initial used for the avatar fallback circle. */
export function initialOf(name?: string | null): string {
  return name?.trim()?.charAt(0)?.toUpperCase() || 'U';
}

/**
 * Verbose relative time, for places where the compact form reads as a typo.
 *
 * `timeAgo` returns "2d", which is right beside a comment author's name in a
 * dense feed and wrong under a job title, where the line is the whole sentence
 * and a recruiter is scanning for freshness. Kept separate rather than adding a
 * flag, because the two call sites want genuinely different strings.
 */
export function postedAgo(dateString?: string | null): string {
  if (!dateString) return '';
  const then = new Date(dateString).getTime();
  if (Number.isNaN(then)) return '';

  const days = Math.floor((Date.now() - then) / 86400000);
  if (days <= 0) return 'Posted today';
  if (days === 1) return 'Posted yesterday';
  if (days < 7) return `Posted ${days} days ago`;

  const weeks = Math.floor(days / 7);
  if (weeks === 1) return 'Posted last week';
  if (weeks < 5) return `Posted ${weeks} weeks ago`;

  const months = Math.floor(days / 30);
  if (months <= 1) return 'Posted last month';
  return `Posted ${months} months ago`;
}
