/**
 * Desktop/tablet layout primitives.
 *
 * Below 768px these collapse to a passthrough: PageGrid drops both rails and
 * PageColumn stops centring, leaving the phone layout to the mobile shell in
 * src/components/mobile. Screens import from here rather than branching on
 * width themselves.
 */
export { Hoverable } from './Hoverable';
export { PageGrid, PageColumn } from './PageGrid';
export { TopBar } from './TopBar';
export { RailCard, ProfileRail } from './Rail';
export { FeedRail } from './FeedRail';
export { AuthShell } from './AuthShell';
