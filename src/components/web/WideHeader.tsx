import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors, spacing, typography, useBreakpoint } from '../../theme';

/**
 * The per-screen header, which only earns its space on mobile.
 *
 * On a phone each screen owns a header row carrying its title plus the
 * messages / notifications / compose icons. On desktop the TopBar already
 * shows all of those persistently, so repeating them would be two navigation
 * systems stacked on top of each other. Above 768px this collapses to
 * nothing and the screen starts at its content.
 */
export function WideHeader({
  title,
  actions,
  testID,
}: {
  title: string;
  /** Icon row shown only on mobile; the TopBar replaces it on wider screens. */
  actions?: React.ReactNode;
  testID?: string;
}) {
  const { isMobile } = useBreakpoint();

  if (!isMobile) return null;

  return (
    <View style={styles.header} testID={testID}>
      <Text style={styles.title} accessibilityRole="header">
        {title}
      </Text>
      {actions ? <View style={styles.actions}>{actions}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.xl,
    paddingVertical: 14,
    backgroundColor: colors.white,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  title: { ...typography.h2, color: colors.navy },
  actions: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
});
