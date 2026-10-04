import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  FlatList,
  RefreshControl,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Animated } from 'react-native';
import { focusScrollInset, type CollapsibleHeader } from '../../hooks/useCollapsibleHeader';
import { useRouter, useFocusEffect } from 'expo-router';
import { useAuth } from '../../context/AuthContext';
import { ResearchPaper } from '../../types/research';
import { fetchResearchPapers, toggleResearchFavorite } from '../../api/research';
import { ResearchCard } from './ResearchCard';
import { ContinueReadingPaperCard } from './ContinueReadingPaperCard';
import { colors, spacing, radius, typography, fonts, shadow } from '../../theme';

const SPECIALTY_FILTERS = [
  'All',
  'Cardiology',
  'Oncology',
  'Neurology',
  'Pediatrics',
  'Infectious Disease',
  'Internal Medicine',
  'Surgery',
  'Critical Care',
  'Pharmacology',
  'Nephrology',
  'Pulmonology',
];

interface Props {
  testID?: string;
  /**
   * Content that sits above the search box in the header -- the page's tabs.
   * With `collapse`, it slides away with the search and chips.
   */
  topSlot?: React.ReactNode;
  /** A collapsible header from useCollapsibleHeader: hides on scroll down. */
  collapse?: CollapsibleHeader;
}

