import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AccessibilityInfo,
  Animated,
  Platform,
  useWindowDimensions,
  type LayoutChangeEvent,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';

/**
 * Movement below this is finger jitter rather than a change of direction.
 * Without it the header flickers whenever a thumb rests on a moving list.
 */
const DIRECTION_THRESHOLD = 6;

/**
 * Inside this band the header is always shown. It also covers the negative
 * offsets reported while a list rubber-bands or pull-to-refresh is open, where
 * a hidden header would read as a rendering bug.
 */
const TOP_ZONE = 12;

// Two durations on purpose. Revealing answers a deliberate scroll-up and has to
// feel immediate; hiding is a side effect of reading on and reads better a
// little slower. A single shared duration makes the reveal feel laggy.
const REVEAL_MS = 160;
const HIDE_MS = 240;

/**
 * Keeps the browser's focus-scrolling clear of an overlaying header, so tabbing
 * into a control never parks it underneath one (WCAG 2.2 "Focus Not
 * Obscured"). Padding the content is not enough on its own — the browser
 * scrolls a focused element flush to the container's top edge, which is exactly
 * where the header sits. No-op off web, which has no tab focus to scroll.
 */
export const focusScrollInset = (headerHeight: number) =>
  Platform.OS === 'web' ? ({ scrollPaddingTop: headerHeight } as any) : undefined;

/** Scroll wiring a child list needs in order to drive a parent's header. */
export interface CollapsibleScrollProps {
  onScroll: (event: NativeSyntheticEvent<NativeScrollEvent>) => void;
  scrollEventThrottle: number;
}

export interface CollapsibleHeader {
  /**
   * Measured from the header itself, so it survives orientation flips, font
   * scaling and the composer expanding. Use it to inset the scrollable's
   * content — the header overlays the list rather than sitting above it.
   */
  headerHeight: number;
  /** Spread onto the `Animated.View` wrapping the collapsing content. */
  headerStyle: { transform: { translateY: Animated.Value }[] };
  onHeaderLayout: (event: LayoutChangeEvent) => void;
  /** Spread onto whichever scrollable should drive the header. */
  scrollProps: CollapsibleScrollProps;
  /** Snap the header back — e.g. when switching tabs swaps the content under it. */
  reveal: (immediate?: boolean) => void;
}

/**
 * Auto-hiding header: slides out of the way as the reader moves down a list and
 * comes straight back on the first scroll up.
 *
 * The translation runs on the native driver, and the JS handler only decides
 * *direction* — it starts an animation on a direction change, not on every
 * frame — so a 60Hz scroll costs one cheap comparison per event.
 *
 * Honours the system "reduce motion" setting by pinning the header open: a
 * header that moves in response to scrolling is exactly the scroll-driven
 * motion that setting asks us to drop.
 */
export function useCollapsibleHeader({ enabled = true }: { enabled?: boolean } = {}): CollapsibleHeader {
  const [headerHeight, setHeaderHeight] = useState(0);
  const [reduceMotion, setReduceMotion] = useState(false);

  const translateY = useRef(new Animated.Value(0)).current;
  const hidden = useRef(false);
  const lastOffset = useRef(0);
  const height = useRef(0);
  // Read inside the scroll handler so its identity stays stable and the
  // scrollable never has to re-attach a listener mid-gesture.
  const active = useRef(enabled);

  const { width, height: windowHeight } = useWindowDimensions();

  useEffect(() => {
    let alive = true;
    AccessibilityInfo.isReduceMotionEnabled?.()
      .then(value => { if (alive) setReduceMotion(!!value); })
      .catch(() => {});
    const sub = AccessibilityInfo.addEventListener?.('reduceMotionChanged', value =>
      setReduceMotion(!!value),
    );
    return () => { alive = false; sub?.remove?.(); };
  }, []);

  const reveal = useCallback((immediate = false) => {
    if (!hidden.current && !immediate) return;
    hidden.current = false;
    if (immediate) {
      translateY.stopAnimation();
      translateY.setValue(0);
      return;
    }
    Animated.timing(translateY, {
      toValue: 0,
      duration: REVEAL_MS,
      useNativeDriver: true,
    }).start();
  }, [translateY]);

  const hide = useCallback(() => {
    if (hidden.current || height.current <= 0) return;
    hidden.current = true;
    Animated.timing(translateY, {
      toValue: -height.current,
      duration: HIDE_MS,
      useNativeDriver: true,
    }).start();
  }, [translateY]);

  const collapsible = enabled && !reduceMotion;

  useEffect(() => {
    active.current = collapsible;
    if (!collapsible) reveal(true);
  }, [collapsible, reveal]);

  // A rotation or a resized browser window re-lays out the header at a new
  // height; showing it again avoids animating from a stale offset.
  useEffect(() => { reveal(true); }, [width, windowHeight, reveal]);

  const onHeaderLayout = useCallback((event: LayoutChangeEvent) => {
    const next = Math.round(event.nativeEvent.layout.height);
    if (next <= 0 || next === height.current) return;
    height.current = next;
    setHeaderHeight(next);
    // Re-pin a header that changed size while hidden, or the old offset leaves
    // a strip of it on screen.
    if (hidden.current) translateY.setValue(-next);
  }, [translateY]);

  const onScroll = useCallback((event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const { contentOffset, contentSize, layoutMeasurement } = event.nativeEvent;
    const offset = contentOffset.y;
    const previous = lastOffset.current;
    lastOffset.current = offset;

    if (!active.current || height.current <= 0) return;

    // A list that barely overflows can't be scrolled far enough to bring a
    // hidden header back, so never take it away in the first place.
    if (contentSize.height <= layoutMeasurement.height + height.current) {
      reveal();
      return;
    }

    if (offset <= TOP_ZONE) {
      reveal();
      return;
    }

    const delta = offset - previous;
    if (Math.abs(delta) < DIRECTION_THRESHOLD) return;

    // Only hide once the reader is past the header's own height, so the first
    // flick of a list doesn't snatch the tabs away.
    if (delta > 0) {
      if (offset > height.current) hide();
    } else {
      reveal();
    }
  }, [hide, reveal]);

  const headerStyle = useMemo(() => ({ transform: [{ translateY }] }), [translateY]);
  const scrollProps = useMemo(() => ({ onScroll, scrollEventThrottle: 16 }), [onScroll]);

  return { headerHeight, headerStyle, onHeaderLayout, scrollProps, reveal };
}
