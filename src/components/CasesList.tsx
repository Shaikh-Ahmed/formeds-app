import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, FlatList, ScrollView, TextInput, TouchableOpacity, ActivityIndicator, RefreshControl } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { useAuth } from '../context/AuthContext';
import { apiFetch } from '../utils/api';
import { usePaginatedList } from '../hooks/usePaginatedList';
import { colors, radius, spacing, typography, fonts, MIN_TOUCH_TARGET } from '../theme';
import { CaseCard } from './CaseCard';
import { TagChip } from './TagChip';
import { LoadingState, EmptyState, ErrorState } from './States';
import { CASE_SORTS, type CaseSort, type CaseTag, type CaseThread } from '../types/cases';

const SEARCH_DEBOUNCE_MS = 400;

/**
 * The Cases tab body: the forum's browse surface.
 *
 * Lives here rather than in `app/(tabs)/community.tsx` because everything under
 * `app/` is a route — this is a panel, not a screen.
 */
export function CasesList() {
  const { token } = useAuth();
  const router = useRouter();

  const [sort, setSort] = useState<CaseSort>('active');
  const [tag, setTag] = useState<string | null>(null);
  const [savedOnly, setSavedOnly] = useState(false);
  const [search, setSearch] = useState('');
  const [query, setQuery] = useState('');
  const [tags, setTags] = useState<CaseTag[]>([]);

  // Debounced so a typed word is one request, not one per keystroke.
  useEffect(() => {
    const timer = setTimeout(() => setQuery(search.trim()), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [search]);

  const path = useMemo(() => {
    if (savedOnly) return '/api/cases/saved';
    const params = [`sort=${sort}`];
    if (tag) params.push(`tag=${encodeURIComponent(tag)}`);
    if (query) params.push(`q=${encodeURIComponent(query)}`);
    return `/api/cases/?${params.join('&')}`;
  }, [sort, tag, query, savedOnly]);

  const { items, loading, refreshing, loadingMore, error, load, refresh, loadMore } =
    usePaginatedList<CaseThread>({ path, token });

  // `load` changes identity whenever `path` does, so this covers both returning
  // to the tab and switching a filter — no separate reload effect needed.
  useFocusEffect(useCallback(() => { load(); }, [load]));

  useEffect(() => {
    apiFetch('/api/cases/tags', token).then(setTags).catch(() => setTags([]));
  }, [token]);

  const selectTag = (next: string) => setTag(prev => (prev === next ? null : next));

  const filtersActive = !!tag || !!query || savedOnly;
  const emptyHint = filtersActive
    ? 'Nothing matches these filters yet. Try clearing them.'
    : 'Post the first one — a question with the workup so far gets answers fastest.';

  return (
    <View style={styles.flex}>
      <View style={styles.controls}>
        <View style={styles.searchBar}>
          <Ionicons name="search" size={18} color={colors.textMuted} />
          <TextInput
            testID="case-search-input"
            style={styles.searchInput}
            placeholder="Search cases…"
            placeholderTextColor={colors.textMuted}
            value={search}
            onChangeText={setSearch}
            returnKeyType="search"
            accessibilityLabel="Search cases"
          />
          {search ? (
            <TouchableOpacity onPress={() => setSearch('')} accessibilityRole="button" accessibilityLabel="Clear search">
              <Ionicons name="close-circle" size={18} color={colors.textMuted} />
            </TouchableOpacity>
          ) : null}
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
          {CASE_SORTS.map(option => {
            const active = !savedOnly && sort === option.key;
            return (
              <TouchableOpacity
                key={option.key}
                testID={`case-sort-${option.key}`}
                onPress={() => { setSavedOnly(false); setSort(option.key); }}
                style={[styles.chip, active && styles.chipActive]}
                accessibilityRole="tab"
                accessibilityState={{ selected: active }}
              >
                <Text style={[styles.chipText, active && styles.chipTextActive]}>{option.label}</Text>
              </TouchableOpacity>
            );
          })}
          {/* Saved is a per-account list, so it only exists for a signed-in
              reader — offering it signed-out would just buy a 401. */}
          {token ? (
            <TouchableOpacity
              testID="case-sort-saved"
              onPress={() => setSavedOnly(v => !v)}
              style={[styles.chip, savedOnly && styles.chipActive]}
              accessibilityRole="tab"
              accessibilityState={{ selected: savedOnly }}
            >
              <Ionicons
                name={savedOnly ? 'bookmark' : 'bookmark-outline'}
                size={13}
                color={savedOnly ? colors.white : colors.textSecondary}
              />
              <Text style={[styles.chipText, savedOnly && styles.chipTextActive]}>Saved</Text>
            </TouchableOpacity>
          ) : null}
        </ScrollView>

        {!savedOnly && tags.length > 0 ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
            {tags.map(t => (
              <TagChip
                key={t.tag}
                testID={`case-tag-${t.tag}`}
                label={t.tag}
                count={t.count}
                selected={tag === t.tag}
                onPress={() => selectTag(t.tag)}
              />
            ))}
          </ScrollView>
        ) : null}
      </View>

      {loading ? (
        <LoadingState label="Loading cases…" />
      ) : error && items.length === 0 ? (
        <ErrorState message={error} onRetry={load} />
      ) : (
        <FlatList
          data={items}
          keyExtractor={item => item.id}
          renderItem={({ item }) => (
            <CaseCard
              item={item}
              onPress={() => router.push({ pathname: '/case/[id]', params: { id: item.id } } as any)}
              onTagPress={savedOnly ? undefined : selectTag}
            />
          )}
          contentContainerStyle={styles.list}
          keyboardShouldPersistTaps="handled"
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={colors.navy} />}
          onEndReached={loadMore}
          onEndReachedThreshold={0.5}
          ListFooterComponent={loadingMore ? <ActivityIndicator style={styles.footer} color={colors.navy} /> : null}
          ListEmptyComponent={
            <EmptyState
              icon={savedOnly ? 'bookmark-outline' : 'help-buoy-outline'}
              title={savedOnly ? 'Nothing saved yet' : 'No cases here yet'}
              hint={savedOnly ? 'Bookmark a case to keep it here for later.' : emptyHint}
              actionLabel={filtersActive ? 'Clear filters' : 'Post a case'}
              onAction={
                filtersActive
                  ? () => { setTag(null); setSearch(''); setQuery(''); setSavedOnly(false); }
                  : () => router.push('/case/new' as any)
              }
            />
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  controls: {
    backgroundColor: colors.white,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
    gap: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.bg,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    paddingHorizontal: spacing.md,
    minHeight: MIN_TOUCH_TARGET,
  },
  searchInput: { flex: 1, ...typography.body, color: colors.text, paddingVertical: spacing.sm },
  chipRow: { flexDirection: 'row', gap: spacing.sm, paddingRight: spacing.lg },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: colors.bgMuted,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm - 2,
  },
  chipActive: { backgroundColor: colors.navy },
  chipText: { ...typography.small, fontFamily: fonts.body.semibold, color: colors.textSecondary },
  chipTextActive: { color: colors.white },
  list: { padding: spacing.lg, paddingBottom: 100 },
  footer: { paddingVertical: spacing.xl },
});
