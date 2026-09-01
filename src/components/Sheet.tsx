import React, { useEffect, useState } from 'react';
import {
  AccessibilityInfo, KeyboardAvoidingView, Modal, Platform, Pressable,
  StyleSheet, Text, View, type StyleProp, type ViewStyle,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, radius, spacing, typography, useBreakpoint, MIN_TOUCH_TARGET } from '../theme';

/**
 * The app's one modal surface: a bottom sheet on a phone, a centred dialog on a
 * wide screen.
 *
 * Every sheet in this codebase was hand-rolled — the profile entry editor, the
 * case options menu, the media viewer, the old job form — and they had drifted
 * on scrim colour, corner radius, dismiss behaviour and whether reduce-motion
 * was honoured at all. This is `EntrySheet`'s shell, which was the most correct
 * of them, lifted out unchanged so the rest can converge on it.
 *
 * Two details here are load-bearing and easy to lose in a rewrite:
 *
 *  - The dismiss `Pressable` is a SIBLING of the sheet, not its parent. Wrapping
 *    the sheet in it makes every tap inside the sheet bubble out and close it.
 *  - `animationType` becomes 'none' under reduce-motion. A sheet that slides is
 *    a vestibular trigger, and the slide is decorative — the sheet appearing is
 *    the information.
 */
export function Sheet({
  visible,
  onClose,
  title,
  children,
  footer,
  /** Widens the dialog for content that needs it (a preview, a filter grid). */
  maxWidth = 560,
  testID,
  contentStyle,
}: {
  visible: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  maxWidth?: number;
  testID?: string;
  contentStyle?: StyleProp<ViewStyle>;
}) {
  const { isMobile } = useBreakpoint();
  const [reduceMotion, setReduceMotion] = useState(false);

  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled().then(setReduceMotion).catch(() => {});
  }, []);

  return (
    <Modal
      visible={visible}
      transparent
      statusBarTranslucent
      animationType={reduceMotion ? 'none' : isMobile ? 'slide' : 'fade'}
      onRequestClose={onClose}
      accessibilityViewIsModal
      testID={testID}
    >
      <View style={styles.scrim}>
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel="Close"
        />
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={[
            styles.shell,
            isMobile ? styles.shellMobile : [styles.shellWide, { maxWidth }],
            contentStyle,
          ]}
        >
          {title ? (
            <View style={styles.header}>
              <Text style={styles.title} accessibilityRole="header">{title}</Text>
              <Pressable
                onPress={onClose}
                accessibilityRole="button"
                accessibilityLabel="Close"
                hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                style={({ pressed }) => [styles.close, pressed && styles.pressed]}
                testID={testID ? `${testID}-close` : undefined}
              >
                <Ionicons name="close" size={20} color={colors.textSecondary} />
              </Pressable>
            </View>
          ) : null}

          {children}

          {footer ? <View style={styles.footer}>{footer}</View> : null}
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  scrim: { flex: 1, backgroundColor: 'rgba(8,12,20,0.55)', justifyContent: 'flex-end' },
  shell: { backgroundColor: colors.white, overflow: 'hidden' },
  shellMobile: {
    maxHeight: '92%',
    borderTopLeftRadius: radius.xl + 6,
    borderTopRightRadius: radius.xl + 6,
  },
  shellWide: {
    alignSelf: 'center',
    marginVertical: 'auto',
    width: '100%',
    maxHeight: '85%',
    borderRadius: radius.xl,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.xl,
    paddingBottom: spacing.md,
  },
  title: { ...typography.h3, color: colors.text, flex: 1 },
  close: {
    width: MIN_TOUCH_TARGET,
    height: MIN_TOUCH_TARGET,
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
  pressed: { opacity: 0.6 },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.xl,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
});
