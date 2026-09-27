import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '../../context/AuthContext';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, typography, MIN_TOUCH_TARGET } from '../../theme';

/**
 * The back-arrow header the pushed Locum screens share -- the same one the
 * Jobs detail and applicant screens draw inline. `fallback` is where Back goes
 * on a cold deep link, when there is no history to return to.
 */
export function LocumBackHeader({
  title, subtitle, fallback, right,
}: {
  title: string;
  subtitle?: string;
  fallback: string;
  right?: React.ReactNode;
}) {
  const router = useRouter();
  const { user } = useAuth();
  // A recruiter's shifts live in their portal, never the locum board.
  const home = user?.role === 'recruiter' ? '/recruiter/jobs' : fallback;
  return (
    <View style={styles.header}>
      <Pressable
        onPress={() => (router.canGoBack() ? router.back() : router.replace(home as any))}
        accessibilityRole="button"
        accessibilityLabel="Back"
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        style={({ pressed }) => [styles.back, pressed && styles.pressed]}
        testID="locum-back"
      >
        <Ionicons name="arrow-back" size={22} color={colors.text} />
      </Pressable>
      <View style={styles.text}>
        <Text style={styles.title} numberOfLines={1}>{title}</Text>
        {subtitle ? <Text style={styles.subtitle} numberOfLines={1}>{subtitle}</Text> : null}
      </View>
      {right}
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: colors.white,
  },
  back: { width: MIN_TOUCH_TARGET, height: MIN_TOUCH_TARGET, alignItems: 'flex-start', justifyContent: 'center' },
  text: { flex: 1, gap: 2 },
  title: { ...typography.h3, color: colors.text },
  subtitle: { ...typography.small, color: colors.textSecondary },
  pressed: { opacity: 0.6 },
});
