import React from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, radius, spacing, typography, fonts, MIN_TOUCH_TARGET, gloss, isPremium } from '../../theme';
import { SORT_LABELS, type JobFilters, type JobSort } from '../../types/jobs';

const SORTS: JobSort[] = ['newest', 'pay_high', 'closing_soon', 'urgent'];

/**
 * The always-visible strip above the list: search, sort, and the way into the
 * full filter set.
 *
 * There is deliberately no "Most relevant" sort. Nothing in this stack can
 * rank — search is a trigram substring match, not a scoring function — so a
 * control offering Relevance would be sorting by date and calling it something
 * else. When a query is present the default chip reads "Newest matches", which
 * is what it actually does.
 *
 * The sort chips wrap rather than sitting in a horizontal ScrollView. A clipped
 * row hides options with no affordance saying they exist, and it gets worse at
 * larger text sizes, which is exactly when it matters most.
 */
export function JobFilterBar({
  query,
  onQueryChange,
  filters,
  onSortChange,
  onOpenFilters,
  activeCount,
  resultLabel,
}: {
  query: string;
  onQueryChange: (value: string) => void;
  filters: JobFilters;
  onSortChange: (sort: JobSort) => void;
  onOpenFilters: () => void;
  activeCount: number;
  resultLabel?: string;
}) {
  const sort = filters.sort ?? 'newest';
  const searching = !!filters.q?.trim();

  return (
    <View style={styles.wrap}>
      <View style={styles.searchRow}>
        <View style={styles.searchBar}>
          <Ionicons name="search" size={18} color={colors.textSecondary} />
          <TextInput maxLength={100}
            testID="jobs-search"
            style={styles.searchInput}
            value={query}
            onChangeText={onQueryChange}
            placeholder="Search roles, specialties or hospitals"
            placeholderTextColor={colors.textMuted}
            autoCorrect={false}
            returnKeyType="search"
            accessibilityLabel="Search jobs"
          />
          {query ? (
            <Pressable
              onPress={() => onQueryChange('')}
              accessibilityRole="button"
              accessibilityLabel="Clear search"
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Ionicons name="close-circle" size={18} color={colors.textMuted} />
            </Pressable>
          ) : null}
        </View>

        <Pressable
          testID="jobs-open-filters"
          onPress={onOpenFilters}
          accessibilityRole="button"
          accessibilityLabel={
            activeCount ? `Filters, ${activeCount} applied` : 'Filters'
          }
          hitSlop={isPremium ? { top: 4, bottom: 4 } : undefined}
          style={({ pressed }) => [
            styles.filterBtn,
            isPremium && styles.cFilterBtn,
            activeCount > 0 && styles.filterBtnActive,
            pressed && styles.pressed,
          ]}
        >
          <Ionicons
            name="options-outline"
            size={isPremium ? 15 : 18}
            color={activeCount ? colors.white : colors.text}
          />
          <Text style={[styles.filterText, isPremium && styles.cFilterText, activeCount > 0 && styles.filterTextActive]}>
            {activeCount ? `Filters (${activeCount})` : 'Filters'}
          </Text>
        </Pressable>
      </View>

      <View style={styles.sortRow} accessibilityRole="tablist">
        {SORTS.map(key => {
          const active = sort === key;
          const label = key === 'newest' && searching ? 'Newest matches' : SORT_LABELS[key];
          return (
            <Pressable
              key={key}
              testID={`jobs-sort-${key}`}
              onPress={() => onSortChange(key)}
              accessibilityRole="tab"
              accessibilityState={{ selected: active }}
              accessibilityLabel={`Sort by ${label}`}
              hitSlop={isPremium ? { top: 7, bottom: 7, left: 3, right: 3 } : undefined}
              style={({ pressed }) => [
                styles.sortChip,
                isPremium && styles.cSortChip,
                active && styles.sortChipActive,
                pressed && styles.pressed,
              ]}
            >
              <Text style={[styles.sortText, isPremium && styles.cSortText, active && styles.sortTextActive]}>{label}</Text>
            </Pressable>
          );
        })}
      </View>

      {resultLabel ? (
        // One atomic status string, not a bare number: a screen reader
        // announcing "247" on its own says nothing about what changed.
        <Text
          style={styles.resultCount}
          accessibilityRole="text"
          accessibilityLiveRegion="polite"
          testID="jobs-result-count"
        >
          {resultLabel}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: isPremium ? spacing.sm : spacing.md, paddingBottom: isPremium ? spacing.sm : spacing.md },
  searchRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  searchBar: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    paddingHorizontal: spacing.md,
    minHeight: MIN_TOUCH_TARGET,
    // Premium: search is a compact recessed pill, as in the header.
    ...(isPremium ? {
      backgroundColor: colors.bgMuted, borderColor: 'transparent', borderRadius: radius.pill, paddingHorizontal: spacing.md + 2,
      minHeight: 38,
      ...(Platform.OS === 'web' ? ({ boxShadow: 'inset 0 1px 2px rgba(15,23,42,0.06)' } as object) : {}),
    } : {}),
  },
  searchInput: isPremium
    ? { flex: 1, fontSize: 13, fontFamily: fonts.body.medium, color: colors.text, paddingVertical: 6 }
    : { flex: 1, ...typography.body, color: colors.text, paddingVertical: spacing.sm },

  filterBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs + 2,
    paddingHorizontal: spacing.md,
    minHeight: MIN_TOUCH_TARGET,
    borderRadius: isPremium ? radius.pill : radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.white,
    ...gloss.glass,
  },
  filterBtnActive: { backgroundColor: colors.action, ...gloss.fill, borderColor: colors.action },
  filterText: { ...typography.label, color: colors.text },
  filterTextActive: { color: colors.white },

  // flexWrap, not a horizontal scroller: options must never be clipped out of
  // sight, and this row grows with the user's text size.
  sortRow: { flexDirection: 'row', flexWrap: 'wrap', gap: isPremium ? 6 : spacing.sm },
  sortChip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.white,
    minHeight: 36,
    justifyContent: 'center',
    ...gloss.glass,
  },
  sortChipActive: { backgroundColor: colors.action, ...gloss.fill, borderColor: colors.action },
  sortText: { ...typography.caption, color: colors.textSecondary },
  sortTextActive: { color: colors.white, fontFamily: fonts.body.semibold },

  resultCount: { ...typography.caption, color: colors.textSecondary },
  // -- Premium: compact controls (touch area restored by hit slop) -----------
  cFilterBtn: { minHeight: 38, paddingHorizontal: spacing.md, gap: 5 },
  cFilterText: { fontSize: 13, lineHeight: 17 },
  cSortChip: { minHeight: 30, paddingVertical: 4, paddingHorizontal: spacing.md },
  cSortText: { fontSize: 12, lineHeight: 16 },
  pressed: { opacity: 0.7 },
});
