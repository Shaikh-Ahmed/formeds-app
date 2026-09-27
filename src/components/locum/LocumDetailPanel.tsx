import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, radius, spacing, typography, fonts } from '../../theme';
import { postedAgo } from '../../utils/time';
import { Avatar } from '../Avatar';
import { Button } from '../Button';
import { EmptyState } from '../States';
import { Skeleton, SkeletonText } from '../Skeleton';
import { JobBadge } from '../jobs/JobMeta';
import {
  BADGE_TONE, formatDeadline, formatLocumPay, formatPlace, formatRoleLine,
  formatShiftDay, formatShiftHours,
} from './LocumMeta';
import {
  LOCUM_APPLICATION_META, LOCUM_SHIFT_LABELS, LOCUM_STATUS_META, type Locum,
} from '../../types/locum';

/**
 * Everything about one locum, minus navigation. One component for the phone
 * route and the desktop pane so they cannot drift apart.
 *
 * The facts are a grid of labelled values rather than prose: a clinician
 * checks date, hours, place and pay against their own week, and those have to
 * be findable at a glance. Requirements and notes follow as short sections,
 * and are omitted entirely when empty rather than rendered as "None".
 */
export function LocumDetailPanel({
  locum,
  loading,
  embedded = false,
  onApply,
  onWithdraw,
  onManage,
  onEdit,
  onViewOrganization,
  applyDisabledReason,
}: {
  locum: Locum | null;
  loading?: boolean;
  embedded?: boolean;
  onApply?: () => void;
  onWithdraw?: () => void;
  onManage?: () => void;
  onEdit?: () => void;
  onViewOrganization?: (orgId: string) => void;
  /** Why Apply is unavailable to this viewer, if it is. */
  applyDisabledReason?: string | null;
}) {
  if (loading) {
    return (
      <View style={styles.body}>
        <Skeleton height={22} width="60%" />
        <Skeleton height={14} width="40%" />
        <SkeletonText lines={4} />
      </View>
    );
  }
  if (!locum) {
    return (
      <EmptyState
        icon="flash-outline"
        title={embedded ? 'Select a locum' : 'Locum unavailable'}
        hint={embedded
          ? 'Pick a shift from the list to see its details here.'
          : 'This locum may have been cancelled or removed.'}
      />
    );
  }

  const status = LOCUM_STATUS_META[locum.status];
  // A withdrawn application can be revived by applying again, so it reads as
  // "not applied" here rather than as a dead end.
  const mine = locum.my_application?.status === 'withdrawn' ? null : locum.my_application;
  const mineMeta = mine ? LOCUM_APPLICATION_META[mine.status] : null;
  const filledLine = `${locum.filled_count} of ${locum.openings} filled`;

  return (
    <ScrollView
      style={styles.flex}
      contentContainerStyle={[styles.body, embedded && styles.bodyEmbedded]}
      showsVerticalScrollIndicator={false}
      testID="locum-detail"
    >
      <View style={styles.header}>
        <View style={styles.badges}>
          <JobBadge label={status.label} icon={status.icon as any} tone={BADGE_TONE[status.tone]} />
          {locum.shift_type === 'emergency' ? (
            <JobBadge label="Emergency" icon="alert-circle" tone="danger" />
          ) : (
            <JobBadge label={`${LOCUM_SHIFT_LABELS[locum.shift_type]} shift`} icon="time-outline" tone="navy" />
          )}
        </View>
        <Text style={styles.title} accessibilityRole="header">{formatRoleLine(locum)}</Text>

        <Pressable
          disabled={!locum.org_id || !onViewOrganization}
          onPress={() => locum.org_id && onViewOrganization?.(locum.org_id)}
          accessibilityRole={locum.org_id ? 'link' : undefined}
          style={({ pressed }) => [styles.employerRow, pressed && styles.pressed]}
        >
          <Avatar name={locum.employer_name} uri={locum.employer_avatar || undefined}
            role={locum.poster_role || undefined} size={28} />
          <Text style={styles.employer} numberOfLines={1}>{locum.employer_name}</Text>
          {locum.employer_verified ? (
            <Ionicons name="checkmark-circle" size={16} color={colors.teal}
              accessibilityLabel="Verified organisation" />
          ) : null}
        </Pressable>
      </View>

      <View style={styles.facts}>
        <Fact icon="calendar-outline" label="Date" value={formatShiftDay(locum.shift_date)} />
        <Fact icon="time-outline" label="Hours" value={formatShiftHours(locum)} />
        <Fact icon="location-outline" label="Location"
          value={[formatPlace(locum), locum.state].filter(Boolean).join(', ')} />
        <Fact icon="cash-outline" label="Compensation" value={formatLocumPay(locum)} />
        <Fact icon="people-outline" label="Openings"
          value={locum.openings_left ? `${locum.openings_left} open · ${filledLine}` : filledLine} />
        <Fact icon="hourglass-outline" label="Applications"
          value={formatDeadline(locum.apply_by) || '—'} />
      </View>

      {locum.experience_min || locum.qualifications || locum.requirements ? (
        <Section title="Requirements">
          {locum.experience_min ? (
            <Text style={styles.text}>{locum.experience_min}+ years of experience</Text>
          ) : null}
          {locum.qualifications ? <Text style={styles.text}>{locum.qualifications}</Text> : null}
          {locum.requirements ? <Text style={styles.text}>{locum.requirements}</Text> : null}
        </Section>
      ) : null}

      {locum.notes ? (
        <Section title="Notes from the hospital">
          <Text style={styles.text}>{locum.notes}</Text>
        </Section>
      ) : null}

      <Text style={styles.posted}>{postedAgo(locum.created_at)}</Text>

      {locum.can_manage ? (
        <View style={styles.actions}>
          {onManage ? (
            <Button
              label={`Manage applicants (${locum.applicant_count})`}
              onPress={onManage}
              style={styles.flex}
              testID="locum-manage"
            />
          ) : null}
          {onEdit && locum.status !== 'cancelled' ? (
            <Button label="Edit" variant="outline" onPress={onEdit} testID="locum-edit" />
          ) : null}
        </View>
      ) : mineMeta ? (
        <View style={styles.mine} testID="locum-my-status">
          <JobBadge label={mineMeta.label} icon={mineMeta.icon as any} tone={BADGE_TONE[mineMeta.tone]} />
          {mine?.interview_at && mine.status === 'interview_scheduled' ? (
            <Text style={styles.text}>
              Interview on {new Date(mine.interview_at).toLocaleString(undefined, {
                day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit',
              })}
            </Text>
          ) : null}
          {onWithdraw ? (
            <Pressable onPress={onWithdraw} accessibilityRole="button" testID="locum-withdraw"
              style={({ pressed }) => [styles.withdraw, pressed && styles.pressed]}>
              <Ionicons name="arrow-undo-outline" size={14} color={colors.textSecondary} />
              <Text style={styles.withdrawText}>Withdraw application</Text>
            </Pressable>
          ) : null}
        </View>
      ) : onApply ? (
        <View style={styles.applyBlock}>
          <Button
            label={locum.status === 'open' ? 'Apply for locum' : LOCUM_STATUS_META[locum.status].label}
            onPress={onApply}
            disabled={locum.status !== 'open' || !!applyDisabledReason}
            testID="locum-apply"
          />
          {applyDisabledReason ? <Text style={styles.hint}>{applyDisabledReason}</Text> : null}
        </View>
      ) : null}
    </ScrollView>
  );
}

