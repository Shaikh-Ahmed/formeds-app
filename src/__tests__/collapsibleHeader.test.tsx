import React from 'react';
import { AccessibilityInfo, Animated, Text, View, useWindowDimensions } from 'react-native';
import { render, act } from '@testing-library/react-native';
import { useCollapsibleHeader } from '../hooks/useCollapsibleHeader';

/**
 * The auto-hiding header's decision table.
 *
 * Every rule here exists because breaking it strands the reader: a header that
 * hides on a list too short to scroll back can never be recovered, and one that
 * ignores the direction of travel flickers under a resting thumb.
 *
 * The slide runs on the native driver, so the JS-side value never moves under
 * test. What is worth locking in is the decision — which target the hook asks
 * for, and when — rather than the frames RN renders to get there.
 */

jest.mock('react-native/Libraries/Utilities/useWindowDimensions');

const HEADER_H = 120;
const VIEWPORT_H = 800;
/** Comfortably taller than the viewport, so hiding is allowed. */
const LONG_CONTENT = 5000;

let latest: any = null;
let timing: jest.SpyInstance;

function Harness({ enabled = true }: { enabled?: boolean }) {
  const header = useCollapsibleHeader({ enabled });
  latest = header;
  return (
    <View onLayout={header.onHeaderLayout as any} style={header.headerStyle as any}>
      <Text>header</Text>
    </View>
  );
}

/**
 * Mounts the harness and lets the reduce-motion probe resolve, so its state
 * update lands inside act() instead of warning after the test has finished.
 */
const mount = async (props: { enabled?: boolean } = {}) => {
  const utils = render(<Harness {...props} />);
  await act(async () => {}); // flush the reduce-motion probe
  return utils;
};

/** Every translateY target the hook has asked for, oldest first. */
const targets = () => timing.mock.calls.map(call => (call[1] as any).toValue);
const lastTarget = () => targets()[targets().length - 1];

const measure = (height = HEADER_H) =>
  act(() => {
    latest.onHeaderLayout({ nativeEvent: { layout: { height } } } as any);
  });

const scrollTo = (y: number, contentHeight = LONG_CONTENT) =>
  act(() => {
    latest.scrollProps.onScroll({
      nativeEvent: {
        contentOffset: { y },
        contentSize: { height: contentHeight },
        layoutMeasurement: { height: VIEWPORT_H },
      },
    } as any);
  });

beforeEach(() => {
  latest = null;
  (useWindowDimensions as unknown as jest.Mock).mockReturnValue({
    width: 390, height: VIEWPORT_H, scale: 1, fontScale: 1,
  });
  jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(false);
  jest.spyOn(AccessibilityInfo, 'addEventListener').mockReturnValue({ remove: jest.fn() } as any);
  timing = jest.spyOn(Animated, 'timing');
});

afterEach(() => jest.restoreAllMocks());

describe('useCollapsibleHeader', () => {
  it('reports the height it measured, so the list can inset itself', async () => {
    await mount();
    measure();
    expect(latest.headerHeight).toBe(HEADER_H);
  });

  it('stays open until the reader is past the header itself', async () => {
    await mount();
    measure();
    scrollTo(50);
    expect(targets()).toEqual([]);
  });

  it('hides once the reader scrolls down past the header', async () => {
    await mount();
    measure();
    scrollTo(200);
    expect(lastTarget()).toBe(-HEADER_H);
  });

  it('comes back on a scroll up, without having to reach the top', async () => {
    await mount();
    measure();
    scrollTo(600);
    scrollTo(560); // reversed direction, still deep in the list
    expect(lastTarget()).toBe(0);
  });

  it('ignores jitter below the direction threshold', async () => {
    await mount();
    measure();
    scrollTo(600);
    const settled = timing.mock.calls.length;
    scrollTo(597); // 3px of thumb wobble
    expect(timing.mock.calls.length).toBe(settled);
  });

  it('never hides on a list too short to scroll the header back', async () => {
    await mount();
    measure();
    scrollTo(200, VIEWPORT_H + 10); // barely overflows
    expect(targets()).not.toContain(-HEADER_H);
  });

  it('pins the header open when collapsing is disabled', async () => {
    await mount({ enabled: false });
    measure();
    scrollTo(900);
    expect(targets()).not.toContain(-HEADER_H);
  });

  it('pins the header open when the system asks for reduced motion', async () => {
    (AccessibilityInfo.isReduceMotionEnabled as jest.Mock).mockResolvedValue(true);
    await mount();
    measure();
    scrollTo(900);
    expect(targets()).not.toContain(-HEADER_H);
  });

  it('hides against the new height after the header is re-measured', async () => {
    await mount();
    measure();
    scrollTo(600);
    scrollTo(0); // reveal, so the next scroll down can hide again
    measure(260); // composer expanded — the header is taller now
    scrollTo(600);
    expect(lastTarget()).toBe(-260);
  });

  it('reopens after an orientation change and can hide again', async () => {
    const { rerender } = await mount();
    measure();
    scrollTo(900);
    expect(lastTarget()).toBe(-HEADER_H);

    (useWindowDimensions as unknown as jest.Mock).mockReturnValue({
      width: VIEWPORT_H, height: 390, scale: 1, fontScale: 1,
    });
    rerender(<Harness />);

    // Reset to visible by the rotation, so scrolling on must hide it afresh.
    timing.mockClear();
    scrollTo(1000);
    expect(lastTarget()).toBe(-HEADER_H);
  });
});
