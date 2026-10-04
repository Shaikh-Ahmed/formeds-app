import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, radius, spacing, typography, fonts, MIN_TOUCH_TARGET } from '../../theme';
import { postedAgo } from '../../utils/time';
import { Avatar } from '../Avatar';
import { Chip } from '../Chip';
import {
  JobBadge, MetaItem, formatExperience, formatPay, formatShiftDates, formatTypeLine,
} from './JobMeta';
import { EMPLOYMENT_TYPE_LABELS, isShiftRole, type Job } from '../../types/jobs';

interface Props {
  item: Job;
  onPress: () => void;
  onToggleSave?: (job: Job) => void;
  /** Share the posting. Shown when given. */
  onShare?: (job: Job) => void;
  /** Open the apply sheet from the card. Shown only when the job can be applied to. */
  onQuickApply?: (job: Job) => void;
  /** Marks the row selected in the desktop split view. */
  selected?: boolean;
  /** Trims the card for the narrow list pane beside a detail panel. */
  compact?: boolean;
}

const MAX_SKILL_CHIPS = 3;

/**
 * One row in the jobs list.
 *
 * Ordered by what a clinician actually scans for, in this order: the role, who
 * is offering it, where, and only then the terms. The old card led with an icon
 * and gave the title the same weight as the hospital name, which meant three
 * cards from the same hospital were indistinguishable at a glance.
 *
 * Deliberately restrained on badges. Every posting has an employment type and a
 * work mode, so rendering those as badges would put two pills on every card and
 * make the genuinely exceptional ones — urgent cover, a verified institution —
 * invisible. They are a plain text line; badges are reserved for the exceptions.
 *
 * The card's own tap target sits BEHIND the content, and Save / Share / Quick
 * apply sit beside it rather than inside it: a button nested in a button is
 * invalid HTML on the web and ambiguous to a screen reader.
 *
 * Memoised because the list re-renders on every keystroke of the search box and
 * a job card is not cheap to lay out.
 */
