import React, { useEffect, useRef, useState } from 'react';
import { useReducedMotion } from '../../hooks/useReducedMotion';
import { TrustMark } from '../TrustMark';
import { Animated, View, Text, StyleSheet, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { colors, spacing, radius, typography, fonts, shadow, elevation, isRefined, motion, getRoleMeta } from '../../theme';
import { useAuth } from '../../context/AuthContext';
import { apiFetch } from '../../utils/api';
import { mediaUri } from '../../utils/media';
import { fetchMyProfile } from '../../api/profile';
import { fetchAccountOrganization } from '../../api/organizations';
import { completionItems } from '../organizations/profile/completion';
import { Avatar } from '../Avatar';
import { studentLine } from '../../utils/roles';
import { Hoverable } from './Hoverable';

/** Generic sidebar card. The single container shape used by both rails. */
export function RailCard({
  title,
  children,
  footerLabel,
  onFooterPress,
  actionLabel = 'View all',
  onAction,
  testID,
}: {
  title?: string;
  children: React.ReactNode;
  footerLabel?: string;
  onFooterPress?: () => void;
  /** A "View all →" link on the title row. */
  actionLabel?: string;
  onAction?: () => void;
  testID?: string;
}) {
  return (
    <View style={styles.card} testID={testID}>
      {title ? (
        <View style={styles.cardHead}>
          <Text style={styles.cardTitle} accessibilityRole="header">
            {title}
          </Text>
          {onAction ? (
            <Hoverable onPress={onAction} accessibilityRole="link" accessibilityLabel={`${actionLabel}: ${title}`}
              style={styles.cardAction} hoverStyle={styles.cardActionHover} testID={testID ? `${testID}-all` : undefined}>
              <Text style={styles.cardActionText}>{actionLabel}</Text>
              <Ionicons name="arrow-forward" size={14} color={colors.navy} />
            </Hoverable>
          ) : null}
        </View>
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

type RailSummary = {
  cover?: string;
  location?: string;
  percent?: number;
  connections?: number;
  invitations?: number;
};

/**
 * What the identity card shows beyond the session user: cover, location,
 * profile completion and network counts. Each piece is fetched on its own and
 * simply left out if it fails — the card never waits on all of them.
 */
function useRailSummary(): RailSummary {
  const { user, token } = useAuth();
  const [summary, setSummary] = useState<RailSummary>({});
  const isOrg = user?.role === 'hospital' || user?.role === 'clinic';

  useEffect(() => {
    if (!token || !user) return;
    let live = true;
    const merge = (part: RailSummary) => { if (live) setSummary(prev => ({ ...prev, ...part })); };

    if (isOrg) {
      fetchAccountOrganization(token, user.id).then(org => {
        const items = completionItems(org);
        merge({
          cover: org.cover_photo || undefined,
          location: [org.city, org.state].filter(Boolean).join(', '),
          percent: items.length ? Math.round((items.filter(i => i.done).length / items.length) * 100) : undefined,
        });
      }).catch(() => {});
    } else {
      fetchMyProfile(token).then(p => merge({
        cover: p.cover_photo || undefined,
        location: [p.city, p.state].filter(Boolean).join(', '),
        percent: p.completion?.percent,
      })).catch(() => {});
    }
    apiFetch('/api/connections/', token)
      .then((rows: unknown) => { if (Array.isArray(rows)) merge({ connections: rows.length }); }).catch(() => {});
    apiFetch('/api/connections/pending?limit=50', token)
      .then((rows: unknown) => { if (Array.isArray(rows)) merge({ invitations: rows.length }); }).catch(() => {});
    return () => { live = false; };
  }, [token, user, isOrg]);

  return summary;
}

type Shortcut = { label: string; icon: keyof typeof Ionicons.glyphMap; href: string };

/**
 * Left rail: who you are signed in as, how complete and connected your
 * profile is, and the shortcuts to your own things. Messages is not here —
 * it already has its place in the top bar.
 */
export function ProfileRail() {
  const { user } = useAuth();
  const router = useRouter();
  const meta = getRoleMeta(user?.role);
  const summary = useRailSummary();
  const role = user?.role;
  const isOrg = role === 'hospital' || role === 'clinic';
  const isPro = role === 'healthcare_professional';
  const isStudentAccount = role === 'student';

  const shortcuts: Shortcut[] = [
    { label: 'My network', icon: 'people-outline', href: '/people' },
    // Saved feed posts; saved cases have their own filter in the Cases tab.
    { label: 'Saved posts', icon: 'bookmark-outline', href: '/(tabs)/community?saved=1' },
    isOrg
      ? { label: 'My job postings', icon: 'briefcase-outline', href: '/(tabs)/jobs/posted' }
      : { label: 'My jobs & applications', icon: 'briefcase-outline', href: '/(tabs)/jobs/applications' },
    // Locum is clinical cover: no shortcut for a student.
    ...(isStudentAccount ? [] : [isOrg
      ? { label: 'My locum postings', icon: 'medkit-outline' as const, href: '/(tabs)/jobs/locum/mine' }
      : { label: 'My locum assignments', icon: 'medkit-outline' as const, href: '/(tabs)/jobs/locum/shifts' }]),
    ...(isPro || isStudentAccount ? [{ label: 'My learning', icon: 'school-outline' as const, href: '/(tabs)/learning' }] : []),
    // The admin queue's only other entry point is AppDrawer, which never
    // renders above 768px, so an admin on desktop needs these rows.
    ...(user?.is_admin
      ? [{ label: 'KYC review queue', icon: 'shield-checkmark-outline' as const, href: '/admin/kyc' },
        { label: 'Recruiter review', icon: 'briefcase-outline' as const, href: '/admin/recruiters' },
        { label: 'Locum reliability', icon: 'calendar-outline' as const, href: '/admin/locum' },
        { label: 'Student accounts', icon: 'school-outline' as const, href: '/admin/students' }]
      : []),
    { label: 'Settings', icon: 'settings-outline', href: '/settings' },
  ];

  const percent = summary.percent;
  const incomplete = percent !== undefined && percent < 100;
  const cover = summary.cover ? mediaUri(summary.cover) : '';

  return (
    <View style={styles.identityWrap}>
      {/* Premium: the identity card is the rail's featured surface. */}
      <View style={[styles.card, isRefined && styles.pFeatured]} testID="rail-profile">
        {/* Your cover photo when you have one; otherwise a tint of your role. */}
        {cover ? (
          <Image source={{ uri: cover }} style={styles.banner} resizeMode="cover" accessibilityIgnoresInvertColors />
        ) : (
          <View style={[styles.banner, { backgroundColor: meta.bg }]} />
        )}
        <Hoverable
          onPress={() => router.push('/(tabs)/profile' as any)}
          accessibilityLabel="Open your profile"
          style={styles.identityBody}
          hoverStyle={styles.identityHover}
          testID="rail-identity"
        >
          <View style={styles.avatarLift}>
            <Avatar name={user?.name} role={user?.role} uri={user?.avatar} size={72} />
          </View>
          <View style={styles.nameRow}>
            <Text style={styles.identityName} numberOfLines={1}>
              {user?.name || 'Your profile'}
            </Text>
            {user?.verified ? (
              <TrustMark size={17} classicIcon="checkmark-circle" label="Verified" />
            ) : null}
          </View>
          <Text style={[styles.identityRole, { color: meta.color }]} numberOfLines={1}>
            {meta.longLabel}
          </Text>
          {isStudentAccount && user?.student_course ? (
            <>
              <Text style={styles.identityMeta} numberOfLines={1}>{studentLine(user)}</Text>
              {user.student_institution ? (
                <Text style={styles.identityMeta} numberOfLines={1}>{user.student_institution}</Text>
              ) : null}
            </>
          ) : user?.specialty ? (
            <Text style={styles.identityMeta} numberOfLines={1}>{user.specialty}</Text>
          ) : null}
          {summary.location ? (
            <View style={styles.locationRow}>
              <Ionicons name="location-outline" size={13} color={colors.textSecondary} />
              <Text style={styles.identityMeta} numberOfLines={1}>{summary.location}</Text>
            </View>
          ) : null}
        </Hoverable>

        <Hoverable onPress={() => router.push('/people' as any)} accessibilityRole="link"
          accessibilityLabel={`${summary.connections ?? 0} connections, ${summary.invitations ?? 0} invitations. Open my network.`}
          style={styles.stats} hoverStyle={styles.identityHover} testID="rail-stats">
          <Stat value={summary.connections} label="Connections" />
          <View style={styles.statDivider} />
          <Stat value={summary.invitations} label="Invitations" />
        </Hoverable>

        {percent !== undefined ? (
          <View style={styles.completion} testID="rail-completion">
            <View style={styles.completionHead}>
              <Text style={styles.completionLabel}>Profile completion</Text>
              <Text style={styles.completionPercent}>{percent}%</Text>
            </View>
            <View style={styles.track} accessibilityRole="progressbar"
              accessibilityValue={{ min: 0, max: 100, now: percent }}>
              <ProgressFill percent={percent} />
            </View>
            {incomplete ? (
              <Hoverable onPress={() => router.push('/(tabs)/profile' as any)} accessibilityRole="link"
                accessibilityLabel="Complete your profile" style={styles.nudge} hoverStyle={styles.nudgeHover}
                testID="rail-complete-profile">
                <View style={styles.nudgeIcon}>
                  <Ionicons name="ribbon" size={18} color={colors.warning} />
                </View>
                <View style={styles.nudgeText}>
                  <Text style={styles.nudgeTitle}>Complete your profile</Text>
                  <Text style={styles.nudgeHint}>
                    {isOrg ? 'to reach more professionals' : 'to get better opportunities'}
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={16} color={colors.textSecondary} />
              </Hoverable>
            ) : null}
          </View>
        ) : null}
      </View>

      <View style={[styles.card, styles.shortcutCard]}>
        {shortcuts.map(s => (
          <Hoverable
            key={s.href}
            testID={`rail-shortcut-${s.label.toLowerCase().replace(/[^a-z]+/g, '-')}`}
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

/** The completion bar's fill. Premium eases it to its value; Classic draws it at once. */
function ProgressFill({ percent }: { percent: number }) {
  const target = Math.max(0, Math.min(100, percent));
  const reduced = useReducedMotion();
  const width = useRef(new Animated.Value(isRefined && !reduced ? 0 : target)).current;
  useEffect(() => {
    if (!isRefined || reduced) { width.setValue(target); return; }
    Animated.timing(width, { toValue: target, duration: motion.slow * 2, useNativeDriver: false }).start();
  }, [target, reduced, width]);
  return (
    <Animated.View style={[styles.fill, {
      width: width.interpolate({ inputRange: [0, 100], outputRange: ['0%', '100%'] }),
    }]} />
  );
}

function Stat({ value, label }: { value?: number; label: string }) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statValue}>{value ?? '–'}</Text>
      <Text style={styles.statLabel}>{label}</Text>
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
  cardHead: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.sm,
  },
  cardTitle: { ...typography.h3, fontSize: 15, color: colors.text, flex: 1 },
  cardAction: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingVertical: 2, paddingHorizontal: 4, borderRadius: radius.sm },
  cardActionHover: { backgroundColor: colors.bgMuted },
  cardActionText: { ...typography.caption, fontFamily: fonts.body.semibold, color: colors.navy },
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
  pFeatured: { borderColor: colors.featuredBorder, borderRadius: radius.card, ...elevation.standard },
  banner: { height: 72, width: '100%' },
  identityBody: { alignItems: 'center', paddingHorizontal: spacing.lg, paddingBottom: spacing.md },
  identityHover: { backgroundColor: colors.bgMuted },
  avatarLift: {
    marginTop: -36,
    borderWidth: 3,
    borderColor: colors.white,
    borderRadius: radius.pill,
    backgroundColor: colors.white,
  },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: spacing.sm, maxWidth: '100%' },
  identityName: { ...typography.h3, color: colors.text, textAlign: 'center', flexShrink: 1 },
  identityRole: { fontSize: 12, fontFamily: fonts.body.semibold, marginTop: 2, textAlign: 'center' },
  identityMeta: { ...typography.caption, color: colors.textSecondary, marginTop: 2, textAlign: 'center' },
  locationRow: { flexDirection: 'row', alignItems: 'center', gap: 3, marginTop: 2 },

  stats: {
    flexDirection: 'row',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: colors.borderLight,
    paddingVertical: spacing.md,
  },
  stat: { flex: 1, alignItems: 'center' },
  statValue: { fontSize: 17, fontFamily: fonts.heading.bold, color: colors.text },
  statLabel: { ...typography.small, color: colors.textSecondary },
  statDivider: { width: 1, height: 28, backgroundColor: colors.border },

  completion: {
    borderTopWidth: 1,
    borderTopColor: colors.borderLight,
    padding: spacing.lg,
    gap: spacing.sm,
  },
  completionHead: { flexDirection: 'row', alignItems: 'center' },
  completionLabel: { ...typography.label, color: colors.text, flex: 1 },
  completionPercent: { ...typography.label, color: colors.teal },
  track: { height: 6, borderRadius: 3, backgroundColor: colors.bgMuted, overflow: 'hidden' },
  fill: { height: 6, borderRadius: 3, backgroundColor: colors.teal },
  nudge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.xs,
    padding: spacing.sm,
    borderRadius: radius.md,
    backgroundColor: colors.tealBg,
  },
  nudgeHover: { opacity: 0.85 },
  nudgeIcon: {
    width: 32, height: 32, borderRadius: 16, backgroundColor: colors.warningBg,
    alignItems: 'center', justifyContent: 'center',
  },
  nudgeText: { flex: 1 },
  nudgeTitle: { ...typography.caption, fontFamily: fonts.body.semibold, color: colors.teal },
  nudgeHint: { ...typography.small, color: colors.textSecondary },

  shortcutCard: { paddingVertical: spacing.xs },
  shortcut: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md - 2,
  },
  shortcutHover: { backgroundColor: colors.bgMuted },
  shortcutLabel: { ...typography.body, fontSize: 14, color: colors.text, fontFamily: fonts.body.medium },
});
