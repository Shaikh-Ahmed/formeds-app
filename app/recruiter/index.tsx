import React, { useCallback, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../src/context/AuthContext';
import { Avatar, ErrorState, LoadingState } from '../../src/components';
import { colors, fonts, radius, spacing, typography, useBreakpoint } from '../../src/theme';
import {
  Card, RecruiterScreen, RecruiterStatusPill, Stat, formatDate, recruiterStyles,
} from '../../src/components/recruiters/RecruiterUI';
import { formatShiftDay } from '../../src/components/locum/LocumMeta';
import { fetchRecruiterDashboard } from '../../src/api/recruiters';
import type { DashboardOpening, RecruiterDashboard } from '../../src/types/recruiters';

/** Applicant stages in pipeline order, each with its own colour. */
const STAGES: { key: string; label: string; color: string }[] = [
  { key: 'applied', label: 'Applied', color: colors.navyLight },
  { key: 'reviewing', label: 'Reviewing', color: colors.textSecondary },
  { key: 'shortlisted', label: 'Shortlisted', color: colors.tealLight },
  { key: 'interviewing', label: 'Interviewing', color: colors.recruiter },
  { key: 'offered', label: 'Offered', color: colors.warning },
  { key: 'hired', label: 'Hired', color: colors.teal },
  { key: 'rejected', label: 'Not selected', color: colors.textMuted },
];
const STAGE = Object.fromEntries(STAGES.map(s => [s.key, s]));

function greeting(): string {
  const h = new Date().getHours();
  return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
}

/** How long ago, in the words a person would use. */
function ago(iso: string): string {
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (!Number.isFinite(mins)) return '';
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins} min ago`;
  if (mins < 60 * 24) return `${Math.round(mins / 60)} h ago`;
  if (mins < 60 * 24 * 7) return `${Math.round(mins / 1440)} d ago`;
  return formatDate(iso);
}

/** The recruiter's home: where the account stands, the numbers, and what needs doing next. */
export default function RecruiterDashboardScreen() {
  const { token, logout, refreshUser } = useAuth();
  const router = useRouter();
  const { width, isMobile } = useBreakpoint();
  const [data, setData] = useState<RecruiterDashboard | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    if (!token) return;
    try {
      setData(await fetchRecruiterDashboard(token));
      // Approval or suspension flips users.verified server-side; keep the
      // session's copy in step so gated screens (posting) agree.
      refreshUser().catch(() => {});
      setError(null);
    } catch (e: any) {
      setError(e?.message || 'Could not load your dashboard.');
    }
  }, [token, refreshUser]);

  useFocusEffect(useCallback(() => { load(); }, [load]));
  const refresh = async () => { setRefreshing(true); await load(); setRefreshing(false); };

  if (!data && error) return <ErrorState message={error} onRetry={load} />;
  if (!data) return <LoadingState />;

  const live = data.status === 'APPROVED';
  const c = data.counts;
  const openings = data.openings ?? [];
  const pipelineTotal = STAGES.reduce((n, s) => n + (data.pipeline[s.key] || 0), 0);
  const inv = data.invitations;
  const awaiting = (inv.SENT || 0) + (inv.VIEWED || 0);
  const acceptRate = c.invitations_sent ? Math.round((c.invitations_accepted / c.invitations_sent) * 100) : 0;
  // Side-by-side columns once there is room for both at a comfortable width
  // (the rail takes ~270px from 1000px up).
  const twoCol = width >= 1180 || (width >= 900 && width < 1000);

  const steps = [
    { done: live, label: 'Get verified by ForMeds', href: '/recruiter/account' },
    { done: c.total_jobs + c.open_locums > 0, label: 'Post your first opening', href: '/jobs/new' },
    { done: c.invitations_sent > 0, label: 'Invite a professional', href: '/recruiter/candidates' },
    { done: c.applicants > 0, label: 'Receive your first application', href: '/recruiter/jobs' },
  ];
  const stepsDone = steps.filter(s => s.done).length;

  const pipelineCard = (
    <Card title="Applicant pipeline" testID="dashboard-pipeline"
      subtitle={pipelineTotal ? `${pipelineTotal} application${pipelineTotal === 1 ? '' : 's'} across your openings`
        : 'Where every applicant stands'}>
      {pipelineTotal ? (
        <>
          <View style={styles.stackBar} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
            {STAGES.filter(s => data.pipeline[s.key]).map(s => (
              <View key={s.key} style={{ flex: data.pipeline[s.key], backgroundColor: s.color }} />
            ))}
          </View>
          <View style={styles.legend}>
            {STAGES.map(s => (
              <View key={s.key} style={styles.legendItem} accessible
                accessibilityLabel={`${s.label}: ${data.pipeline[s.key] || 0}`}>
                <View style={[styles.legendDot, { backgroundColor: s.color }]} />
                <Text style={styles.legendLabel}>{s.label}</Text>
                <Text style={styles.legendValue}>{data.pipeline[s.key] || 0}</Text>
              </View>
            ))}
          </View>
        </>
      ) : (
        <EmptyPanel icon="git-network-outline" title="No applications yet"
          body="As professionals apply, you'll see them move from applied to hired here."
          action={live ? { label: 'Invite professionals', onPress: () => router.push('/recruiter/candidates') } : undefined} />
      )}
    </Card>
  );

  const recentCard = (
    <Card title="Recent applications" testID="dashboard-recent">
      {data.recent_applications.length === 0 ? (
        <Text style={recruiterStyles.muted}>New applications to your openings will appear here.</Text>
      ) : data.recent_applications.map((a, i) => {
        const stage = STAGE[a.status] ?? STAGE.applied;
        return (
          <Pressable key={a.id} onPress={() => router.push(`/jobs/applicants/${a.job_id}` as any)}
            style={({ pressed, hovered }: any) => [styles.listRow, i === 0 && styles.listRowFirst,
              hovered && styles.listRowHover, pressed && { opacity: 0.85 }]}
            accessibilityRole="link"
            accessibilityLabel={`${a.applicant?.name ?? 'Applicant'} applied to ${a.job_title}, ${stage.label}`}>
            <Avatar name={a.applicant?.name} uri={a.applicant?.avatar} size={40} />
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={recruiterStyles.strong} numberOfLines={1}>{a.applicant?.name ?? 'Applicant'}</Text>
              <Text style={recruiterStyles.muted} numberOfLines={1}>{a.job_title} · {ago(a.created_at)}</Text>
            </View>
            <View style={[styles.stageChip, { borderColor: stage.color }]}>
              <View style={[styles.legendDot, { backgroundColor: stage.color }]} />
              <Text style={styles.stageChipText}>{stage.label}</Text>
            </View>
          </Pressable>
        );
      })}
    </Card>
  );

  const openingsCard = (
    <Card title="Your openings" testID="dashboard-openings"
      right={<LinkText label="Manage" onPress={() => router.push('/recruiter/jobs')} />}>
      {openings.length === 0 ? (
        <EmptyPanel icon="briefcase-outline" title="Nothing live right now"
          body="Post a job or a locum shift for a client and it will show here."
          action={live ? { label: 'Post a job', onPress: () => router.push('/jobs/new' as any) } : undefined} />
      ) : openings.map((o, i) => <OpeningRow key={`${o.kind}:${o.id}`} o={o} first={i === 0} />)}
    </Card>
  );

  const invitationsCard = (
    <Card title="Invitations" testID="dashboard-invitations"
      right={<LinkText label="View all" onPress={() => router.push('/recruiter/invitations')} />}>
      {c.invitations_sent === 0 ? (
        <Text style={recruiterStyles.muted}>Invite professionals who have chosen to be discoverable.</Text>
      ) : (
        <View style={{ gap: spacing.sm }}>
          {[
            { label: 'Awaiting reply', n: awaiting, color: colors.navyLight },
            { label: 'Applied', n: inv.ACCEPTED || 0, color: colors.teal },
            { label: 'Declined', n: inv.DECLINED || 0, color: colors.textSecondary },
            { label: 'Expired', n: inv.EXPIRED || 0, color: colors.textMuted },
          ].map(r => (
            <View key={r.label} style={styles.invRow} accessible accessibilityLabel={`${r.label}: ${r.n}`}>
              <Text style={styles.invLabel}>{r.label}</Text>
              <View style={styles.invTrack}>
                <View style={[styles.invFill, { backgroundColor: r.color, width: `${(r.n / c.invitations_sent) * 100}%` }]} />
              </View>
              <Text style={styles.invValue}>{r.n}</Text>
            </View>
          ))}
        </View>
      )}
    </Card>
  );

  // A new agency's next steps. Not shown to a suspended or rejected account,
  // whose next step is the one in the hero.
  const onboarding = data.status !== 'SUSPENDED' && data.status !== 'REJECTED';
  const checklist = onboarding && stepsDone < steps.length ? (
    <Card title="Getting started" subtitle={`${stepsDone} of ${steps.length} done`} testID="dashboard-checklist">
      <View style={styles.progressTrack}>
        <View style={[styles.progressFill, { width: `${(stepsDone / steps.length) * 100}%` }]} />
      </View>
      {steps.map(s => (
        <Pressable key={s.label} onPress={() => !s.done && router.push(s.href as any)} disabled={s.done}
          accessibilityRole="link" accessibilityState={{ checked: s.done, disabled: s.done }}
          style={({ hovered }: any) => [styles.step, hovered && !s.done && styles.listRowHover]}>
          <Ionicons name={s.done ? 'checkmark-circle' : 'ellipse-outline'} size={20}
            color={s.done ? colors.teal : colors.textMuted} />
          <Text style={[styles.stepText, s.done && styles.stepDone]}>{s.label}</Text>
          {!s.done ? <Ionicons name="chevron-forward" size={16} color={colors.textMuted} /> : null}
        </Pressable>
      ))}
    </Card>
  ) : null;

  return (
    <RecruiterScreen title="Dashboard" hideTitle active="dashboard" refreshing={refreshing} onRefresh={refresh}
      testID="recruiter-dashboard">
      <Hero data={data} compact={isMobile} />

      <View style={styles.stats}>
        <Stat icon="briefcase-outline" tone="navy" label="Live openings" value={c.active_jobs + c.open_locums}
          hint={`${c.active_jobs} job${c.active_jobs === 1 ? '' : 's'} · ${c.open_locums} shift${c.open_locums === 1 ? '' : 's'}`}
          onPress={() => router.push('/recruiter/jobs')} testID="stat-active-jobs" />
        <Stat icon="people-outline" tone="teal" label="Applicants" value={c.applicants}
          hint={pipelineTotal ? `${data.pipeline.shortlisted || 0} shortlisted` : 'None yet'}
          onPress={() => router.push('/recruiter/jobs')} testID="stat-applicants" />
        <Stat icon="paper-plane-outline" tone="purple" label="Invitations sent" value={c.invitations_sent}
          hint={c.invitations_sent ? `${acceptRate}% applied` : 'Find talent to invite'}
          onPress={() => router.push('/recruiter/invitations')} testID="stat-invitations" />
        <Stat icon="ribbon-outline" tone="amber" label="Placements" value={c.hired}
          hint={c.hired ? 'Hired through ForMeds' : 'Your hires show here'}
          onPress={() => router.push('/recruiter/history')} testID="stat-hired" />
      </View>

      <View style={[styles.columns, twoCol && styles.columnsWide]}>
        <View style={[styles.col, twoCol && styles.colMain]}>
          {checklist && !twoCol ? checklist : null}
          {pipelineCard}
          {openingsCard}
          {!twoCol ? invitationsCard : null}
          {recentCard}
        </View>
        {twoCol ? (
          <View style={[styles.col, styles.colSide]}>
            {checklist}
            {invitationsCard}
          </View>
        ) : null}
      </View>

      <Pressable onPress={async () => { await logout(); router.replace('/recruiter-login'); }} testID="recruiter-logout"
        accessibilityRole="button" style={({ pressed }) => [styles.signOut, pressed && { opacity: 0.7 }]}>
        <Ionicons name="log-out-outline" size={18} color={colors.textSecondary} />
        <Text style={styles.signOutText}>Sign out</Text>
      </Pressable>
    </RecruiterScreen>
  );
}

// ── Hero ────────────────────────────────────────────────────────────────────

const HERO_COPY: Partial<Record<RecruiterDashboard['status'], { title: string; body: string; cta?: string }>> = {
  PENDING: {
    title: 'Finish setting up your account',
    body: 'Add your business and representative details and upload your documents. Every recruiter is verified before they can post or contact professionals.',
    cta: 'Complete verification',
  },
  UNDER_REVIEW: {
    title: 'Your account is under review',
    body: "We usually review recruiter accounts within 1–2 working days. You'll get a notification when it's done.",
  },
  NEEDS_INFORMATION: { title: 'More information needed', body: '', cta: 'Update details' },
  REJECTED: { title: 'Your recruiter verification was not approved', body: '', cta: 'Review and resubmit' },
  SUSPENDED: {
    title: 'Your recruiter account is currently suspended',
    body: "Your openings are paused and you can't contact professionals. Please contact ForMeds support at support@formeds.in.",
  },
};

function Hero({ data, compact }: { data: RecruiterDashboard; compact: boolean }) {
  const router = useRouter();
  const live = data.status === 'APPROVED';
  const first = (data.rep_name || '').trim().split(/\s+/)[0];
  const c = data.counts;
  const copy = HERO_COPY[data.status];
  const reason = data.status_reason ? `Reason: ${data.status_reason.replace(/\.$/, '')}.` : '';

  return (
    <View style={[styles.hero, compact && styles.heroCompact]} testID="dashboard-hero">
      {/* Decoration only: two soft rings and the verified mark, behind the text. */}
      <View style={styles.heroRingLg} pointerEvents="none" />
      <View style={styles.heroRingSm} pointerEvents="none" />
      {/* The verified mark only once it is true; until then, the agency. */}
      <Ionicons name={live ? 'shield-checkmark' : 'business'} size={150} color={colors.onDarkSurface} style={styles.heroMark}
        accessibilityElementsHidden importantForAccessibility="no" />

      <Text style={styles.heroOverline}>{greeting()}{first ? `, ${first}` : ''}</Text>
      <View style={styles.heroTitleRow}>
        <Text style={[styles.heroTitle, compact && styles.heroTitleCompact]} accessibilityRole="header">
          {data.company_name}
        </Text>
        {live ? (
          <View style={styles.heroBadge} testID="verified-recruiter-badge" accessible accessibilityLabel="Verified Recruiter">
            <Ionicons name="shield-checkmark" size={14} color={colors.white} />
            <Text style={styles.heroBadgeText}>Verified Recruiter</Text>
          </View>
        ) : <RecruiterStatusPill status={data.status} />}
      </View>

      {live ? (
        <>
          <Text style={styles.heroBody}>
            {c.active_jobs + c.open_locums
              ? `${c.active_jobs} active job${c.active_jobs === 1 ? '' : 's'} and ${c.open_locums} open shift${c.open_locums === 1 ? '' : 's'}. `
              : 'No openings live yet. '}
            {c.applicants
              ? `${c.applicants} applicant${c.applicants === 1 ? '' : 's'} so far.`
              : 'Post an opening and invite professionals who fit.'}
          </Text>
          <View style={styles.heroActions}>
            <HeroButton primary grow={compact} icon="add" label="Post a job" onPress={() => router.push('/jobs/new' as any)}
              testID="dashboard-post-job" />
            <HeroButton grow={compact} icon="flash-outline" label="Post locum shift" onPress={() => router.push('/jobs/locum/new' as any)} />
            <HeroButton grow={compact} icon="search" label="Find talent" onPress={() => router.push('/recruiter/candidates')}
              testID="dashboard-find-talent" />
          </View>
        </>
      ) : copy ? (
        <View style={styles.heroNotice} testID={`dashboard-status-${data.status}`}>
          <Text style={styles.heroNoticeTitle}>{copy.title}</Text>
          {[copy.body, reason].filter(Boolean).map(t => <Text key={t} style={styles.heroBody}>{t}</Text>)}
          {copy.cta ? (
            <View style={styles.heroActions}>
              <HeroButton primary icon="arrow-forward" label={copy.cta} onPress={() => router.push('/recruiter/account')}
                testID="dashboard-complete" />
            </View>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

function HeroButton({ label, icon, onPress, primary, testID, grow }: {
  label: string; icon: keyof typeof Ionicons.glyphMap; onPress: () => void; primary?: boolean; testID?: string;
  /** On a phone the buttons share each row instead of leaving one stranded. */
  grow?: boolean;
}) {
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={label} testID={testID}
      style={({ pressed, hovered }: any) => [styles.heroBtn, grow && styles.heroBtnGrow,
        primary ? styles.heroBtnPrimary : styles.heroBtnGhost,
        hovered && (primary ? styles.heroBtnPrimaryHover : styles.heroBtnGhostHover), pressed && { opacity: 0.85 }]}>
      <Ionicons name={icon} size={18} color={primary ? colors.navy : colors.white} />
      <Text style={[styles.heroBtnText, primary && styles.heroBtnTextPrimary]}>{label}</Text>
    </Pressable>
  );
}

// ── Pieces ──────────────────────────────────────────────────────────────────

function OpeningRow({ o, first }: { o: DashboardOpening; first: boolean }) {
  const router = useRouter();
  const meta = o.kind === 'locum'
    ? [o.city, o.shift_date && formatShiftDay(o.shift_date)].filter(Boolean).join(' · ')
    : [o.client_name && `For ${o.client_name}`, o.city].filter(Boolean).join(' · ');
  const manage = o.kind === 'job' ? `/jobs/applicants/${o.id}` : `/jobs/locum/manage/${o.id}`;
  return (
    <View style={[styles.listRow, first && styles.listRowFirst]} testID={`dashboard-opening-${o.id}`}>
      <View style={[styles.kindIcon, o.kind === 'locum' ? styles.kindLocum : null]}>
        <Ionicons name={o.kind === 'job' ? 'briefcase' : 'flash'} size={16}
          color={o.kind === 'job' ? colors.navy : colors.teal} />
      </View>
      <Pressable style={{ flex: 1, minWidth: 0 }} onPress={() => router.push(manage as any)} accessibilityRole="link"
        accessibilityLabel={`${o.title}, ${o.applicants} applicants`}>
        <Text style={recruiterStyles.strong} numberOfLines={1}>{o.title}</Text>
        <Text style={recruiterStyles.muted} numberOfLines={1}>
          {meta ? `${meta} · ` : ''}{o.applicants} applicant{o.applicants === 1 ? '' : 's'}
        </Text>
      </Pressable>
      <LinkText label="Invite" icon="person-add-outline" onPress={() => router.push({
        pathname: '/recruiter/candidates',
        params: o.kind === 'job' ? { job: o.id, title: o.title } : { locum: o.id, title: o.title },
      } as any)} />
    </View>
  );
}

function LinkText({ label, onPress, icon }: { label: string; onPress: () => void; icon?: keyof typeof Ionicons.glyphMap }) {
  return (
    <Pressable onPress={onPress} accessibilityRole="link" hitSlop={8}
      style={({ pressed, hovered }: any) => [styles.link, hovered && styles.linkHover, pressed && { opacity: 0.7 }]}>
      {icon ? <Ionicons name={icon} size={16} color={colors.navy} /> : null}
      <Text style={recruiterStyles.link}>{label}</Text>
    </Pressable>
  );
}

function EmptyPanel({ icon, title, body, action }: {
  icon: keyof typeof Ionicons.glyphMap; title: string; body: string; action?: { label: string; onPress: () => void };
}) {
  return (
    <View style={styles.empty}>
      <View style={styles.emptyIcon}><Ionicons name={icon} size={22} color={colors.navy} /></View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={recruiterStyles.strong}>{title}</Text>
        <Text style={recruiterStyles.muted}>{body}</Text>
        {action ? (
          <Pressable onPress={action.onPress} accessibilityRole="button" style={styles.emptyAction}>
            <Text style={recruiterStyles.link}>{action.label}</Text>
            <Ionicons name="arrow-forward" size={14} color={colors.navy} />
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  // Hero
  hero: {
    backgroundColor: colors.navy, borderRadius: radius.xl + 4, padding: spacing.xxl + 4, overflow: 'hidden',
    gap: spacing.sm,
  },
  heroCompact: { padding: spacing.xl },
  heroRingLg: {
    position: 'absolute', width: 340, height: 340, borderRadius: 170, right: -110, top: -150,
    borderWidth: 48, borderColor: colors.navyLight, opacity: 0.45,
  },
  heroRingSm: {
    position: 'absolute', width: 160, height: 160, borderRadius: 80, right: 120, bottom: -110,
    backgroundColor: colors.navyLight, opacity: 0.3,
  },
  heroMark: { position: 'absolute', right: 28, top: 28 },
  heroOverline: { ...typography.overline, color: colors.tealLight },
  heroTitleRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: spacing.md },
  heroTitle: {
    fontSize: 32, lineHeight: 38, fontFamily: fonts.heading.bold, letterSpacing: -0.6, color: colors.white, flexShrink: 1,
  },
  heroTitleCompact: { fontSize: 26, lineHeight: 32 },
  heroBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: spacing.md, paddingVertical: 5,
    borderRadius: radius.pill, backgroundColor: colors.onDarkSurface, borderWidth: 1, borderColor: colors.onDarkBorder,
  },
  heroBadgeText: { ...typography.small, fontFamily: fonts.body.bold, color: colors.white },
  heroBody: { ...typography.body, lineHeight: 22, color: colors.textOnDarkMuted, maxWidth: 620 },
  heroNotice: { gap: 4, marginTop: spacing.xs },
  heroNoticeTitle: { ...typography.h3, color: colors.white },
  heroActions: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.md },
  heroBtn: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm, minHeight: 46,
    paddingHorizontal: spacing.lg + 2, borderRadius: radius.lg,
  },
  heroBtnGrow: { flexGrow: 1, justifyContent: 'center' },
  heroBtnPrimary: { backgroundColor: colors.white },
  heroBtnPrimaryHover: { backgroundColor: colors.bgMuted },
  heroBtnGhost: { borderWidth: 1, borderColor: colors.onDarkBorder, backgroundColor: colors.onDarkSurface },
  heroBtnGhostHover: { borderColor: colors.white },
  heroBtnText: { ...typography.label, color: colors.white },
  heroBtnTextPrimary: { color: colors.navy, fontFamily: fonts.body.bold },

  stats: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },

  columns: { gap: spacing.lg },
  columnsWide: { flexDirection: 'row', alignItems: 'flex-start' },
  col: { gap: spacing.lg },
  colMain: { flex: 1.65, minWidth: 0 },
  colSide: { flex: 1, minWidth: 0 },

  // Pipeline
  stackBar: {
    flexDirection: 'row', height: 14, borderRadius: 7, overflow: 'hidden', backgroundColor: colors.bgMuted, gap: 2,
  },
  legend: { flexDirection: 'row', flexWrap: 'wrap', marginTop: spacing.lg, rowGap: spacing.md },
  legendItem: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm, flexBasis: '33%', minWidth: 130, paddingRight: spacing.md,
  },
  legendDot: { width: 10, height: 10, borderRadius: 5 },
  legendLabel: { ...typography.caption, color: colors.textSecondary },
  legendValue: { ...typography.bodyStrong, color: colors.text },

  // Lists
  listRow: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: spacing.md,
    borderTopWidth: 1, borderTopColor: colors.borderLight, minHeight: 60, marginHorizontal: -spacing.sm,
    paddingHorizontal: spacing.sm, borderRadius: radius.md,
  },
  listRowFirst: { borderTopWidth: 0 },
  listRowHover: { backgroundColor: colors.bg },
  stageChip: {
    flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: spacing.sm + 2, paddingVertical: 4,
    borderRadius: radius.pill, borderWidth: 1, backgroundColor: colors.white,
  },
  stageChipText: { ...typography.small, fontFamily: fonts.body.semibold, color: colors.text },
  kindIcon: {
    width: 36, height: 36, borderRadius: radius.md, backgroundColor: colors.bgMuted,
    alignItems: 'center', justifyContent: 'center',
  },
  kindLocum: { backgroundColor: colors.tealBg },
  link: {
    flexDirection: 'row', alignItems: 'center', gap: 4, minHeight: 36, paddingHorizontal: spacing.sm, borderRadius: radius.sm,
  },
  linkHover: { backgroundColor: colors.bgMuted },

  // Invitations
  invRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  invLabel: { ...typography.caption, color: colors.textSecondary, width: 104 },
  invTrack: { flex: 1, height: 8, borderRadius: 4, backgroundColor: colors.bgMuted, overflow: 'hidden' },
  invFill: { height: 8, borderRadius: 4 },
  invValue: { ...typography.bodyStrong, color: colors.text, width: 28, textAlign: 'right' },

  // Checklist
  progressTrack: {
    height: 6, borderRadius: 3, backgroundColor: colors.bgMuted, overflow: 'hidden', marginBottom: spacing.sm,
  },
  progressFill: { height: 6, borderRadius: 3, backgroundColor: colors.teal },
  step: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.md, minHeight: 44, borderRadius: radius.md,
    marginHorizontal: -spacing.sm, paddingHorizontal: spacing.sm,
  },
  stepText: { ...typography.body, color: colors.text, flex: 1 },
  stepDone: { color: colors.textMuted, textDecorationLine: 'line-through' },

  // Empty
  empty: {
    flexDirection: 'row', gap: spacing.md, padding: spacing.lg, borderRadius: radius.lg,
    borderWidth: 1, borderStyle: 'dashed', borderColor: colors.border, backgroundColor: colors.bg,
  },
  emptyIcon: {
    width: 40, height: 40, borderRadius: radius.md, backgroundColor: colors.white, borderWidth: 1,
    borderColor: colors.border, alignItems: 'center', justifyContent: 'center',
  },
  emptyAction: {
    flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: spacing.sm, minHeight: 32, alignSelf: 'flex-start',
  },

  signOut: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm, alignSelf: 'center', minHeight: 44, paddingHorizontal: spacing.lg,
  },
  signOutText: { ...typography.label, color: colors.textSecondary },
});
