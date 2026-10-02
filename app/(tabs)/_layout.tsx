import React, { useCallback, useState } from 'react';
import { Tabs, useRouter, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../src/context/AuthContext';
import { View, Pressable, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, fonts, elevation, useBreakpoint, isRefined, isMaterial } from '../../src/theme';
import { MobileTopBar, AppDrawer } from '../../src/components/mobile';
import { AedLogo } from '../../src/components/aed/AedLogo';
import { apiFetch } from '../../src/utils/api';

/**
 * Floating AED entry point — phones only.
 * A persistent emergency shortcut is what a FAB is for, so it stays a FAB;
 * on desktop the same action is a pill in the top bar, where nothing floats.
 */
function AEDBubble({ bottomInset }: { bottomInset: number }) {
  const router = useRouter();
  return (
    <Pressable
      testID="aed-bubble-btn"
      onPress={() => router.push('/aed-chat')}
      accessibilityRole="button"
      accessibilityLabel="Open AED Assist, emergency clinical guidance"
      style={({ pressed }) => [
        bubbleStyles.bubble,
        // Rides above the tab bar, which itself grows by the bottom inset on
        // gesture-navigation Android and on iPhones with a home indicator.
        { bottom: TAB_BAR_HEIGHT + bottomInset + 16 + (isMaterial ? MATERIAL_BAR_GAP + 6 : 0) },
        pressed && bubbleStyles.pressed,
      ]}
    >
      {/* The bubble is already the red badge, so the mark sits straight on it. */}
      <AedLogo size={50} round />
    </Pressable>
  );
}

/** Tab bar height excluding the bottom safe-area inset. */
const TAB_BAR_HEIGHT = 60;
/** Material: the bar floats this far above the bottom edge. */
const MATERIAL_BAR_GAP = 10;

/**
 * Material's tab icon: the current tab sits in a white disc on the dark
 * floating bar -- a clear, tactile "you are here". Same icon, same tab.
 */
function tabIcon(name: keyof typeof Ionicons.glyphMap) {
  const TabIcon = ({ color, size, focused }: { color: string; size: number; focused: boolean }) => {
    if (!isMaterial) return <Ionicons name={name} size={size} color={color} />;
    return (
      <View style={[tabStyles.disc, focused && tabStyles.discActive]}>
        <Ionicons name={name} size={size - 2} color={focused ? colors.navy : 'rgba(255,255,255,0.78)'} />
      </View>
    );
  };
  TabIcon.displayName = `TabIcon(${name})`;
  return TabIcon;
}

const tabStyles = StyleSheet.create({
  disc: { width: 40, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  discActive: { backgroundColor: '#FFFFFF' },
});

const bubbleStyles = StyleSheet.create({
  bubble: {
    position: 'absolute',
    // `bottom` is applied inline so it can include the safe-area inset.
    right: 16,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.red,
    alignItems: 'center',
    justifyContent: 'center',
    // A ring lifts it off whatever scrolls underneath; shadow alone
    // disappears against a busy image.
    borderWidth: 3,
    borderColor: colors.white,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.28,
    shadowRadius: 14,
    elevation: 10,
    zIndex: 999,
  },
  pressed: { opacity: 0.85, transform: [{ scale: 0.96 }] },
});

export default function TabLayout() {
  const { user, token } = useAuth();
  const { isMobile } = useBreakpoint();
  const insets = useSafeAreaInsets();
  const role = user?.role || 'healthcare_professional';
  // A recruiter only reaches this group for the posting and applicant screens
  // under Jobs. Their portal is the whole app for them, so none of the
  // network's chrome (feed bar, tabs, drawer, AED) is shown around those.
  const isRecruiter = role === 'recruiter';
  const showChrome = isMobile && !isRecruiter;

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [unreadMsgs, setUnreadMsgs] = useState(0);
  const [unreadNotifs, setUnreadNotifs] = useState(0);

  // The mobile bar is persistent across tabs, so its badge counts can't be
  // owned by any one screen's fetch. (Desktop counts are loaded in _layout.)
  const loadCounts = useCallback(async () => {
    if (!token || !showChrome) return;
    const [msgs, notifs] = await Promise.all([
      apiFetch('/api/messages/unread-total', token).catch(() => ({ count: 0 })),
      apiFetch('/api/notifications/unread-count', token).catch(() => ({ count: 0 })),
    ]);
    setUnreadMsgs(msgs.count || 0);
    setUnreadNotifs(notifs.count || 0);
  }, [token, showChrome]);

  useFocusEffect(useCallback(() => { loadCounts(); }, [loadCounts]));

  return (
    <View style={styles.root}>
      {showChrome && (
        <MobileTopBar unreadMessages={unreadMsgs} onOpenDrawer={() => setDrawerOpen(true)} />
      )}

      <Tabs
        screenOptions={{
          headerShown: false,
          tabBarActiveTintColor: isMaterial ? colors.white : colors.navy,
          tabBarInactiveTintColor: isMaterial ? 'rgba(255,255,255,0.72)' : colors.textSecondary,
          // React Navigation adds the bottom inset itself, but only while the
          // height is left unset — an explicit height overrides it and drops
          // the labels behind the Android gesture bar / iPhone home indicator.
          // Since we do want a fixed height, the inset is added back by hand.
          tabBarStyle: showChrome && isMaterial
            ? {
                // Material: a deep-teal pill floating above the page.
                backgroundColor: colors.navyDark,
                borderTopWidth: 0,
                borderRadius: 30,
                marginHorizontal: 14,
                marginBottom: MATERIAL_BAR_GAP + insets.bottom,
                height: TAB_BAR_HEIGHT + 6,
                paddingBottom: 8,
                paddingTop: 7,
                ...elevation.featured,
              }
            : showChrome
            ? {
                backgroundColor: colors.white,
                borderTopWidth: StyleSheet.hairlineWidth,
                borderTopColor: colors.border,
                height: TAB_BAR_HEIGHT + insets.bottom,
                paddingBottom: 8 + insets.bottom,
                paddingTop: 6,
              }
            : { display: 'none' },
          // Premium sets the labels in the brand body face rather than the
          // system font a bare fontWeight falls back to.
          tabBarLabelStyle: isRefined
            ? { fontSize: 10.5, fontFamily: fonts.body.semibold, marginTop: 2 }
            : { fontSize: 10, fontWeight: '600', marginTop: 2 },
          tabBarItemStyle: { paddingVertical: 2 },
        }}
      >
        {/* "chatbubbles", not "people" — the Specialists tab already owns the
            people glyph, and these read as the same shape at tab-bar size. */}
        <Tabs.Screen name="community" options={{ title: 'Home', tabBarIcon: tabIcon(isRefined ? 'home' : 'chatbubbles') }} />
        {/* Every account type can now browse AND advertise work, so this tab
            is no longer role-gated and no longer renames itself. */}
        <Tabs.Screen name="jobs" options={{
          title: 'Jobs',
          tabBarIcon: tabIcon('briefcase'),
        }} />
        <Tabs.Screen name="learning" options={{
          title: 'Learning',
          tabBarIcon: tabIcon('book'),
          href: role === 'healthcare_professional' ? '/(tabs)/learning' : null,
        }} />
        <Tabs.Screen name="specialists" options={{
          title: role === 'clinic' ? 'Listings' : 'Specialists',
          tabBarIcon: tabIcon('people'),
          href: role === 'hospital' || role === 'recruiter' ? null : '/(tabs)/specialists',
        }} />
        <Tabs.Screen name="alerts" options={{
          title: 'Alerts',
          tabBarIcon: tabIcon('notifications'),
          tabBarBadge: unreadNotifs > 0 ? (unreadNotifs > 9 ? '9+' : unreadNotifs) : undefined,
          tabBarBadgeStyle: { backgroundColor: colors.red, fontSize: 10 },
        }} />
        {/* Profile moved into the drawer so Alerts could take a tab slot;
            the route stays reachable, it just no longer occupies the bar. */}
        <Tabs.Screen name="profile" options={{ href: null }} />
      </Tabs>

      {showChrome && <AEDBubble bottomInset={insets.bottom} />}

      {isRecruiter ? null : <AppDrawer visible={drawerOpen} onClose={() => setDrawerOpen(false)} />}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
});
