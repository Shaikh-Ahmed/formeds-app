import React from 'react';
import { AccessibilityInfo } from 'react-native';
import { render, screen, fireEvent, act } from '@testing-library/react-native';
import { AppDrawer } from '../components/mobile/AppDrawer';
import { MobileTopBar } from '../components/mobile/MobileTopBar';

/**
 * The mobile shell's contract.
 *
 * These cover the two things most likely to regress silently: the drawer
 * offering a route that doesn't exist, and the top bar losing an entry point
 * that has no other home on a phone.
 */

// `mock`-prefixed so Jest allows the hoisted jest.mock factories below to
// close over them.
const mockPush = jest.fn();
const mockReplace = jest.fn();
const mockLogout = jest.fn();
let mockAuth: any = {};

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush, replace: mockReplace, back: jest.fn(), canGoBack: () => true }),
  usePathname: () => '/(tabs)/community',
}));

jest.mock('../context/AuthContext', () => ({
  useAuth: () => mockAuth,
}));

// Stands in for a notched device. The test renderer reports zero insets, so
// without this the safe-area regression below could never fail.
const mockInsets = { top: 47, bottom: 34, left: 0, right: 0 };
jest.mock('react-native-safe-area-context', () => {
  const actual = jest.requireActual('react-native-safe-area-context');
  return { ...actual, useSafeAreaInsets: () => mockInsets };
});

/**
 * Render icons synchronously.
 *
 * @expo/vector-icons' createIconSet awaits Font.loadAsync in componentDidMount
 * and then setStates, which lands outside act and floods the output with
 * warnings. Mocking it removes that unflushed work; these assertions are all on
 * testIDs, never on glyphs, so nothing is lost.
 *
 * A Proxy so any icon family resolves, not just the ones these two components
 * happen to import today.
 */
jest.mock('@expo/vector-icons', () => {
  // require, not import: jest.mock factories are hoisted above the imports.
  /* eslint-disable @typescript-eslint/no-require-imports */
  const ReactModule = require('react');
  const { Text } = require('react-native');
  /* eslint-enable @typescript-eslint/no-require-imports */
  const Icon = ({ name, ...rest }: any) => ReactModule.createElement(Text, rest, name);
  return new Proxy(
    {},
    { get: (_t, key) => (key === '__esModule' ? true : Icon) },
  );
});

beforeEach(() => {
  // Fake timers make the drawer's open/close animation complete on demand
  // rather than on wall-clock time, which is what made these tests flaky
  // under CPU contention.
  jest.useFakeTimers();

  // AppDrawer probes AccessibilityInfo.isReduceMotionEnabled() and setStates
  // when it resolves — an async tail fake timers do not control. Pinning it
  // makes the tail one predictable tick. These tests cover drawer routing, not
  // motion preferences.
  jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(false);
  mockPush.mockClear();
  mockReplace.mockClear();
  mockLogout.mockClear();
  mockAuth = {
    user: { id: 'u1', name: 'Dr Asha Rao', role: 'healthcare_professional', specialty: 'Cardiology' },
    isKycApproved: true,
    logout: mockLogout,
  };
});

afterEach(() => {
  // Flush anything still queued before handing the clock back, so a pending
  // animation callback can't fire against a torn-down environment.
  act(() => { jest.runOnlyPendingTimers(); });
  jest.useRealTimers();
  jest.restoreAllMocks();
});

