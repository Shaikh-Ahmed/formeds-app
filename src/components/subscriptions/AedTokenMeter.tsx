import React from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, fonts, radius, spacing, typography, gloss, isMaterial } from '../../theme';
import { daysUntil, formatDay, type AedWallet } from '../../types/subscriptions';

/**
 * The AED token balance: a bar, the numbers, and when it resets.
 *
 * Calm on purpose. A low balance is stated plainly ("180 AED tokens
 * remaining") in the ordinary text colour; only an exhausted balance changes
 * the message, and even then it offers the way forward rather than alarming.
 */
export function AedTokenMeter({
  wallet, compact = false, onPress, testID,
}: {
  wallet: AedWallet;
  /** The one-line strip inside AED. */
  compact?: boolean;
  onPress?: () => void;
  testID?: string;
}) {
  const pct = wallet.allocated ? Math.min(wallet.remaining / wallet.allocated, 1) : 0;
  const fill = wallet.exhausted ? colors.textMuted : wallet.low ? colors.warning : colors.teal;
  const line = wallet.exhausted
    ? 'Your AED tokens have been used for this billing period.'
    : wallet.low
      ? `${wallet.remaining.toLocaleString('en-IN')} AED tokens remaining.`
      : `${wallet.remaining.toLocaleString('en-IN')} / ${wallet.allocated.toLocaleString('en-IN')} tokens remaining`;

  // Material, inside AED: one small glass pill -- a progress ring, the
  // balance, and when it resets -- instead of a three-line strip.
  const body = compact && isMaterial ? (
    <View style={styles.pill} testID={testID}>
      <Ring pct={pct} color={fill} />
      <Text style={styles.pillText} numberOfLines={1}>
        {wallet.exhausted ? (
          <Text style={styles.pillStrong}>Tokens used up</Text>
        ) : (
          <>
            <Text style={styles.pillStrong}>{wallet.remaining.toLocaleString('en-IN')}</Text>
            {` / ${wallet.allocated.toLocaleString('en-IN')} tokens`}
          </>
        )}
        <Text style={styles.pillMuted}>{`  ·  resets ${daysUntil(wallet.resets_at)}`}</Text>
      </Text>
      {onPress ? <Ionicons name="chevron-forward" size={13} color={colors.textSecondary} /> : null}
    </View>
  ) : (
    <View style={[styles.wrap, compact && styles.wrapCompact]} testID={testID}>
      <View style={styles.row}>
        <Text style={[styles.text, compact && styles.textCompact]} numberOfLines={1}>{line}</Text>
        {onPress ? <Ionicons name="chevron-forward" size={14} color={colors.textSecondary} /> : null}
      </View>
      <View style={styles.track} accessibilityRole="progressbar"
        accessibilityValue={{ min: 0, max: wallet.allocated, now: wallet.remaining }}>
        <View style={[styles.bar, { width: `${pct * 100}%`, backgroundColor: fill }, gloss.fill]} />
      </View>
      {compact ? (
        <Text style={styles.sub}>Resets {daysUntil(wallet.resets_at)}</Text>
      ) : (
        <View style={styles.stats}>
          <Stat label="Included" value={wallet.allocated} />
          <Stat label="Used" value={wallet.used} />
          <Stat label="Remaining" value={wallet.remaining} />
          <View style={styles.stat}>
            <Text style={styles.statValue}>{formatDay(wallet.resets_at)}</Text>
            <Text style={styles.statLabel}>Resets</Text>
          </View>
        </View>
      )}
    </View>
  );
  if (!onPress) return body;
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={`${line} View plans and usage.`}
      // The pill is centred; only the pill itself is the tap target.
      style={({ pressed }) => [compact && isMaterial && styles.pillHit, pressed && styles.pressed]}>
      {body}
    </Pressable>
  );
}

/**
 * A small progress ring. On the web it is a conic gradient -- a glossy sweep
 * of the fill colour -- punched out to a donut; natively, a plain ring.
 */
function Ring({ pct, color }: { pct: number; color: string }) {
  const deg = Math.round(pct * 360);
  const web = Platform.OS === 'web';
  return (
    <View accessibilityRole="progressbar" accessibilityValue={{ min: 0, max: 100, now: Math.round(pct * 100) }}
      style={[styles.ring, web
        ? ({
          backgroundImage: `conic-gradient(${color} 0deg, ${color}CC ${deg}deg, ${colors.bgMuted} ${deg}deg 360deg)`,
          boxShadow: `0 2px 6px -2px ${color}88`,
        } as object)
        : { borderWidth: 3, borderColor: pct > 0 ? color : colors.bgMuted }]}>
      <View style={styles.ringHole}>
        <Ionicons name="sparkles" size={10} color={color} />
      </View>
    </View>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statValue}>{value.toLocaleString('en-IN')}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.sm },
  wrapCompact: { gap: 6 },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm },
  text: { ...typography.label, color: colors.text, flexShrink: 1 },
  textCompact: { ...typography.small, fontFamily: fonts.body.medium },
  sub: { ...typography.small, color: colors.textSecondary },
  track: { height: 6, borderRadius: radius.pill, backgroundColor: colors.bgMuted, overflow: 'hidden' },
  bar: { height: 6, borderRadius: radius.pill },
  stats: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.lg, marginTop: spacing.xs },
  stat: { gap: 2, minWidth: 64 },
  statValue: { ...typography.label, color: colors.text },
  statLabel: { ...typography.small, color: colors.textSecondary },
  pressed: { opacity: 0.75 },

  // Material pill.
  pillHit: { alignSelf: 'center' },
  pill: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm, alignSelf: 'center',
    paddingVertical: 5, paddingLeft: 5, paddingRight: spacing.md, borderRadius: radius.pill,
    borderWidth: 1, borderColor: colors.borderLight, backgroundColor: colors.surface, ...gloss.glass,
  },
  pillText: { ...typography.small, color: colors.textSecondary, flexShrink: 1 },
  pillStrong: { fontFamily: fonts.body.semibold, color: colors.text },
  pillMuted: { color: colors.textMuted },
  ring: { width: 26, height: 26, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  ringHole: {
    width: 18, height: 18, borderRadius: 9, backgroundColor: colors.surface,
    alignItems: 'center', justifyContent: 'center',
  },
});
