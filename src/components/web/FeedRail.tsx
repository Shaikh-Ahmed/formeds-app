import React, { useEffect, useState } from 'react';
import { Platform, View, Text, StyleSheet, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { colors, spacing, radius, typography, fonts, shadow, isPremium } from '../../theme';
import { GradientFill } from '../material/Surfaces';
import { useAuth } from '../../context/AuthContext';
import { kycCopy, useKycStatus } from '../../hooks/useKycStatus';
import { apiFetch } from '../../utils/api';
import { timeAgo } from '../../utils/time';
import { toggleSaveJob } from '../../api/jobs';
import { EMPLOYMENT_TYPE_LABELS, type Job } from '../../types/jobs';
import { LOCUM_ROLE_LABELS, LOCUM_PAY_LABELS, type Locum } from '../../types/locum';
import { Avatar } from '../Avatar';
import { formatClock } from '../locum/LocumMeta';
import { ConnectActions } from '../network/ConnectActions';
import { RailCard } from './Rail';
import { Hoverable } from './Hoverable';

/** How many of each the rail shows. */
const TRENDING_COUNT = 5;
const PEOPLE_SHOWN = 3;
// Fetched with spares, so dismissing one brings the next in without a reload.
const PEOPLE_FETCHED = 8;
const NEW_WITHIN_DAYS = 3;

type Tag = { tag: string; count: number };
type Person = {
  id: string; name: string; role: string; avatar?: string;
  specialty?: string; professional_role?: string; city?: string;
};

/**
 * Right-hand rail for the feed (>=1128px only).
 *
 * Everything in it is real: trending topics are the most used case tags,
 * suggestions come from /api/users/suggestions (shared specialty and place,
 * never a hidden ranking), opportunities are the newest jobs and soonest
 * locums. A section with nothing to show is left out rather than padded.
 */
export function FeedRail() {
  const { isKycApproved, user } = useAuth();
  const router = useRouter();
  const { state } = useKycStatus({ enabled: !!user && !isKycApproved });
  const copy = kycCopy(state?.status);
  const tone = copy.tone === 'navy' ? colors.navy : copy.tone === 'danger' ? colors.redText : colors.warning;

  return (
    <View style={styles.wrap}>
      {/* Verification is the gate on posting, applying and messaging, so on
          desktop it gets persistent rail space instead of only appearing
          inside the composer. */}
      {/* Students have no professional verification to complete. */}
      {!isKycApproved && user && user.role !== 'student' ? (
        <View style={[styles.kycCard, copy.tone === 'navy' && styles.kycCardReview,
          copy.tone === 'danger' && styles.kycCardRejected]} testID="rail-kyc">
          <View style={styles.kycHead}>
            <Ionicons name={copy.tone === 'navy' ? 'time-outline' : 'shield-outline'} size={18} color={tone} />
            <Text style={[styles.kycTitle, { color: tone }]}>{copy.title}</Text>
          </View>
          <Text style={styles.kycBody}>{copy.hint}</Text>
          <Hoverable
            testID="rail-kyc-cta"
            onPress={() => router.push('/kyc' as any)}
            accessibilityLabel={copy.cta}
            style={styles.kycCta}
            hoverStyle={styles.kycCtaHover}
          >
            <Text style={[styles.kycCtaText, { color: tone }]}>{copy.cta}</Text>
            <Ionicons name="arrow-forward" size={14} color={tone} />
          </Hoverable>
        </View>
      ) : null}

      {isPremium && user && user.role !== 'recruiter' ? <AedAnchor /> : null}
      <Trending />
      <PeopleYouMayKnow />
      {user?.role === 'healthcare_professional' ? <Opportunities /> : null}

      {/* Quiet footer — the legal/help links a website is expected to carry,
          without competing with content for attention. */}
      <View style={styles.footer}>
        <Hoverable onPress={() => router.push('/help' as any)} accessibilityLabel="Help centre" style={styles.footerLink}>
          <Text style={styles.footerText}>Help centre</Text>
        </Hoverable>
        <Text style={styles.footerBrand}>ForMeds © {new Date().getFullYear()}</Text>
      </View>
    </View>
  );
}

/**
 * Premium: AED as the rail's one dark anchor -- the clinical AI, always a
 * click away. A shortcut to the existing AED screen; nothing new behind it.
 */
function AedAnchor() {
  const router = useRouter();
  return (
    <View style={styles.aedCard} testID="rail-aed">
      <GradientFill name="featured" style={StyleSheet.absoluteFill} pointerEvents="none" />
      <Ionicons name="pulse" size={132} color="rgba(255,255,255,0.04)" style={styles.aedMark} />
      <View style={styles.aedTop}>
        <View style={styles.aedLive}>
          <View style={styles.aedDot} />
          <Text style={styles.aedLiveText}>Clinical AI · live</Text>
        </View>
        <Text style={styles.aedMono}>EVIDENCE-LINKED</Text>
      </View>
      <Text style={styles.aedTitle} accessibilityRole="header">AED Assist</Text>
      <Text style={styles.aedBody}>
        Differentials, drug checks, lab reads and guideline summaries, with sources to verify.
      </Text>
      <Hoverable testID="rail-aed-open" onPress={() => router.push('/aed-chat' as any)}
        accessibilityRole="link" accessibilityLabel="Ask AED" style={styles.aedCta} hoverStyle={styles.aedCtaHover}>
        <Ionicons name="sparkles" size={15} color={colors.white} />
        <Text style={styles.aedCtaText}>Ask AED</Text>
      </Hoverable>
    </View>
  );
}

// Tints for the numbered markers, cycling. Each pair clears 4.5:1.
const MARKERS = [
  { bg: colors.tealBg, fg: colors.teal },
  { bg: colors.bgMuted, fg: colors.navy },
  { bg: colors.recruiterBg, fg: colors.recruiter },
  { bg: colors.warningBg, fg: colors.warning },
  { bg: colors.successBg, fg: colors.success },
];

/** Tags are stored lowercase; show them as topics. */
export function topicLabel(tag: string): string {
  return tag.replace(/(^|[\s-])(\p{L})/gu, (_, sep: string, ch: string) => sep + ch.toUpperCase());
}

function Trending() {
  const { token } = useAuth();
  const router = useRouter();
  const [tags, setTags] = useState<Tag[]>([]);

  useEffect(() => {
    apiFetch('/api/cases/tags', token)
      .then((t: unknown) => setTags(Array.isArray(t) ? t.slice(0, TRENDING_COUNT) : []))
      .catch(() => setTags([]));
  }, [token]);

  if (!tags.length) return null;
  const open = (tag?: string) => router.push({
    pathname: '/(tabs)/community', params: tag ? { tab: 'cases', tag } : { tab: 'cases' },
  } as any);

  return (
    <RailCard title="Trending in Healthcare" onAction={() => open()} testID="rail-trending">
      <View style={styles.list}>
        {tags.map((t, i) => {
          const m = MARKERS[i % MARKERS.length];
          return (
            <Hoverable key={t.tag} onPress={() => open(t.tag)} accessibilityRole="link"
              accessibilityLabel={`${topicLabel(t.tag)}, ${t.count} ${t.count === 1 ? 'case' : 'cases'}`}
              style={styles.trendRow} hoverStyle={styles.rowHover} testID={`rail-trending-${i}`}>
              <View style={[styles.marker, { backgroundColor: m.bg }]}>
                <Text style={[styles.markerText, { color: m.fg }]}>{i + 1}</Text>
              </View>
              <View style={styles.rowText}>
                <Text style={styles.rowTitle} numberOfLines={1}>{topicLabel(t.tag)}</Text>
                <Text style={styles.rowMeta}>{t.count} {t.count === 1 ? 'case' : 'cases'}</Text>
              </View>
            </Hoverable>
          );
        })}
      </View>
    </RailCard>
  );
}

function PeopleYouMayKnow() {
  const { token, user } = useAuth();
  const router = useRouter();
  const [people, setPeople] = useState<Person[]>([]);
  const [dismissed, setDismissed] = useState<string[]>([]);

  useEffect(() => {
    if (!token) return;
    apiFetch(`/api/users/suggestions?limit=${PEOPLE_FETCHED}`, token)
      .then((rows: unknown) => setPeople(Array.isArray(rows) ? rows : []))
      .catch(() => setPeople([]));
  }, [token]);

  // Recruiters work from their own portal and are not part of the network.
  if (user?.role === 'recruiter') return null;
  const shown = people.filter(p => !dismissed.includes(p.id)).slice(0, PEOPLE_SHOWN);
  if (!shown.length) return null;

  return (
    <RailCard title="People you may know" onAction={() => router.push('/people?tab=suggested' as any)} testID="rail-people">
      <View style={styles.list}>
        {shown.map(p => {
          const org = p.role === 'hospital' || p.role === 'clinic';
          const what = org ? (p.role === 'hospital' ? 'Hospital' : 'Clinic') : (p.specialty || p.professional_role || 'Healthcare professional');
          return (
            <View key={p.id} style={styles.personRow} testID={`rail-person-${p.id}`}>
              <Pressable onPress={() => router.push(`/profile/${p.id}` as any)} accessibilityRole="link"
                accessibilityLabel={`Open ${p.name}'s profile`} style={styles.personLink}>
                <Avatar name={p.name} role={p.role} uri={p.avatar} size={40} />
                <View style={styles.rowText}>
                  <Text style={styles.rowTitle} numberOfLines={1}>{p.name}</Text>
                  <Text style={styles.rowMeta} numberOfLines={1}>{[what, p.city].filter(Boolean).join(' · ')}</Text>
                </View>
              </Pressable>
              <View style={styles.personActions}>
                <ConnectActions iconOnly userId={p.id} name={p.name} initialStatus="none" testID={`rail-connect-${p.id}`} />
                <Pressable onPress={() => setDismissed(d => [...d, p.id])} accessibilityRole="button"
                  accessibilityLabel={`Hide ${p.name}`} hitSlop={6} testID={`rail-dismiss-${p.id}`}
                  style={({ hovered }: any) => [styles.dismiss, hovered && styles.dismissHover]}>
                  <Ionicons name="close" size={15} color={colors.textSubtle} />
                </Pressable>
              </View>
            </View>
          );
        })}
      </View>
    </RailCard>
  );
}

// Each row reads title / employer / one detail line. `lead` is the one figure
// worth colour (a locum's pay); `details` follow it, quietly.
type Opportunity =
  | { kind: 'job'; id: string; title: string; employer: string; avatar?: string;
      lead?: string; details: string[]; at: string; saved: boolean }
  | { kind: 'locum'; id: string; title: string; employer: string; avatar?: string;
      lead?: string; details: string[]; at: string };

function jobItem(j: Job): Opportunity {
  const exp = j.experience_max
    ? `${j.experience_min}–${j.experience_max} yrs`
    : j.experience_min ? `${j.experience_min}+ yrs` : '';
  return {
    kind: 'job', id: j.id, title: j.title, employer: j.employer_name, avatar: j.employer_avatar,
    details: [j.city || j.location, EMPLOYMENT_TYPE_LABELS[j.employment_type] ?? '', exp].filter(Boolean),
    at: j.published_at || j.created_at, saved: j.saved,
  };
}

function locumItem(l: Locum): Opportunity {
  const date = new Date(`${l.shift_date}T00:00:00`);
  const day = Number.isNaN(date.getTime()) ? l.shift_date
    : date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
  return {
    kind: 'locum', id: l.id,
    // The specialty is what a reader scans for, so it leads the title.
    title: l.specialty ? `${l.specialty} locum` : `Locum ${LOCUM_ROLE_LABELS[l.role_required] ?? 'cover'}`,
    employer: l.employer_name, avatar: l.employer_avatar,
    lead: l.pay_type === 'negotiable' || !l.pay_amount
      ? 'Pay negotiable'
      : `₹${l.pay_amount.toLocaleString('en-IN')} ${LOCUM_PAY_LABELS[l.pay_type] ?? ''}`.trim(),
    // Pay and start are what decide a shift; the city would only truncate.
    details: [`${day}, ${formatClock(l.start_time)}`],
    at: l.created_at,
  };
}

function Opportunities() {
  const { token } = useAuth();
  const router = useRouter();
  const [items, setItems] = useState<Opportunity[]>([]);

  useEffect(() => {
    let live = true;
    Promise.all([
      apiFetch('/api/jobs/?limit=2&sort=newest', token).then((r: { items?: Job[] }) => (r?.items ?? []).map(jobItem)).catch(() => []),
      apiFetch('/api/locums/?limit=1&sort=soonest', token).then((r: { items?: Locum[] }) => (r?.items ?? []).map(locumItem)).catch(() => []),
    ]).then(([jobs, locums]) => { if (live) setItems([...jobs, ...locums]); });
    return () => { live = false; };
  }, [token]);

  if (!items.length) return null;

  const toggleSave = async (id: string) => {
    if (!token) return;
    // Optimistic, then settled by the server's answer.
    setItems(prev => prev.map(i => (i.kind === 'job' && i.id === id ? { ...i, saved: !i.saved } : i)));
    try {
      const { saved } = await toggleSaveJob(token, id);
      setItems(prev => prev.map(i => (i.kind === 'job' && i.id === id ? { ...i, saved } : i)));
    } catch {
      setItems(prev => prev.map(i => (i.kind === 'job' && i.id === id ? { ...i, saved: !i.saved } : i)));
    }
  };

  return (
    <RailCard title="Upcoming opportunities" onAction={() => router.push('/(tabs)/jobs' as any)} testID="rail-opportunities">
      <View style={styles.list}>
        {items.map(o => {
          const fresh = Date.now() - new Date(o.at).getTime() < NEW_WITHIN_DAYS * 86_400_000;
          const href = o.kind === 'job' ? `/(tabs)/jobs/${o.id}` : `/(tabs)/jobs/locum/${o.id}`;
          return (
            <View key={`${o.kind}-${o.id}`} style={styles.oppRow} testID={`rail-opp-${o.kind}-${o.id}`}>
              <Pressable onPress={() => router.push(href as any)} accessibilityRole="link"
                accessibilityLabel={`${o.title} at ${o.employer}`} style={styles.oppLink}>
                <Avatar name={o.employer} role="hospital" uri={o.avatar} size={40} />
                <View style={styles.rowText}>
                  <Text style={styles.rowTitle} numberOfLines={1}>{o.title}</Text>
                  <Text style={styles.rowMeta} numberOfLines={1}>{o.employer}</Text>
                  <Text style={styles.oppDetail} numberOfLines={1}>
                    {o.lead ? <Text style={styles.oppLead}>{o.lead}</Text> : null}
                    {o.lead && o.details.length ? '  ·  ' : ''}
                    {o.details.join('  ·  ')}
                  </Text>
                </View>
              </Pressable>
              <View style={styles.oppSide}>
                {fresh
                  ? <Text style={styles.newBadge}>New</Text>
                  : <Text style={styles.ago}>{timeAgo(o.at)}</Text>}
                {o.kind === 'job' ? (
                  <Pressable onPress={() => toggleSave(o.id)} accessibilityRole="button" hitSlop={8}
                    accessibilityLabel={o.saved ? `Unsave ${o.title}` : `Save ${o.title}`}
                    accessibilityState={{ selected: o.saved }} testID={`rail-save-${o.id}`}>
                    <Ionicons name={o.saved ? 'bookmark' : 'bookmark-outline'} size={17}
                      color={o.saved ? colors.teal : colors.textSubtle} />
                  </Pressable>
                ) : null}
              </View>
            </View>
          );
        })}
      </View>
    </RailCard>
  );
}

const styles = StyleSheet.create({
  // -- Premium: the AED anchor ------------------------------------------------
  aedCard: {
    borderRadius: radius.card, overflow: 'hidden', padding: spacing.xl, gap: spacing.sm,
    ...(Platform.OS === 'web' ? ({ boxShadow: '0 12px 28px -12px rgba(15,23,42,0.55)' } as object) : shadow.card),
  },
  aedMark: { position: 'absolute', right: -18, bottom: -26 },
  aedTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm },
  aedLive: {
    flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: spacing.sm + 2, paddingVertical: 3,
    borderRadius: radius.pill, backgroundColor: 'rgba(16,185,129,0.14)', borderWidth: 1, borderColor: 'rgba(16,185,129,0.32)',
  },
  aedDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: '#34D399' },
  aedLiveText: { fontSize: 11, fontFamily: fonts.body.bold, color: '#6EE7B7' },
  aedMono: {
    fontSize: 9, letterSpacing: 0.8, color: 'rgba(148,163,184,0.85)',
    fontFamily: Platform.OS === 'web' ? 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace' : undefined,
  },
  aedTitle: { fontSize: 18, lineHeight: 24, fontFamily: fonts.heading.bold, color: colors.white, marginTop: spacing.xs },
  aedBody: { fontSize: 13, lineHeight: 19, fontFamily: fonts.body.regular, color: '#CBD5E1' },
  aedCta: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, height: 42, marginTop: spacing.xs,
    borderRadius: radius.pill, backgroundColor: colors.action,
  },
  aedCtaHover: { backgroundColor: '#0D9488' },
  aedCtaText: { fontSize: 13, fontFamily: fonts.body.bold, color: colors.white },
  wrap: { gap: spacing.lg },
  kycCard: {
    backgroundColor: colors.warningBg,
    borderWidth: 1,
    borderColor: '#FDE68A',
    borderRadius: radius.lg,
    padding: spacing.lg,
    gap: spacing.sm,
  },
  kycCardReview: { backgroundColor: colors.bgMuted, borderColor: colors.border },
  kycCardRejected: { backgroundColor: colors.redBg, borderColor: '#FECACA' },
  kycHead: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  kycTitle: { ...typography.label, color: colors.warning },
  kycBody: { ...typography.caption, color: colors.textSecondary, lineHeight: 19 },
  kycCta: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, paddingVertical: spacing.xs },
  kycCtaHover: { opacity: 0.7 },
  kycCtaText: { ...typography.label, color: colors.warning },

  list: { paddingBottom: spacing.sm },
  rowHover: { backgroundColor: colors.bgMuted },
  rowText: { flex: 1, minWidth: 0 },
  rowTitle: { ...typography.caption, fontFamily: fonts.body.semibold, color: colors.text, flexShrink: 1 },
  rowMeta: { ...typography.small, color: colors.textSecondary, marginTop: 1 },

  trendRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingHorizontal: spacing.lg, paddingVertical: spacing.sm },
  marker: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  markerText: { fontSize: 13, fontFamily: fonts.body.semibold },

  personRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingHorizontal: spacing.lg, paddingVertical: spacing.sm + 2 },
  personLink: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  personActions: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  dismiss: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  dismissHover: { backgroundColor: colors.bgMuted },

  oppRow: {
    flexDirection: 'row', gap: spacing.sm, paddingHorizontal: spacing.lg, paddingVertical: spacing.md,
    borderTopWidth: 1, borderTopColor: colors.borderLight,
  },
  oppLink: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  oppDetail: { ...typography.small, color: colors.textSecondary, marginTop: 3 },
  oppLead: { fontFamily: fonts.body.semibold, color: colors.teal },
  newBadge: {
    fontSize: 11, fontFamily: fonts.body.semibold, color: colors.teal, backgroundColor: colors.tealBg,
    paddingHorizontal: 7, paddingVertical: 1, borderRadius: radius.pill, overflow: 'hidden',
  },
  oppSide: { alignItems: 'flex-end', justifyContent: 'space-between', gap: spacing.sm, alignSelf: 'stretch', paddingVertical: 1 },
  ago: { ...typography.small, color: colors.textSecondary },

  footer: { paddingHorizontal: spacing.xs, gap: spacing.xs },
  footerLink: { alignSelf: 'flex-start', paddingVertical: 2 },
  footerText: { ...typography.small, color: colors.textSecondary },
  // textMuted reaches only 2.5:1 on the page background — legible enough for a
  // placeholder, not for a line of standing text.
  footerBrand: { ...typography.small, color: colors.textSecondary, marginTop: spacing.xs },
});

export const railShadow = shadow.card;
