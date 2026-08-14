import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, radius, typography } from '../theme';

/**
 * Placeholder for a feature that ships in a later phase.
 * Use instead of an EmptyState when there is nothing to load yet — an empty
 * list reads as "we found nothing", this reads as "this isn't built yet".
 */
export function ComingSoon({
  icon,
  title,
  description,
  bullets = [],
  testID,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  description: string;
  bullets?: string[];
  testID?: string;
}) {
  return (
    <View testID={testID} style={styles.card}>
      <View style={styles.iconWrap}>
        <Ionicons name={icon} size={32} color={colors.navy} />
      </View>

      <View style={styles.pill}>
        <Ionicons name="time-outline" size={13} color={colors.warning} />
        <Text style={styles.pillText}>Coming soon</Text>
      </View>

      <Text style={styles.title}>{title}</Text>
      <Text style={styles.description}>{description}</Text>

      {bullets.length > 0 && (
        <View style={styles.bullets}>
          {bullets.map(b => (
            <View key={b} style={styles.bulletRow}>
              <Ionicons name="ellipse" size={6} color={colors.textMuted} />
              <Text style={styles.bulletText}>{b}</Text>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.card,
    borderRadius: radius.xl + 2,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.xxl,
    alignItems: 'center',
    marginTop: spacing.xxl,
  },
  iconWrap: {
    width: 64,
    height: 64,
    borderRadius: radius.lg + 4,
    backgroundColor: colors.bgMuted,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.lg,
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: colors.warningBg,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radius.pill,
    marginBottom: spacing.md,
  },
  pillText: { fontSize: 12, fontWeight: '600', color: colors.warning },
  title: { ...typography.h3, color: colors.text, textAlign: 'center', marginBottom: spacing.sm },
  description: {
    ...typography.body,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 21,
    marginBottom: spacing.xl,
  },
  bullets: { alignSelf: 'stretch', gap: spacing.sm },
  bulletRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  bulletText: { ...typography.caption, color: colors.textSecondary, flex: 1 },
});
