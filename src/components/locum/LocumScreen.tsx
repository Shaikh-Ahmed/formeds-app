import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useSubmit } from '../../hooks/useSubmit';
import { ApiError } from '../../utils/api';
import {
  ActivityIndicator, FlatList, Pressable, RefreshControl, StyleSheet, Text, View,
} from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../context/AuthContext';
import { colors, layout, radius, spacing, typography, fonts, useBreakpoint, gloss } from '../../theme';
import { usePaginatedList } from '../../hooks/usePaginatedList';
import { PageGrid } from '../web';
import { Button } from '../Button';
import { EmptyState, ErrorState } from '../States';
import { KycNotice } from '../KycNotice';
import { JobListSkeleton } from '../jobs/JobCardSkeleton';
import { LocumNav } from './LocumNav';
import { LocumCard } from './LocumCard';
import { LocumDetailPanel } from './LocumDetailPanel';
import { LocumApplySheet } from './LocumApplySheet';
import { LocumFiltersSheet } from './LocumFiltersSheet';
import { ChoiceChips } from './ChoiceChips';
import { applyToLocum, fetchLocum, locumsPath } from '../../api/locum';
import {
  LOCUM_SHIFT_LABELS, type Locum, type LocumFilters, type LocumShiftType,
} from '../../types/locum';

const LIST_PANE = 400;

const QUICK_SHIFTS: { value: LocumShiftType; label: string }[] = [
  { value: 'day', label: LOCUM_SHIFT_LABELS.day },
  { value: 'night', label: LOCUM_SHIFT_LABELS.night },
  { value: 'emergency', label: LOCUM_SHIFT_LABELS.emergency },
  { value: 'weekend', label: LOCUM_SHIFT_LABELS.weekend },
];

export function activeLocumFilterCount(filters: LocumFilters): number {
  const { sort: _sort, shift_type: _shift, date_to: _to, ...rest } = filters;
  return Object.values(rest).filter(v => v !== undefined && v !== null && v !== '' && v !== false).length;
}

/**
 * Who may apply from here, and if not, why not -- the same rules the server
 * enforces, surfaced before the tap rather than after it.
 */
export function applyBlocker(
  user: { role?: string } | null | undefined, isKycApproved: boolean,
): { canApply: boolean; reason: string | null } {
  if (!user) return { canApply: false, reason: 'Sign in to apply.' };
  if (user.role !== 'healthcare_professional') return { canApply: false, reason: null };
  if (!isKycApproved) return { canApply: true, reason: 'Complete your verification to apply.' };
  return { canApply: true, reason: null };
}

/**
 * Locum Discover, at every width.
 *
 * The same split-view arrangement as JobsScreen -- a fixed list pane beside a
 * detail pane from the desktop breakpoint up, full-width list with pushed
 * detail below it -- including the first-render guard, because useBreakpoint
 * reports mobile on frame one at any width. It is otherwise much simpler: no
 * search box (the filters are the search) and no collapsing header.
 */
