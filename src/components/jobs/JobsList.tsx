import React, { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, RefreshControl, StyleSheet, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { useAuth } from '../../context/AuthContext';
import { usePaginatedList } from '../../hooks/usePaginatedList';
import { useDebounced } from '../../hooks/useDebounced';
import { focusScrollInset, type CollapsibleScrollProps } from '../../hooks/useCollapsibleHeader';
import { colors, spacing } from '../../theme';
import { EmptyState, ErrorState } from '../States';
import { Button } from '../Button';
import { JobCard } from './JobCard';
import { JobListSkeleton } from './JobCardSkeleton';
import { JobFilterBar } from './JobFilterBar';
import { JobFiltersSheet } from './JobFiltersSheet';
import { activeFilterCount, jobsPath, toggleSaveJob } from '../../api/jobs';
import type { Job, JobFilters, JobSort } from '../../types/jobs';

const SEARCH_DEBOUNCE_MS = 350;

/**
 * The browse surface, used by Discover on every width and by the list pane of
 * the desktop split view.
 *
 * Structured after `CasesList`, including the two non-obvious parts:
 *
 *  - The filter strip is passed as an ELEMENT, not a component reference. Handing
 *    `ListHeaderComponent` a component means React remounts it on every render,
 *    which drops focus out of the search box after the first character.
 *  - Loading renders skeletons in place of the list rather than replacing the
 *    screen with a spinner, so the header stays put and nothing reflows when
 *    results land.
 */
export function JobsList({
  scrollProps,
  contentInsetTop = 0,
  selectedId,
  onSelect,
  compact = false,
  emptyAction,
  onSaveSearch,
}: {
  scrollProps?: CollapsibleScrollProps;
  contentInsetTop?: number;
  /** Highlights a row in the split view. */
  selectedId?: string | null;
  onSelect: (job: Job) => void;
  compact?: boolean;
  emptyAction?: { label: string; onPress: () => void };
  /** Offered when a search returns nothing worth waiting for. */
  onSaveSearch?: (filters: JobFilters) => void;
}) {
  const { token } = useAuth();

  const [search, setSearch] = useState('');
  const [filters, setFilters] = useState<JobFilters>({ sort: 'newest' });
  const [showFilters, setShowFilters] = useState(false);

  const debouncedSearch = useDebounced(search, SEARCH_DEBOUNCE_MS);
  const effective = useMemo<JobFilters>(
    () => ({ ...filters, q: debouncedSearch.trim() || undefined }),
    [filters, debouncedSearch],
  );

  const path = useMemo(() => jobsPath(effective), [effective]);
  const {
    items, setItems, loading, refreshing, loadingMore, error, meta, load, refresh, loadMore,
  } = usePaginatedList<Job>({ path, token });

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const count = activeFilterCount(effective);
  const filtering = count > 0 || !!effective.q;

  /**
   * Optimistic save. The bookmark flips immediately and is put back if the
   * request fails — a save is a one-tap action people do while scrolling, and
   * waiting a round trip to see the icon change makes the list feel broken.
   */
  const onToggleSave = useCallback(async (job: Job) => {
    if (!token) return;
    const next = !job.saved;
    setItems(prev => prev.map(j => (j.id === job.id ? { ...j, saved: next } : j)));
    try {
      const res = await toggleSaveJob(token, job.id);
      setItems(prev => prev.map(j => (j.id === job.id ? { ...j, saved: res.saved } : j)));
    } catch {
      setItems(prev => prev.map(j => (j.id === job.id ? { ...j, saved: !next } : j)));
    }
  }, [token, setItems]);

  const resultLabel = useMemo(() => {
    if (loading || meta.total == null) return undefined;
    const n = meta.total;
    if (n === 0) return undefined;
    const shown = meta.total_capped ? `${n}+` : `${n}`;
    return `${shown} ${n === 1 ? 'opportunity' : 'opportunities'} found`;
  }, [loading, meta]);

  const header = (
    <JobFilterBar
      query={search}
      onQueryChange={setSearch}
      filters={effective}
      onSortChange={(sort: JobSort) => setFilters(prev => ({ ...prev, sort }))}
      onOpenFilters={() => setShowFilters(true)}
      activeCount={count}
      resultLabel={resultLabel}
    />
  );

  return (
    <View style={styles.flex}>
      <FlatList
        data={loading ? [] : items}
        {...scrollProps}
        style={focusScrollInset(contentInsetTop)}
        keyExtractor={item => item.id}
        renderItem={({ item }) => (
          <JobCard
            item={item}
            selected={item.id === selectedId}
            compact={compact}
            onPress={() => onSelect(item)}
            onToggleSave={token ? onToggleSave : undefined}
          />
        )}
        contentContainerStyle={[
          styles.list,
          compact && styles.listCompact,
          { paddingTop: contentInsetTop + spacing.lg },
        ]}
        keyboardShouldPersistTaps="handled"
        ListHeaderComponent={header}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={refresh}
            tintColor={colors.navy}
            progressViewOffset={contentInsetTop}
          />
        }
        onEndReached={loadMore}
        onEndReachedThreshold={0.5}
        ListFooterComponent={
          loadingMore ? <ActivityIndicator style={styles.footer} color={colors.navy} /> : null
        }
        ListEmptyComponent={
          loading ? (
            <JobListSkeleton compact={compact} />
          ) : error ? (
            <ErrorState message={error} onRetry={load} />
          ) : (
            // Never a dead end, and the way out depends on why nothing
            // matched. Offering "search nearby" to somebody who set no city
            // would be noise; offering "clear everything" to somebody who set
            // one filter throws away work they meant.
            <NoResults
              filtering={filtering}
              canBroaden={!!effective.city}
              city={effective.city}
              onBroaden={() => setFilters(prev => ({ ...prev, city: undefined }))}
              onClear={() => { setFilters({ sort: filters.sort }); setSearch(''); }}
              onSaveSearch={token && filtering ? () => onSaveSearch?.(effective) : undefined}
              emptyAction={emptyAction}
            />
          )
        }
      />

      <JobFiltersSheet
        visible={showFilters}
        filters={effective}
        onClose={() => setShowFilters(false)}
        onApply={next => {
          // The sheet owns `q` only so "Clear all" can preserve it; the search
          // box remains the source of truth for the query itself.
          const { q: _q, ...rest } = next;
          setFilters(rest);
          setShowFilters(false);
        }}
      />
    </View>
  );
}

