import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, fonts, radius, shadow, spacing, typography, MIN_TOUCH_TARGET } from '../../../theme';
import { Avatar } from '../../Avatar';
import { Skeleton } from '../../Skeleton';
import { ScreeningAnswersView } from '../Screening';
import { ResumeViewer } from './ResumeViewer';
import { StatusBadge, verifiedLabel } from './ApplicantList';
import { APPLICATION_STATUS_META, type ApplicationStatusKey } from '../../../types/jobs';
import { INTERVIEW_MODE_LABELS, type ApplicantDetail as Detail, type TimelineEvent } from '../../../types/applicants';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function when(iso?: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const today = new Date();
  const days = Math.floor((new Date(today.toDateString()).getTime() - new Date(d.toDateString()).getTime()) / 86400000);
  if (days === 0) return 'Today';
  if (days === 1) return 'Yesterday';
  return `${d.getDate()} ${MONTHS[d.getMonth()]}${d.getFullYear() !== today.getFullYear() ? ` ${d.getFullYear()}` : ''}`;
}

function clock(iso: string): string {
  const d = new Date(iso);
  const h = d.getHours();
  return `${h % 12 === 0 ? 12 : h % 12}:${String(d.getMinutes()).padStart(2, '0')} ${h >= 12 ? 'PM' : 'AM'}`;
}

/** "Mar 2021 – Present", from YYYY-MM values. */
function monthRange(start?: string, end?: string, current?: boolean): string {
  const fmt = (v?: string) => {
    if (!v) return '';
    const [y, m] = v.split('-').map(Number);
    return m ? `${MONTHS[m - 1]} ${y}` : String(y);
  };
  const a = fmt(start);
  const b = current ? 'Present' : fmt(end);
  return [a, b].filter(Boolean).join(' – ');
}

const EVENT_TEXT: Record<TimelineEvent['event'], (e: TimelineEvent) => string> = {
  applied: () => 'Application submitted',
  viewed: () => 'Application first opened by your team',
  status_changed: e => `Moved to ${e.to_status ? APPLICATION_STATUS_META[e.to_status].label : 'a new stage'}`,
  interview_scheduled: () => 'Interview scheduled',
  resume_viewed: () => 'Resume viewed',
  withdrawn: () => 'Applicant withdrew',
};

