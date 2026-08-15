import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, spacing, radius, typography, MIN_TOUCH_TARGET, getRoleMeta } from '../../theme';
import { useAuth } from '../../context/AuthContext';
import { Avatar } from '../Avatar';

/**
 * Persistent mobile header for the tab screens.
 *
 * Fixes a real navigation gap as much as it restyles anything: Messages and
 * Notifications used to live only in the Community header, so from Jobs or
 * Learning there was no route to either without backing out first. This bar is
 * mounted once by the tab layout, so every tab carries the same three
 * affordances — identity, search, messages.
 *
 * The search field is a Pressable dressed as an input, not a live TextInput.
 * Typing in a 36px-tall field wedged under a status bar is miserable; tapping
 * it opens the full search screen where the keyboard, filters and results all
 * have room.
 */
export function MobileTopBar({
  unreadMessages = 0,
  onOpenDrawer,
}: {
  unreadMessages?: number;
  onOpenDrawer: () => void;
}) {
  const { user, isKycApproved } = useAuth();
  const router = useRouter();
  const meta = getRoleMeta(user?.role);
  const insets = useSafeAreaInsets();

  return (
    /**
     * The top inset is padding on the bar itself, not a SafeAreaView wrapper,
     * so the white background fills the status-bar strip instead of leaving a
     * transparent gap with the feed scrolling through it.
     *
     * This is load-bearing on Android: app.json sets `edgeToEdgeEnabled`, so
     * the app draws under the notch and the bar renders behind the clock and
     * camera cutout without it.
     */
    <View style={[styles.bar, { paddingTop: insets.top + spacing.sm }]}>
      {/* Verification ring: a standing credential in a clinical network, so it
          rides on the avatar rather than hiding inside the profile screen. */}
      <Pressable
        testID="mobile-drawer-btn"
        onPress={onOpenDrawer}
        accessibilityRole="button"
        accessibilityLabel={`Open menu. Signed in as ${user?.name ?? 'your account'}`}
        hitSlop={8}
        style={({ pressed }) => [styles.avatarBtn, pressed && styles.pressed]}
      >
        <View style={[styles.avatarRing, { borderColor: isKycApproved ? meta.color : colors.border }]}>
          <Avatar name={user?.name} role={user?.role} uri={user?.avatar} size={32} />
        </View>
      </Pressable>

      <Pressable
        testID="mobile-search-btn"
        onPress={() => router.push('/search' as any)}
        accessibilityRole="search"
        accessibilityLabel="Search people, cases and jobs"
        style={({ pressed }) => [styles.search, pressed && styles.searchPressed]}
      >
        <Ionicons name="search" size={18} color={colors.textSecondary} />
        <Text style={styles.searchText} numberOfLines={1}>
          Search ForMeds
        </Text>
      </Pressable>

      <Pressable
        testID="mobile-messages-btn"
        onPress={() => router.push('/messages' as any)}
        accessibilityRole="button"
        accessibilityLabel={
          unreadMessages > 0 ? `Messages, ${unreadMessages} unread` : 'Messages'
        }
        hitSlop={8}
        style={({ pressed }) => [styles.iconBtn, pressed && styles.pressed]}
      >
        <Ionicons name="chatbubbles-outline" size={24} color={colors.navy} />
        {unreadMessages > 0 && (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{unreadMessages > 9 ? '9+' : unreadMessages}</Text>
          </View>
        )}
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    // paddingTop is applied inline from the safe-area inset; only the bottom
    // is fixed here.
    paddingBottom: spacing.sm,
    backgroundColor: colors.white,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  avatarBtn: { borderRadius: radius.pill },
  avatarRing: {
    padding: 2,
    borderRadius: radius.pill,
    borderWidth: 2,
  },
  pressed: { opacity: 0.6 },

  search: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    height: 38,
    paddingHorizontal: spacing.md,
    borderRadius: radius.pill,
    backgroundColor: colors.bgMuted,
    borderWidth: 1,
    borderColor: colors.border,
  },
  searchPressed: { backgroundColor: colors.border },
  searchText: { ...typography.body, color: colors.textSecondary, flex: 1 },

  iconBtn: {
    width: MIN_TOUCH_TARGET,
    height: MIN_TOUCH_TARGET,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badge: {
    position: 'absolute',
    top: 4,
    right: 2,
    minWidth: 18,
    height: 18,
    paddingHorizontal: 4,
    borderRadius: radius.pill,
    backgroundColor: colors.red,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: colors.white,
  },
  badgeText: { color: colors.white, fontSize: 10, fontWeight: '700' },
});
