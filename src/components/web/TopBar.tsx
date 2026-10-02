import React, { useState } from 'react';
import { View, Text, Image, StyleSheet, TextInput } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, usePathname } from 'expo-router';
import { colors, spacing, radius, fonts, layout, useBreakpoint, MIN_TOUCH_TARGET, activeTheme, isRefined, isMaterial, isTerracotta, elevation, materials } from '../../theme';
import { Platform } from 'react-native';
import { useAuth } from '../../context/AuthContext';
import { Avatar } from '../Avatar';
import { Hoverable } from './Hoverable';
import { AedLogo } from '../aed/AedLogo';
import { MeMenu } from './MeMenu';

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
  // The box was never connected to anything -- typing and Enter did nothing.
  // Enter now opens the search page with the query, which runs it.
  const [query, setQuery] = useState(searchValue ?? '');
  const submitSearch = () => {
    const q = query.trim();
    if (!q) return;
    onSearch?.(q);
    // Already on the results page: update it rather than stacking another.
    if (pathname === '/search') router.setParams({ q });
    else router.push({ pathname: '/search', params: { q } } as any);
  };

  const role = user?.role || 'healthcare_professional';
  // Recruiters get their own portal and nothing of the professional network:
  // no feed, no job board, no AED, no network search.
  const isRecruiter = role === 'recruiter';
  const homeHref = isRecruiter ? '/recruiter' : '/(tabs)/community';
  const profileHref = isRecruiter ? '/recruiter/account' : '/(tabs)/profile';

  // Mirrors the href gating in app/(tabs)/_layout.tsx. Kept in the same shape
  // so the two can't silently disagree about who sees what.
  const items: NavItem[] = isRecruiter ? [
    { key: 'recruiter', label: 'Dashboard', href: '/recruiter', icon: 'grid-outline', iconActive: 'grid' },
    { key: 'messages', label: 'Messages', href: '/messages', icon: 'mail-outline', iconActive: 'mail', badge: unreadMessages },
    { key: 'notifications', label: 'Alerts', href: '/notifications', icon: 'notifications-outline', iconActive: 'notifications', badge: unreadNotifications },
  ] : [
    // Same item, label, place and destination in every theme. Premium draws
    // it as a home rather than a speech bubble, so "Home" reads as home.
    { key: 'community', label: 'Home', href: '/(tabs)/community',
      icon: isRefined ? 'home-outline' : 'chatbubbles-outline', iconActive: isRefined ? 'home' : 'chatbubbles' },
    { key: 'jobs', label: 'Jobs', href: '/(tabs)/jobs', icon: 'briefcase-outline', iconActive: 'briefcase' },
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

  // Journal wears its own bar: text links on the left, then search, round
  // Messages / Alerts buttons and the avatar. Below desktop there is no room
  // for text links, so it falls back to the icon bar.
  if (activeTheme === 'journal' && isDesktop) {
    const iconKeys = ['messages', 'notifications'];
    const links = items.filter(i => !iconKeys.includes(i.key));
    const iconItems = items.filter(i => iconKeys.includes(i.key));
    return (
      <View style={[styles.bar, styles.jBar]} role="banner">
        <View style={styles.inner}>
          <Hoverable onPress={() => router.push(homeHref as any)} accessibilityLabel="ForMeds home"
            style={styles.brand} hoverStyle={styles.brandHover} testID="topbar-brand">
            <Image source={require('../../../assets/images/formeds-logo.png')} style={styles.logo}
              resizeMode="contain" accessibilityLabel="ForMeds" />
          </Hoverable>

          <View style={styles.jLinks}>
            {links.map(item => {
              const active = isActive(item.href) && !(item.key === 'recruiter' && isActive(profileHref));
              return (
                <Hoverable key={item.key} testID={`topnav-${item.key}`} onPress={() => router.push(item.href as any)}
                  accessibilityRole="link" accessibilityLabel={item.label} accessibilityState={{ selected: active }}
                  style={styles.jLink} hoverStyle={styles.jLinkHover}>
                  <Text style={[styles.jLinkText, active && styles.jLinkTextActive]} numberOfLines={1}>{item.label}</Text>
                  <View style={[styles.jUnderline, active && styles.jUnderlineActive]} />
                </Hoverable>
              );
            })}
          </View>

          {isRecruiter ? null : (
            <View style={[styles.searchWrap, styles.jSearch]}>
              <Ionicons name="search" size={16} color={colors.textSecondary} />
              <TextInput testID="topbar-search" style={styles.searchInput} placeholder="Search ForMeds"
                placeholderTextColor={colors.textMuted} value={query} onChangeText={setQuery}
                onSubmitEditing={submitSearch} returnKeyType="search" accessibilityLabel="Search ForMeds" />
            </View>
          )}

          <View style={styles.jActions}>
            {iconItems.map(item => {
              const active = isActive(item.href);
              return (
                <Hoverable key={item.key} testID={`topnav-${item.key}`} onPress={() => router.push(item.href as any)}
                  accessibilityRole="link"
                  accessibilityLabel={item.badge ? `${item.label}, ${item.badge} unread` : item.label}
                  accessibilityState={{ selected: active }}
                  style={[styles.jIconBtn, active && styles.jIconBtnActive]} hoverStyle={styles.jIconBtnHover}>
                  <Ionicons name={active ? item.iconActive : item.icon} size={18} color={colors.text} />
                  {item.badge ? (
                    <View style={styles.badge}>
                      <Text style={styles.badgeText}>{item.badge > 9 ? '9+' : item.badge}</Text>
                    </View>
                  ) : null}
                </Hoverable>
              );
            })}
            {isRecruiter ? null : (
              <Hoverable testID="topnav-aed" onPress={() => router.push('/aed-chat' as any)} accessibilityRole="link"
                accessibilityLabel="Open AED Assist" style={styles.aedItem} hoverStyle={styles.aedItemHover}>
                <AedLogo size={20} />
                <Text style={styles.aedLabel}>AED</Text>
              </Hoverable>
            )}
            <MeMenu profileHref={profileHref} isRecruiter={isRecruiter} trigger={(open) => (
              <Hoverable testID="topnav-profile" onPress={open} accessibilityRole="button"
                accessibilityLabel="Your account menu" accessibilityState={{ selected: isActive(profileHref) }}
                style={styles.jAvatar} hoverStyle={styles.jIconBtnHover}>
                <Avatar name={user?.name} role={user?.role} uri={user?.avatar} size={36} />
              </Hoverable>
            )} />
          </View>
        </View>
      </View>
    );
  }

  return (
    // "banner", not "header": react-native-web renders accessibilityRole
    // "header" as an <h1>, which announced the whole navigation bar as a page
    // heading -- and pulled it under +html.tsx's [role="heading"] rule, whose
    // `overflow: visible !important` stopped the avatar clipping to a circle.
    <View style={[styles.bar, isRefined && styles.pBar, isMaterial && styles.mBar]} role="banner">
      <View style={styles.inner}>
        {/* Brand — also the "home" affordance a browser user expects. */}
        <Hoverable
          onPress={() => router.push(homeHref as any)}
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
        {isRecruiter ? null : (
        <View style={[styles.searchWrap, isRefined && styles.pSearch]}>
          <Ionicons name="search" size={17} color={isRefined ? colors.textSecondary : colors.textMuted} />
          <TextInput
            testID="topbar-search"
            style={styles.searchInput}
            // Tablet widths leave the box ~150px; the long hint would clip.
            placeholder={isDesktop ? 'Search people, cases, jobs' : 'Search'}
            placeholderTextColor={colors.textMuted}
            value={query}
            onChangeText={setQuery}
            onSubmitEditing={submitSearch}
            returnKeyType="search"
            accessibilityLabel="Search ForMeds"
          />
        </View>
        )}

        <View style={styles.nav}>
          {items.map(item => {
            // The portal's Account page belongs to "Me", not to Dashboard.
            const active = isActive(item.href) && !(item.key === 'recruiter' && isActive(profileHref));
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
                // Icon-only below desktop, so the item can shrink to the
                // minimum touch target and give the search box the room.
                style={[styles.navItem, !isDesktop && styles.navItemCompact,
                  isMaterial && styles.mNavItem, isMaterial && active && styles.mNavItemActive]}
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
                  <Text style={[styles.navLabel, active && styles.navLabelActive,
                    isRefined && styles.pNavLabel, isRefined && active && styles.pNavLabelActive]} numberOfLines={1}>
                    {item.label}
                  </Text>
                )}
                {/* Active state is an underline AND a colour+weight change, so
                    it never depends on colour alone. */}
                {isMaterial ? null : (
                  <View style={[styles.underline, active && styles.underlineActive,
                    isRefined && styles.pUnderline, isRefined && active && styles.pUnderlineActive]} />
                )}
              </Hoverable>
            );
          })}

          {/* AED Assist. The mobile bubble is present on every tab, so its
              desktop equivalent has to be persistent too — a rail card would
              vanish on Jobs and Learning, which have no right rail. Red is
              reserved for this and destructive actions. */}
          {isRecruiter ? null : (
          <Hoverable
            testID="topnav-aed"
            onPress={() => router.push('/aed-chat' as any)}
            accessibilityRole="link"
            accessibilityLabel="Open AED Assist"
            style={[styles.aedItem, isRefined && styles.pAed, isMaterial && styles.mAed]}
            hoverStyle={isMaterial ? styles.mAedHover : isRefined ? styles.pAedHover : styles.aedItemHover}
          >
            {isMaterial ? (
              // A thin white glass ring keeps the red mark distinct on the red end.
              <View style={styles.mAedMark}><AedLogo size={22} /></View>
            ) : <AedLogo size={22} />}
            {isDesktop && <Text style={[styles.aedLabel, isMaterial && styles.mAedLabel]}>AED</Text>}
          </Hoverable>
          )}

          <View style={styles.divider} />

          {/* "Me" opens the account menu -- profile, Settings, Help, Sign out --
              rather than jumping straight to the profile. */}
          <MeMenu profileHref={profileHref} isRecruiter={isRecruiter} trigger={(open, isOpen) => (
            <Hoverable
              testID="topnav-profile"
              onPress={open}
              accessibilityRole="button"
              accessibilityLabel="Your account menu"
              accessibilityState={{ selected: isActive(profileHref) }}
              style={styles.navItem}
              hoverStyle={styles.navItemHover}
            >
              <View style={styles.navIconWrap}>
                <Avatar name={user?.name} role={user?.role} uri={user?.avatar} size={24} />
              </View>
              {isDesktop && (
                <View style={styles.meLabel}>
                  <Text
                    style={[styles.navLabel, isActive(profileHref) && styles.navLabelActive]}
                    numberOfLines={1}
                  >
                    Me
                  </Text>
                  <Ionicons name={isOpen ? 'caret-up' : 'caret-down'} size={10}
                    color={isActive(profileHref) ? colors.navy : colors.textSecondary} />
                </View>
              )}
              <View style={[styles.underline, isActive(profileHref) && styles.underlineActive]} />
            </Hoverable>
          )} />
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
    // A browser <input> has an intrinsic width of ~20 characters and will not
    // shrink below it on its own. At tablet widths that pushed the field out of
    // its box and underneath the nav icons; minWidth 0 lets it fit the box.
    minWidth: 0,
    width: '100%',
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
  navItemCompact: { minWidth: MIN_TOUCH_TARGET, paddingHorizontal: spacing.xs },
  navIconWrap: { width: 24, height: 24, alignItems: 'center', justifyContent: 'center' },
  navLabel: { fontSize: 11, fontWeight: '500', color: colors.textSecondary },
  navLabelActive: { color: colors.navy, fontWeight: '700' },
  meLabel: { flexDirection: 'row', alignItems: 'center', gap: 2 },
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

  // ── ForMeds Premium overlays (Classic never applies these) ───────────────
  // A quiet lifted surface instead of a hard rule; a slim rounded teal
  // indicator for the current section; labels set in the brand body face.
  pBar: { borderBottomColor: colors.borderLight, ...elevation.subtle },
  pSearch: {
    backgroundColor: colors.bg, borderColor: colors.border, borderRadius: radius.input, height: 38,
  },
  pNavLabel: { fontFamily: fonts.body.medium, fontWeight: undefined, fontSize: 11.5, letterSpacing: 0.1 },
  pNavLabelActive: { fontFamily: fonts.body.semibold, color: colors.navy },
  pUnderline: { left: 14, right: 14, height: 3, borderTopLeftRadius: 3, borderTopRightRadius: 3 },
  pUnderlineActive: { backgroundColor: colors.teal },
  pAed: { backgroundColor: colors.aedBg, borderColor: colors.aedBg },
  pAedHover: { backgroundColor: colors.aedBg, borderColor: colors.aed },

  // ── ForMeds Material ─────────────────────────────────────────────────────
  // A glass bar over the soft page; the current section is a teal pill.
  // On the web the bar floats: a rounded pane of frosted glass inset from the
  // window edges, lit along its top, over the page wallpaper.
  mBar: Platform.OS === 'web'
    ? ({
      marginHorizontal: spacing.lg, marginTop: spacing.sm,
      borderRadius: 18, borderWidth: 1, borderColor: 'rgba(255,255,255,0.85)', borderBottomColor: 'rgba(255,255,255,0.85)',
      backgroundColor: 'rgba(255,255,255,0.62)',
      backdropFilter: 'blur(22px) saturate(180%)', WebkitBackdropFilter: 'blur(22px) saturate(180%)',
      boxShadow: 'inset 0 1px 0 rgba(255,255,255,1), 0 1px 2px rgba(15,55,75,0.05), 0 12px 32px -14px rgba(20,80,110,0.25)',
    } as object)
    : { backgroundColor: materials.glass.fill, borderBottomColor: materials.glass.border },
  mNavItem: { height: layout.topBar - 14, borderRadius: radius.lg, marginVertical: 7 },
  // The current section: a glossy aqua pill with a soft glow of its own colour.
  mNavItemActive: Platform.OS === 'web'
    ? ({
      backgroundColor: colors.tealBg,
      backgroundImage: isTerracotta
        ? 'linear-gradient(180deg, rgba(225,160,125,0.45) 0%, rgba(163,71,42,0.14) 100%)'
        : 'linear-gradient(180deg, rgba(120,160,215,0.45) 0%, rgba(0,58,114,0.14) 100%)',
      boxShadow: `inset 0 1px 0 rgba(255,255,255,0.95), 0 6px 14px -6px rgba(${materials.tint},0.40)`,
    } as object)
    : { backgroundColor: colors.tealBg },
  // AED: glossy red flowing into the brand blue -- urgency meeting ForMeds.
  // Layers, top to bottom: the sheen, then the red -> blue sweep. A lit top
  // edge, and one soft glow mixed from the two colours.
  mAed: Platform.OS === 'web'
    ? ({
      backgroundColor: '#8A2C4E',
      backgroundImage: 'linear-gradient(180deg, rgba(255,255,255,0.34) 0%, rgba(255,255,255,0.08) 50%, rgba(0,0,0,0.14) 100%), '
        + (isTerracotta
          // Terracotta: red deepening into clay -- warm all the way across.
          ? 'linear-gradient(105deg, #E5484D 0%, #C43A3E 40%, #9E3F2B 70%, #7A3320 100%)'
          : 'linear-gradient(105deg, #E5484D 0%, #B8344C 35%, #5A2E5E 62%, #003A72 100%)'),
      borderColor: 'rgba(255,255,255,0.45)',
      boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.55), inset 0 -1px 0 rgba(0,0,0,0.15), '
        + '0 6px 16px -6px rgba(110,40,90,0.50)',
    } as object)
    : { backgroundColor: colors.aed, borderColor: colors.aed },
  mAedHover: Platform.OS === 'web'
    ? ({
      borderColor: 'rgba(255,255,255,0.75)',
      boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.65), inset 0 -1px 0 rgba(0,0,0,0.15), '
        + '0 8px 20px -6px rgba(110,40,90,0.62)',
    } as object)
    : {},
  mAedLabel: { color: colors.white, letterSpacing: 0.4 },
  mAedMark: { borderRadius: 8, borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.75)' },

  // Journal bar.
  jBar: { backgroundColor: colors.bg },
  jLinks: { flexDirection: 'row', alignItems: 'center', gap: spacing.xxl, marginLeft: spacing.lg },
  jLink: { height: layout.topBar, justifyContent: 'center' },
  jLinkHover: { opacity: 0.8 },
  jLinkText: { fontSize: 14, fontFamily: fonts.body.medium, color: colors.textSecondary },
  jLinkTextActive: { color: colors.text, fontFamily: fonts.body.semibold },
  jUnderline: { position: 'absolute', bottom: 14, left: 0, right: 0, height: 2, backgroundColor: 'transparent' },
  jUnderlineActive: { backgroundColor: colors.teal },
  jSearch: {
    marginLeft: 'auto', maxWidth: 260, height: 38, borderRadius: radius.pill,
    backgroundColor: colors.white, borderColor: colors.border,
  },
  jActions: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  jIconBtn: {
    width: 40, height: 40, borderRadius: 20, borderWidth: 1, borderColor: colors.border,
    backgroundColor: colors.white, alignItems: 'center', justifyContent: 'center',
  },
  jIconBtnActive: { borderColor: colors.teal },
  jIconBtnHover: { backgroundColor: colors.bgMuted },
  jAvatar: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
});

export const TOP_BAR_MIN_TOUCH = MIN_TOUCH_TARGET;
