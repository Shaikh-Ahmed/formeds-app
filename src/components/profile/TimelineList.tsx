import React, { useState } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, typography, fonts, compactAction } from '../../theme';
import { Chip } from '../Chip';
import { VerifiedMark } from './VerifiedMark';
import { VerificationStatus } from '../../types/profile';

export interface TimelineItem {
  id: string;
  title: string;
  subtitle?: string;
  meta?: string;
  dateRange?: string;
  bullets?: string[];
  tags?: string[];
  isCurrent?: boolean;
  /** Rendered above the title, e.g. "Residency" for training entries. */
  kicker?: string;
  status?: VerificationStatus;
}

interface Props {
  items: TimelineItem[];
  editable?: boolean;
  onEdit?: (id: string) => void;
  /** Cap before a "Show all" expander appears. */
  maxVisible?: number;
  testID?: string;
}

/**
 * The career rail, shared by Experience and Education.
 *
 * A timeline rather than a list of cards, because progression is the thing a
 * reader is actually scanning for — a filled dot marks the current role, hollow
 * ones the path to it. This is the one visual device on the profile that earns
 * its place beyond typography, so it is used for exactly these two sections and
 * nowhere else.
 *
 * Long sections cap and expand rather than collapsing into an accordion: a
 * resume should read top to bottom, and an accordion hides the very thing a
 * recruiter came to skim.
 */
export function TimelineList({ items, editable, onEdit, maxVisible = 3, testID }: Props) {
  const [expanded, setExpanded] = useState(false);
  const hidden = Math.max(0, items.length - maxVisible);
  const visible = expanded ? items : items.slice(0, maxVisible);

  return (
    <View testID={testID}>
      {visible.map((item, index) => {
        const isLast = index === visible.length - 1 && !hidden;
        return (
          <View key={item.id} style={styles.row}>
            <View style={styles.rail}>
              <View style={[styles.dot, item.isCurrent ? styles.dotCurrent : styles.dotPast]} />
              {isLast ? null : <View style={styles.line} />}
            </View>

            <View style={[styles.body, isLast && styles.bodyLast]}>
              <View style={styles.titleRow}>
                <View style={styles.titleCol}>
                  {item.kicker ? <Text style={styles.kicker}>{item.kicker}</Text> : null}
                  <Text style={styles.title}>{item.title}</Text>
                </View>
                {editable && onEdit ? (
                  <Pressable
                    onPress={() => onEdit(item.id)}
                    hitSlop={compactAction.hitSlop}
                    accessibilityRole="button"
                    accessibilityLabel={`Edit ${item.title}`}
                    style={({ pressed }) => pressed && styles.pressed}
                    testID={testID ? `${testID}-edit-${item.id}` : undefined}
                  >
                    <Ionicons name="pencil" size={15} color={colors.textMuted} />
                  </Pressable>
                ) : null}
              </View>

              {item.subtitle ? <Text style={styles.subtitle}>{item.subtitle}</Text> : null}

              <View style={styles.metaRow}>
                {item.dateRange ? <Text style={styles.meta}>{item.dateRange}</Text> : null}
                {item.dateRange && item.meta ? <Text style={styles.metaDot}>·</Text> : null}
                {item.meta ? <Text style={styles.meta}>{item.meta}</Text> : null}
                {item.status ? <VerifiedMark status={item.status} compact /> : null}
              </View>

              {item.bullets && item.bullets.length ? (
                <View style={styles.bullets}>
                  {item.bullets.map((line, i) => (
                    <View key={i} style={styles.bulletRow}>
                      <Text style={styles.bulletMark}>•</Text>
                      <Text style={styles.bulletText}>{line}</Text>
                    </View>
                  ))}
                </View>
              ) : null}

              {item.tags && item.tags.length ? (
                <View style={styles.tags}>
                  {item.tags.map((tag) => (
                    <Chip key={tag} label={tag} tone="neutral" />
                  ))}
                </View>
              ) : null}
            </View>
          </View>
        );
      })}

      {hidden ? (
        <Pressable
          onPress={() => setExpanded((v) => !v)}
          accessibilityRole="button"
          accessibilityState={{ expanded }}
          accessibilityLabel={expanded ? 'Show fewer entries' : `Show all ${items.length} entries`}
          style={({ pressed }) => [styles.expander, pressed && styles.pressed]}
          testID={testID ? `${testID}-expand` : undefined}
        >
          <Text style={styles.expanderText}>
            {expanded ? 'Show less' : `Show all ${items.length}`}
          </Text>
          <Ionicons
            name={expanded ? 'chevron-up' : 'chevron-down'}
            size={14}
            color={colors.navy}
          />
        </Pressable>
      ) : null}
    </View>
  );
}

const DOT = 9;

const styles = StyleSheet.create({
  row: { flexDirection: 'row' },
  rail: { width: spacing.xl, alignItems: 'center', paddingTop: 5 },
  dot: { width: DOT, height: DOT, borderRadius: DOT / 2, borderWidth: 2 },
  // Filled marks the current role; hollow marks the path to it. Shape, not just
  // colour, so the distinction survives a colour-vision difference.
  dotCurrent: { backgroundColor: colors.teal, borderColor: colors.teal },
  dotPast: { backgroundColor: colors.white, borderColor: colors.border },
  line: { flex: 1, width: 1, backgroundColor: colors.border, marginTop: 4 },

  body: { flex: 1, paddingLeft: spacing.md, paddingBottom: spacing.xl },
  bodyLast: { paddingBottom: 0 },

  titleRow: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm },
  titleCol: { flex: 1 },
  kicker: {
    ...typography.small,
    fontFamily: fonts.body.semibold,
    color: colors.teal,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    marginBottom: 2,
  },
  title: { ...typography.h3, fontSize: 16, color: colors.text },
  subtitle: {
    ...typography.body,
    fontSize: 14,
    color: colors.textSecondary,
    marginTop: 1,
  },

  metaRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: spacing.xs + 2, marginTop: spacing.xs },
  meta: { ...typography.small, color: colors.textMuted },
  metaDot: { ...typography.small, color: colors.textMuted },

  bullets: { marginTop: spacing.sm, gap: 3 },
  bulletRow: { flexDirection: 'row', gap: spacing.sm },
  bulletMark: { ...typography.caption, color: colors.textMuted, lineHeight: 19 },
  bulletText: { ...typography.caption, color: colors.textSecondary, flex: 1, lineHeight: 19 },

  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs + 2, marginTop: spacing.md },

  expander: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginTop: spacing.md,
    marginLeft: spacing.xl + spacing.md,
    minHeight: 32,
  },
  expanderText: { ...typography.caption, fontFamily: fonts.body.semibold, color: colors.navy },
  pressed: { opacity: 0.6 },
});