export function ApplicantDetailPanel({
  detail, loading, error, onRetry, onBack, onMessage, onMove, onInterview, onMore, busy,
}: {
  detail: Detail | null; loading: boolean; error: string | null; onRetry: () => void;
  /** Phone: back to the list. */
  onBack?: () => void;
  onMessage: () => void;
  onMove: (s: ApplicationStatusKey) => void;
  onInterview: () => void;
  onMore: () => void;
  busy?: boolean;
}) {
  if (error && !detail) {
    return (
      <View style={styles.center}>
        {onBack ? <BackLink onBack={onBack} /> : null}
        <Text style={styles.centerTitle}>Unable to load this applicant.</Text>
        <Pressable onPress={onRetry} accessibilityRole="button" style={styles.textBtn}><Text style={styles.link}>Try again</Text></Pressable>
      </View>
    );
  }
  if (loading || !detail) {
    return (
      <View style={{ padding: spacing.xl, gap: spacing.lg }} testID="applicant-detail-loading">
        {onBack ? <BackLink onBack={onBack} /> : null}
        <View style={{ flexDirection: 'row', gap: spacing.lg, alignItems: 'center' }}>
          <Skeleton width={72} height={72} radius={36} />
          <View style={{ flex: 1, gap: 8 }}><Skeleton width="50%" height={20} /><Skeleton width="70%" height={14} /></View>
        </View>
        <Skeleton height={120} radius={radius.lg} />
        <Skeleton height={220} radius={radius.lg} />
      </View>
    );
  }

  const { application: app, applicant: p, screening, resume, timeline } = detail;
  const verified = verifiedLabel(p);
  const allowed = app.allowed_moves;
  const e = p.entries || {};
  const experience = e.experience || [];
  const education = e.education || [];
  const certifications = e.certification || [];
  const registrations = e.registration || [];
  const skills = Object.values(p.skills || {}).flat().filter(Boolean);
  const expertise = p.areas_of_expertise || [];
  const openTo = p.availability?.open_to || [];

  return (
    <ScrollView contentContainerStyle={styles.scroll} testID="applicant-detail">
      {onBack ? <BackLink onBack={onBack} /> : null}

      {/* ── Who, at a glance ── */}
      <View style={styles.card}>
        <View style={styles.head}>
          <Avatar name={p.name} uri={p.avatar} role={p.role} size={64} />
          <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
            <Text style={styles.name} accessibilityRole="header" testID="applicant-name">{p.name}</Text>
            {verified ? (
              <View style={styles.verified}>
                <Ionicons name="shield-checkmark" size={14} color={colors.teal} />
                <Text style={styles.verifiedText}>{verified}</Text>
              </View>
            ) : (
              <Text style={styles.muted}>Not yet verified on ForMeds</Text>
            )}
            {p.headline ? <Text style={styles.headline}>{p.headline}</Text> : null}
            <Text style={styles.facts}>
              {[p.professional_role, p.primary_specialization || p.specialty, p.city,
                p.years_experience ? `${p.years_experience} yrs experience` : null].filter(Boolean).join(' · ')}
            </Text>
          </View>
        </View>
        <View style={styles.statusRow}>
          <StatusBadge status={app.status} />
          <Text style={styles.muted}>Applied {when(app.created_at).toLowerCase()}</Text>
          {screening ? (
            <Text style={[styles.muted, screening.summary.unmet ? { color: colors.warning } : null]}>
              {screening.summary.answered}/{screening.summary.total} screening answered
            </Text>
          ) : null}
        </View>
        <View style={styles.actions}>
          <Action primary icon="chatbubble-ellipses-outline" label="Message" onPress={onMessage} testID="applicant-message" />
          {allowed.includes('shortlisted') ? (
            <Action icon="star-outline" label="Shortlist" onPress={() => onMove('shortlisted')} disabled={busy}
              testID="applicant-shortlist" />
          ) : null}
          {!['withdrawn', 'hired', 'rejected'].includes(app.status) ? (
            <Action icon="calendar-outline" label={app.interview ? 'Reschedule' : 'Interview'} onPress={onInterview}
              testID="applicant-interview" />
          ) : null}
          {allowed.length ? (
            <Action icon="git-branch-outline" label="Change status" onPress={() => onMove('__menu' as any)} disabled={busy}
              testID="applicant-status" />
          ) : null}
          <Action icon="ellipsis-horizontal" label="More" onPress={onMore} testID="applicant-more-actions" iconOnly />
        </View>
        {app.status === 'withdrawn' ? (
          <Text style={styles.note}>This applicant withdrew. Their application is kept for your records.</Text>
        ) : null}
      </View>

      {/* ── The application ── */}
      {app.interview || app.cover_note ? (
        <Section title="Application">
          {app.interview ? (
            <View style={styles.interview} testID="applicant-interview-card">
              <Ionicons name="calendar" size={18} color={colors.navy} />
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={styles.strong}>
                  Interview · {when(app.interview.interview_at)} at {clock(app.interview.interview_at)}
                </Text>
                <Text style={styles.muted}>
                  {INTERVIEW_MODE_LABELS[app.interview.interview_mode]}
                  {app.interview.interview_location ? ` · ${app.interview.interview_location}` : ''}
                </Text>
                {app.interview.notes ? <Text style={styles.privateNote}>Note (private): {app.interview.notes}</Text> : null}
              </View>
            </View>
          ) : null}
          {app.cover_note ? (
            <View style={{ gap: 4 }}>
              <Text style={styles.label}>Note from the applicant</Text>
              <Text style={styles.body}>{app.cover_note}</Text>
            </View>
          ) : null}
        </Section>
      ) : null}

      {screening ? (
        <Section title="Screening questions">
          <ScreeningAnswersView answers={screening.answers} summary={screening.summary} />
        </Section>
      ) : null}

      <Section title="Resume">
        <ResumeViewer applicationId={app.id} available={resume.available} name={resume.name} size={resume.size} />
      </Section>

      {/* ── The professional ── */}
      <Section title="Professional profile">
        {p.about ? <Text style={styles.body}>{p.about}</Text> : null}
        {registrations.length ? (
          <Group title="Registration">
            {registrations.map(r => (
              <EntryRow key={r.id} icon="ribbon-outline" title={String(r.data.council || 'Medical registration')}
                sub={[r.data.state, r.data.issue_date ? `since ${monthRange(r.data.issue_date)}` : ''].filter(Boolean).join(' · ')}
                verified={r.verification_status === 'verified'} />
            ))}
          </Group>
        ) : null}
        {education.length ? (
          <Group title="Qualifications">
            {education.map(ed => (
              <EntryRow key={ed.id} icon="school-outline" title={[ed.data.degree, ed.data.field_of_study].filter(Boolean).join(', ')}
                sub={[ed.data.institution, [ed.data.start_year, ed.data.end_year].filter(Boolean).join(' – ')].filter(Boolean).join(' · ')}
                verified={ed.verification_status === 'verified'} />
            ))}
          </Group>
        ) : null}
        {experience.length ? (
          <Group title="Experience">
            {experience.map(x => (
              <EntryRow key={x.id} icon="briefcase-outline" title={String(x.data.title || '')}
                sub={[x.data.organization, monthRange(x.data.start_date, x.data.end_date, x.data.is_current)].filter(Boolean).join(' · ')}
                verified={x.verification_status === 'verified'} />
            ))}
          </Group>
        ) : null}
        {certifications.length ? (
          <Group title="Certifications">
            {certifications.map(c => (
              <EntryRow key={c.id} icon="medal-outline" title={String(c.data.name || '')}
                sub={[c.data.issuer, c.data.expiry_date ? `expires ${monthRange(c.data.expiry_date)}` : ''].filter(Boolean).join(' · ')}
                verified={c.verification_status === 'verified'} />
            ))}
          </Group>
        ) : null}
        {expertise.length || skills.length ? (
          <Group title="Expertise and skills">
            <View style={styles.chips}>
              {[...expertise, ...skills].slice(0, 24).map(s => <View key={s} style={styles.chip}><Text style={styles.chipText}>{s}</Text></View>)}
            </View>
          </Group>
        ) : null}
        {openTo.length ? (
          <Group title="Open to">
            <Text style={styles.body}>{openTo.map(o => o.replace('_', ' ')).join(', ')}
              {p.availability?.note ? ` · ${p.availability.note}` : ''}</Text>
          </Group>
        ) : null}
        {!p.about && !registrations.length && !education.length && !experience.length && !certifications.length
          && !skills.length && !expertise.length ? (
            <Text style={styles.muted}>This applicant has not filled in their profile yet, or keeps it private.</Text>
          ) : null}
      </Section>

      <Section title="Application timeline">
        {timeline.map((t, i) => (
          <View key={i} style={styles.tl} testID={`timeline-${t.event}`}>
            <View style={styles.tlDotCol}>
              <View style={[styles.tlDot, i === 0 && styles.tlDotOn]} />
              {i < timeline.length - 1 ? <View style={styles.tlLine} /> : null}
            </View>
            <View style={{ flex: 1, paddingBottom: spacing.md }}>
              <Text style={styles.strong}>{EVENT_TEXT[t.event](t)}</Text>
              <Text style={styles.muted}>{when(t.created_at)} · {clock(t.created_at)}</Text>
            </View>
          </View>
        ))}
      </Section>
    </ScrollView>
  );
}

