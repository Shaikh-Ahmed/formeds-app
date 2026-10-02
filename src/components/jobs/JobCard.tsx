import React, { useEffect, useRef } from 'react';
import { useReducedMotion } from '../../hooks/useReducedMotion';
import { TrustMark } from '../TrustMark';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, radius, spacing, typography, fonts, shadow, isRefined, isMaterial, isPremium, motion, MIN_TOUCH_TARGET, gloss } from '../../theme';
import { Platform } from 'react-native';
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
    <View style={[styles.card, compact && styles.cardCompact, isRefined && styles.pCard, isPremium && styles.cCard,
      selected && styles.cardSelected]}>
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
          (pressed || hovered) && !selected && (isPremium ? styles.cHover : styles.cardPressed),
        ]}
      />

      <View style={styles.topRow} pointerEvents="box-none">
        <View style={styles.titleBlock} pointerEvents="none">
          {/* Premium: the specialty leads, as a crisp classification tag. */}
          {isPremium && item.specialty ? (
            <View style={styles.cSpecialty}>
              <Text style={styles.cSpecialtyText} numberOfLines={1}>{item.specialty}</Text>
            </View>
          ) : null}
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
              <TrustMark size={14} classicIcon="checkmark-circle" label="Verified organisation" />
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
            <SaveGlyph saved={!!item.saved} />
          </Pressable>
        ) : null}
      </View>

      <View pointerEvents="none" style={styles.body}>
        {/* Premium: compensation straight after who is offering it -- the
            spec's decision order -- and set to read before the metadata. */}
        {isRefined ? (pay ? (
          <View style={[styles.pPayRow, isMaterial && styles.mPayRow]}>
            <Ionicons name={isPremium ? 'cash-outline' : 'wallet-outline'} size={16}
              color={isMaterial || isPremium ? colors.teal : colors.navy} />
            <Text style={[styles.pPay, isPremium && styles.cPay]}>{pay}</Text>
          </View>
        ) : (
          <Text style={styles.payHidden}>Pay not disclosed</Text>
        )) : null}
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

        {isRefined ? null : pay ? (
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
          {isPremium && item.employer_verified ? (
            <Text style={styles.cVerifiedLine} numberOfLines={1}>Verified employer ·</Text>
          ) : null}
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
              <Ionicons name={isPremium ? 'paper-plane' : 'flash'} size={14} color={colors.white} />
              <Text style={styles.quickText}>Quick apply</Text>
            </Pressable>
          ) : null}
        </View>
      </View>
    </View>
  );
});

/**
 * The bookmark. In Premium, becoming saved gives a brief scale "pop" -- the
 * confirmation the spec asks for -- skipped under reduce-motion.
 */
function SaveGlyph({ saved }: { saved: boolean }) {
  const reduced = useReducedMotion();
  const scale = useRef(new Animated.Value(1)).current;
  const first = useRef(true);
  useEffect(() => {
    if (first.current) { first.current = false; return; }
    if (!isRefined || reduced || !saved) return;
    Animated.sequence([
      Animated.timing(scale, { toValue: 1.25, duration: motion.fast, useNativeDriver: true }),
      Animated.timing(scale, { toValue: 1, duration: motion.base, useNativeDriver: true }),
    ]).start();
  }, [saved, reduced, scale]);
  return (
    <Animated.View style={{ transform: [{ scale }] }}>
      <Ionicons
        name={saved ? 'bookmark' : 'bookmark-outline'}
        size={20}
        color={saved ? colors.navy : colors.textSecondary}
      />
    </Animated.View>
  );
}

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
  cardSelected: { borderColor: colors.primaryFill, backgroundColor: colors.selected },
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
    borderRadius: radius.pill, backgroundColor: colors.action, ...gloss.fill,
  },
  quickHover: { backgroundColor: colors.actionHover },
  quickText: { ...typography.label, color: colors.white },

  // ── ForMeds Premium ──────────────────────────────────────────────────────
  pCard: { borderRadius: radius.card, ...shadow.card },
  pPayRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs + 2 },
  pPay: { ...typography.h3, color: colors.navy },
  // Premium: a crisp card that answers a hover with a teal edge.
  cCard: Platform.OS === 'web'
    ? ({ transition: 'border-color 200ms cubic-bezier(0.2,0,0,1), box-shadow 200ms cubic-bezier(0.2,0,0,1)' } as object)
    : {},
  cSpecialty: {
    alignSelf: 'flex-start', marginBottom: 2, paddingHorizontal: 6, paddingVertical: 2,
    borderRadius: radius.tag, borderWidth: 1, borderColor: colors.tealLine, backgroundColor: colors.tealBg,
  },
  cSpecialtyText: { fontSize: 10, lineHeight: 14, fontFamily: fonts.body.bold, color: colors.tealInk, letterSpacing: 0.6, textTransform: 'uppercase' },
  cPay: { color: colors.teal, fontSize: 15 },
  // The hover edge is drawn by the card's own tap target, which fills it.
  cHover: { borderWidth: 1, borderColor: 'rgba(20,184,166,0.45)', backgroundColor: 'rgba(240,253,250,0.35)' },
  cVerifiedLine: { ...typography.small, color: colors.textSubtle },
  // Material: the salary sits in a soft teal well -- the decision number.
  mPayRow: {
    alignSelf: 'flex-start', backgroundColor: colors.tealBg,
    paddingHorizontal: spacing.md, paddingVertical: 6, borderRadius: radius.md,
  },
});
