import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, radius, spacing, typography, MIN_TOUCH_TARGET } from '../../theme';
import { postedAgo } from '../../utils/time';
import { Avatar } from '../Avatar';
import { Chip } from '../Chip';
import { Button } from '../Button';
import { EmptyState } from '../States';
import { Skeleton, SkeletonText } from '../Skeleton';
import {
  JobBadge, MetaItem, formatExperience, formatPay, formatShiftDates, formatTypeLine,
} from './JobMeta';
import { EMPLOYMENT_TYPE_LABELS, type Job } from '../../types/jobs';

/**
 * The whole job page body, minus navigation.
 *
 * One component so the phone route and the desktop split pane cannot drift.
 * The alternative — a mobile screen and a desktop panel that happen to render
 * the same fields — is how a "View on desktop to see requirements" bug gets
 * shipped.
 *
 * The description is split into labelled sections rather than one prose block,
 * because that is how a job posting is actually read: nobody reads a job ad
 * top to bottom, they jump to Requirements and Compensation.
 */
export function JobDetailPanel({
  job,
  loading,
  onApply,
  onToggleSave,
  onShare,
  applying,
  /** Renders inside a split pane, which has its own scroll container. */
  embedded = false,
}: {
  job: Job | null;
  loading?: boolean;
  onApply: () => void;
  onToggleSave: () => void;
  onShare: () => void;
  applying?: boolean;
  embedded?: boolean;
}) {
  if (loading) return <JobDetailSkeleton />;

  if (!job) {
    return (
      <EmptyState
        icon="document-text-outline"
        title={embedded ? 'Select an opportunity' : 'Opportunity unavailable'}
        hint={
          embedded
            ? 'Pick a role from the list to see the full description here.'
            : 'This posting may have been closed or removed.'
        }
      />
    );
  }

  const pay = formatPay(job);
  const experience = formatExperience(job);
  const shiftDates = formatShiftDates(job);
  const closed = job.status !== 'active';

  return (
    <ScrollView
      style={styles.flex}
      contentContainerStyle={[styles.body, embedded && styles.bodyEmbedded]}
      showsVerticalScrollIndicator={false}
      testID="job-detail"
    >
      <View style={styles.header}>
        <Text style={styles.title} accessibilityRole="header">{job.title}</Text>

        <Pressable
          onPress={() => { /* organisation profiles arrive with the org phase */ }}
          disabled
          style={styles.employerRow}
        >
          <Avatar
            name={job.employer_name}
            uri={job.employer_avatar || undefined}
            role={job.poster_role || undefined}
            size={36}
          />
          <View style={styles.employerText}>
            <View style={styles.employerNameRow}>
              <Text style={styles.employerName} numberOfLines={1}>{job.employer_name}</Text>
              {job.employer_verified ? (
                <Ionicons
                  name="checkmark-circle"
                  size={15}
                  color={colors.teal}
                  accessibilityLabel="Verified organisation"
                />
              ) : null}
            </View>
            {job.location ? <Text style={styles.employerMeta}>{job.location}</Text> : null}
          </View>
        </Pressable>

        <View style={styles.badgeRow}>
          <JobBadge
            label={EMPLOYMENT_TYPE_LABELS[job.employment_type]}
            icon="briefcase-outline"
            tone="navy"
          />
          {job.is_urgent ? <JobBadge label="Urgent" icon="alert-circle" tone="danger" /> : null}
          {closed ? <JobBadge label="Closed" icon="lock-closed-outline" tone="neutral" /> : null}
          {job.has_applied ? (
            <JobBadge label="Applied" icon="checkmark-circle" tone="teal" />
          ) : null}
        </View>

        <Text style={styles.posted}>{postedAgo(job.created_at)}</Text>
      </View>

      {/* Desktop keeps the actions at the top of the panel; the phone route
          pins them to the bottom of the screen instead, within thumb reach. */}
      {embedded ? (
        <View style={styles.actionRow}>
          <Button
            label={job.has_applied ? 'Applied' : 'Apply now'}
            onPress={onApply}
            disabled={job.has_applied || closed}
            loading={applying}
            style={styles.applyBtn}
            testID="job-apply"
          />
          <IconAction
            icon={job.saved ? 'bookmark' : 'bookmark-outline'}
            label={job.saved ? 'Remove from saved' : 'Save this role'}
            active={job.saved}
            onPress={onToggleSave}
            testID="job-save"
          />
          <IconAction
            icon="share-social-outline"
            label="Share this role"
            onPress={onShare}
            testID="job-share"
          />
        </View>
      ) : null}

      <Section title="At a glance">
        <View style={styles.factGrid}>
          <MetaItem icon="briefcase-outline" text={formatTypeLine(job)} />
          {job.location ? <MetaItem icon="location-outline" text={job.location} /> : null}
          {experience ? <MetaItem icon="time-outline" text={experience} /> : null}
          {job.specialty ? <MetaItem icon="medical-outline" text={job.specialty} /> : null}
          {job.department ? <MetaItem icon="git-branch-outline" text={job.department} /> : null}
          {job.vacancies > 1 ? (
            <MetaItem icon="people-outline" text={`${job.vacancies} openings`} />
          ) : null}
          {shiftDates ? <MetaItem icon="calendar-outline" text={shiftDates} /> : null}
          {job.shift_time ? <MetaItem icon="moon-outline" text={job.shift_time} /> : null}
          {job.shift_duration ? (
            <MetaItem icon="hourglass-outline" text={job.shift_duration} />
          ) : null}
        </View>
      </Section>

      <Section title="Compensation">
        {pay ? (
          <Text style={styles.pay}>{pay}</Text>
        ) : (
          <Text style={styles.muted}>
            The employer has not published a figure. Ask when you apply.
          </Text>
        )}
      </Section>

      {job.description ? (
        <Section title="About the role">
          <Text style={styles.prose}>{job.description}</Text>
        </Section>
      ) : null}

      {job.responsibilities ? (
        <Section title="Key responsibilities">
          <Text style={styles.prose}>{job.responsibilities}</Text>
        </Section>
      ) : null}

      {job.requirements ? (
        <Section title="Requirements">
          <Text style={styles.prose}>{job.requirements}</Text>
        </Section>
      ) : null}

      {job.skills?.length ? (
        <Section title="Skills and competencies">
          <View style={styles.skillRow}>
            {job.skills.map(s => <Chip key={s} label={s} tone="teal" />)}
          </View>
        </Section>
      ) : null}

      <Section title="About the employer">
        <View style={styles.employerCard}>
          <Avatar
            name={job.employer_name}
            uri={job.employer_avatar || undefined}
            role={job.poster_role || undefined}
            size={44}
          />
          <View style={styles.employerText}>
            <Text style={styles.employerName}>{job.employer_name}</Text>
            <Text style={styles.employerMeta}>
              {job.employer_verified
                ? 'Verified healthcare organisation'
                : job.poster_role === 'healthcare_professional'
                  ? 'Posted by an individual professional'
                  : 'Healthcare employer'}
            </Text>
          </View>
        </View>
      </Section>

      {!embedded ? <View style={styles.bottomPad} /> : null}
    </ScrollView>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle} accessibilityRole="header">{title}</Text>
      {children}
    </View>
  );
}