function BackLink({ onBack }: { onBack: () => void }) {
  return (
    <Pressable onPress={onBack} accessibilityRole="button" style={styles.back} testID="applicant-back">
      <Ionicons name="arrow-back" size={20} color={colors.navy} />
      <Text style={styles.link}>Back to applicants</Text>
    </Pressable>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.card}>
      <Text style={styles.sectionTitle} accessibilityRole="header">{title}</Text>
      <View style={{ gap: spacing.md }}>{children}</View>
    </View>
  );
}

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return <View style={{ gap: spacing.sm }}><Text style={styles.label}>{title}</Text>{children}</View>;
}

function EntryRow({ icon, title, sub, verified }: {
  icon: keyof typeof Ionicons.glyphMap; title: string; sub?: string; verified?: boolean;
}) {
  return (
    <View style={styles.entry}>
      <View style={styles.entryIcon}><Ionicons name={icon} size={16} color={colors.navy} /></View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
          <Text style={styles.strong}>{title}</Text>
          {verified ? (
            <View style={styles.entryVerified}>
              <Ionicons name="checkmark-circle" size={12} color={colors.teal} />
              <Text style={styles.entryVerifiedText}>Verified</Text>
            </View>
          ) : null}
        </View>
        {sub ? <Text style={styles.muted}>{sub}</Text> : null}
      </View>
    </View>
  );
}