function Fact({ icon, label, value }: { icon: keyof typeof Ionicons.glyphMap; label: string; value: string }) {
  return (
    <View style={styles.fact}>
      <Ionicons name={icon} size={18} color={colors.teal} />
      <View style={styles.factText}>
        <Text style={styles.factLabel}>{label}</Text>
        <Text style={styles.factValue}>{value}</Text>
      </View>
    </View>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={styles.overline}>{title}</Text>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  body: { padding: spacing.lg, paddingBottom: spacing.xxxl * 3, gap: spacing.lg },
  bodyEmbedded: { padding: spacing.xxl, paddingBottom: spacing.xxxl },
  header: { gap: spacing.sm },
  badges: { flexDirection: 'row', gap: spacing.sm, flexWrap: 'wrap' },
  title: { ...typography.h2, color: colors.text },
  employerRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  employer: { ...typography.bodyStrong, color: colors.textSecondary, flexShrink: 1 },
  pressed: { opacity: 0.65 },

  // Two columns of facts wherever there is room, one on a narrow phone.
  facts: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    rowGap: spacing.md,
    padding: spacing.lg,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.white,
  },
  fact: { flexDirection: 'row', gap: spacing.sm, flexBasis: 240, flexGrow: 1, paddingRight: spacing.md },
  factText: { flex: 1, gap: 2 },
  factLabel: { ...typography.small, color: colors.textSecondary },
  factValue: { ...typography.body, fontFamily: fonts.body.medium, color: colors.text },

  section: { gap: spacing.sm },
  overline: { ...typography.overline, color: colors.teal },
  text: { ...typography.body, color: colors.text, lineHeight: 22 },
  posted: { ...typography.small, color: colors.textSecondary },

  actions: { flexDirection: 'row', gap: spacing.md },
  applyBlock: { gap: spacing.sm },
  hint: { ...typography.small, color: colors.textSecondary },
  mine: {
    gap: spacing.sm,
    padding: spacing.lg,
    borderRadius: radius.xl,
    backgroundColor: colors.bgMuted,
  },
  withdraw: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, alignSelf: 'flex-start' },
  withdrawText: { ...typography.small, color: colors.textSecondary },
});
