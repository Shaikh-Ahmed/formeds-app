/**
 * Desktop/tablet layout primitives.
 *
 * Everything here is a no-op or a passthrough below 768px — the mobile UI
 * renders exactly as it did before. Screens import from here rather than
 * branching on width themselves.
 */
export { Hoverable } from './Hoverable';
export { PageGrid, PageColumn } from './PageGrid';
export { TopBar } from './TopBar';
export { RailCard, ProfileRail } from './Rail';
export { WideHeader } from './WideHeader';
export { FeedRail } from './FeedRail';
export { AuthShell } from './AuthShell';