export function LocumScreen({ selectedId = null }: { selectedId?: string | null }) {
  const { token, user, isKycApproved } = useAuth();
  const { isDesktop } = useBreakpoint();
  const router = useRouter();

  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const split = mounted && isDesktop;

  const [filters, setFilters] = useState<LocumFilters>({ sort: 'soonest' });
  const [filtersOpen, setFiltersOpen] = useState(false);
  const path = useMemo(() => locumsPath(filters), [filters]);
  const list = usePaginatedList<Locum>({ path, token });
  const { load } = list;
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const [detail, setDetail] = useState<Locum | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  useEffect(() => {
    if (!selectedId) { setDetail(null); return; }
    let cancelled = false;
    setDetailLoading(true);
    fetchLocum(token, selectedId)
      .then(l => { if (!cancelled) setDetail(l); })
      .catch(() => { if (!cancelled) setDetail(null); })
      .finally(() => { if (!cancelled) setDetailLoading(false); });
    return () => { cancelled = true; };
  }, [selectedId, token]);

  const { canApply, reason } = applyBlocker(user, isKycApproved);
  const [applyFor, setApplyFor] = useState<Locum | null>(null);
  const { submitting: applying, run: runApply } = useSubmit();
  const [applyError, setApplyError] = useState<string | null>(null);

  const open = useCallback((locum: Locum) => {
    const href = `/jobs/locum/${locum.id}` as any;
    if (split) router.replace(href);
    else router.push(href);
  }, [split, router]);

  const startApply = useCallback((locum: Locum) => {
    setApplyError(null);
    if (reason) { open(locum); return; } // the detail explains what is missing
    setApplyFor(locum);
  }, [reason, open]);

  const submit = useCallback((note: string) => runApply(async key => {
    if (!token || !applyFor) return;
    setApplyError(null);
    try {
      // Keyed: a second tap or a retry returns this same application.
      const mine = await applyToLocum(token, applyFor.id, note, key);
      const patch = (l: Locum) => (l.id === applyFor.id ? { ...l, my_application: mine } : l);
      list.setItems(prev => prev.map(patch));
      setDetail(prev => (prev ? patch(prev) : prev));
      setApplyFor(null);
    } catch (e: any) {
      if (e instanceof ApiError && e.code === 'already_applied') { setApplyFor(null); list.refresh?.(); }
      setApplyError(e?.message || 'Could not send your application. Please try again.');
    }
  }, { locum: applyFor?.id, note }), [token, applyFor, list, runApply]);

  const filterCount = activeLocumFilterCount(filters);

  const header = (
    <View style={styles.filterBar}>
      <ChoiceChips
        choices={QUICK_SHIFTS}
        value={filters.shift_type}
        onChange={v => setFilters(f => ({ ...f, shift_type: v ?? undefined }))}
        allowDeselect
        testID="locum-quick-shift"
      />
      <Pressable
        onPress={() => setFiltersOpen(true)}
        accessibilityRole="button"
        accessibilityLabel={`Filters${filterCount ? `, ${filterCount} active` : ''}`}
        style={({ pressed }) => [styles.filterBtn, filterCount > 0 && styles.filterBtnOn,
          pressed && styles.pressed]}
        testID="locum-filters-open"
      >
        <Ionicons name="options-outline" size={16} color={filterCount ? colors.white : colors.navy} />
        <Text style={[styles.filterText, filterCount > 0 && styles.filterTextOn]}>
          {filterCount ? `Filters (${filterCount})` : 'Filters'}
        </Text>
      </Pressable>
    </View>
  );

  const listView = (
    <FlatList
      data={list.loading ? [] : list.items}
      keyExtractor={item => item.id}
      renderItem={({ item }) => (
        <LocumCard
          item={item}
          compact={split}
          selected={split && item.id === selectedId}
          onPress={() => open(item)}
          onApply={canApply ? startApply : undefined}
        />
      )}
      ListHeaderComponent={header}
      contentContainerStyle={styles.list}
      onEndReached={list.loadMore}
      onEndReachedThreshold={0.4}
      refreshControl={
        <RefreshControl refreshing={list.refreshing} onRefresh={list.refresh} tintColor={colors.navy} />
      }
      ListFooterComponent={list.loadingMore ? <ActivityIndicator color={colors.navy} /> : null}
      ListEmptyComponent={
        list.loading ? (
          <JobListSkeleton />
        ) : list.error ? (
          <ErrorState message={list.error} onRetry={list.load} />
        ) : (
          <EmptyState
            icon="flash-outline"
            title={filterCount || filters.shift_type ? 'No locums match' : 'No open locums right now'}
            hint={filterCount || filters.shift_type
              ? 'Try a wider date range or clear a filter.'
              : 'Short-notice shifts appear here the moment a hospital posts one.'}
            actionLabel={filterCount || filters.shift_type ? 'Clear filters' : undefined}
            onAction={filterCount || filters.shift_type
              ? () => setFilters({ sort: filters.sort }) : undefined}
          />
        )
      }
    />
  );

  return (
    <View style={styles.flex}>
      <PageGrid fluid testID="locum-grid">
        <View style={styles.header}>
          <Text style={styles.h1} accessibilityRole="header">Locum shifts</Text>
          <Text style={styles.sub}>
            Short-notice cover from hospitals and clinics — apply in one tap.
          </Text>
        </View>
        <LocumNav active="discover" />
        {user?.role === 'healthcare_professional' ? (
          <View style={styles.notice}><KycNotice action="apply for locums" /></View>
        ) : null}
        {user && user.role !== 'healthcare_professional' ? (
          <View style={styles.postRow}>
            <Button label="Post a locum" onPress={() => router.push('/jobs/locum/new' as any)}
              disabled={!isKycApproved} testID="locum-post-open" />
          </View>
        ) : null}

        {!mounted ? (
          <View style={styles.flex} />
        ) : split ? (
          <View style={styles.split}>
            <View style={styles.listPane}>{listView}</View>
            <View style={styles.detailPane}>
              <LocumDetailPanel
                locum={detail}
                loading={detailLoading}
                embedded
                onApply={canApply ? () => detail && setApplyFor(detail) : undefined}
                applyDisabledReason={reason}
                onManage={() => detail && router.push(`/jobs/locum/manage/${detail.id}` as any)}
                onEdit={() => detail && router.push(`/jobs/locum/edit/${detail.id}` as any)}
                onViewOrganization={orgId => router.push(`/org/${orgId}` as any)}
              />
            </View>
          </View>
        ) : (
          listView
        )}
      </PageGrid>

      <LocumApplySheet
        visible={!!applyFor}
        locum={applyFor}
        onClose={() => setApplyFor(null)}
        onSubmit={submit}
        submitting={applying}
        error={applyError}
      />
      <LocumFiltersSheet
        visible={filtersOpen}
        filters={filters}
        onClose={() => setFiltersOpen(false)}
        onApply={next => { setFilters(next); setFiltersOpen(false); }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  header: { paddingTop: spacing.xl, paddingHorizontal: spacing.lg, gap: spacing.xs, paddingBottom: spacing.sm },
  h1: { ...typography.h2, color: colors.text },
  sub: { ...typography.caption, color: colors.textSecondary, lineHeight: 20 },
  notice: { paddingHorizontal: spacing.lg },
  postRow: { paddingHorizontal: spacing.lg, paddingBottom: spacing.md, alignItems: 'flex-start' },

  filterBar: { gap: spacing.md, paddingBottom: spacing.md },
  filterBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    alignSelf: 'flex-start',
    paddingHorizontal: spacing.md,
    minHeight: 36,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.navy,
    backgroundColor: colors.white,
    ...gloss.glass,
  },
  filterBtnOn: { backgroundColor: colors.action, ...gloss.fill },
  filterText: { ...typography.caption, fontFamily: fonts.body.semibold, color: colors.navy },
  filterTextOn: { color: colors.white },
  pressed: { opacity: 0.7 },

  list: { padding: spacing.lg, paddingBottom: spacing.xxxl * 2, gap: spacing.md },
  split: { flex: 1, flexDirection: 'row', gap: layout.gutter, minHeight: 0 },
  listPane: { width: LIST_PANE, flexGrow: 0, flexShrink: 0 },
  detailPane: {
    flex: 1,
    minWidth: 0,
    backgroundColor: colors.white,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.xxl,
    overflow: 'hidden',
  },
});
