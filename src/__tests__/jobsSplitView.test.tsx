import React from 'react';
import { useWindowDimensions } from 'react-native';
import { render, screen } from '@testing-library/react-native';
import { JobsScreen } from '../components/jobs/JobsScreen';
import { breakpoints, useBreakpoint } from '../theme/breakpoints';
import * as breakpointModule from '../theme/breakpoints';

/**
 * When the split view is allowed to exist.
 *
 * Two rules, both easy to break with a one-character change:
 *
 *  1. The split is gated on `isDesktop` (>= 1128), NOT on `!isMobile`. At the
 *     tablet floor the centre column is 720px, and splitting that leaves a
 *     296px detail pane — narrower than the phone it was meant to improve on.
 *  2. Nothing commits to a layout on the first render. `useBreakpoint()` reports
 *     mobile at every width until after mount, because the web build is
 *     statically exported and there is no window at render time. Painting the
 *     mobile detail for one frame at 1440px is a visible flash, and any fetch
 *     inside the pane would fire, unmount and fire again.
 */

jest.mock('react-native/Libraries/Utilities/useWindowDimensions');

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: jest.fn(), replace: jest.fn(), back: jest.fn() }),
  useFocusEffect: jest.fn(),
}));

jest.mock('../context/AuthContext', () => ({
  useAuth: () => ({ token: 'test-token', user: { id: 'u1', role: 'healthcare_professional' } }),
}));

// The list does its own fetching; this suite is about layout, not data.
jest.mock('../components/jobs/JobsList', () => {
  const { Text } = require('react-native');
  return { JobsList: () => <Text testID="jobs-list-stub">list</Text> };
});

jest.mock('../api/jobs', () => ({
  fetchJob: jest.fn(() => new Promise(() => {})), // never settles: keeps the pane in its loading state
  toggleSaveJob: jest.fn(),
  applyToJob: jest.fn(),
  activeFilterCount: jest.fn(() => 0),
  jobsPath: jest.fn(() => '/api/jobs/'),
}));

/**
 * Pins what `useBreakpoint` reports, independently of the mocked width. Used to
 * reproduce the first render, where the hook deliberately answers "mobile" at
 * every width until it has mounted.
 */
const mockBreakpoint = (value: Partial<ReturnType<typeof useBreakpoint>>) =>
  jest.spyOn(breakpointModule, 'useBreakpoint').mockReturnValue({
    breakpoint: 'desktop', isMobile: false, isTablet: false, isDesktop: true,
    isWide: true, width: 1440, ...value,
  } as ReturnType<typeof useBreakpoint>);

const mockWidth = (width: number) =>
  (useWindowDimensions as unknown as jest.Mock).mockReturnValue({
    width, height: 900, scale: 1, fontScale: 1,
  });

describe('JobsScreen layout', () => {
  afterEach(() => jest.restoreAllMocks());

  it.each([
    ['phone', 375],
    ['large phone', 414],
    ['tablet', breakpoints.tablet],
    ['wide tablet', 1024],
    ['just below desktop', breakpoints.desktop - 1],
  ])('shows a single column on %s (%ipx)', (_label, width) => {
    mockWidth(width);
    render(<JobsScreen selectedId="job-1" />);
    expect(screen.getByTestId('jobs-list-stub')).toBeTruthy();
    expect(screen.queryByTestId('jobs-detail-pane')).toBeNull();
  });

  it.each([
    ['desktop floor', breakpoints.desktop],
    ['wide desktop', 1440],
  ])('shows both panes on %s (%ipx)', (_label, width) => {
    mockWidth(width);
    render(<JobsScreen selectedId="job-1" />);
    expect(screen.getByTestId('jobs-list-pane')).toBeTruthy();
    expect(screen.getByTestId('jobs-detail-pane')).toBeTruthy();
  });

  it('still renders the list pane at desktop width with nothing selected', () => {
    mockWidth(1440);
    render(<JobsScreen selectedId={null} />);
    expect(screen.getByTestId('jobs-list-pane')).toBeTruthy();
    // The pane stays, holding its "pick a role" empty state, so the layout does
    // not jump the moment the first card is clicked.
    expect(screen.getByTestId('jobs-detail-pane')).toBeTruthy();
  });

  it('never splits while the breakpoint is still reporting its pre-mount value', () => {
    // What frame one looks like at 1440px: the window is wide, but
    // useBreakpoint has not yet been allowed to say so. Committing to a layout
    // here is what produces the flash-and-double-fetch this guard prevents.
    mockWidth(1440);
    mockBreakpoint({ breakpoint: 'mobile', isMobile: true, isTablet: false, isDesktop: false });

    render(<JobsScreen selectedId="job-1" />);

    expect(screen.queryByTestId('jobs-detail-pane')).toBeNull();
    expect(screen.queryByTestId('jobs-list-pane')).toBeNull();
    expect(screen.getByTestId('jobs-list-stub')).toBeTruthy();
  });
});
