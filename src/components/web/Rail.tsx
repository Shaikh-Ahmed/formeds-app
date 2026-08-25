import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { colors, spacing, radius, typography, fonts, shadow, getRoleMeta } from '../../theme';
import { useAuth } from '../../context/AuthContext';
import { Avatar } from '../Avatar';
import { Hoverable } from './Hoverable';

/** Generic sidebar card. The single container shape used by both rails. */
export function RailCard({
  title,
  children,
  footerLabel,
  onFooterPress,
  testID,
}: {
  title?: string;
  children: React.ReactNode;
  footerLabel?: string;
  onFooterPress?: () => void;
  testID?: string;
}) {
  return (
    <View style={styles.card} testID={testID}>
      {title ? (
        <Text style={styles.cardTitle} accessibilityRole="header">
          {title}
        </Text>
      ) : null}
      {children}
      {footerLabel && onFooterPress ? (
        <Hoverable
          onPress={onFooterPress}
          style={styles.cardFooter}
          hoverStyle={styles.cardFooterHover}
          accessibilityLabel={footerLabel}
        >
          <Text style={styles.cardFooterText}>{footerLabel}</Text>
          <Ionicons name="arrow-forward" size={14} color={colors.navy} />
        </Hoverable>
      ) : null}
    </View>
  );
}

/**
 * Left-rail identity card: who you are signed in as, plus the shortcuts that
 * lost their home when the bottom tab bar disappeared on desktop.
 */
export function ProfileRail() {
  const { user } = useAuth();
  const router = useRouter();
  const meta = getRoleMeta(user?.role);

  const shortcuts: { label: string; icon: keyof typeof Ionicons.glyphMap; href: string }[] = [
    { label: 'My network', icon: 'people-outline', href: '/people' },
    { label: 'Messages', icon: 'mail-outline', href: '/messages' },
    { label: 'Settings', icon: 'settings-outline', href: '/settings' },
    { label: 'Help', icon: 'help-circle-outline', href: '/help' },
  ];

  return (
    <View style={styles.identityWrap}>
      <View style={styles.card}>
        {/* Brand-tinted banner: gives the card a top edge without needing an
            uploaded cover image, which this product doesn't have. */}
        <View style={[styles.banner, { backgroundColor: meta.bg }]} />
        <Hoverable
          onPress={() => router.push('/(tabs)/profile' as any)}
          accessibilityLabel="Open your profile"
          style={styles.identityBody}
          hoverStyle={styles.identityHover}
          testID="rail-identity"
        >
          <View style={styles.avatarLift}>
            <Avatar name={user?.name} role={user?.role} uri={user?.avatar} size={64} />
          </View>
          <Text style={styles.identityName} numberOfLines={1}>
            {user?.name || 'Your profile'}
          </Text>
          <Text style={[styles.identityRole, { color: meta.color }]} numberOfLines={1}>
            {meta.longLabel}
          </Text>
          {user?.specialty ? (
            <Text style={styles.identityMeta} numberOfLines={1}>
              {user.specialty}
            </Text>
          ) : null}
        </Hoverable>
      </View>

      <View style={styles.card}>
        {shortcuts.map(s => (
          <Hoverable
            key={s.href}
            testID={`rail-shortcut-${s.label.toLowerCase().replace(/\s+/g, '-')}`}
            onPress={() => router.push(s.href as any)}
            accessibilityRole="link"
            accessibilityLabel={s.label}
            style={styles.shortcut}
            hoverStyle={styles.shortcutHover}
          >
            <Ionicons name={s.icon} size={18} color={colors.textSecondary} />
            <Text style={styles.shortcutLabel}>{s.label}</Text>
          </Hoverable>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
    ...shadow.card,
  },
  cardTitle: {
    ...typography.label,
    color: colors.text,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.sm,
  },
  cardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.borderLight,
  },
  cardFooterHover: { backgroundColor: colors.bgMuted },
  cardFooterText: { ...typography.label, color: colors.navy },

  identityWrap: { gap: spacing.lg },
  banner: { height: 52 },
  identityBody: { alignItems: 'center', paddingHorizontal: spacing.lg, paddingBottom: spacing.lg },
  identityHover: { backgroundColor: colors.bgMuted },
  avatarLift: {
    marginTop: -32,
    borderWidth: 3,
    borderColor: colors.white,
    borderRadius: radius.pill,
    backgroundColor: colors.white,
  },
  identityName: { ...typography.h3, color: colors.text, marginTop: spacing.sm, textAlign: 'center' },
  identityRole: { fontSize: 12, fontWeight: '700', marginTop: 2, textAlign: 'center' },
  identityMeta: { ...typography.caption, color: colors.textSecondary, marginTop: 2, textAlign: 'center' },

  shortcut: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  shortcutHover: { backgroundColor: colors.bgMuted },
  shortcutLabel: { ...typography.body, color: colors.textSecondary, fontFamily: fonts.body.medium },
});
