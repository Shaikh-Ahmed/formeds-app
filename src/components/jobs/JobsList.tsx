import React, { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, RefreshControl, StyleSheet, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { useAuth } from '../../context/AuthContext';
import { usePaginatedList } from '../../hooks/usePaginatedList';
import { useDebounced } from '../../hooks/useDebounced';
import { focusScrollInset, type CollapsibleScrollProps } from '../../hooks/useCollapsibleHeader';
import { colors, spacing } from '../../theme';
import { EmptyState, ErrorState } from '../States';
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
}: {
  scrollProps?: CollapsibleScrollProps;
  contentInsetTop?: number;
  /** Highlights a row in the split view. */
  selectedId?: string | null;
  onSelect: (job: Job) => void;
  compact?: boolean;
  emptyAction?: { label: string; onPress: () => void };
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
            // Never a dead end. If filters are the reason nothing matched,
            // the way out is the action; if the board is genuinely empty,
            // the action is whatever the host screen offers instead.
            <EmptyState
              icon={filtering ? 'search-outline' : 'briefcase-outline'}
              title={filtering ? 'No matching opportunities' : 'No opportunities yet'}
              hint={
                filtering
                  ? 'Try a broader search, or widen the location and pay filters.'
                  : 'New roles and locum shifts will appear here as they are posted.'
              }
              actionLabel={filtering ? 'Clear filters' : emptyAction?.label}
              onAction={
                filtering
                  ? () => { setFilters({ sort: filters.sort }); setSearch(''); }
                  : emptyAction?.onPress
              }
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

const styles = StyleSheet.create({
  flex: { flex: 1 },
  list: { padding: spacing.lg, paddingBottom: spacing.xxxl * 2, gap: spacing.md },
  listCompact: { padding: spacing.md, gap: spacing.sm },
  footer: { paddingVertical: spacing.lg },
});
