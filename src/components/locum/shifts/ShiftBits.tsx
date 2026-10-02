import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, fonts, radius, spacing, typography, MIN_TOUCH_TARGET } from '../../../theme';
import { JobBadge } from '../../jobs/JobMeta';
import { BADGE_TONE, formatPlace, formatRoleLine, formatShiftDay, formatShiftHours } from '../LocumMeta';
import {
  LOCUM_PHASE_META, type LocumReliabilitySummary, type LocumShift, type LocumShiftPhase,
} from '../../../types/locum';

/**
 * Pieces every Shifts view shares, so "8:52 AM", "₹2,500", a star rating and a
 * shift's status read the same for the professional, the hospital and admin.
 *
 * Instants from the server are shown in IST -- the zone every locum is written
 * in -- whatever the device's zone is, so "Arrival marked at 8:52 AM" means the
 * same minute to a hospital in Pune and a doctor with a phone set to Dubai.
 */

const IST_MS = 330 * 60 * 1000;
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function inIst(iso?: string | null): Date | null {
  if (!iso) return null;
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? null : new Date(d.getTime() + IST_MS);
}

/** "8:52 AM" (IST). */
export function istClock(iso?: string | null): string {
  const d = inIst(iso);
  if (!d) return '';
  const h = d.getUTCHours();
  const m = d.getUTCMinutes();
  return `${h % 12 === 0 ? 12 : h % 12}:${String(m).padStart(2, '0')} ${h >= 12 ? 'PM' : 'AM'}`;
}

