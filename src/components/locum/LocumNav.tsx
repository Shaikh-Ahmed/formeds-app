import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../context/AuthContext';
import { colors, radius, spacing, typography, fonts, useBreakpoint, MIN_TOUCH_TARGET } from '../../theme';
import { JobsModuleTabs } from '../jobs/JobsModuleTabs';

export type LocumSegment = 'discover' | 'applications' | 'mine' | 'applicants';

interface Segment {
  key: LocumSegment;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  href: string;
}

const DISCOVER: Segment = { key: 'discover', label: 'Discover', icon: 'compass-outline', href: '/jobs/locum' };
const APPLICATIONS: Segment = {
  key: 'applications', label: 'My applications', icon: 'document-text-outline', href: '/jobs/locum/applications',
};
const MINE: Segment = { key: 'mine', label: 'My locums', icon: 'calendar-outline', href: '/jobs/locum/mine' };
const APPLICANTS: Segment = {
  key: 'applicants', label: 'Applicants', icon: 'people-outline', href: '/jobs/locum/applicants',
};

/**
 * Locum's own navigation, under the same Jobs | Locum switch as Jobs.
 *
 * Segments follow what each account can actually do, from the same rule the
 * server enforces: professionals apply (and may post cover for their own
 * list), hospitals and clinics post and screen. A hospital is never shown
 * "My applications", because it cannot have any.
 *
 * Styled to match `JobsSegmentedNav` exactly so the two modules read as one
 * product; kept separate so neither module's segment list can leak into the
 * other.
 */
export function LocumNav({ active }: { active: LocumSegment }) {
  const { user } = useAuth();
  const { isMobile } = useBreakpoint();
  const router = useRouter();

  const isProfessional = user?.role === 'healthcare_professional';
  const segments = isProfessional
    ? [DISCOVER, APPLICATIONS, MINE]
    : user?.role
      ? [DISCOVER, MINE, APPLICANTS]
      : [DISCOVER];

  const content = (
    <View style={styles.row} accessibilityRole="tablist">
      {segments.map(segment => {
        const selected = segment.key === active;
        return (
          <Pressable
            key={segment.key}
            testID={`locum-segment-${segment.key}`}
            onPress={() => { if (!selected) router.replace(segment.href as any); }}
            accessibilityRole="tab"
            accessibilityState={{ selected }}
            accessibilityLabel={segment.label}
            style={({ pressed }) => [styles.segment, selected && styles.segmentActive, pressed && styles.pressed]}
          >
            <Ionicons name={segment.icon} size={16} color={selected ? colors.white : colors.textSecondary} />
            <Text style={[styles.label, selected && styles.labelActive]}>{segment.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );

  return (
    <View>
      <JobsModuleTabs active="locum" />
      {isMobile ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.scroller}>
          {content}
        </ScrollView>
      ) : (
        <View style={styles.wide}>{content}</View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  scroller: { paddingHorizontal: spacing.lg, paddingVertical: spacing.md },
  wide: { paddingVertical: spacing.lg },
  row: { flexDirection: 'row', gap: spacing.sm },
  segment: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs + 2,
    paddingHorizontal: spacing.md,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.white,
    minHeight: MIN_TOUCH_TARGET - 6,
    justifyContent: 'center',
  },
  segmentActive: { backgroundColor: colors.navy, borderColor: colors.navy },
  label: { ...typography.caption, color: colors.textSecondary },
  labelActive: { color: colors.white, fontFamily: fonts.body.semibold },
  pressed: { opacity: 0.7 },
});