export function ResearchCatalog({ testID, topSlot, collapse }: Props) {
  const router = useRouter();
  const { token, user } = useAuth();

  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [selectedSpecialty, setSelectedSpecialty] = useState('All');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [papers, setPapers] = useState<ResearchPaper[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Debounce search query
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedQuery(searchQuery);
      setPage(1);
    }, 300);
    return () => clearTimeout(handler);
  }, [searchQuery]);

  // Reset to page 1 on filter changes
  const handleSelectSpecialty = (spec: string) => {
    setSelectedSpecialty(spec);
    setPage(1);
  };

  const loadPapers = useCallback(async () => {
    setError(null);
    try {
      const res = await fetchResearchPapers(
        {
          page,
          limit: 10,
          q: debouncedQuery || undefined,
          specialty: selectedSpecialty !== 'All' ? selectedSpecialty : undefined,
        },
        token
      );
      setPapers(res.items || []);
      setTotalPages(res.total_pages || 1);
      setTotalCount(res.total || 0);
    } catch (err: any) {
      console.error('Error fetching research papers:', err);
      setError(err?.message || 'Could not load research catalog. Please try again.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [debouncedQuery, selectedSpecialty, page, token]);

  const isInitialMount = useRef(true);

  useEffect(() => {
    setLoading(true);
    loadPapers();
  }, [loadPapers]);

  // Re-fetch papers only when re-focusing (e.g. returning from reader), not duplicated on initial mount
  useFocusEffect(
    useCallback(() => {
      if (isInitialMount.current) {
        isInitialMount.current = false;
        return;
      }
      loadPapers();
    }, [loadPapers])
  );

  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    loadPapers();
  }, [loadPapers]);

  const handleToggleFavorite = async (paperId: string) => {
    if (!token) {
      router.push('/login');
      return;
    }
    // Optimistic toggle
    setPapers(prev =>
      prev.map(p => (p.id === paperId ? { ...p, is_favorite: !p.is_favorite } : p))
    );
    try {
      const res = await toggleResearchFavorite(paperId, token);
      setPapers(prev =>
        prev.map(p => (p.id === paperId ? { ...p, is_favorite: res.favorited } : p))
      );
    } catch (e) {
      // Revert on error
      setPapers(prev =>
        prev.map(p => (p.id === paperId ? { ...p, is_favorite: !p.is_favorite } : p))
      );
    }
  };

  const handleOpenReader = (paper: ResearchPaper) => {
    router.push({
      pathname: '/learning/reader/[id]',
      params: {
        id: paper.id,
        type: 'research',
        initialPage: paper.last_page ? String(paper.last_page) : undefined,
      },
    });
  };

  // Recent/Continue reading shelf (papers with is_recent: true)
  const recentPapers = useMemo(() => {
    return papers.filter(p => p.is_recent === true);
  }, [papers]);

  return (
    <View style={[styles.container, collapse && styles.collapseHost]} testID={testID || 'research-catalog'}>
      <CollapsingHead collapse={collapse}>
      {topSlot}
      {/* 1. Search Bar */}
      <View style={styles.searchBar}>
        <Ionicons name="search-outline" size={18} color={colors.textMuted} style={styles.searchIcon} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search papers, authors, clinical trials..."
          placeholderTextColor={colors.textMuted}
          value={searchQuery}
          onChangeText={setSearchQuery}
          returnKeyType="search"
          testID="research-search-input"
        />
        {searchQuery.length > 0 && (
          <TouchableOpacity
            onPress={() => setSearchQuery('')}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            testID="clear-search-btn"
          >
            <Ionicons name="close-circle" size={18} color={colors.textMuted} />
          </TouchableOpacity>
        )}
      </View>

      {/* 2. Specialty Chips Filter */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.specialtyChipsContainer}
        style={styles.specialtyChipsScroll}
      >
        {SPECIALTY_FILTERS.map(spec => {
          const isSelected = selectedSpecialty === spec;
          return (
            <TouchableOpacity
              key={spec}
              style={[styles.specialtyChip, isSelected && styles.specialtyChipActive]}
              onPress={() => handleSelectSpecialty(spec)}
              accessibilityRole="button"
              accessibilityState={{ selected: isSelected }}
              testID={`specialty-chip-${spec.toLowerCase().replace(/\s+/g, '-')}`}
            >
              <Text style={[styles.specialtyChipText, isSelected && styles.specialtyChipTextActive]}>
                {spec}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
      </CollapsingHead>

      {/* 3. Catalog Body */}
      {loading && !refreshing ? (
        <View style={[styles.loadingContainer, collapse && { paddingTop: collapse.headerHeight }]} testID="research-loading">
          <ActivityIndicator size="large" color={colors.navy} />
          <Text style={styles.loadingText}>Loading clinical research...</Text>
        </View>
      ) : error ? (
        <View style={[styles.errorContainer, collapse && { paddingTop: collapse.headerHeight + 60 }]} testID="research-error">
          <Ionicons name="alert-circle-outline" size={44} color={colors.redText} />
          <Text style={styles.errorTitle}>Could not load catalog</Text>
          <Text style={styles.errorSubtitle}>{error}</Text>
          <TouchableOpacity style={styles.retryBtn} onPress={loadPapers}>
            <Text style={styles.retryBtnText}>Retry</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          style={[styles.flatList, collapse ? focusScrollInset(collapse.headerHeight) : null]}
          {...(collapse ? collapse.scrollProps : {})}
          data={papers}
          keyExtractor={item => item.id}
          renderItem={({ item }) => (
            <ResearchCard
              paper={item}
              onReadPress={handleOpenReader}
              onToggleFavorite={handleToggleFavorite}
            />
          )}
          contentContainerStyle={[styles.listContent, collapse && { paddingTop: collapse.headerHeight }]}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={colors.navy} />
          }
          ListHeaderComponent={
            recentPapers.length > 0 && !debouncedQuery && selectedSpecialty === 'All' ? (
              <View style={styles.continueSection} testID="continue-reading-research-section">
                <View style={styles.sectionHeaderRow}>
                  <Ionicons name="bookmark" size={16} color={colors.teal} style={{ marginRight: 6 }} />
                  <Text style={styles.sectionTitle}>Continue Reading</Text>
                </View>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.continueList}
                >
                  {recentPapers.map(paper => (
                    <ContinueReadingPaperCard
                      key={`recent-${paper.id}`}
                      paper={paper}
                      onResume={handleOpenReader}
                    />
                  ))}
                </ScrollView>
                <View style={styles.sectionDivider} />
                <Text style={styles.sectionTitle}>All Studies & Research ({totalCount})</Text>
              </View>
            ) : null
          }
          ListFooterComponent={
            papers.length > 0 ? (
              <View style={styles.paginationContainer} testID="research-pagination">
                <Text style={styles.paginationSummary}>
                  Showing {(page - 1) * 10 + 1}-{Math.min(page * 10, totalCount)} of {totalCount} studies
                </Text>
                {totalPages > 1 && (
                  <View style={styles.paginationControls}>
                    <TouchableOpacity
                      style={[styles.pageBtn, page <= 1 && styles.pageBtnDisabled]}
                      onPress={() => setPage(p => Math.max(1, p - 1))}
                      disabled={page <= 1}
                      accessibilityRole="button"
                      accessibilityLabel="Previous page"
                      testID="pagination-prev-btn"
                    >
                      <Ionicons
                        name="chevron-back"
                        size={16}
                        color={page <= 1 ? colors.textMuted : colors.navy}
                      />
                      <Text style={[styles.pageBtnText, page <= 1 && styles.pageBtnTextDisabled]}>Prev</Text>
                    </TouchableOpacity>

                    <View style={styles.pagePill}>
                      <Text style={styles.pagePillText}>
                        Page {page} of {totalPages}
                      </Text>
                    </View>

                    <TouchableOpacity
                      style={[styles.pageBtn, page >= totalPages && styles.pageBtnDisabled]}
                      onPress={() => setPage(p => Math.min(totalPages, p + 1))}
                      disabled={page >= totalPages}
                      accessibilityRole="button"
                      accessibilityLabel="Next page"
                      testID="pagination-next-btn"
                    >
                      <Text style={[styles.pageBtnText, page >= totalPages && styles.pageBtnTextDisabled]}>Next</Text>
                      <Ionicons
                        name="chevron-forward"
                        size={16}
                        color={page >= totalPages ? colors.textMuted : colors.navy}
                      />
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            ) : null
          }
          ListEmptyComponent={
            <View style={styles.emptyContainer} testID="research-empty">
              <Ionicons name="document-text-outline" size={48} color={colors.textMuted} />
              <Text style={styles.emptyTitle}>No research studies found</Text>
              <Text style={styles.emptySubtitle}>
                {searchQuery || selectedSpecialty !== 'All'
                  ? 'Try broadening your search or choosing another specialty.'
                  : 'No medical studies are currently available.'}
              </Text>
              {(searchQuery || selectedSpecialty !== 'All') && (
                <TouchableOpacity
                  style={styles.clearFilterBtn}
                  onPress={() => {
                    setSearchQuery('');
                    setSelectedSpecialty('All');
                  }}
                >
                  <Text style={styles.clearFilterText}>Reset Filters</Text>
                </TouchableOpacity>
              )}
            </View>
          }
        />
      )}
    </View>
  );
}

/**
 * Tabs + search + chips. With a collapsible header they float over the list
 * (which is inset by their height) and slide out of the way on scroll.
 */
function CollapsingHead({ collapse, children }: { collapse?: CollapsibleHeader; children: React.ReactNode }) {
  if (!collapse) return <>{children}</>;
  return (
    <Animated.View style={[styles.floatingHead, collapse.headerStyle]} onLayout={collapse.onHeaderLayout}>
      {children}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  // The list scrolls under the header; the host clips it as it slides away.
  collapseHost: { overflow: 'hidden' },
  floatingHead: { position: 'absolute', top: 0, left: 0, right: 0, zIndex: 2, backgroundColor: colors.bg },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.sm,
    flexShrink: 0,
    ...shadow.card,
  },
  searchIcon: {
    marginRight: spacing.sm,
  },
  searchInput: {
    flex: 1,
    ...typography.body,
    fontSize: 14,
    color: colors.text,
    padding: 0,
  },
  specialtyChipsScroll: {
    flexGrow: 0,
    flexShrink: 0,
    height: 44,
    marginBottom: spacing.md,
  },
  specialtyChipsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs + 2,
    paddingVertical: 2,
    paddingRight: spacing.lg,
  },
  specialtyChip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs + 2,
    borderRadius: radius.pill,
    backgroundColor: colors.bgMuted,
    borderWidth: 1,
    borderColor: colors.border,
  },
  specialtyChipActive: {
    backgroundColor: colors.primaryFill,
    borderColor: colors.primaryFill,
  },
  specialtyChipText: {
    ...typography.small,
    fontSize: 12,
    fontFamily: fonts.body.medium,
    color: colors.textSecondary,
  },
  specialtyChipTextActive: {
    color: colors.white,
    fontFamily: fonts.heading.bold,
  },
  flatList: {
    flex: 1,
  },
  listContent: {
    paddingBottom: 100,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 80,
  },
  loadingText: {
    ...typography.body,
    fontSize: 14,
    color: colors.textMuted,
    marginTop: spacing.md,
  },
  errorContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
    paddingHorizontal: spacing.lg,
  },
  errorTitle: {
    ...typography.h3,
    color: colors.text,
    marginTop: spacing.md,
  },
  errorSubtitle: {
    ...typography.body,
    fontSize: 14,
    color: colors.textMuted,
    textAlign: 'center',
    marginTop: spacing.xs,
    maxWidth: 320,
  },
  retryBtn: {
    backgroundColor: colors.primaryFill,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: radius.pill,
    marginTop: spacing.md,
  },
  retryBtnText: {
    ...typography.bodyStrong,
    color: colors.white,
  },
  continueSection: {
    marginBottom: spacing.md,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  sectionTitle: {
    fontSize: 14,
    fontFamily: fonts.heading.bold,
    color: colors.text,
  },
  continueList: {
    paddingBottom: spacing.sm,
  },
  sectionDivider: {
    height: 1,
    backgroundColor: colors.borderLight,
    marginVertical: spacing.md,
  },
  paginationContainer: {
    alignItems: 'center',
    paddingVertical: spacing.lg,
    borderTopWidth: 1,
    borderTopColor: colors.borderLight,
    marginTop: spacing.md,
  },
  paginationSummary: {
    ...typography.caption,
    color: colors.textMuted,
    marginBottom: spacing.sm,
  },
  paginationControls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  pageBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs + 2,
    borderRadius: radius.pill,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
  },
  pageBtnDisabled: {
    opacity: 0.4,
  },
  pageBtnText: {
    ...typography.small,
    fontFamily: fonts.heading.bold,
    color: colors.navy,
  },
  pageBtnTextDisabled: {
    color: colors.textMuted,
  },
  pagePill: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs + 2,
    backgroundColor: colors.bgMuted,
    borderRadius: radius.pill,
  },
  pagePillText: {
    ...typography.small,
    fontFamily: fonts.body.medium,
    color: colors.textSecondary,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
    paddingHorizontal: spacing.lg,
  },
  emptyTitle: {
    ...typography.h3,
    color: colors.text,
    marginTop: spacing.md,
  },
  emptySubtitle: {
    ...typography.body,
    fontSize: 14,
    color: colors.textMuted,
    textAlign: 'center',
    marginTop: spacing.xs,
    maxWidth: 320,
  },
  clearFilterBtn: {
    backgroundColor: colors.primaryFill,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: radius.pill,
    marginTop: spacing.md,
  },
  clearFilterText: {
    ...typography.bodyStrong,
    color: colors.white,
  },

});