function Action({ icon, label, onPress, primary, disabled, iconOnly, testID }: {
  icon: keyof typeof Ionicons.glyphMap; label: string; onPress: () => void; primary?: boolean; disabled?: boolean;
  iconOnly?: boolean; testID?: string;
}) {
  return (
    <Pressable onPress={onPress} disabled={disabled} accessibilityRole="button" accessibilityLabel={label} testID={testID}
      style={({ pressed, hovered }: any) => [styles.action, primary && styles.actionPrimary, iconOnly && styles.actionIcon,
        hovered && !primary && styles.actionHover, (pressed || disabled) && { opacity: 0.7 }]}>
      <Ionicons name={icon} size={17} color={primary ? colors.white : colors.navy} />
      {iconOnly ? null : <Text style={[styles.actionText, primary && { color: colors.white }]}>{label}</Text>}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  scroll: { padding: spacing.lg, gap: spacing.md, paddingBottom: spacing.xxxl * 2 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.sm, padding: spacing.xxl },
  centerTitle: { ...typography.bodyStrong, color: colors.text },
  textBtn: { minHeight: 40, justifyContent: 'center' },
  back: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, minHeight: MIN_TOUCH_TARGET, alignSelf: 'flex-start' },
  link: { ...typography.label, color: colors.navy },
  card: {
    backgroundColor: colors.white, borderRadius: radius.xl, borderWidth: 1, borderColor: colors.border,
    padding: spacing.xl, gap: spacing.md, ...shadow.card,
  },
  head: { flexDirection: 'row', gap: spacing.lg, alignItems: 'flex-start' },
  name: { ...typography.h2, color: colors.text },
  verified: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  verifiedText: { ...typography.caption, fontFamily: fonts.body.semibold, color: colors.teal },
  headline: { ...typography.body, color: colors.text, marginTop: 2 },
  facts: { ...typography.caption, color: colors.textSecondary },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, flexWrap: 'wrap' },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  action: {
    flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 42, paddingHorizontal: spacing.lg,
    borderRadius: radius.pill, borderWidth: 1, borderColor: colors.navy, backgroundColor: colors.white,
  },
  actionPrimary: { backgroundColor: colors.navy },
  actionIcon: { paddingHorizontal: spacing.md },
  actionHover: { backgroundColor: colors.bgMuted },
  actionText: { ...typography.label, color: colors.navy },
  note: { ...typography.caption, color: colors.textSecondary },
  sectionTitle: { ...typography.h3, color: colors.navy },
  label: { ...typography.overline, color: colors.teal },
  body: { ...typography.body, color: colors.text, lineHeight: 22 },
  strong: { ...typography.bodyStrong, color: colors.text },
  muted: { ...typography.caption, color: colors.textSecondary },
  privateNote: { ...typography.caption, color: colors.textSecondary, fontStyle: 'italic', marginTop: 2 },
  interview: {
    flexDirection: 'row', gap: spacing.md, padding: spacing.md, borderRadius: radius.lg, backgroundColor: colors.bgMuted,
  },
  entry: { flexDirection: 'row', gap: spacing.md, alignItems: 'flex-start' },
  entryIcon: {
    width: 32, height: 32, borderRadius: radius.md, backgroundColor: colors.bgMuted, alignItems: 'center', justifyContent: 'center',
  },
  entryVerified: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  entryVerifiedText: { ...typography.small, color: colors.teal },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  chip: { paddingHorizontal: spacing.sm + 2, paddingVertical: 4, borderRadius: radius.pill, backgroundColor: colors.bgMuted },
  chipText: { ...typography.small, color: colors.text },
  tl: { flexDirection: 'row', gap: spacing.md },
  tlDotCol: { alignItems: 'center', width: 12 },
  tlDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.border, marginTop: 5 },
  tlDotOn: { backgroundColor: colors.navy },
  tlLine: { flex: 1, width: 2, backgroundColor: colors.borderLight, marginTop: 2 },
});
