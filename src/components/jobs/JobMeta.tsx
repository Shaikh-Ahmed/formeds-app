import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, radius, spacing, typography, fonts } from '../../theme';
import {
  EMPLOYMENT_TYPE_LABELS, PAY_PERIOD_LABELS, WORK_MODE_LABELS, isShiftRole,
  type Job,
} from '../../types/jobs';

/**
 * The small shared vocabulary of a job: how pay is phrased, how a badge is
 * drawn, how a date range reads. Lives in one place because the card, the
 * detail panel and the posting preview must agree exactly — a salary that
 * rounds differently between the list and the page reads as a different job.
 */

/**
 * Indian numbering, because that is what the audience reads salaries in.
 * "₹3.5L – ₹5L per month" is instantly legible to a doctor in Hyderabad;
 * "₹350,000" makes them count digits.
 */
export function formatPayValue(amount: number): string {
  if (amount >= 10000000) return `₹${trim(amount / 10000000)}Cr`;
  if (amount >= 100000) return `₹${trim(amount / 100000)}L`;
  if (amount >= 1000) return `₹${trim(amount / 1000)}K`;
  return `₹${amount}`;
}

function trim(n: number): string {
  // 3.5 keeps its decimal, 5.0 does not — a trailing .0 reads as spurious
  // precision on a figure that is already a band.
  return n.toFixed(1).replace(/\.0$/, '');
}

/** The whole pay line, or null when there is nothing honest to show. */
export function formatPay(job: Job): string | null {
  if (!job.pay_disclosed) return null;
  const min = job.pay_min ?? 0;
  const max = job.pay_max ?? 0;
  if (!min && !max) return null;
  const period = PAY_PERIOD_LABELS[job.pay_period] ?? '';
  const range = !max || max === min
    ? formatPayValue(min)
    : `${formatPayValue(min)} – ${formatPayValue(max)}`;
  return `${range} ${period}`.trim();
}

/** "8+ years", "2–5 years", or nothing when the employer did not say. */
export function formatExperience(job: Job): string | null {
  const { experience_min: min, experience_max: max } = job;
  if (!min && !max) return null;
  if (min && max && max > min) return `${min}–${max} years experience`;
  if (min) return `${min}+ years experience`;
  return `Up to ${max} years experience`;
}

/** "12–15 September", for a shift role. */
export function formatShiftDates(job: Job): string | null {
  if (!isShiftRole(job.employment_type) || !job.shift_start_date) return null;
  const start = new Date(job.shift_start_date);
  if (Number.isNaN(start.getTime())) return null;
  const end = job.shift_end_date ? new Date(job.shift_end_date) : null;
  const month = { month: 'long' } as const;
  if (!end || Number.isNaN(end.getTime()) || +end === +start) {
    return start.toLocaleDateString(undefined, { day: 'numeric', ...month });
  }
  const sameMonth = start.getMonth() === end.getMonth();
  return sameMonth
    ? `${start.getDate()}–${end.getDate()} ${end.toLocaleDateString(undefined, month)}`
    : `${start.toLocaleDateString(undefined, { day: 'numeric', ...month })} – ${end.toLocaleDateString(undefined, { day: 'numeric', ...month })}`;
}

/**
 * "Full-time · On-site". Work mode is dropped for a remote-by-nature role,
 * where "Telemedicine · Remote" says the same thing twice.
 */
export function formatTypeLine(job: Job): string {
  const type = EMPLOYMENT_TYPE_LABELS[job.employment_type] ?? job.employment_type;
  if (job.employment_type === 'telemedicine' && job.work_mode === 'remote') return type;
  return `${type} · ${WORK_MODE_LABELS[job.work_mode] ?? job.work_mode}`;
}

const TONES = {
  neutral: { bg: colors.bgMuted, fg: colors.textSecondary },
  teal: { bg: colors.tealBg, fg: colors.teal },
  navy: { bg: '#EFF6FF', fg: colors.navy },
  // redText, not red: `red` is 3.6:1 on redBg and fails contrast as text.
  danger: { bg: colors.redBg, fg: colors.redText },
  warning: { bg: colors.warningBg, fg: colors.warning },
} as const;

export type BadgeTone = keyof typeof TONES;

/**
 * A labelled badge that always carries both an icon and words.
 *
 * Never colour alone: "Urgent" in red and "Verified" in teal are
 * indistinguishable to a red-green colourblind reader, and both are exactly the
 * kind of claim someone acts on.
 */
export function JobBadge({
  label, icon, tone = 'neutral',
}: {
  label: string;
  icon?: keyof typeof Ionicons.glyphMap;
  tone?: BadgeTone;
}) {
  const { bg, fg } = TONES[tone];
  return (
    <View style={[styles.badge, { backgroundColor: bg }]}>
      {icon ? <Ionicons name={icon} size={12} color={fg} /> : null}
      <Text style={[styles.badgeText, { color: fg }]}>{label}</Text>
    </View>
  );
}

/** One icon + text metadata item, as used in the card's detail row. */
export function MetaItem({
  icon, text,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  text: string;
}) {
  return (
    <View style={styles.meta}>
      <Ionicons name={icon} size={14} color={colors.textSecondary} />
      <Text style={styles.metaText} numberOfLines={1}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: 3,
    borderRadius: radius.pill,
    alignSelf: 'flex-start',
  },
  badgeText: { ...typography.small, fontFamily: fonts.body.semibold },
  meta: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, flexShrink: 1 },
  metaText: { ...typography.caption, color: colors.textSecondary },
});
