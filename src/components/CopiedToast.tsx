import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { colors, radius, spacing, typography } from '../theme';
import type { ShareOutcome } from '../utils/share';

/**
 * "Link copied" -- the confirmation for a share that fell back to the
 * clipboard (desktop browsers have no share sheet). Announced politely to
 * screen readers; gone after a couple of seconds.
 */
export function CopiedToast({ visible, label = 'Link copied', bottom = spacing.xl }: {
  visible: boolean; label?: string; bottom?: number;
}) {
  if (!visible) return null;
  return (
    <View style={[styles.toast, { bottom }]} accessibilityLiveRegion="polite" testID="link-copied">
      <Text style={styles.text}>{label}</Text>
    </View>
  );
}

/**
 * State for a CopiedToast: `report(outcome)` shows it when a share ended up
 * copying the link, and hides it again after `ms`.
 */
export function useCopiedToast(ms = 2200) {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    if (!visible) return;
    const t = setTimeout(() => setVisible(false), ms);
    return () => clearTimeout(t);
  }, [visible, ms]);
  return { visible, report: (outcome: ShareOutcome) => { if (outcome === 'copied') setVisible(true); } };
}

const styles = StyleSheet.create({
  toast: {
    position: 'absolute', alignSelf: 'center', zIndex: 50, backgroundColor: colors.text,
    paddingHorizontal: spacing.lg, paddingVertical: spacing.sm, borderRadius: radius.pill,
  },
  text: { ...typography.label, color: colors.white },
});
