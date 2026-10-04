import React, { useRef, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { colors, fonts, getRoleMeta, isPremium, layout, radius, shadow, spacing, typography, MIN_TOUCH_TARGET } from '../../theme';
import { useAuth } from '../../context/AuthContext';
import { Avatar } from '../Avatar';

/**
 * The "Me" menu in the desktop top bar: who you are, then your profile,
 * Settings, Help and Sign out -- the account actions a web user looks for
 * under their own photo. (Phones keep the drawer, which already has them.)
 *
 * A transparent Modal supplies the click-outside-to-close and Escape handling
 * a hand-rolled absolute dropdown would have to re-implement; the menu itself
 * is placed under the "Me" item from its measured position.
 */
export function MeMenu({ profileHref, isRecruiter, trigger }: {
  profileHref: string;
  isRecruiter: boolean;
  trigger: (open: () => void, isOpen: boolean) => React.ReactNode;
}) {
  const { user, logout } = useAuth();
  const router = useRouter();
  const { width } = useWindowDimensions();
  const anchor = useRef<View>(null);
  const [open, setOpen] = useState(false);
  const [right, setRight] = useState<number>(spacing.xxl);
  const [signingOut, setSigningOut] = useState(false);
  const meta = getRoleMeta(user?.role);

  const show = () => {
    // Right-align the menu with the "Me" item, whatever the window width.
    anchor.current?.measureInWindow((x, _y, w) => {
      setRight(Math.max(spacing.md, width - (x + w)));
      setOpen(true);
    });
    if (!anchor.current) setOpen(true);
  };
  const go = (href: string) => { setOpen(false); router.push(href as any); };
  const signOut = async () => {
    setSigningOut(true);
    await logout();
    setOpen(false);
    setSigningOut(false);
    router.replace((isRecruiter ? '/recruiter-login' : '/login') as any);
  };

  return (
    <>
      <View ref={anchor} collapsable={false}>{trigger(show, open)}</View>
      <Modal visible={open} transparent animationType="none" onRequestClose={() => setOpen(false)}>
        <Pressable style={StyleSheet.absoluteFill} onPress={() => setOpen(false)} accessibilityRole="button"
          accessibilityLabel="Close menu" />
        <View style={[styles.menu, { right }]} accessibilityRole="menu" testID="me-menu">
          <Pressable onPress={() => go(profileHref)} accessibilityRole="menuitem" testID="me-menu-profile"
            style={({ hovered, pressed }: any) => [styles.who, (hovered || pressed) && styles.hover]}>
            <Avatar name={user?.name} role={user?.role} uri={user?.avatar} size={48} />
            <View style={styles.flex}>
              <Text style={styles.name} numberOfLines={1}>{user?.name}</Text>
              <Text style={styles.role} numberOfLines={1}>{meta.longLabel}</Text>
            </View>
          </Pressable>
          <Pressable onPress={() => go(profileHref)} accessibilityRole="button" testID="me-menu-view"
            style={({ pressed }) => [styles.viewBtn, pressed && styles.pressed]}>
            <Text style={styles.viewText}>{isRecruiter ? 'View account' : 'View profile'}</Text>
          </Pressable>
          <View style={styles.rule} />
          <Item icon="settings-outline" label="Settings" onPress={() => go('/settings')} testID="me-menu-settings" />
          <Item icon="help-circle-outline" label="Help" onPress={() => go('/help')} testID="me-menu-help" />
          <View style={styles.rule} />
          <Item icon="log-out-outline" label={signingOut ? 'Signing out…' : 'Sign out'} onPress={signOut}
            testID="me-menu-signout" />
        </View>
      </Modal>
    </>
  );
}

function Item({ icon, label, onPress, testID }: {
  icon: keyof typeof Ionicons.glyphMap; label: string; onPress: () => void; testID?: string;
}) {
  return (
    <Pressable onPress={onPress} accessibilityRole="menuitem" accessibilityLabel={label} testID={testID}
      style={({ hovered, pressed }: any) => [styles.item, (hovered || pressed) && styles.hover]}>
      <Ionicons name={icon} size={18} color={colors.textSecondary} />
      <Text style={styles.itemText}>{label}</Text>
    </Pressable>
  );
}

const PREMIUM_ROW = 64;

const styles = StyleSheet.create({
  flex: { flex: 1, minWidth: 0 },
  menu: {
    position: 'absolute',
    // Premium's account row is taller (the two-tier header's first tier).
    top: isPremium ? PREMIUM_ROW - 2 : layout.topBar - 4,
    width: 280,
    backgroundColor: colors.white,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: spacing.sm,
    ...shadow.card,
  },
  who: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingHorizontal: spacing.lg, paddingVertical: spacing.sm },
  name: { ...typography.bodyStrong, color: colors.text },
  role: { ...typography.caption, color: colors.textSecondary },
  viewBtn: {
    marginHorizontal: spacing.lg, marginTop: spacing.xs, marginBottom: spacing.sm, minHeight: 34,
    borderRadius: radius.pill, borderWidth: 1, borderColor: colors.primaryFill, alignItems: 'center', justifyContent: 'center',
  },
  viewText: { ...typography.caption, fontFamily: fonts.body.semibold, color: colors.navy },
  rule: { height: 1, backgroundColor: colors.borderLight, marginVertical: spacing.xs },
  item: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.md, minHeight: MIN_TOUCH_TARGET - 4,
    paddingHorizontal: spacing.lg,
  },
  itemText: { ...typography.body, color: colors.text },
  hover: { backgroundColor: colors.bgMuted },
  pressed: { opacity: 0.7 },
});
