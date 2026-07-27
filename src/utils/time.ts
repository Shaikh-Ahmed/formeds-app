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
