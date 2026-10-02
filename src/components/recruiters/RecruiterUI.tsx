import React, { useCallback, useEffect, useState } from 'react';
import { FormScrollView } from '../FormScrollView';
import {
  Pressable, RefreshControl, ScrollView, StyleSheet, Switch, Text, View, type StyleProp, type ViewStyle,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { colors, fonts, layout, radius, shadow, spacing, typography, useBreakpoint, MIN_TOUCH_TARGET, gloss } from '../../theme';
import { useAuth } from '../../context/AuthContext';
import { apiFetch } from '../../utils/api';
import { fetchRecruiterAccount } from '../../api/recruiters';
import { ScreenHeader } from '../ScreenHeader';
import { PageColumn } from '../web';
import { STATUS_META, type RecruiterAccount, type RecruiterStatus } from '../../types/recruiters';

/**
 * The small set of pieces every recruiter screen is built from, so the portal
 * reads as one product and as ForMeds: same header, same white section cards
 * on the slate page, same navy pills as the Jobs filters.
 */

const TONES = {
  neutral: { bg: colors.bgMuted, fg: colors.textSecondary, icon: 'information-circle-outline' },
  warning: { bg: colors.warningBg, fg: colors.warning, icon: 'time-outline' },
  success: { bg: colors.successBg, fg: colors.teal, icon: 'shield-checkmark' },
  danger: { bg: colors.redBg, fg: colors.redText, icon: 'alert-circle-outline' },
} as const;

export function RecruiterStatusPill({ status, testID }: { status: RecruiterStatus; testID?: string }) {
  const meta = STATUS_META[status];
  const tone = TONES[meta.tone];
  return (
    <View style={[styles.pill, { backgroundColor: tone.bg }]} testID={testID ?? 'recruiter-status'}
      accessible accessibilityLabel={`Status: ${meta.label}`}>
      <Ionicons name={tone.icon as any} size={14} color={tone.fg} />
      <Text style={[styles.pillText, { color: tone.fg }]}>{meta.label}</Text>
    </View>
  );
}

export function VerifiedRecruiterBadge({ compact = false }: { compact?: boolean }) {
  return (
    <View style={[styles.pill, { backgroundColor: colors.recruiterBg }]} testID="verified-recruiter-badge"
      accessible accessibilityLabel="Verified Recruiter">
      <Ionicons name="shield-checkmark" size={13} color={colors.recruiter} />
      <Text style={[styles.pillText, { color: colors.recruiter }]}>{compact ? 'Verified' : 'Verified Recruiter'}</Text>
    </View>
  );
}

export type PortalSection = 'dashboard' | 'jobs' | 'talent' | 'invitations' | 'history' | 'account';

type Glyph = keyof typeof Ionicons.glyphMap;
const SECTIONS: { key: PortalSection; label: string; icon: Glyph; iconActive: Glyph; href: string }[] = [
  { key: 'dashboard', label: 'Dashboard', icon: 'grid-outline', iconActive: 'grid', href: '/recruiter' },
  { key: 'jobs', label: 'Jobs & shifts', icon: 'briefcase-outline', iconActive: 'briefcase', href: '/recruiter/jobs' },
  { key: 'talent', label: 'Find talent', icon: 'search-outline', iconActive: 'search', href: '/recruiter/candidates' },
  { key: 'invitations', label: 'Invitations', icon: 'paper-plane-outline', iconActive: 'paper-plane', href: '/recruiter/invitations' },
  { key: 'history', label: 'History', icon: 'time-outline', iconActive: 'time', href: '/recruiter/history' },
  { key: 'account', label: 'Account', icon: 'business-outline', iconActive: 'business', href: '/recruiter/account' },
];

/** Section tabs for phones and tablets; a wide screen gets the rail instead. */
export function PortalNav({ active }: { active: PortalSection }) {
  const router = useRouter();
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.navScroll}
      contentContainerStyle={styles.nav} accessibilityRole="tablist" testID="recruiter-nav">
      {SECTIONS.map(s => {
        const selected = s.key === active;
        return (
          <Pressable key={s.key} testID={`recruiter-nav-${s.key}`}
            onPress={() => { if (!selected) router.replace(s.href as any); }}
            accessibilityRole="tab" accessibilityState={{ selected }} accessibilityLabel={s.label}
            style={({ pressed }) => [styles.navTab, pressed && styles.pressed]}>
            <View style={styles.navTabInner}>
              <Ionicons name={selected ? s.iconActive : s.icon} size={16}
                color={selected ? colors.navy : colors.textSecondary} />
              <Text style={[styles.navLabel, selected && styles.navLabelActive]}>{s.label}</Text>
            </View>
            <View style={[styles.navUnderline, selected && styles.navUnderlineActive]} />
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

/**
 * The agency's own account, for the rail. Cached at module level so moving
 * between sections doesn't refetch it and flash an empty rail.
 */
let summaryCache: { token: string; account: RecruiterAccount } | null = null;
export function useRecruiterSummary(): RecruiterAccount | null {
  const { token } = useAuth();
  const [account, setAccount] = useState<RecruiterAccount | null>(
    summaryCache && summaryCache.token === token ? summaryCache.account : null);
  useFocusEffect(useCallback(() => {
    if (!token) return undefined;
    let live = true;
    fetchRecruiterAccount(token).then(a => {
      summaryCache = { token, account: a };
      if (live) setAccount(a);
    }).catch(() => {});
    return () => { live = false; };
  }, [token]));
  return account;
}

/** Wide screens: who you are, where you are in the portal, the main action. */
function PortalRail({ active }: { active: PortalSection }) {
  const router = useRouter();
  const account = useRecruiterSummary();
  const approved = account?.status === 'APPROVED';
  return (
    <View style={styles.rail} testID="recruiter-rail">
      <View style={styles.railCard}>
        <View style={styles.railIdentity}>
          <View style={styles.railMark}>
            <Ionicons name="business" size={22} color={colors.recruiter} />
          </View>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={styles.railOverline}>Recruiter portal</Text>
            <Text style={styles.railCompany} numberOfLines={2}>{account?.company_name || ' '}</Text>
          </View>
        </View>
        {account ? (approved ? <VerifiedRecruiterBadge /> : <RecruiterStatusPill status={account.status} />) : null}
      </View>

      <View style={styles.railNav} accessibilityRole="tablist" testID="recruiter-nav">
        {SECTIONS.map(s => {
          const selected = s.key === active;
          return (
            <Pressable key={s.key} testID={`recruiter-nav-${s.key}`}
              onPress={() => { if (!selected) router.replace(s.href as any); }}
              accessibilityRole="tab" accessibilityState={{ selected }} accessibilityLabel={s.label}
              style={({ pressed, hovered }: any) => [
                styles.railItem, hovered && !selected && styles.railItemHover,
                selected && styles.railItemActive, pressed && styles.pressed,
              ]}>
              <Ionicons name={selected ? s.iconActive : s.icon} size={19}
                color={selected ? colors.navy : colors.textSecondary} />
              <Text style={[styles.railLabel, selected && styles.railLabelActive]}>{s.label}</Text>
            </Pressable>
          );
        })}
      </View>

      {approved ? (
        <Pressable onPress={() => router.push('/jobs/new' as any)} accessibilityRole="button" testID="rail-post-job"
          style={({ pressed, hovered }: any) => [styles.railCta, hovered && styles.railCtaHover, pressed && styles.pressed]}>
          <Ionicons name="add" size={20} color={colors.white} />
          <Text style={styles.railCtaText}>Post a job</Text>
        </Pressable>
      ) : null}
      <Text style={styles.railHelp}>Questions? support@formeds.in</Text>
    </View>
  );
}

/**
 * Messages and Alerts for the portal on a phone. On wider screens the desktop
 * TopBar already carries both, and the portal sits outside the tab bar, so
 * without these a recruiter on a phone had no way to reach either.
 */
function PortalHeaderLinks() {
  const router = useRouter();
  const { token } = useAuth();
  const [counts, setCounts] = useState({ messages: 0, alerts: 0 });

  // Refreshed each time the screen comes back into view, e.g. after reading
  // the messages this badge pointed to.
  useFocusEffect(useCallback(() => {
    if (!token) return undefined;
    let live = true;
    Promise.all([
      apiFetch('/api/messages/unread-total', token).catch(() => ({ count: 0 })),
      apiFetch('/api/notifications/unread-count', token).catch(() => ({ count: 0 })),
    ]).then(([m, n]) => { if (live) setCounts({ messages: m.count || 0, alerts: n.count || 0 }); });
    return () => { live = false; };
  }, [token]));

  const link = (icon: keyof typeof Ionicons.glyphMap, label: string, href: string, count: number, testID: string) => (
    <Pressable onPress={() => router.push(href as any)} accessibilityRole="link" testID={testID} hitSlop={4}
      accessibilityLabel={count ? `${label}, ${count} unread` : label}
      style={({ pressed }) => [styles.headerLink, pressed && styles.pressed]}>
      <Ionicons name={icon} size={22} color={colors.navy} />
      {count ? (
        <View style={styles.headerBadge}><Text style={styles.headerBadgeText}>{count > 9 ? '9+' : count}</Text></View>
      ) : null}
    </Pressable>
  );
  return (
    <View style={styles.headerLinks}>
      {link('chatbubbles-outline', 'Messages', '/messages', counts.messages, 'recruiter-header-messages')}
      {link('notifications-outline', 'Alerts', '/notifications', counts.alerts, 'recruiter-header-alerts')}
    </View>
  );
}

/**
 * Every recruiter screen's frame.
 *
 * A portal section (`active` set) is a top-level place: no back arrow, a page
 * title with a one-line subtitle, and the section nav -- a left rail on a wide
 * screen, tabs under the header otherwise. Without `active` it is a plain
 * pushed screen (admin review, a professional's Opportunities).
 */
export function RecruiterScreen({
  title, subtitle, active, children, refreshing, onRefresh, right, testID, hideTitle,
}: {
  title: string; subtitle?: string; active?: PortalSection; children: React.ReactNode;
  refreshing?: boolean; onRefresh?: () => void; right?: React.ReactNode; testID?: string;
  /** The dashboard's hero carries its own title. */
  hideTitle?: boolean;
}) {
  const { isMobile, width } = useBreakpoint();
  const refresh = onRefresh ? <RefreshControl refreshing={!!refreshing} onRefresh={onRefresh} /> : undefined;

  if (!active) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']} testID={testID}>
        <PageColumn maxWidth={880}>
          <ScreenHeader title={title} right={right} />
          <FormScrollView style={styles.flex} contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled"
            refreshControl={refresh}>
            {children}
          </FormScrollView>
        </PageColumn>
      </SafeAreaView>
    );
  }

  const heading = hideTitle ? null : (
    <View style={styles.pageHead}>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={styles.pageTitle} accessibilityRole="header">{title}</Text>
        {subtitle ? <Text style={styles.pageSubtitle}>{subtitle}</Text> : null}
      </View>
      {right}
    </View>
  );

  // The rail from laptop widths up: the app's own desktop breakpoint (1128)
  // would leave most laptops on tabs.
  if (!isMobile && width >= 1000) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']} testID={testID}>
        <View style={styles.wideRow}>
          <PortalRail active={active} />
          <FormScrollView style={styles.flex} contentContainerStyle={styles.wideScroll} keyboardShouldPersistTaps="handled"
            refreshControl={refresh}>
            {heading}
            {children}
          </FormScrollView>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']} testID={testID}>
      <PageColumn maxWidth={960}>
        {isMobile ? (
          <ScreenHeader title={title} showBack={false} right={right ?? <PortalHeaderLinks />} />
        ) : null}
        <PortalNav active={active} />
        <FormScrollView style={styles.flex} contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled"
          refreshControl={refresh}>
          {isMobile ? (subtitle && !hideTitle ? <Text style={styles.pageSubtitle}>{subtitle}</Text> : null) : heading}
          {children}
        </FormScrollView>
      </PageColumn>
    </SafeAreaView>
  );
}

export function Card({ title, subtitle, children, style, right, testID }: {
  title?: string; subtitle?: string; children?: React.ReactNode; style?: StyleProp<ViewStyle>;
  right?: React.ReactNode; testID?: string;
}) {
  return (
    <View style={[styles.card, style]} testID={testID}>
      {title ? (
        <View style={styles.cardHead}>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={styles.cardTitle} accessibilityRole="header">{title}</Text>
            {subtitle ? <Text style={styles.cardSub}>{subtitle}</Text> : null}
          </View>
          {right}
        </View>
      ) : null}
      {children}
    </View>
  );
}

export function ToggleRow({ label, hint, value, onChange, testID, disabled }: {
  label: string; hint?: string; value: boolean; onChange: (v: boolean) => void; testID?: string; disabled?: boolean;
}) {
  return (
    <View style={styles.toggle}>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={styles.toggleLabel}>{label}</Text>
        {hint ? <Text style={styles.toggleHint}>{hint}</Text> : null}
      </View>
      <Switch value={value} onValueChange={onChange} disabled={disabled} testID={testID}
        accessibilityLabel={label} trackColor={{ true: colors.teal, false: colors.border }}
        thumbColor={colors.white} />
    </View>
  );
}

/** Multi-select pills. */
export function MultiChips<T extends string>({ label, options, value, onChange, testID }: {
  label?: string; options: { value: T; label: string }[]; value: T[];
  onChange: (next: T[]) => void; testID?: string;
}) {
  return (
    <View style={styles.chipGroup} testID={testID}>
      {label ? <Text style={styles.fieldLabel}>{label}</Text> : null}
      <View style={styles.chips}>
        {options.map(o => {
          const on = value.includes(o.value);
          return (
            <Pressable key={o.value} testID={testID ? `${testID}-${o.value}` : undefined}
              onPress={() => onChange(on ? value.filter(v => v !== o.value) : [...value, o.value])}
              accessibilityRole="checkbox" accessibilityState={{ checked: on }} accessibilityLabel={o.label}
              style={({ pressed }) => [styles.chip, on && styles.chipOn, pressed && styles.pressed]}>
              {on ? <Ionicons name="checkmark" size={14} color={colors.white} /> : null}
              <Text style={[styles.chipText, on && styles.chipTextOn]}>{o.label}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const STAT_TONES = {
  navy: { bg: colors.bgMuted, fg: colors.navy },
  teal: { bg: colors.tealBg, fg: colors.teal },
  purple: { bg: colors.recruiterBg, fg: colors.recruiter },
  amber: { bg: colors.warningBg, fg: colors.warning },
} as const;

/** A metric tile: tinted icon, the number, what it counts, and an optional
 *  hint. A tile that leads somewhere is pressable and says so with an arrow. */
export function Stat({ label, value, icon, testID, tone = 'navy', hint, onPress }: {
  label: string; value: number | string; icon: keyof typeof Ionicons.glyphMap; testID?: string;
  tone?: keyof typeof STAT_TONES; hint?: string; onPress?: () => void;
}) {
  const t = STAT_TONES[tone];
  const body = (
    <>
      <View style={styles.statTop}>
        <View style={[styles.statIcon, { backgroundColor: t.bg }]}>
          <Ionicons name={icon} size={18} color={t.fg} />
        </View>
        {onPress ? <Ionicons name="arrow-forward" size={16} color={colors.textMuted} /> : null}
      </View>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel} numberOfLines={1}>{label}</Text>
      {hint ? <Text style={styles.statHint} numberOfLines={1}>{hint}</Text> : null}
    </>
  );
  const a11y = `${label}: ${value}${hint ? `, ${hint}` : ''}`;
  return onPress ? (
    <Pressable onPress={onPress} testID={testID} accessibilityRole="link" accessibilityLabel={a11y}
      style={({ pressed, hovered }: any) => [styles.stat, hovered && styles.statHover, pressed && styles.pressed]}>
      {body}
    </Pressable>
  ) : (
    <View style={styles.stat} testID={testID} accessible accessibilityLabel={a11y}>{body}</View>
  );
}

export function Notice({ tone = 'warning', title, body, children, testID }: {
  tone?: keyof typeof TONES; title: string; body?: string; children?: React.ReactNode; testID?: string;
}) {
  const t = TONES[tone];
  return (
    <View style={[styles.notice, { backgroundColor: t.bg }]} testID={testID}>
      <Ionicons name={t.icon as any} size={18} color={t.fg} />
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={[styles.noticeTitle, { color: t.fg }]}>{title}</Text>
        {body ? <Text style={styles.noticeBody}>{body}</Text> : null}
        {children}
      </View>
    </View>
  );
}

/**
 * Why a gated portal feature is unavailable, in the recruiter's actual
 * situation: a suspended or rejected account must not be told it is simply
 * "waiting for verification".
 */
export function RecruiterLockedNotice({ feature }: { feature: string }) {
  const { token } = useAuth();
  const router = useRouter();
  const [status, setStatus] = useState<RecruiterStatus | null>(null);
  useEffect(() => {
    if (!token) return;
    fetchRecruiterAccount(token).then(a => setStatus(a.status)).catch(() => setStatus('PENDING'));
  }, [token]);
  if (!status) return null;
  if (status === 'SUSPENDED') {
    return (
      <Notice tone="danger" title="Your recruiter account is currently suspended" testID="recruiter-locked"
        body={`Please contact ForMeds support at support@formeds.in. ${feature} stays unavailable until your account is reactivated.`} />
    );
  }
  if (status === 'REJECTED') {
    return (
      <Notice tone="danger" title="Your recruiter verification was not approved" testID="recruiter-locked"
        body={`${feature} needs an approved account. Review the reason on your Account page and resubmit.`}>
        <Pressable onPress={() => router.replace('/recruiter/account')} accessibilityRole="link" style={styles.noticeLink}>
          <Text style={recruiterStyles.link}>Go to Account</Text>
        </Pressable>
      </Notice>
    );
  }
  const waiting = status === 'UNDER_REVIEW';
  return (
    <Notice tone="warning" title={waiting ? 'Your account is under review' : 'Recruiter verification is required'}
      testID="recruiter-locked"
      body={`${feature} unlocks once our team approves your recruiter account.${waiting ? '' : ' Complete your details and documents to submit it.'}`}>
      {waiting ? null : (
        <Pressable onPress={() => router.replace('/recruiter/account')} accessibilityRole="link" style={styles.noticeLink}>
          <Text style={recruiterStyles.link}>Complete verification</Text>
        </Pressable>
      )}
    </Notice>
  );
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** "27 Sep 2026". Built by hand: en-IN renders September as "Sept". */
export function formatDate(iso?: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}

export const recruiterStyles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, flexWrap: 'wrap' },
  muted: { ...typography.caption, color: colors.textSecondary },
  body: { ...typography.body, color: colors.text },
  strong: { ...typography.bodyStrong, color: colors.text },
  link: { ...typography.label, color: colors.navy },
});

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  flex: { flex: 1 },
  scroll: { padding: spacing.lg, paddingBottom: spacing.xxxl, gap: spacing.md },
  pressed: { opacity: 0.85 },

  pill: {
    flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'flex-start',
    paddingHorizontal: spacing.sm + 2, paddingVertical: 4, borderRadius: radius.pill,
  },
  pillText: { fontSize: 12, fontFamily: fonts.body.bold },

  // flexShrink 0: on a long page the content ScrollView otherwise squeezes
  // the tab strip down to a sliver.
  navScroll: { flexGrow: 0, flexShrink: 0, backgroundColor: colors.white, borderBottomWidth: 1, borderBottomColor: colors.border },
  nav: { paddingHorizontal: spacing.sm, gap: spacing.xs },
  navTab: { minHeight: 48, paddingHorizontal: spacing.md, justifyContent: 'center' },
  navTabInner: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  navLabel: { fontSize: 14, fontFamily: fonts.body.medium, color: colors.textSecondary },
  navLabelActive: { color: colors.navy, fontFamily: fonts.body.bold },
  navUnderline: { position: 'absolute', left: spacing.sm, right: spacing.sm, bottom: 0, height: 3, borderRadius: 2 },
  navUnderlineActive: { backgroundColor: colors.navy },

  wideRow: {
    // Same width and gutters as the desktop TopBar, so the rail lines up
    // under the logo.
    flex: 1, flexDirection: 'row', width: '100%', maxWidth: layout.maxWidth, alignSelf: 'center',
    paddingHorizontal: spacing.xxl, gap: spacing.xxl,
  },
  wideScroll: { paddingTop: spacing.xxl, paddingBottom: spacing.xxxl * 2, gap: spacing.lg },
  pageHead: { flexDirection: 'row', alignItems: 'flex-end', gap: spacing.md, marginBottom: spacing.xs },
  pageTitle: { ...typography.h1, color: colors.text },
  pageSubtitle: { ...typography.body, color: colors.textSecondary, marginTop: 2 },

  rail: { width: 248, paddingTop: spacing.xxl, gap: spacing.lg },
  railCard: {
    backgroundColor: colors.white, borderRadius: radius.xl, borderWidth: 1, borderColor: colors.border,
    padding: spacing.lg, gap: spacing.md, ...shadow.card,
  },
  railIdentity: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  railMark: {
    width: 44, height: 44, borderRadius: radius.lg, backgroundColor: colors.recruiterBg,
    alignItems: 'center', justifyContent: 'center',
  },
  railOverline: { ...typography.overline, fontSize: 10, letterSpacing: 1.4, color: colors.teal },
  railCompany: { ...typography.h3, color: colors.text, marginTop: 2 },
  railNav: { gap: 2 },
  railItem: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.md, minHeight: 44,
    paddingHorizontal: spacing.md, borderRadius: radius.md, borderWidth: 1, borderColor: 'transparent',
  },
  railItemHover: { backgroundColor: colors.bgMuted },
  railItemActive: { backgroundColor: colors.white, borderColor: colors.border, ...shadow.card },
  railLabel: { fontSize: 15, fontFamily: fonts.body.medium, color: colors.textSecondary },
  railLabelActive: { color: colors.navy, fontFamily: fonts.body.bold },
  railCta: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm, minHeight: 48,
    borderRadius: radius.lg, backgroundColor: colors.action, ...gloss.fill,
  },
  railCtaHover: { backgroundColor: colors.actionHover },
  railCtaText: { fontSize: 15, fontFamily: fonts.body.bold, color: colors.white },
  railHelp: { ...typography.small, color: colors.textMuted, textAlign: 'center' },

  card: {
    backgroundColor: colors.white, borderRadius: radius.xl, borderWidth: 1, borderColor: colors.border,
    padding: spacing.xl, ...shadow.card,
  },
  cardHead: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.md },
  cardTitle: { ...typography.h3, color: colors.navy },
  cardSub: { ...typography.caption, color: colors.textSecondary, marginTop: 2 },

  toggle: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.md, minHeight: MIN_TOUCH_TARGET,
    paddingVertical: spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.borderLight,
  },
  toggleLabel: { ...typography.bodyStrong, color: colors.text },
  toggleHint: { ...typography.caption, color: colors.textSecondary, marginTop: 2 },

  fieldLabel: { ...typography.label, color: colors.textBody, marginBottom: 6 },
  chipGroup: { marginBottom: spacing.lg },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  chip: {
    flexDirection: 'row', alignItems: 'center', gap: 4, minHeight: 36,
    paddingHorizontal: spacing.md, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.border,
    backgroundColor: colors.white,
  },
  chipOn: { backgroundColor: colors.action, ...gloss.fill, borderColor: colors.action },
  chipText: { fontSize: 14, fontFamily: fonts.body.medium, color: colors.text },
  chipTextOn: { color: colors.white },

  // Three to a row on wide screens, two on a phone: six tiles never leave
  // one orphan stretched across the width.
  stat: {
    flexGrow: 1, flexBasis: '22%', minWidth: 150, backgroundColor: colors.white, borderRadius: radius.xl,
    borderWidth: 1, borderColor: colors.border, padding: spacing.lg, ...shadow.card,
  },
  statHover: { borderColor: colors.navyLight },
  statTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.md },
  statIcon: { width: 36, height: 36, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center' },
  statValue: { fontSize: 30, lineHeight: 34, fontFamily: fonts.heading.bold, color: colors.text, letterSpacing: -0.5 },
  statLabel: { ...typography.label, color: colors.text, marginTop: 2 },
  statHint: { ...typography.small, color: colors.textSecondary, marginTop: 2 },

  headerLinks: { flexDirection: 'row', gap: spacing.xs },
  headerLink: { width: MIN_TOUCH_TARGET, height: MIN_TOUCH_TARGET, alignItems: 'center', justifyContent: 'center' },
  headerBadge: {
    position: 'absolute', top: 6, right: 4, minWidth: 16, height: 16, borderRadius: 8, paddingHorizontal: 3,
    backgroundColor: colors.redText, alignItems: 'center', justifyContent: 'center',
  },
  headerBadgeText: { color: colors.white, fontSize: 10, fontFamily: fonts.body.bold },

  notice: { flexDirection: 'row', gap: spacing.sm, padding: spacing.md, borderRadius: radius.lg },
  noticeTitle: { ...typography.bodyStrong },
  noticeLink: { minHeight: MIN_TOUCH_TARGET, justifyContent: 'center', alignSelf: 'flex-start' },
  noticeBody: { ...typography.caption, color: colors.textSecondary, marginTop: 2 },
});