/**
 * What to offer when nothing matched.
 *
 * Three different situations, three different ways out. Widening the city is
 * the single most effective one — most empty results in a young marketplace are
 * a location filter on a board that has nothing in that city yet — so it leads
 * when it applies.
 */
function NoResults({
  filtering, canBroaden, city, onBroaden, onClear, onSaveSearch, emptyAction,
}: {
  filtering: boolean;
  canBroaden: boolean;
  city?: string;
  onBroaden: () => void;
  onClear: () => void;
  onSaveSearch?: () => void;
  emptyAction?: { label: string; onPress: () => void };
}) {
  if (!filtering) {
    return (
      <EmptyState
        icon="briefcase-outline"
        title="No opportunities yet"
        hint="New roles and locum shifts will appear here as they are posted."
        actionLabel={emptyAction?.label}
        onAction={emptyAction?.onPress}
      />
    );
  }

  return (
    <View style={styles.noResults} testID="jobs-no-results">
      <EmptyState
        icon="search-outline"
        title="No matching opportunities"
        hint={
          canBroaden
            ? `Nothing in ${city} right now. Widening the search usually helps.`
            : 'Try fewer filters, or a broader search term.'
        }
      />
      <View style={styles.recovery}>
        {canBroaden ? (
          <Button
            label="Search the whole state"
            onPress={onBroaden}
            testID="jobs-broaden"
          />
        ) : null}
        <Button
          label="Clear filters"
          variant="outline"
          onPress={onClear}
          testID="jobs-clear-filters"
        />
        {onSaveSearch ? (
          // The honest option when the board genuinely has nothing: stop
          // looking, and be told when something arrives.
          <Button
            label="Tell me when one appears"
            variant="outline"
            onPress={onSaveSearch}
            testID="jobs-save-search"
          />
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  noResults: { gap: spacing.md },
  recovery: { gap: spacing.sm, paddingHorizontal: spacing.xl },
  flex: { flex: 1 },
  list: { padding: spacing.lg, paddingBottom: spacing.xxxl * 2, gap: spacing.md },
  listCompact: { padding: spacing.md, gap: spacing.sm },
  footer: { paddingVertical: spacing.lg },
});
