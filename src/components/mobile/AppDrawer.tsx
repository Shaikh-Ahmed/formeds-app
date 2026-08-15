import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Modal,
  Animated,
  Easing,
  ScrollView,
  useWindowDimensions,
  AccessibilityInfo,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, spacing, radius, typography, getRoleMeta, MIN_TOUCH_TARGET } from '../../theme';
import { useAuth } from '../../context/AuthContext';
import { Avatar } from '../Avatar';

const DRAWER_MAX = 320;
const DURATION = 220;

/**
 * Left navigation drawer, opened from the avatar in MobileTopBar.
 *
 * Built on Modal + Animated rather than @react-navigation/drawer: that package
 * isn't a dependency, and pulling it in for one panel would add a native
 * gesture-handler surface to every screen for no other gain.
 *
 * Every row here routes somewhere that actually exists. There is deliberately
 * no "Saved posts" or "Groups" — those aren't built, and a drawer full of dead
 * links is worse than a short drawer.
 */
export function AppDrawer({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const { user, logout, isKycApproved } = useAuth();
  const router = useRouter();
  const { width } = useWindowDimensions();
  const meta = getRoleMeta(user?.role);

  const drawerWidth = Math.min(width * 0.86, DRAWER_MAX);
  const progress = useRef(new Animated.Value(0)).current;
  // Keeps the Modal mounted through the closing animation; unmounting on the
  // first frame would make the panel vanish instead of slide out.
  const [mounted, setMounted] = useState(visible);
  const [reduceMotion, setReduceMotion] = useState(false);

  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled().then(setReduceMotion).catch(() => {});
  }, []);

  useEffect(() => {
    if (visible) setMounted(true);
    Animated.timing(progress, {
      toValue: visible ? 1 : 0,
      duration: reduceMotion ? 0 : DURATION,
      easing: visible ? Easing.out(Easing.cubic) : Easing.in(Easing.cubic),
      useNativeDriver: true,
    }).start(({ finished }) => {
      if (finished && !visible) setMounted(false);
    });
  }, [visible, progress, reduceMotion]);

  if (!mounted) return null;

  const translateX = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [-drawerWidth, 0],
  });

  const go = (path: string) => {
    onClose();
    router.push(path as any);
  };

  const handleLogout = async () => {
    onClose();
    await logout();
    router.replace('/');
  };

  return (
    <Modal visible transparent animationType="none" onRequestClose={onClose} statusBarTranslucent>
      <View style={styles.root}>
        <Animated.View style={[styles.scrim, { opacity: progress }]}>
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={onClose}
            accessibilityRole="button"
            accessibilityLabel="Close menu"
          />
        </Animated.View>

        <Animated.View style={[styles.panel, { width: drawerWidth, transform: [{ translateX }] }]}>
          <SafeAreaView style={styles.panelSafe} edges={['top', 'bottom']}>
            <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
              <Pressable
                testID="drawer-profile"
                onPress={() => go('/(tabs)/profile')}
                accessibilityRole="link"
                accessibilityLabel="View your profile"
                style={({ pressed }) => [styles.identity, pressed && styles.rowPressed]}
              >
                <Avatar name={user?.name} role={user?.role} uri={user?.avatar} size={64} />
                <Text style={styles.name} numberOfLines={1}>{user?.name || 'Your profile'}</Text>
                <Text style={[styles.role, { color: meta.color }]} numberOfLines={1}>
                  {meta.longLabel}
                </Text>
                {user?.specialty || user?.location ? (
                  <Text style={styles.meta} numberOfLines={1}>
                    {user?.specialty || user?.location}
                  </Text>
                ) : null}
                <Text style={styles.viewProfile}>View profile</Text>
              </Pressable>

              {/* Verification is the gate on posting, applying and messaging,
                  so its state is stated here rather than discovered at a 403. */}
              <Pressable
                testID="drawer-kyc"
                onPress={() => go('/kyc')}
                accessibilityRole="link"
                accessibilityLabel={
                  isKycApproved ? 'Verified account' : 'Verification pending. Complete verification'
                }
                style={({ pressed }) => [
                  styles.kyc,
                  isKycApproved ? styles.kycOk : styles.kycPending,
                  pressed && styles.rowPressed,
                ]}
              >
                <Ionicons
                  name={isKycApproved ? 'shield-checkmark' : 'shield-outline'}
                  size={18}
                  color={isKycApproved ? colors.teal : colors.warning}
                />
                <View style={styles.kycBody}>
                  <Text style={[styles.kycTitle, { color: isKycApproved ? colors.teal : colors.warning }]}>
                    {isKycApproved ? 'Verified' : 'Verification pending'}
                  </Text>
                  {!isKycApproved && (
                    <Text style={styles.kycHint}>Tap to complete verification</Text>
                  )}
                </View>
                {!isKycApproved && (
                  <Ionicons name="chevron-forward" size={16} color={colors.warning} />
                )}
              </Pressable>

              <View style={styles.divider} />

              <DrawerRow icon="people-outline" label="My network" onPress={() => go('/people')} testID="drawer-network" />
              <DrawerRow icon="notifications-outline" label="Notifications" onPress={() => go('/notifications')} testID="drawer-notifications" />
              <DrawerRow icon="create-outline" label="Edit profile" onPress={() => go('/edit-profile')} testID="drawer-edit" />

              {user?.is_admin ? (
                <>
                  <View style={styles.divider} />
                  <DrawerRow
                    icon="shield-checkmark-outline"
                    label="KYC review queue"
                    iconColor={colors.teal}
                    onPress={() => go('/admin/kyc')}
                    testID="drawer-admin"
                  />
                </>
              ) : null}

              <View style={styles.divider} />

              <DrawerRow icon="settings-outline" label="Settings" onPress={() => go('/settings')} testID="drawer-settings" />
              <DrawerRow icon="help-circle-outline" label="Help & support" onPress={() => go('/help')} testID="drawer-help" />

              <View style={styles.divider} />

              <DrawerRow
                icon="log-out-outline"
                label="Sign out"
                iconColor={colors.redText}
                labelColor={colors.redText}
                onPress={handleLogout}
                testID="drawer-logout"
              />

              <Text style={styles.version}>ForMeds v1.0.0</Text>
            </ScrollView>
          </SafeAreaView>
        </Animated.View>
      </View>
    </Modal>
  );
}