/** "28 Sep, 6:00 AM" (IST). */
export function istDayClock(iso?: string | null): string {
  const d = inIst(iso);
  if (!d) return '';
  return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]}, ${istClock(iso)}`;
}

/** "28 Sep 2026" from YYYY-MM-DD, as written. */
export function longDay(day?: string | null): string {
  if (!day) return '';
  const [y, m, d] = day.slice(0, 10).split('-').map(Number);
  return `${d} ${MONTHS[(m || 1) - 1]} ${y}`;
}

export const rupees = (n?: number | null): string =>
  `₹${Math.round(n ?? 0).toLocaleString('en-IN')}`;

export function PhaseBadge({ phase }: { phase: LocumShiftPhase }) {
  const meta = LOCUM_PHASE_META[phase];
  return <JobBadge label={meta.label} icon={meta.icon as any} tone={BADGE_TONE[meta.tone]} />;
}

/** Read-only stars, with the number beside them for screen readers and scanning. */
export function Stars({ value, size = 14 }: { value: number | null | undefined; size?: number }) {
  const v = value ?? 0;
  return (
    <View style={styles.stars} accessibilityLabel={value ? `${value} out of 5 stars` : 'Not rated'}>
      {[1, 2, 3, 4, 5].map(i => (
        <Ionicons key={i} size={size} color={i <= Math.round(v) ? colors.warning : colors.border}
          name={i <= Math.round(v) ? 'star' : 'star-outline'} />
      ))}
    </View>
  );
}

/** Tappable 1–5 stars. Each star is a full-size touch target. */
export function StarInput({ label, value, onChange, testID }: {
  label: string; value: number; onChange: (v: number) => void; testID?: string;
}) {
  return (
    <View style={styles.starInput}>
      <Text style={styles.starLabel}>{label}</Text>
      <View style={styles.stars} accessibilityRole="radiogroup" accessibilityLabel={label}>
        {[1, 2, 3, 4, 5].map(i => (
          <Pressable key={i} onPress={() => onChange(i === value ? 0 : i)} hitSlop={4}
            accessibilityRole="radio" accessibilityState={{ selected: i === value }}
            accessibilityLabel={`${i} star${i === 1 ? '' : 's'}`} testID={testID ? `${testID}-${i}` : undefined}
            style={styles.starButton}>
            <Ionicons name={i <= value ? 'star' : 'star-outline'} size={26}
              color={i <= value ? colors.warning : colors.textMuted} />
          </Pressable>
        ))}
      </View>
    </View>
  );
}

/** "4.7 ★ · 18 shifts · 1 no-show" -- what a hospital sees about someone. */
export function ReliabilityLine({ summary }: { summary?: LocumReliabilitySummary | null }) {
  if (!summary) return null;
  const parts = [
    summary.rating ? `${summary.rating.toFixed(1)} ★ (${summary.review_count})` : 'No ratings yet',
    `${summary.completed_shifts} locum shift${summary.completed_shifts === 1 ? '' : 's'}`,
  ];
  if (summary.no_shows) parts.push(`${summary.no_shows} no-show${summary.no_shows === 1 ? '' : 's'}`);
  return (
    <Text style={[styles.muted, summary.locum_blocked && { color: colors.red }]} numberOfLines={2}>
      {summary.locum_blocked ? 'Locum access blocked · ' : ''}{parts.join(' · ')}
    </Text>
  );
}

/** The four numbers, as tiles. Informative first; strikes are one tile of four. */
export function ReliabilityTiles({ summary, cancellations }: {
  summary: LocumReliabilitySummary; cancellations?: number;
}) {
  const tiles: { label: string; value: string; tone?: string; testID: string }[] = [
    { label: 'Completed', value: String(summary.completed_shifts), testID: 'rel-completed' },
    { label: 'Rating', value: summary.rating ? `${summary.rating.toFixed(1)} ★` : '–', testID: 'rel-rating' },
    { label: 'No-shows', value: String(summary.no_shows), testID: 'rel-no-shows' },
    {
      label: 'Strikes', value: `${summary.active_strikes} / ${summary.strike_limit}`, testID: 'rel-strikes',
      tone: summary.active_strikes >= summary.strike_limit ? colors.red
        : summary.active_strikes > 0 ? colors.warning : undefined,
    },
  ];
  if (cancellations !== undefined) {
    tiles.splice(3, 0, { label: 'Cancelled', value: String(cancellations), testID: 'rel-cancelled' });
  }
  return (
    <View style={styles.tiles}>
      {tiles.map(t => (
        <View key={t.label} style={styles.tile} testID={t.testID}>
          <Text style={[styles.tileValue, t.tone ? { color: t.tone } : null]}>{t.value}</Text>
          <Text style={styles.tileLabel}>{t.label}</Text>
        </View>
      ))}
    </View>
  );
}

/** Hospital, role line, date, hours, place and pay: the head of every shift card. */
export function ShiftHead({ shift, who }: { shift: LocumShift; who?: string }) {
  const { locum } = shift;
  return (
    <View style={styles.head}>
      <View style={styles.headTop}>
        <Text style={styles.when}>{formatShiftDay(locum.shift_date)} · {formatShiftHours(locum)}</Text>
        <PhaseBadge phase={shift.phase} />
      </View>
      <Text style={styles.title} numberOfLines={2}>{who || locum.employer_name}</Text>
      <Text style={styles.muted} numberOfLines={2}>
        {formatRoleLine(locum)} · {formatPlace(locum)}
        {locum.shift_pay ? ` · ${rupees(locum.shift_pay)}` : ''}
      </Text>
      {who ? <Text style={styles.muted}>{longDay(locum.shift_date)}</Text> : null}
    </View>
  );
}

export function SectionTitle({ title, count }: { title: string; count?: number }) {
  return (
    <Text style={styles.section} accessibilityRole="header">
      {title}{count ? ` · ${count}` : ''}
    </Text>
  );
}

export const shiftStyles = StyleSheet.create({
  card: {
    backgroundColor: colors.card,
    borderRadius: radius.xl + 2,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    gap: spacing.md,
  },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  action: { flexGrow: 1, flexBasis: 150 },
  note: { ...typography.caption, color: colors.textSecondary, lineHeight: 19 },
  ok: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  okText: { ...typography.caption, color: colors.teal, fontFamily: fonts.body.semibold },
});

const styles = StyleSheet.create({
  stars: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  starInput: { gap: spacing.xs },
  starLabel: { ...typography.caption, color: colors.text, fontFamily: fonts.body.semibold },
  starButton: { minWidth: MIN_TOUCH_TARGET - 8, minHeight: MIN_TOUCH_TARGET - 8, alignItems: 'center', justifyContent: 'center' },
  muted: { ...typography.caption, color: colors.textSecondary },
  tiles: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  tile: {
    flexGrow: 1, flexBasis: 90, backgroundColor: colors.bg, borderRadius: radius.lg,
    paddingVertical: spacing.md, paddingHorizontal: spacing.sm, alignItems: 'center', gap: 2,
  },
  tileValue: { ...typography.h3, color: colors.navy },
  tileLabel: { ...typography.small, color: colors.textSecondary },
  head: { gap: spacing.xs },
  headTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm, flexWrap: 'wrap' },
  when: { ...typography.small, color: colors.navy, fontFamily: fonts.body.semibold },
  title: { ...typography.h3, color: colors.text },
  section: { ...typography.label, color: colors.textSecondary, marginTop: spacing.sm },
});