function IconAction({
  icon, label, onPress, active, testID,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
  active?: boolean;
  testID?: string;
}) {
  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected: !!active }}
      style={({ pressed }) => [
        styles.iconAction, active && styles.iconActionActive, pressed && styles.pressed,
      ]}
    >
      <Ionicons name={icon} size={20} color={active ? colors.navy : colors.textSecondary} />
    </Pressable>
  );
}

function JobDetailSkeleton() {
  return (
    <View style={[styles.body, { gap: spacing.xl }]}>
      <Skeleton height={24} width="80%" />
      <View style={styles.employerRow}>
        <Skeleton height={36} width={36} radius={18} />
        <Skeleton height={12} width="45%" />
      </View>
      <Skeleton height={36} width="100%" radius={radius.xl} />
      <SkeletonText lines={4} />
      <SkeletonText lines={5} />
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  body: { padding: spacing.lg, gap: spacing.xl },
  bodyEmbedded: { padding: spacing.xl },

  header: { gap: spacing.md },
  title: { ...typography.h2, color: colors.text },
  employerRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  employerText: { flex: 1, gap: 2 },
  employerNameRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  employerName: { ...typography.bodyStrong, color: colors.text, flexShrink: 1 },
  employerMeta: { ...typography.caption, color: colors.textSecondary },
  badgeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  posted: { ...typography.small, color: colors.textSecondary },

  actionRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  applyBtn: { flex: 1 },
  iconAction: {
    width: MIN_TOUCH_TARGET,
    height: MIN_TOUCH_TARGET,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.white,
  },
  iconActionActive: { borderColor: colors.navy, backgroundColor: '#EFF6FF' },
  pressed: { opacity: 0.7 },

  section: { gap: spacing.sm },
  sectionTitle: { ...typography.overline, color: colors.teal },
  factGrid: { gap: spacing.sm },
  pay: { ...typography.h3, color: colors.text },
  muted: { ...typography.body, color: colors.textSecondary },
  // Line height is set here because no typography variant carries one, and
  // 15px prose at the default leading is unreadable at paragraph length.
  prose: { ...typography.body, color: colors.textSecondary, lineHeight: 23 },
  skillRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs + 2 },
  employerCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.lg,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.white,
  },
  bottomPad: { height: spacing.xxxl * 3 },
});
