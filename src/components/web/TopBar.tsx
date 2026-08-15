import React from 'react';
import { View, Text, Image, StyleSheet, TextInput } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, usePathname } from 'expo-router';
import { colors, spacing, radius, layout, useBreakpoint, MIN_TOUCH_TARGET } from '../../theme';
import { useAuth } from '../../context/AuthContext';
import { Avatar } from '../Avatar';
import { Hoverable } from './Hoverable';

/**
 * Persistent desktop navigation — the replacement for the bottom tab bar,
 * which is a phone idiom and reads as broken in a browser.
 *
 * A horizontal bar suits this product specifically because the nav is
 * role-conditional: a professional sees Learning, a hospital doesn't see
 * Specialists, a clinic doesn't see Jobs. Horizontal space at >=768px absorbs
 * that variation without the bar ever looking half-empty, which a fixed
 * five-slot tab bar could not.
 */

type NavItem = {
  key: string;
  label: string;
  href: string;
  icon: keyof typeof Ionicons.glyphMap;
  iconActive: keyof typeof Ionicons.glyphMap;
  badge?: number;
};

export function TopBar({
  unreadMessages = 0,
  unreadNotifications = 0,
  onSearch,
  searchValue,
}: {
  unreadMessages?: number;
  unreadNotifications?: number;
  onSearch?: (q: string) => void;
  searchValue?: string;
}) {
  const { user } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const { isDesktop } = useBreakpoint();

  const role = user?.role || 'healthcare_professional';

  // Mirrors the href gating in app/(tabs)/_layout.tsx. Kept in the same shape
  // so the two can't silently disagree about who sees what.
  const items: NavItem[] = [
    { key: 'community', label: 'Community', href: '/(tabs)/community', icon: 'chatbubbles-outline', iconActive: 'chatbubbles' },
    ...(role !== 'clinic'
      ? [{ key: 'jobs', label: role === 'hospital' ? 'Postings' : 'Jobs', href: '/(tabs)/jobs', icon: 'briefcase-outline', iconActive: 'briefcase' } as NavItem]
      : []),
    ...(role === 'healthcare_professional'
      ? [{ key: 'learning', label: 'Learning', href: '/(tabs)/learning', icon: 'book-outline', iconActive: 'book' } as NavItem]
      : []),
    ...(role !== 'hospital'
      ? [{ key: 'specialists', label: role === 'clinic' ? 'Listings' : 'Specialists', href: '/(tabs)/specialists', icon: 'people-outline', iconActive: 'people' } as NavItem]
      : []),
    { key: 'messages', label: 'Messages', href: '/messages', icon: 'mail-outline', iconActive: 'mail', badge: unreadMessages },
    { key: 'notifications', label: 'Alerts', href: '/notifications', icon: 'notifications-outline', iconActive: 'notifications', badge: unreadNotifications },
  ];

  const isActive = (href: string) => {
    const leaf = href.replace('/(tabs)', '');
    return pathname === href || pathname === leaf || pathname.startsWith(`${leaf}/`);
  };

  return (
    <View style={styles.bar} accessibilityRole="header">
      <View style={styles.inner}>
        {/* Brand — also the "home" affordance a browser user expects. */}
        <Hoverable
          onPress={() => router.push('/(tabs)/community' as any)}
          accessibilityLabel="ForMeds home"
          style={styles.brand}
          hoverStyle={styles.brandHover}
          testID="topbar-brand"
        >
          <Image
            source={require('../../../assets/images/formeds-logo.png')}
            style={styles.logo}
            resizeMode="contain"
            accessibilityLabel="ForMeds"
          />
        </Hoverable>

        {/* Global search. Present at every width above mobile because search is
            the primary way a pointer user navigates a network this size. */}
        <View style={styles.searchWrap}>
          <Ionicons name="search" size={17} color={colors.textMuted} />
          <TextInput
            testID="topbar-search"
            style={styles.searchInput}
            placeholder="Search people, cases, jobs"
            placeholderTextColor={colors.textMuted}
            value={searchValue}
            onChangeText={onSearch}
            returnKeyType="search"
            accessibilityLabel="Search ForMeds"
          />
        </View>

        <View style={styles.nav}>
          {items.map(item => {
            const active = isActive(item.href);
            return (
              <Hoverable
                key={item.key}
                testID={`topnav-${item.key}`}
                onPress={() => router.push(item.href as any)}
                accessibilityRole="link"
                accessibilityLabel={
                  item.badge ? `${item.label}, ${item.badge} unread` : item.label
                }
                accessibilityState={{ selected: active }}
                style={styles.navItem}
                hoverStyle={styles.navItemHover}
              >
                <View style={styles.navIconWrap}>
                  <Ionicons
                    name={active ? item.iconActive : item.icon}
                    size={22}
                    color={active ? colors.navy : colors.textSecondary}
                  />
                  {item.badge ? (
                    <View style={styles.badge}>
                      <Text style={styles.badgeText}>{item.badge > 9 ? '9+' : item.badge}</Text>
                    </View>
                  ) : null}
                </View>
                {isDesktop && (
                  <Text style={[styles.navLabel, active && styles.navLabelActive]} numberOfLines={1}>
                    {item.label}
                  </Text>
                )}
                {/* Active state is an underline AND a colour+weight change, so
                    it never depends on colour alone. */}
                <View style={[styles.underline, active && styles.underlineActive]} />
              </Hoverable>
            );
          })}

          {/* AED Assist. The mobile bubble is present on every tab, so its
              desktop equivalent has to be persistent too — a rail card would
              vanish on Jobs and Learning, which have no right rail. Red is
              reserved for this and destructive actions. */}
          <Hoverable
            testID="topnav-aed"
            onPress={() => router.push('/aed-chat' as any)}
            accessibilityRole="link"
            accessibilityLabel="Open AED Assist"
            style={styles.aedItem}
            hoverStyle={styles.aedItemHover}
          >
            <Ionicons name="pulse" size={18} color={colors.red} />
            {isDesktop && <Text style={styles.aedLabel}>AED</Text>}
          </Hoverable>

          <View style={styles.divider} />

          <Hoverable
            testID="topnav-profile"
            onPress={() => router.push('/(tabs)/profile' as any)}
            accessibilityRole="link"
            accessibilityLabel="Your profile"
            accessibilityState={{ selected: isActive('/(tabs)/profile') }}
            style={styles.navItem}
            hoverStyle={styles.navItemHover}
          >
            <View style={styles.navIconWrap}>
              <Avatar name={user?.name} role={user?.role} uri={user?.avatar} size={24} />
            </View>
            {isDesktop && (
              <Text
                style={[styles.navLabel, isActive('/(tabs)/profile') && styles.navLabelActive]}
                numberOfLines={1}
              >
                Me
              </Text>
            )}
            <View style={[styles.underline, isActive('/(tabs)/profile') && styles.underlineActive]} />
          </Hoverable>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    height: layout.topBar,
    backgroundColor: colors.white,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    // Sits above page content so a scrolled feed passes beneath it.
    zIndex: 100,
  },
  inner: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'center',
    width: '100%',
    maxWidth: layout.maxWidth,
    paddingHorizontal: spacing.xxl,
    gap: spacing.lg,
  },
  brand: { borderRadius: radius.sm, paddingHorizontal: spacing.xs, paddingVertical: spacing.xs },
  brandHover: { backgroundColor: colors.bgMuted },
  logo: { width: 108, height: 32 },

  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.bgMuted,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: 'transparent',
    paddingHorizontal: spacing.md,
    height: 36,
    flex: 1,
    maxWidth: 320,
  },
  // `outlineStyle: none` is a react-native-web escape hatch: it suppresses the
  // browser's default input outline so the shared :focus-visible ring in
  // +html.tsx is the single focus treatment across the app.
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: colors.text,
    ...({ outlineStyle: 'none' } as object),
  },

  nav: { flexDirection: 'row', alignItems: 'center', marginLeft: 'auto', gap: spacing.xs },
  navItem: {
    minWidth: 56,
    height: layout.topBar,
    paddingHorizontal: spacing.sm,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
  navItemHover: { backgroundColor: colors.bgMuted },
  navIconWrap: { width: 24, height: 24, alignItems: 'center', justifyContent: 'center' },
  navLabel: { fontSize: 11, fontWeight: '500', color: colors.textSecondary },
  navLabelActive: { color: colors.navy, fontWeight: '700' },
  underline: { position: 'absolute', bottom: 0, left: 8, right: 8, height: 2, backgroundColor: 'transparent' },
  underlineActive: { backgroundColor: colors.navy },

  aedItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    height: 36,
    minWidth: 44,
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: '#FECACA',
    backgroundColor: colors.redBg,
    marginLeft: spacing.sm,
  },
  aedItemHover: { backgroundColor: '#FEE2E2', borderColor: colors.red },
  aedLabel: { fontSize: 12, fontWeight: '700', color: colors.redText },

  divider: { width: 1, height: 24, backgroundColor: colors.border, marginHorizontal: spacing.sm },

  badge: {
    position: 'absolute',
    top: -4,
    right: -6,
    minWidth: 16,
    height: 16,
    paddingHorizontal: 4,
    borderRadius: radius.pill,
    backgroundColor: colors.red,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: colors.white,
  },
  badgeText: { color: colors.white, fontSize: 9, fontWeight: '700' },
});

export const TOP_BAR_MIN_TOUCH = MIN_TOUCH_TARGET;
