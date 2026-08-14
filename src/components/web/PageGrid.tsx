import React from 'react';
import { View, ScrollView, StyleSheet } from 'react-native';
import { colors, spacing, layout, useBreakpoint } from '../../theme';

/**
 * The responsive shell every signed-in page renders into.
 *
 * Columns collapse by usefulness rather than by position: the right rail
 * (contextual extras) goes first, then the left rail (identity + shortcuts),
 * leaving the centre column — the actual content — last standing on a phone.
 *
 *   >= 1128px   left | centre | right
 *   768–1127px  left | centre
 *   <  768px    centre, full-bleed, exactly the current mobile layout
 *
 * Each column scrolls independently. The web build pins the document body
 * (see app/+html.tsx), so a page-level scroll with sticky rails isn't
 * available; independent regions also keep a long feed from scrolling the
 * user's own profile card off screen, which is the behaviour you want anyway.
 */
export function PageGrid({
  children,
  left,
  right,
  /** Cap the centre column near 65–75ch so body text stays readable. */
  contentMaxWidth = layout.contentMax,
  /** Skip the centre-column cap for grid/table pages that want the room. */
  fluid = false,
  testID,
}: {
  children: React.ReactNode;
  left?: React.ReactNode;
  right?: React.ReactNode;
  contentMaxWidth?: number;
  fluid?: boolean;
  testID?: string;
}) {
  const { isMobile, isDesktop } = useBreakpoint();

  // Phones keep the untouched single-column layout.
  if (isMobile) {
    return (
      <View style={styles.mobileRoot} testID={testID}>
        {children}
      </View>
    );
  }

  const showLeft = !!left;
  const showRight = isDesktop && !!right;

  return (
    <View style={styles.wideRoot} testID={testID}>
      <View style={styles.grid}>
        {showLeft && (
          <ScrollView
            style={styles.railLeft}
            contentContainerStyle={styles.railContent}
            showsVerticalScrollIndicator={false}
          >
            {left}
          </ScrollView>
        )}

        <View style={[styles.centre, !fluid && { maxWidth: contentMaxWidth }]}>{children}</View>

        {showRight && (
          <ScrollView
            style={styles.railRight}
            contentContainerStyle={styles.railContent}
            showsVerticalScrollIndicator={false}
          >
            {right}
          </ScrollView>
        )}
      </View>
    </View>
  );
}

/**
 * Single-column page (settings, forms, a conversation) centred on desktop.
 * Without this a form's inputs stretch to 1400px and the label/field
 * relationship falls apart.
 */
export function PageColumn({
  children,
  maxWidth = layout.narrowMax,
  testID,
}: {
  children: React.ReactNode;
  maxWidth?: number;
  testID?: string;
}) {
  const { isMobile } = useBreakpoint();

  if (isMobile) {
    return (
      <View style={styles.mobileRoot} testID={testID}>
        {children}
      </View>
    );
  }

  return (
    <View style={styles.wideRoot} testID={testID}>
      <View style={[styles.column, { maxWidth }]}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  mobileRoot: { flex: 1, backgroundColor: colors.bg },
  wideRoot: { flex: 1, backgroundColor: colors.bg, alignItems: 'center' },
  grid: {
    flex: 1,
    flexDirection: 'row',
    width: '100%',
    maxWidth: layout.maxWidth,
    gap: layout.gutter,
    paddingHorizontal: spacing.xxl,
  },
  railLeft: { width: layout.railLeft, flexGrow: 0, flexShrink: 0 },
  railRight: { width: layout.railRight, flexGrow: 0, flexShrink: 0 },
  railContent: { paddingVertical: layout.gutter, gap: spacing.lg },
  centre: { flex: 1, minWidth: 0 },
  column: {
    flex: 1,
    width: '100%',
    backgroundColor: colors.white,
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderColor: colors.border,
  },
});
