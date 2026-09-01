import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../context/AuthContext';
import { colors, radius, spacing, typography, fonts, useBreakpoint, MIN_TOUCH_TARGET } from '../../theme';

export type JobsSegment = 'discover' | 'saved' | 'applications' | 'posted';

interface Segment {
  key: JobsSegment;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  href: string;
}

const SEEKER_SEGMENTS: Segment[] = [
  { key: 'discover', label: 'Discover', icon: 'compass-outline', href: '/jobs' },
  { key: 'saved', label: 'Saved', icon: 'bookmark-outline', href: '/jobs/saved' },
  { key: 'applications', label: 'Applications', icon: 'document-text-outline', href: '/jobs/applications' },
];

const POSTED_SEGMENT: Segment = {
  key: 'posted', label: 'Posted', icon: 'megaphone-outline', href: '/jobs/posted',
};

/**
 * Jobs' own navigation.
 *
 * The bottom tab bar is full — five tabs is the limit before targets get too
 * narrow to hit — so Saved, Applications and Posted live under Jobs rather than
 * beside it. They are real routes, not local state, which is what makes
 * /jobs/saved deep-linkable and makes the hardware Back button do the obvious
 * thing instead of exiting the tab.
 *
 * "Posted" is shown to employer accounts and to any professional who can
 * advertise work — a consultant arranging cover for their own list needs it,
 * and that is an ordinary case in Indian private practice, not an edge one.
 */
export function JobsSegmentedNav({ active }: { active: JobsSegment }) {
  const { user } = useAuth();
  const { isMobile } = useBreakpoint();
  const router = useRouter();

  const canPost = !!user?.role;
  const segments = canPost ? [...SEEKER_SEGMENTS, POSTED_SEGMENT] : SEEKER_SEGMENTS;

  const content = (
    <View style={styles.row} accessibilityRole="tablist">
      {segments.map(segment => {
        const selected = segment.key === active;
        return (
          <Pressable
            key={segment.key}
            testID={`jobs-segment-${segment.key}`}
            onPress={() => {
              // replace, not push: these are peers. Pushing would stack
              // Discover → Saved → Discover and make Back walk backwards
              // through the user's own browsing history of tabs.
              if (!selected) router.replace(segment.href as any);
            }}
            accessibilityRole="tab"
            accessibilityState={{ selected }}
            accessibilityLabel={segment.label}
            style={({ pressed }) => [
              styles.segment, selected && styles.segmentActive, pressed && styles.pressed,
            ]}
          >
            <Ionicons
              name={segment.icon}
              size={16}
              color={selected ? colors.white : colors.textSecondary}
            />
            <Text style={[styles.label, selected && styles.labelActive]}>{segment.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );

  // Four segments do not fit across a 320pt phone, and wrapping them onto two
  // lines costs a card's worth of feed on every screen. A scroller is the right
  // trade here specifically because the items are peers with a clear selected
  // state — nothing is hidden that the user has to discover.
  return isMobile ? (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.scroller}
    >
      {content}
    </ScrollView>
  ) : (
    <View style={styles.wide}>{content}</View>
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