function DrawerRow({
  icon,
  label,
  onPress,
  iconColor = colors.textSecondary,
  labelColor = colors.text,
  testID,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
  iconColor?: string;
  labelColor?: string;
  testID?: string;
}) {
  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      accessibilityRole="link"
      accessibilityLabel={label}
      style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
    >
      <Ionicons name={icon} size={22} color={iconColor} />
      <Text style={[styles.rowLabel, { color: labelColor }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, flexDirection: 'row' },
  scrim: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(15, 23, 42, 0.45)' },
  panel: {
    backgroundColor: colors.white,
    shadowColor: '#0F172A',
    shadowOpacity: 0.2,
    shadowRadius: 24,
    shadowOffset: { width: 4, height: 0 },
    elevation: 16,
  },
  panelSafe: { flex: 1 },
  scroll: { paddingBottom: spacing.xxl },

  identity: { paddingHorizontal: spacing.xl, paddingTop: spacing.xl, paddingBottom: spacing.lg },
  name: { ...typography.h3, color: colors.text, marginTop: spacing.md },
  role: { fontSize: 12, fontWeight: '700', marginTop: 2 },
  meta: { ...typography.caption, color: colors.textSecondary, marginTop: 2 },
  viewProfile: { ...typography.caption, color: colors.navy, fontWeight: '700', marginTop: spacing.sm },

  kyc: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginHorizontal: spacing.lg,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    minHeight: MIN_TOUCH_TARGET,
  },
  kycOk: { backgroundColor: colors.successBg, borderColor: '#BBF7D0' },
  kycPending: { backgroundColor: colors.warningBg, borderColor: '#FDE68A' },
  kycBody: { flex: 1 },
  kycTitle: { ...typography.label, fontSize: 13 },
  kycHint: { ...typography.small, color: colors.textSecondary, marginTop: 1 },

  divider: { height: 1, backgroundColor: colors.borderLight, marginVertical: spacing.sm },

  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.lg,
    paddingHorizontal: spacing.xl,
    minHeight: MIN_TOUCH_TARGET + 4,
  },
  rowPressed: { backgroundColor: colors.bgMuted },
  rowLabel: { ...typography.body, fontWeight: '500' },

  version: {
    ...typography.small,
    color: colors.textSecondary,
    paddingHorizontal: spacing.xl,
    marginTop: spacing.xl,
  },
});