describe('MobileTopBar', () => {
  it('exposes the three entry points a phone has nowhere else to put', () => {
    const onOpenDrawer = jest.fn();
    render(<MobileTopBar unreadMessages={0} onOpenDrawer={onOpenDrawer} />);

    fireEvent.press(screen.getByTestId('mobile-drawer-btn'));
    expect(onOpenDrawer).toHaveBeenCalledTimes(1);

    fireEvent.press(screen.getByTestId('mobile-search-btn'));
    expect(mockPush).toHaveBeenCalledWith('/search');

    fireEvent.press(screen.getByTestId('mobile-messages-btn'));
    expect(mockPush).toHaveBeenCalledWith('/messages');
  });

  it('announces the unread count rather than showing a bare dot', () => {
    render(<MobileTopBar unreadMessages={3} onOpenDrawer={jest.fn()} />);
    expect(screen.getByLabelText('Messages, 3 unread')).toBeTruthy();
  });

  it('caps a large unread count at 9+', () => {
    render(<MobileTopBar unreadMessages={42} onOpenDrawer={jest.fn()} />);
    expect(screen.getByText('9+')).toBeTruthy();
  });

  /**
   * Regression: the bar was rendering behind the status bar and camera cutout.
   * Android's edgeToEdgeEnabled means the app draws under the notch, so the
   * top inset has to be padding on the bar itself — a fixed paddingVertical
   * put the avatar and search field under the clock.
   */
  it('clears the notch by padding itself with the top safe-area inset', () => {
    render(<MobileTopBar unreadMessages={0} onOpenDrawer={jest.fn()} />);
    const bar = screen.getByTestId('mobile-drawer-btn').parent!;

    // Walk up to the bar element and read its flattened style.
    const flatten = (s: any): any =>
      Array.isArray(s) ? Object.assign({}, ...s.filter(Boolean).map(flatten)) : (s ?? {});

    let node: any = bar;
    let padTop: number | undefined;
    while (node && padTop === undefined) {
      const style = flatten(node.props?.style);
      if (style.paddingTop !== undefined) padTop = style.paddingTop;
      node = node.parent;
    }

    expect(padTop).toBeGreaterThanOrEqual(mockInsets.top);
  });
});

describe('AppDrawer', () => {
  /**
   * Opens the drawer.
   *
   * Deliberately synchronous. Every assertion below reads a row, and the rows
   * exist as soon as `visible` flips `mounted` in the mount effect that
   * render() already flushes — the open animation changes only opacity and
   * translation, which nothing here inspects.
   *
   * Two earlier versions tried to wait for the animation instead: first a fixed
   * 300ms real sleep, then `await act(async () => ...)` draining microtasks
   * before advancing the clock. Both were attempts to settle async work whose
   * timing the test does not control, and the second deadlocked on CI —
   * `await openDrawer()` simply never returned and the test hit its 5s timeout.
   *
   * A synchronous act() cannot wait on anything, so it cannot hang. Advancing
   * the clock still settles the animation for teardown.
   */
  const openDrawer = (onClose = jest.fn()) => {
    render(<AppDrawer visible onClose={onClose} />);
    act(() => { jest.advanceTimersByTime(500); });
    return onClose;
  };

  it('routes every row to a screen that exists', async () => {
    await openDrawer();
    const routes: [string, string][] = [
      ['drawer-profile', '/(tabs)/profile'],
      ['drawer-kyc', '/kyc'],
      ['drawer-network', '/people'],
      ['drawer-notifications', '/notifications'],
      ['drawer-edit', '/edit-profile'],
      ['drawer-settings', '/settings'],
      ['drawer-help', '/help'],
    ];
    for (const [testID, path] of routes) {
      mockPush.mockClear();
      fireEvent.press(screen.getByTestId(testID));
      expect(mockPush).toHaveBeenCalledWith(path);
    }
  });

  it('hides the admin queue from non-admins', async () => {
    await openDrawer();
    expect(screen.queryByTestId('drawer-admin')).toBeNull();
  });

  it('shows the admin queue to admins', async () => {
    mockAuth.user = { ...mockAuth.user, is_admin: true };
    await openDrawer();
    expect(screen.getByTestId('drawer-admin')).toBeTruthy();
  });

  it('states verification status instead of hiding it until a 403', async () => {
    mockAuth.isKycApproved = false;
    await openDrawer();
    expect(screen.getByText('Verification pending')).toBeTruthy();
    expect(screen.getByText('Tap to complete verification')).toBeTruthy();
  });

  it('signs out and returns to the gateway', async () => {
    await openDrawer();
    fireEvent.press(screen.getByTestId('drawer-logout'));
    // The handler awaits logout() then replaces the route, so one microtask
    // flush is enough. waitFor would poll against the fake clock installed
    // above and only pass depending on how the suites interleave.
    await act(async () => {});
    expect(mockLogout).toHaveBeenCalledTimes(1);
    expect(mockReplace).toHaveBeenCalledWith('/');
  });

  it('renders nothing while closed', () => {
    render(<AppDrawer visible={false} onClose={jest.fn()} />);
    expect(screen.queryByTestId('drawer-profile')).toBeNull();
  });
});
