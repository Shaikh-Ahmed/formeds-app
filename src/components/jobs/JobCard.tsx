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
 * Memoised because the list re-renders on every keystroke of the search box and
 * a job card is not cheap to lay out.
 */
export const JobCard = React.memo(function JobCard({
  item, onPress, onToggleSave, selected = false, compact = false,
}: Props) {
  const pay = formatPay(item);
  const experience = formatExperience(item);
  const shiftDates = formatShiftDates(item);
  const skills = item.skills?.slice(0, MAX_SKILL_CHIPS) ?? [];
  const extraSkills = Math.max((item.skills?.length ?? 0) - MAX_SKILL_CHIPS, 0);

  // The save toggle can't be a Pressable nested inside the card's own
  // Pressable: react-native-web renders `accessibilityRole="button"` as a
  // literal <button>, and a <button> cannot legally contain another
  // <button> — browsers un-nest it, which breaks click targeting and trips
  // up screen readers. So it renders as a sibling, absolutely positioned
  // over the same top-right corner it always occupied; `titleBlockWithSave`
  // reserves the space under it that the old flex row used to.
  return (
    <View style={styles.cardWrap}>
      <Pressable
        testID={`job-card-${item.id}`}
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={
          `${item.title} at ${item.employer_name}. ` +
          `${formatTypeLine(item)}. ${item.location || 'Location not stated'}. ` +
          `${pay ? pay + '. ' : ''}${postedAgo(item.created_at)}.`
        }
        style={({ pressed }) => [
          styles.card,
          compact && styles.cardCompact,
          selected && styles.cardSelected,
          pressed && styles.cardPressed,
        ]}
      >
        <View style={styles.topRow}>
          <View style={[styles.titleBlock, onToggleSave && styles.titleBlockWithSave]}>
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
          </View>
        </View>

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

        <View style={styles.footer}>
          <Text style={styles.posted}>{postedAgo(item.created_at)}</Text>
          {item.has_applied ? (
            <View style={styles.applied}>
              <Ionicons name="checkmark-circle" size={14} color={colors.teal} />
              <Text style={styles.appliedText}>Applied</Text>
            </View>
          ) : item.applicant_count > 0 ? (
            <Text style={styles.posted}>
              {item.applicant_count} {item.applicant_count === 1 ? 'applicant' : 'applicants'}
            </Text>
          ) : null}
        </View>
      </Pressable>

      {onToggleSave ? (
        <Pressable
          testID={`job-save-${item.id}`}
          onPress={() => onToggleSave(item)}
          accessibilityRole="button"
          accessibilityLabel={item.saved ? `Remove ${item.title} from saved` : `Save ${item.title}`}
          accessibilityState={{ selected: item.saved }}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          style={({ pressed }) => [
            styles.saveBtn,
            compact ? styles.saveBtnCompact : styles.saveBtnRegular,
            pressed && styles.savePressed,
          ]}
        >
          <Ionicons
            name={item.saved ? 'bookmark' : 'bookmark-outline'}
            size={20}
            color={item.saved ? colors.navy : colors.textSecondary}
          />
        </Pressable>
      ) : null}
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

  // Position-only wrapper: `card` carries the actual visual shell (border,
  // radius, padding), so the save button below has something to anchor an
  // absolute position against without doubling up the shell itself.
  cardWrap: { position: 'relative' },

  topRow: { flexDirection: 'row', alignItems: 'flex-start' },
  titleBlock: { flex: 1, gap: spacing.xs },
  // Reserves the same space the save button used to occupy as a flex
  // sibling (its 44px width plus the row's old gap), so the title still
  // wraps clear of it now that it floats above the layout instead.
  titleBlockWithSave: { paddingRight: MIN_TOUCH_TARGET + spacing.sm },
  title: { ...typography.h3, color: colors.text },
  employerRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs + 2 },
  employer: { ...typography.caption, color: colors.textSecondary, flexShrink: 1 },

  saveBtn: {
    position: 'absolute',
    width: MIN_TOUCH_TARGET,
    height: MIN_TOUCH_TARGET,
    alignItems: 'flex-end',
    justifyContent: 'flex-start',
  },
  // Matches each card variant's own padding, so the icon lands exactly
  // where it always sat as a flex child inside that padding.
  saveBtnRegular: { top: spacing.lg, right: spacing.lg },
  saveBtnCompact: { top: spacing.md + 2, right: spacing.md + 2 },
  savePressed: { backgroundColor: colors.bgMuted, borderRadius: radius.sm },

  metaRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md, rowGap: spacing.xs },
  pay: { ...typography.bodyStrong, color: colors.text },
  payHidden: { ...typography.caption, color: colors.textSecondary, fontStyle: 'italic' },

  badgeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  skillRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs + 2 },

  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
    marginTop: spacing.xs,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.borderLight,
  },
  posted: { ...typography.small, color: colors.textSecondary },
  applied: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  appliedText: { ...typography.small, fontFamily: fonts.body.semibold, color: colors.teal },
});
