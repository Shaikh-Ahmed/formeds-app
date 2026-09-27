import React from 'react';
import { View, Text, StyleSheet, Pressable, Modal } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, radius, typography, fonts, useBreakpoint, MIN_TOUCH_TARGET } from '../theme';

/**
 * A small list of choices/actions, presented as a bottom sheet on a phone and
 * a centred modal everywhere wider — the one generic "menu" this app reaches
 * for, rather than a bespoke popover per screen. Originally local to the
 * profile screen; promoted here once the desktop "Me" nav item needed the
 * exact same shape (a short list of options under a title) and duplicating
 * it would have meant two menus that could drift apart in padding and type.
 */
export function ActionSheet({
  visible, title, message, options, onClose,
}: {
  visible: boolean;
  title: string;
  message?: string;
  options: {
    label: string;
    icon?: keyof typeof Ionicons.glyphMap;
    badge?: string;
    selected?: boolean;
    onPress: () => void;
  }[];
  onClose: () => void;
}) {
  const { isMobile } = useBreakpoint();
  return (
    <Modal visible={visible} transparent animationType="fade" statusBarTranslucent onRequestClose={onClose} accessibilityViewIsModal>
      <View style={[styles.scrim, !isMobile && styles.scrimCentred]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityRole="button" accessibilityLabel="Close" />
        <View style={[styles.shell, isMobile ? styles.shellMobile : styles.shellWide]}>
          <Text style={styles.title} accessibilityRole="header">{title}</Text>
          {message ? <Text style={styles.message}>{message}</Text> : null}
          {options.map((opt) => (
            <Pressable
              key={opt.label}
              onPress={opt.onPress}
              accessibilityRole="button"
              accessibilityState={{ selected: opt.selected }}
              accessibilityLabel={opt.label}
              style={({ pressed }) => [styles.row, pressed && styles.pressed]}
            >
              {opt.icon ? <Ionicons name={opt.icon} size={18} color={colors.textSecondary} /> : null}
              <Text style={styles.rowText}>{opt.label}</Text>
              {opt.badge ? (
                <View style={styles.badge}><Text style={styles.badgeText}>{opt.badge}</Text></View>
              ) : null}
              {opt.selected ? <Ionicons name="checkmark" size={18} color={colors.teal} /> : null}
            </Pressable>
          ))}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  scrim: { flex: 1, backgroundColor: 'rgba(8,12,20,0.5)', justifyContent: 'flex-end' },
  scrimCentred: { justifyContent: 'center', alignItems: 'center' },
  shell: { backgroundColor: colors.white, padding: spacing.xl, gap: spacing.xs },
  shellMobile: { borderTopLeftRadius: radius.xl + 6, borderTopRightRadius: radius.xl + 6 },
  shellWide: { width: '100%', maxWidth: 420, borderRadius: radius.xl },
  title: { ...typography.h3, color: colors.text, marginBottom: spacing.sm },
  message: { ...typography.caption, color: colors.textSecondary, lineHeight: 20, marginBottom: spacing.md },
  row: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.md,
    minHeight: MIN_TOUCH_TARGET, paddingVertical: spacing.sm,
  },
  rowText: { ...typography.body, color: colors.text, flex: 1 },
  badge: {
    backgroundColor: colors.warningBg, borderRadius: radius.sm,
    paddingHorizontal: spacing.sm, paddingVertical: 2,
  },
  badgeText: { ...typography.small, fontFamily: fonts.body.semibold, color: colors.warning },
  pressed: { opacity: 0.6 },
});
