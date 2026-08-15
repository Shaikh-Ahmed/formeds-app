import React from 'react';
import { Text, useWindowDimensions } from 'react-native';
import { render, screen } from '@testing-library/react-native';
import { PageGrid, PageColumn } from '../components/web/PageGrid';
import { useBreakpoint, breakpoints } from '../theme/breakpoints';

/**
 * The responsive shell's contract.
 *
 * These lock in the two rules the whole redesign rests on: that a phone still
 * gets the original single column with no rails, and that the rails appear in
 * order of usefulness as width allows. A regression here silently returns the
 * site to "the mobile app, stretched".
 */

jest.mock('react-native/Libraries/Utilities/useWindowDimensions');

const mockWidth = (width: number) =>
  (useWindowDimensions as unknown as jest.Mock).mockReturnValue({
    width,
    height: 900,
    scale: 1,
    fontScale: 1,
  });

function Probe() {
  const { breakpoint, isMobile, isDesktop } = useBreakpoint();
  return <Text testID="probe">{`${breakpoint}|${isMobile}|${isDesktop}`}</Text>;
}

describe('useBreakpoint', () => {
  it.each([
    [320, 'mobile'],
    [375, 'mobile'],
    [767, 'mobile'],
    [breakpoints.tablet, 'tablet'],
    [1024, 'tablet'],
    [breakpoints.desktop, 'desktop'],
    [1440, 'desktop'],
  ])('resolves %ipx to %s', (width, expected) => {
    mockWidth(width);
    render(<Probe />);
    expect(screen.getByTestId('probe').props.children).toBe(
      `${expected}|${expected === 'mobile'}|${expected === 'desktop'}`,
    );
  });
});

describe('PageGrid', () => {
  const content = <Text testID="content">feed</Text>;
  const left = <Text testID="left">identity</Text>;
  const right = <Text testID="right">context</Text>;

  it('renders content only on a phone — no rails competing for the width', () => {
    mockWidth(375);
    render(<PageGrid left={left} right={right}>{content}</PageGrid>);
    expect(screen.getByTestId('content')).toBeTruthy();
    expect(screen.queryByTestId('left')).toBeNull();
    expect(screen.queryByTestId('right')).toBeNull();
  });

  it('adds the left rail at tablet but holds back the right one', () => {
    mockWidth(900);
    render(<PageGrid left={left} right={right}>{content}</PageGrid>);
    expect(screen.getByTestId('left')).toBeTruthy();
    expect(screen.queryByTestId('right')).toBeNull();
  });

  it('shows all three columns at desktop width', () => {
    mockWidth(1280);
    render(<PageGrid left={left} right={right}>{content}</PageGrid>);
    expect(screen.getByTestId('left')).toBeTruthy();
    expect(screen.getByTestId('content')).toBeTruthy();
    expect(screen.getByTestId('right')).toBeTruthy();
  });

  it('never renders a rail the caller did not supply', () => {
    mockWidth(1280);
    render(<PageGrid left={left}>{content}</PageGrid>);
    expect(screen.getByTestId('left')).toBeTruthy();
    expect(screen.queryByTestId('right')).toBeNull();
  });
});

describe('PageColumn', () => {
  it('passes children through unchanged at every width', () => {
    for (const width of [375, 900, 1440]) {
      mockWidth(width);
      const { unmount } = render(
        <PageColumn>
          <Text testID="body">settings</Text>
        </PageColumn>,
      );
      expect(screen.getByTestId('body')).toBeTruthy();
      unmount();
    }
  });
});
