import React from 'react';
import { ShiftDateTile } from '../material';
import { LocumIcon } from '../icons/ForMedsIcons';
import { TrustMark } from '../TrustMark';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, radius, spacing, typography, fonts, MIN_TOUCH_TARGET, isRefined, isPremium, shadow, isMaterial, gloss } from '../../theme';
import { GradientFill } from '../material/Surfaces';
import { postedAgo } from '../../utils/time';
import { Avatar } from '../Avatar';
import { JobBadge, MetaItem } from '../jobs/JobMeta';
import {
  BADGE_TONE, formatDeadline, formatLocumPay, formatOpenings, formatPlace,
  formatRoleLine, formatShiftDay, formatShiftHours,
} from './LocumMeta';
import {
  LOCUM_APPLICATION_META, LOCUM_SHIFT_LABELS, LOCUM_STATUS_META, type Locum,
} from '../../types/locum';

interface Props {
  item: Locum;
  onPress: () => void;
  /** The primary action. Omitted where applying is not on offer. */
  onApply?: (locum: Locum) => void;
  selected?: boolean;
  compact?: boolean;
}

/**
 * One locum, built to be read in two seconds.
 *
 * Leads with WHEN, because for a locum the date is the decision -- a doctor
 * scanning the board is asking "am I free then?" before anything else. Then
 * where, then pay, then who. The hospital line is second rather than first
 * (the opposite of JobCard) for the same reason.
 *
 * One primary action. If the viewer has applied, the button becomes their
 * status, so the card answers "did I already apply to this?" without a tap.
 */
