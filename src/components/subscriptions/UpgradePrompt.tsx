import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { colors, fonts, radius, spacing, typography } from '../../theme';
import { Button } from '../Button';

/**
 * The one "not on your plan" state. A locked feature is shown, with a lock and
 * the plan that includes it, rather than silently hidden -- the member should
 * know the capability exists and how to get it.
 */
export function UpgradePrompt({
  title, message, requiredPlan, compact = false, testID,
}: {
  title?: string;
  message: string;
  requiredPlan?: string | null;
  compact?: boolean;
  testID?: string;
}) {
  const router = useRouter();
  return (
    <View style={[styles.card, compact && styles.compact]} testID={testID}>
      <View style={styles.head}>
        <View style={styles.lock}><Ionicons name="lock-closed" size={14} color={colors.navy} /></View>
        <Text style={styles.title}>{title ?? (requiredPlan ? `Available with ${requiredPlan}` : 'Not on your plan')}</Text>
      </View>
      <Text style={styles.message}>{message}</Text>
      <Button
        label={requiredPlan ? `View ${requiredPlan}` : 'View plans'}
        variant="outline"
        onPress={() => router.push('/subscription' as any)}
        style={styles.button}
        testID={testID ? `${testID}-plans` : undefined}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: spacing.sm, padding: spacing.lg, borderRadius: radius.xl,
    backgroundColor: colors.bg, borderWidth: 1, borderColor: colors.border,
  },
  compact: { padding: spacing.md },
  head: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  lock: {
    width: 26, height: 26, borderRadius: 13, backgroundColor: colors.tintBg,
    alignItems: 'center', justifyContent: 'center',
  },
  title: { ...typography.label, fontFamily: fonts.body.semibold, color: colors.text, flex: 1 },
  message: { ...typography.caption, color: colors.textSecondary, lineHeight: 19 },
  button: { minHeight: 44, alignSelf: 'flex-start', paddingHorizontal: spacing.lg },
});
