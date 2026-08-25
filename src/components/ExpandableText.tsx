import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Text, Pressable, StyleSheet, Platform, View } from 'react-native';
import type { StyleProp, TextStyle, NativeSyntheticEvent, TextLayoutEventData } from 'react-native';
import { colors, spacing, typography, fonts } from '../theme';

/**
 * Post body that collapses to a few lines with a "…more" affordance.
 *
 * A long post used to render in full, so one wall of text pushed every other
 * card off the screen. Collapsing keeps the feed scannable and makes the cost
 * of a long post fall on the person who opens it.
 *
 * Detecting *whether* the text actually overflows needs two implementations,
 * because react-native-web does not implement `onTextLayout` at all (verified:
 * the prop appears nowhere in its dist):
 *
 *   native — `onTextLayout` reports the laid-out lines; more lines than the
 *            limit means it was clipped.
 *   web    — react-native-web renders Text as a real element with line
 *            clamping, so the DOM node's scrollHeight exceeding its
 *            clientHeight means the same thing.
 *
 * Both converge on `canExpand`, so the control only appears when there is
 * genuinely something hidden — never a "more" link that expands to nothing.
 */
export function ExpandableText({
  text,
  numberOfLines = 3,
  style,
  testID,
}: {
  text: string;
  /** Lines shown while collapsed. */
  numberOfLines?: number;
  style?: StyleProp<TextStyle>;
  testID?: string;
}) {
  const [expanded, setExpanded] = useState(false);
  const [canExpand, setCanExpand] = useState(false);
  const nodeRef = useRef<any>(null);

  // Web: compare rendered height against the clamped height.
  const measureWeb = useCallback(() => {
    if (Platform.OS !== 'web' || expanded) return;
    const node = nodeRef.current;
    if (!node || typeof node.scrollHeight !== 'number') return;
    // +1 absorbs sub-pixel rounding, which otherwise reports every block as
    // overflowing by a fraction and shows "more" on short posts.
    setCanExpand(node.scrollHeight > node.clientHeight + 1);
  }, [expanded]);

  useEffect(() => {
    measureWeb();
    // Measure again on the next frame. The app loads fonts asynchronously
    // (expo-font), and a metric change after first paint can flip a block
    // between three and four lines — measuring only once would then either
    // hide "…more" on a clipped post or show it on one that fits.
    if (Platform.OS !== 'web') return;
    const raf =
      typeof requestAnimationFrame === 'function'
        ? requestAnimationFrame(measureWeb)
        : null;
    return () => { if (raf !== null) cancelAnimationFrame(raf); };
  }, [measureWeb, text]);

  // Re-measure when the column width changes — a post that fits on a desktop
  // three-column layout may well clip once the window narrows.
  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const win: any = typeof window !== 'undefined' ? window : null;
    if (!win?.addEventListener) return;
    win.addEventListener('resize', measureWeb);
    return () => win.removeEventListener('resize', measureWeb);
  }, [measureWeb]);

  // Native: the layout event carries the real line count.
  const onTextLayout = useCallback(
    (e: NativeSyntheticEvent<TextLayoutEventData>) => {
      if (Platform.OS === 'web' || expanded) return;
      setCanExpand(e.nativeEvent.lines.length > numberOfLines);
    },
    [expanded, numberOfLines],
  );

  return (
    <View testID={testID}>
      <Text
        ref={nodeRef}
        style={[styles.body, style]}
        numberOfLines={expanded ? undefined : numberOfLines}
        onTextLayout={onTextLayout}
      >
        {text}
      </Text>

      {canExpand && (
        <Pressable
          testID={testID ? `${testID}-toggle` : undefined}
          onPress={() => setExpanded(v => !v)}
          accessibilityRole="button"
          accessibilityState={{ expanded }}
          accessibilityLabel={expanded ? 'Show less of this post' : 'Show the full post'}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          style={({ pressed }) => [styles.toggle, pressed && styles.togglePressed]}
        >
          <Text style={styles.toggleText}>{expanded ? 'Show less' : '…more'}</Text>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  body: { ...typography.body, color: '#334155', lineHeight: 22 },
  toggle: { alignSelf: 'flex-start', paddingVertical: 2, marginTop: 2 },
  togglePressed: { opacity: 0.6 },
  toggleText: { ...typography.body, fontSize: 14, fontFamily: fonts.body.bold, color: colors.textSecondary },
  spacer: { height: spacing.xs },
});
