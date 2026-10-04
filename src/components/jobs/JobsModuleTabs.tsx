import React from 'react';
import { LocumIcon } from '../icons/ForMedsIcons';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { colors, radius, spacing, fonts, useBreakpoint, isRefined, isPremium, gloss, elevation } from '../../theme';

export type JobsModule = 'jobs' | 'locum';

const MODULES: { key: JobsModule; label: string; icon: keyof typeof Ionicons.glyphMap; href: string }[] = [
  { key: 'jobs', label: 'Jobs', icon: 'briefcase-outline', href: '/jobs' },
  { key: 'locum', label: 'Locum', icon: 'flash-outline', href: '/jobs/locum' },
];

/**
 * The top level of the Jobs tab: Jobs | Locum.
 *
 * The same segmented control as Feed | Cases on the Community tab -- two
 * equal-width tabs on a muted track, the active one filled navy, becoming a
 * bordered card in the content column on wider screens -- so switching
 * between sibling modules looks and works the same everywhere in the app.
 *
 * Both are real routes (`/jobs`, `/jobs/locum`), replaced rather than pushed:
 * they are peers, and Back should leave the tab rather than walk through
 * every switch.
 */
export function JobsModuleTabs({ active }: { active: JobsModule }) {
  const router = useRouter();
  const { isMobile } = useBreakpoint();
  return (
    <View style={[styles.bar, !isMobile && styles.barWide, isPremium && styles.cBar, isPremium && isMobile && styles.cBarMobile]} accessibilityRole="tablist"
      testID="jobs-module-tabs">
      {MODULES.map(module => {
        const selected = module.key === active;
        return (
          <Pressable
            key={module.key}
            testID={`jobs-module-${module.key}`}
            onPress={() => { if (!selected) router.replace(module.href as any); }}
            accessibilityRole="tab"
            accessibilityState={{ selected }}
            accessibilityLabel={module.label}
            style={({ pressed }) => [styles.tab, selected && styles.tabActive, isPremium && styles.cTab,
              isPremium && selected && styles.cTabActive, pressed && styles.pressed]}
          >
            {isRefined && module.key === 'locum' ? (
              // Premium's shift mark: a day with a clock -- cover, not a job.
              <LocumIcon size={16} color={selected ? (isPremium ? colors.teal : colors.white) : colors.textSecondary}
                badgeBg={selected ? (isPremium ? colors.tealBg : colors.navy) : colors.bgMuted} />
            ) : (
              <Ionicons
                name={module.icon}
                size={16}
                color={selected ? (isPremium ? colors.teal : colors.white) : colors.textSecondary}
              />
            )}
            <Text style={[styles.label, selected && styles.labelActive, isPremium && selected && styles.cLabelActive]}>{module.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

// Mirrors `tabBar` / `tab` in app/(tabs)/community.tsx, expressed in tokens.
const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    backgroundColor: colors.white,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    gap: spacing.sm,
  },
  barWide: {
    marginTop: spacing.lg,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.sm,
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: radius.md,
    backgroundColor: colors.bgMuted,
    ...gloss.glass,
  },
  tabActive: { backgroundColor: colors.action, ...gloss.fill },
  label: { fontSize: 14, fontFamily: fonts.body.semibold, color: colors.textSecondary },
  labelActive: { color: colors.white },
  pressed: { opacity: 0.8 },
  // Premium: a Material 3 segmented control -- a quiet slate track, the
  // chosen segment lifted onto a white thumb in teal.
  cBar: { backgroundColor: colors.bgMuted, borderColor: colors.bgMuted, padding: 3, gap: 3, borderRadius: radius.pill, marginTop: spacing.md },
  cTab: { backgroundColor: 'transparent', borderRadius: radius.pill, paddingVertical: 7 },
  cTabActive: {
    backgroundColor: colors.white,
    ...(Platform.OS === 'web' ? ({ boxShadow: '0 1px 3px rgba(15,23,42,0.10), 0 1px 2px rgba(15,23,42,0.06)' } as object) : elevation.subtle),
  },
  cLabelActive: { color: colors.teal, fontFamily: fonts.body.bold },
  cBarMobile: { marginHorizontal: spacing.lg, marginVertical: spacing.sm },
});