export const LocumCard = React.memo(function LocumCard({
  item, onPress, onApply, selected = false, compact = false,
}: Props) {
  const mine = item.my_application?.status === 'withdrawn' ? null : item.my_application;
  const mineMeta = mine ? LOCUM_APPLICATION_META[mine.status] : null;
  const statusMeta = LOCUM_STATUS_META[item.status];
  const urgent = item.shift_type === 'emergency';
  const deadline = formatDeadline(item.apply_by);

  // The card is a plain container holding two siblings: the tappable body and
  // the footer with its own Apply button. Nesting Apply inside a tappable card
  // rendered <button> inside <button> on the web -- invalid HTML that screen
  // readers announce as one control, and a tap on Apply also opened the card.
  return (
    <View style={[styles.card, compact && styles.cardCompact, isRefined && styles.pCard,
      selected && styles.cardSelected]}>
    <Pressable
      testID={`locum-card-${item.id}`}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={
        `${formatRoleLine(item)} at ${item.employer_name}. ` +
        `${formatShiftDay(item.shift_date)}, ${formatShiftHours(item)}. ` +
        `${formatPlace(item)}. ${formatLocumPay(item)}.`
      }
      style={({ pressed }) => [styles.body, compact && styles.bodyCompact, pressed && styles.cardPressed]}
    >
      {isPremium ? (
        // Premium: the shift as a ticket -- the date on a navy block, the hours
        // in teal and the role beside it. Date, time and role, scannable first.
        <View style={styles.cHead}>
          <DateBlock date={item.shift_date} compact={compact} />
          <View style={styles.mHeadText}>
            <View style={styles.mHoursRow}>
              <Ionicons name="time-outline" size={14} color={colors.teal} />
              <Text style={styles.cHours} numberOfLines={1}>{formatShiftHours(item)}</Text>
            </View>
            <Text style={styles.title} numberOfLines={2}>{formatRoleLine(item)}</Text>
          </View>
        </View>
      ) : isMaterial ? (
        // Material: the date as a tactile tile, the hours and role beside it.
        <View style={styles.mHead}>
          <ShiftDateTile date={item.shift_date} size={compact ? 56 : 64} />
          <View style={styles.mHeadText}>
            <View style={styles.mHoursRow}>
              <Ionicons name="time" size={14} color={colors.teal} />
              <Text style={styles.mHours} numberOfLines={1}>{formatShiftHours(item)}</Text>
            </View>
            <Text style={styles.title} numberOfLines={2}>{formatRoleLine(item)}</Text>
          </View>
        </View>
      ) : isRefined ? (
        // Premium: the shift itself leads, in a band of its own -- this is
        // cover for a date and a time, and that is the first decision.
        <View style={[styles.pWhen, compact && styles.pWhenCompact]}>
          <LocumIcon size={20} color={colors.navy} badgeBg={colors.infoBg} />
          <Text style={styles.pDay}>{formatShiftDay(item.shift_date)}</Text>
          <Text style={styles.pHours} numberOfLines={1}>{formatShiftHours(item)}</Text>
        </View>
      ) : (
        <View style={styles.whenRow}>
          <View style={styles.dayChip}>
            <Ionicons name="calendar" size={14} color={colors.navy} />
            <Text style={styles.dayText}>{formatShiftDay(item.shift_date)}</Text>
          </View>
          <Text style={styles.hours} numberOfLines={1}>{formatShiftHours(item)}</Text>
        </View>
      )}

      {isMaterial || isPremium ? null : <Text style={styles.title} numberOfLines={2}>{formatRoleLine(item)}</Text>}

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

      <View style={styles.metaRow}>
        <MetaItem icon="location-outline" text={formatPlace(item)} />
        <MetaItem icon="people-outline" text={formatOpenings(item)} />
      </View>

      <View style={styles.payRow}>
        <Text style={[styles.pay, isRefined && styles.pPay, isMaterial && styles.mPay, isPremium && styles.cPay]}>{formatLocumPay(item)}</Text>
        <View style={styles.badges}>
          {urgent ? <JobBadge label="Emergency" icon="alert-circle" tone="danger" /> : null}
          {!urgent && item.shift_type !== 'day' ? (
            <JobBadge
              label={LOCUM_SHIFT_LABELS[item.shift_type]}
              icon={item.shift_type === 'night' ? 'moon-outline' : 'time-outline'}
              tone="navy"
            />
          ) : null}
          {item.status !== 'open' ? (
            <JobBadge label={statusMeta.label} icon={statusMeta.icon as any}
              tone={BADGE_TONE[statusMeta.tone]} />
          ) : null}
        </View>
      </View>
    </Pressable>

      <View style={[styles.footer, compact && styles.footerCompact]}>
        <Text style={styles.small} numberOfLines={1}>
          {item.status === 'open' && deadline ? deadline : postedAgo(item.created_at)}
        </Text>
        {mineMeta ? (
          <JobBadge label={mineMeta.label} icon={mineMeta.icon as any} tone={BADGE_TONE[mineMeta.tone]} />
        ) : item.can_manage ? (
          <Text style={styles.small}>
            {item.applicant_count} {item.applicant_count === 1 ? 'applicant' : 'applicants'}
          </Text>
        ) : onApply && item.status === 'open' ? (
          <Pressable
            testID={`locum-apply-${item.id}`}
            onPress={() => onApply(item)}
            accessibilityRole="button"
            accessibilityLabel={`Apply for ${formatRoleLine(item)} on ${formatShiftDay(item.shift_date)}`}
            hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
            style={({ pressed }) => [styles.apply, pressed && styles.applyPressed]}
          >
            <Text style={styles.applyText}>Apply</Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
});

/** Premium's date block: weekday, the day large, month -- on the navy anchor. */
function DateBlock({ date, compact }: { date: string; compact?: boolean }) {
  const d = new Date(`${date}T00:00:00`);
  const valid = !Number.isNaN(d.getTime());
  const size = compact ? 54 : 62;
  return (
    <View style={[styles.cBlock, { width: size, minHeight: size }]} accessible={false}
      importantForAccessibility="no-hide-descendants">
      <GradientFill name="featured" style={StyleSheet.absoluteFill} pointerEvents="none" />
      <Text style={styles.cBlockWeek}>{valid ? d.toLocaleDateString('en-IN', { weekday: 'short' }).toUpperCase() : ''}</Text>
      <Text style={[styles.cBlockDay, compact && { fontSize: 20, lineHeight: 24 }]}>{valid ? d.getDate() : '–'}</Text>
      <Text style={styles.cBlockMonth}>{valid ? d.toLocaleDateString('en-IN', { month: 'short' }).toUpperCase() : ''}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  // -- ForMeds Premium: the shift ticket --------------------------------------
  cHead: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  cBlock: {
    borderRadius: radius.lg, overflow: 'hidden', alignItems: 'center', justifyContent: 'center', paddingVertical: 6,
    borderTopWidth: 2, borderTopColor: colors.tealLight,
  },
  cBlockWeek: { fontSize: 9.5, lineHeight: 12, fontFamily: fonts.body.bold, color: colors.tealLight, letterSpacing: 0.8 },
  cBlockDay: { fontSize: 23, lineHeight: 27, fontFamily: fonts.display, color: colors.white },
  cBlockMonth: { fontSize: 9.5, lineHeight: 12, fontFamily: fonts.body.bold, color: 'rgba(255,255,255,0.72)', letterSpacing: 0.8 },
  cHours: { fontSize: 13, lineHeight: 18, fontFamily: fonts.body.bold, color: colors.teal },
  cPay: { color: colors.teal },
  card: {
    backgroundColor: colors.card,
    borderRadius: radius.xl + 2,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  cardCompact: { borderRadius: radius.lg },
  cardSelected: { borderColor: colors.primaryFill, backgroundColor: colors.selected },
  cardPressed: { backgroundColor: colors.bgMuted },
  body: { padding: spacing.lg, paddingBottom: spacing.sm, gap: spacing.sm },
  bodyCompact: { padding: spacing.md + 2, paddingBottom: spacing.xs + 2, gap: spacing.xs + 2 },

  whenRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, flexWrap: 'wrap' },
  dayChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: 3,
    borderRadius: radius.pill,
    backgroundColor: colors.tintBg,
  },
  dayText: { ...typography.small, fontFamily: fonts.body.semibold, color: colors.navy },
  hours: { ...typography.caption, fontFamily: fonts.body.medium, color: colors.text, flexShrink: 1 },

  title: { ...typography.h3, color: colors.text },
  employerRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs + 2 },
  employer: { ...typography.caption, color: colors.textSecondary, flexShrink: 1 },

  metaRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md, rowGap: spacing.xs },
  payRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    gap: spacing.sm, flexWrap: 'wrap',
  },
  pay: { ...typography.bodyStrong, color: colors.text },
  badges: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs + 2 },

  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
    marginHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    paddingBottom: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.borderLight,
  },
  footerCompact: { marginHorizontal: spacing.md + 2, paddingBottom: spacing.sm + 2 },
  small: { ...typography.small, color: colors.textSecondary, flexShrink: 1 },
  apply: {
    minHeight: MIN_TOUCH_TARGET - 8,
    paddingHorizontal: spacing.lg,
    borderRadius: isPremium ? radius.pill : radius.md,
    backgroundColor: colors.action, ...gloss.fill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  applyPressed: { opacity: 0.8 },
  applyText: { ...typography.label, color: colors.white },

  // ── ForMeds Premium ──────────────────────────────────────────────────────
  pCard: { borderRadius: radius.card, ...shadow.card },
  pWhen: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm, flexWrap: 'wrap',
    marginHorizontal: -spacing.lg, marginTop: -spacing.lg, marginBottom: spacing.xs,
    paddingHorizontal: spacing.lg, paddingVertical: spacing.sm + 2,
    backgroundColor: colors.infoBg, borderBottomWidth: 1, borderBottomColor: colors.borderLight,
  },
  pWhenCompact: { marginHorizontal: -(spacing.md + 2), marginTop: -(spacing.md + 2), paddingHorizontal: spacing.md + 2 },
  pDay: { ...typography.label, color: colors.navy, marginLeft: 2 },
  pHours: { ...typography.caption, fontFamily: fonts.body.medium, color: colors.text, flexShrink: 1 },
  pPay: { ...typography.h3, color: colors.navy },

  // ── ForMeds Material ─────────────────────────────────────────────────────
  mHead: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  mHeadText: { flex: 1, minWidth: 0, gap: 2 },
  mHoursRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  mHours: { ...typography.label, color: colors.teal },
  mPay: {
    ...typography.h3, color: colors.navy, backgroundColor: colors.tealBg,
    paddingHorizontal: spacing.md, paddingVertical: 4, borderRadius: radius.md, overflow: 'hidden',
  },
});