export const JobCard = React.memo(function JobCard({
  item, onPress, onToggleSave, onShare, onQuickApply, selected = false, compact = false,
}: Props) {
  const pay = formatPay(item);
  const experience = formatExperience(item);
  const shiftDates = formatShiftDates(item);
  const skills = item.skills?.slice(0, MAX_SKILL_CHIPS) ?? [];
  const extraSkills = Math.max((item.skills?.length ?? 0) - MAX_SKILL_CHIPS, 0);
  const canQuickApply = !!onQuickApply && !item.has_applied && !item.can_manage && item.status === 'active';

  return (
    <View style={[styles.card, compact && styles.cardCompact, selected && styles.cardSelected]}>
      <Pressable
        testID={`job-card-${item.id}`}
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={
          `${item.title} at ${item.employer_name}. ` +
          `${formatTypeLine(item)}. ${item.location || 'Location not stated'}. ` +
          `${pay ? pay + '. ' : ''}${postedAgo(item.created_at)}.`
        }
        style={({ pressed, hovered }: any) => [
          styles.hit,
          (pressed || hovered) && !selected && styles.cardPressed,
        ]}
      />

      <View style={styles.topRow} pointerEvents="box-none">
        <View style={styles.titleBlock} pointerEvents="none">
          <Text style={styles.title} numberOfLines={2}>{item.title}</Text>

          <View style={styles.employerRow}>
            <Avatar
              name={item.employer_name}
              uri={item.employer_avatar || undefined}
              role={item.poster_role || undefined}
              size={20}
            />
            <Text style={styles.employer} numberOfLines={1}>{item.employer_name}</Text>
            {item.employer_verified ? (
              <Ionicons
                name="checkmark-circle"
                size={14}
                color={colors.teal}
                // The tick is a claim, so it is announced rather than decorative.
                accessibilityLabel="Verified organisation"
              />
            ) : null}
          </View>
          {item.posted_by_recruiter ? (
            <Text style={styles.client} numberOfLines={1} testID={`job-client-${item.id}`}>
              {item.client_name ? `Recruiter posting · For: ${item.client_name}`
                : item.client_confidential ? 'Recruiter posting · For: Confidential client' : 'Recruiter posting'}
            </Text>
          ) : null}
        </View>

        {onToggleSave ? (
          <Pressable
            testID={`job-save-${item.id}`}
            onPress={() => onToggleSave(item)}
            accessibilityRole="button"
            accessibilityLabel={item.saved ? `Remove ${item.title} from saved` : `Save ${item.title}`}
            accessibilityState={{ selected: item.saved }}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            style={({ pressed }) => [styles.saveBtn, pressed && styles.iconPressed]}
          >
            <Ionicons
              name={item.saved ? 'bookmark' : 'bookmark-outline'}
              size={20}
              color={item.saved ? colors.navy : colors.textSecondary}
            />
          </Pressable>
        ) : null}
      </View>

      <View pointerEvents="none" style={styles.body}>
        <View style={styles.metaRow}>
          {item.location ? <MetaItem icon="location-outline" text={item.location} /> : null}
          <MetaItem icon="briefcase-outline" text={formatTypeLine(item)} />
          {experience ? <MetaItem icon="time-outline" text={experience} /> : null}
        </View>

        {shiftDates ? (
          <View style={styles.metaRow}>
            <MetaItem icon="calendar-outline" text={shiftDates} />
            {item.shift_time ? <MetaItem icon="moon-outline" text={item.shift_time} /> : null}
          </View>
        ) : null}

        {pay ? (
          <Text style={styles.pay}>{pay}</Text>
        ) : (
          <Text style={styles.payHidden}>Pay not disclosed</Text>
        )}

        {(item.is_urgent || isShiftRole(item.employment_type)) && !compact ? (
          <View style={styles.badgeRow}>
            {item.is_urgent ? (
              <JobBadge label="Urgent" icon="alert-circle" tone="danger" />
            ) : null}
            {isShiftRole(item.employment_type) ? (
              <JobBadge
                label={EMPLOYMENT_TYPE_LABELS[item.employment_type]}
                icon="flash-outline"
                tone="teal"
              />
            ) : null}
          </View>
        ) : null}

        {skills.length && !compact ? (
          <View style={styles.skillRow}>
            {skills.map(s => <Chip key={s} label={s} tone="neutral" />)}
            {extraSkills ? <Chip label={`+${extraSkills} more`} tone="neutral" /> : null}
          </View>
        ) : null}
      </View>

      <View style={styles.footer} pointerEvents="box-none">
        <View style={styles.footerInfo} pointerEvents="none">
          <Text style={styles.posted}>{postedAgo(item.created_at)}</Text>
          {!item.has_applied && item.applicant_count > 0 ? (
            <Text style={styles.posted}>
              · {item.applicant_count} {item.applicant_count === 1 ? 'applicant' : 'applicants'}
            </Text>
          ) : null}
        </View>
        <View style={styles.actions} pointerEvents="box-none">
          {onShare ? (
            <Pressable
              testID={`job-share-${item.id}`}
              onPress={() => onShare(item)}
              accessibilityRole="button"
              accessibilityLabel={`Share ${item.title}`}
              hitSlop={6}
              style={({ pressed, hovered }: any) => [styles.iconBtn, hovered && styles.iconHover, pressed && styles.iconPressed]}
            >
              <Ionicons name="share-social-outline" size={18} color={colors.navy} />
            </Pressable>
          ) : null}
          {item.has_applied ? (
            <View style={styles.applied} accessible accessibilityLabel="You have applied">
              <Ionicons name="checkmark-circle" size={14} color={colors.teal} />
              <Text style={styles.appliedText}>Applied</Text>
            </View>
          ) : canQuickApply ? (
            <Pressable
              testID={`job-quick-apply-${item.id}`}
              onPress={() => onQuickApply!(item)}
              accessibilityRole="button"
              accessibilityLabel={`Quick apply to ${item.title}`}
              style={({ pressed, hovered }: any) => [styles.quick, hovered && styles.quickHover, pressed && styles.iconPressed]}
            >
              <Ionicons name="flash" size={14} color={colors.white} />
              <Text style={styles.quickText}>Quick apply</Text>
            </Pressable>
          ) : null}
        </View>
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.card,
    borderRadius: radius.xl + 2,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    gap: spacing.sm,
  },
  cardCompact: { borderRadius: radius.lg, padding: spacing.md + 2, gap: spacing.xs + 2 },
  // A 2px left edge rather than a fill: the selected row has to read as
  // selected without changing how legible its text is.
  cardSelected: { borderColor: colors.navy, backgroundColor: '#EFF6FF' },
  cardPressed: { backgroundColor: colors.bgMuted },
  // The card's own tap target, filling it behind the content.
  hit: { ...StyleSheet.absoluteFillObject, borderRadius: radius.xl + 2 },
  body: { gap: spacing.sm },
  iconPressed: { opacity: 0.6 },

  topRow: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm },
  titleBlock: { flex: 1, gap: spacing.xs },
  title: { ...typography.h3, color: colors.text },
  employerRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs + 2 },
  employer: { ...typography.caption, color: colors.textSecondary, flexShrink: 1 },
  client: { ...typography.small, color: colors.recruiter, marginTop: 2 },

  saveBtn: {
    width: MIN_TOUCH_TARGET,
    height: MIN_TOUCH_TARGET,
    alignItems: 'flex-end',
    justifyContent: 'flex-start',
  },

  metaRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md, rowGap: spacing.xs },
  pay: { ...typography.bodyStrong, color: colors.text },
  payHidden: { ...typography.caption, color: colors.textSecondary, fontStyle: 'italic' },

  badgeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  skillRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs + 2 },

  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginTop: spacing.xs,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.borderLight,
  },
  footerInfo: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, flexShrink: 1 },
  posted: { ...typography.small, color: colors.textSecondary },
  actions: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginLeft: 'auto' },
  applied: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  appliedText: { ...typography.small, fontFamily: fonts.body.semibold, color: colors.teal },
  iconBtn: {
    width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: colors.border, backgroundColor: colors.white,
  },
  iconHover: { backgroundColor: colors.bgMuted },
  quick: {
    flexDirection: 'row', alignItems: 'center', gap: 4, minHeight: 36, paddingHorizontal: spacing.md,
    borderRadius: radius.pill, backgroundColor: colors.navy,
  },
  quickHover: { backgroundColor: colors.navyLight },
  quickText: { ...typography.label, color: colors.white },
});
