import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, radius, spacing } from '../theme';
import type { VoteValue } from '../types/cases';

interface Props {
  score: number;
  myVote: VoteValue;
  onVote: (value: 1 | -1) => void;
  /** Own posts and removed posts can't be voted on — the server enforces this too. */
  disabled?: boolean;
  /** 'column' for the detail rail, 'row' for compact list/reply footers. */
  orientation?: 'column' | 'row';
  testID?: string;
}

/**
 * The up/score/down control shared by cases, answers and replies.
 *
 * Direction is never signalled by colour alone: the active arrow also fills in
 * (outline → solid) and the count takes the arrow's colour, so the state
 * survives greyscale and colour-vision differences.
 */
export function VoteControl({ score, myVote, onVote, disabled, orientation = 'column', testID }: Props) {
  const row = orientation === 'row';
  const activeColor = myVote === 1 ? colors.teal : myVote === -1 ? colors.red : colors.textMuted;

  const arrow = (dir: 1 | -1) => {
    const active = myVote === dir;
    const up = dir === 1;
    return (
      <TouchableOpacity
        testID={testID ? `${testID}-${up ? 'up' : 'down'}` : undefined}
        onPress={() => onVote(dir)}
        disabled={disabled}
        hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
        style={[styles.arrow, row && styles.arrowRow, disabled && styles.disabled]}
        accessibilityRole="button"
        accessibilityState={{ selected: active, disabled: !!disabled }}
        accessibilityLabel={up ? 'Upvote' : 'Downvote'}
        accessibilityHint={active ? 'Tap again to remove your vote' : undefined}
      >
        <Ionicons
          name={up ? (active ? 'arrow-up-circle' : 'arrow-up-circle-outline')
                   : (active ? 'arrow-down-circle' : 'arrow-down-circle-outline')}
          size={row ? 20 : 26}
          color={active ? (up ? colors.teal : colors.red) : colors.textMuted}
        />
      </TouchableOpacity>
    );
  };

  return (
    <View
      style={[styles.wrap, row && styles.wrapRow]}
      accessible={false}
      accessibilityLabel={`Score ${score}`}
    >
      {arrow(1)}
      <Text style={[styles.score, row && styles.scoreRow, { color: activeColor }]}>{score}</Text>
      {arrow(-1)}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', gap: 2 },
  wrapRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs,
             backgroundColor: colors.bgMuted, borderRadius: radius.pill, paddingHorizontal: spacing.sm, paddingVertical: 2 },
  arrow: { width: 34, height: 30, alignItems: 'center', justifyContent: 'center' },
  arrowRow: { width: 26, height: 26 },
  score: { fontSize: 15, fontWeight: '700', minWidth: 20, textAlign: 'center' },
  scoreRow: { fontSize: 13 },
  disabled: { opacity: 0.35 },
});
