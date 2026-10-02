import React, { useState, useEffect, useCallback, useMemo } from 'react';
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
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useFocusEffect } from 'expo-router';
import { useAuth } from '../../context/AuthContext';
import { Book } from '../../types/books';
import { fetchBooks, toggleBookFavorite } from '../../api/books';
import { BookCard } from './BookCard';
import { ContinueReadingCard } from './ContinueReadingCard';
import { colors, spacing, radius, typography, fonts, shadow } from '../../theme';

const SPECIALTY_FILTERS = [
  'All',
  'Cardiology',
  'Internal Medicine',
  'Surgery',
  'Pediatrics',
  'Emergency Care',
  'Dermatology',
  'Psychiatry',
  'Ob/Gyn',
  'Pharmacology',
  'Radiology',
  'Oncology',
  'Nephrology',
  'Orthopedics',
  'Pathology',
  'Anatomy',
  'Clinical Guide',
];

interface Props {
  testID?: string;
}

export function BooksCatalog({ testID }: Props) {
  const router = useRouter();
  const { token, user } = useAuth();

  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [selectedSpecialty, setSelectedSpecialty] = useState('All');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [books, setBooks] = useState<Book[]>([]);
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

  // Reset to page 1 on specialty change
  const handleSelectSpecialty = (spec: string) => {
    setSelectedSpecialty(spec);
    setPage(1);
  };

  const loadBooks = useCallback(async () => {
    setError(null);
    try {
      const res = await fetchBooks(
        {
          page,
          limit: 10,
          q: debouncedQuery,
          specialty: selectedSpecialty === 'All' ? undefined : selectedSpecialty,
        },
        token
      );
      const items = Array.isArray(res) ? res : (res?.items || []);
      const total = Array.isArray(res) ? res.length : (res?.total ?? items.length);
      const pages = Array.isArray(res) ? 1 : (res?.total_pages ?? 1);
      setBooks(items);
      setTotalPages(pages);
      setTotalCount(total);
    } catch (err: any) {
      console.error('Error fetching books:', err);
      setError(err?.message || 'Could not load books catalog. Please try again.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [debouncedQuery, selectedSpecialty, page, token]);

  useEffect(() => {
    setLoading(true);
    loadBooks();
  }, [loadBooks]);

  // Re-fetch books whenever the screen is focused (e.g. returning from reader)
  useFocusEffect(
    useCallback(() => {
      loadBooks();
    }, [loadBooks])
  );

  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    loadBooks();
  }, [loadBooks]);

  const handleToggleFavorite = async (bookId: string) => {
    if (!token) {
      router.push('/login');
      return;
    }
    // Optimistic toggle
    setBooks(prev =>
      prev.map(b => (b.id === bookId ? { ...b, is_favorite: !b.is_favorite } : b))
    );
    try {
      const res = await toggleBookFavorite(bookId, token);
      setBooks(prev =>
        prev.map(b => (b.id === bookId ? { ...b, is_favorite: res.favorited } : b))
      );
    } catch (e) {
      // Revert on error
      setBooks(prev =>
        prev.map(b => (b.id === bookId ? { ...b, is_favorite: !b.is_favorite } : b))
      );
    }
  };

  const handleOpenReader = (book: Book) => {
    router.push({
      pathname: '/learning/reader/[id]',
      params: {
        id: book.id,
        initialPage: book.last_page ? String(book.last_page) : undefined,
      },
    });
  };

  // Recent/Continue reading shelf (books with is_recent: true or previously opened)
  const recentBooks = useMemo(() => {
    return books.filter(b => b.is_recent === true);
  }, [books]);

  return (
    <View style={styles.container} testID={testID || 'books-catalog'}>
      {/* 1. Search Bar */}
      <View style={styles.searchBar}>
        <Ionicons name="search-outline" size={18} color={colors.textMuted} style={styles.searchIcon} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search by title, author, specialty..."
          placeholderTextColor={colors.textMuted}
          value={searchQuery}
          onChangeText={setSearchQuery}
          returnKeyType="search"
          testID="books-search-input"
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
              <Text
                style={[styles.specialtyChipText, isSelected && styles.specialtyChipTextActive]}
              >
                {spec}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* 3. Catalog Body */}
      {loading && !refreshing ? (
        <View style={styles.loadingContainer} testID="books-loading">
          <ActivityIndicator size="large" color={colors.navy} />
          <Text style={styles.loadingText}>Loading medical library...</Text>
        </View>
      ) : error ? (
        <View style={styles.errorContainer} testID="books-error">
          <Ionicons name="alert-circle-outline" size={44} color={colors.redText} />
          <Text style={styles.errorTitle}>Could not load catalog</Text>
          <Text style={styles.errorSubtitle}>{error}</Text>
          <TouchableOpacity style={styles.retryBtn} onPress={loadBooks}>
            <Text style={styles.retryBtnText}>Retry</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          style={styles.flatList}
          data={books}
          keyExtractor={item => item.id}
          renderItem={({ item }) => (
            <BookCard
              book={item}
              onReadPress={handleOpenReader}
              onToggleFavorite={handleToggleFavorite}
            />
          )}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              tintColor={colors.navy}
            />
          }
          ListHeaderComponent={
            recentBooks.length > 0 && !debouncedQuery && selectedSpecialty === 'All' ? (
              <View style={styles.continueSection} testID="continue-reading-section">
                <View style={styles.sectionHeaderRow}>
                  <Ionicons name="bookmark" size={16} color={colors.teal} style={{ marginRight: 6 }} />
                  <Text style={styles.sectionTitle}>Continue Reading</Text>
                </View>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.continueList}
                >
                  {recentBooks.map(book => (
                    <ContinueReadingCard
                      key={`recent-${book.id}`}
                      book={book}
                      onResume={handleOpenReader}
                    />
                  ))}
                </ScrollView>
                <View style={styles.sectionDivider} />
                <Text style={styles.sectionTitle}>All E-Books ({totalCount})</Text>
              </View>
            ) : null
          }
          ListFooterComponent={
            books.length > 0 ? (
              <View style={styles.paginationContainer} testID="books-pagination">
                <Text style={styles.paginationSummary}>
                  Showing {(page - 1) * 10 + 1}-{Math.min(page * 10, totalCount)} of {totalCount} books
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
                      <Ionicons name="chevron-back" size={16} color={page <= 1 ? colors.textMuted : colors.navy} />
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
            <View style={styles.emptyContainer} testID="books-empty">
              <Ionicons name="book-outline" size={48} color={colors.textMuted} />
              <Text style={styles.emptyTitle}>No e-books found</Text>
              <Text style={styles.emptySubtitle}>
                {searchQuery || selectedSpecialty !== 'All'
                  ? 'Try broadening your search or choosing another specialty.'
                  : 'No medical books are currently available in the catalogue.'}
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

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
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
  flatList: {
    flex: 1,
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
  listContent: {
    paddingBottom: 100,
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
    ...typography.h3,
    fontSize: 15,
    fontFamily: fonts.heading.bold,
    color: colors.text,
    marginBottom: spacing.sm,
  },
  continueList: {
    paddingRight: spacing.md,
    paddingBottom: 4,
  },
  sectionDivider: {
    height: 1,
    backgroundColor: colors.border,
    marginVertical: spacing.md,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 80,
  },
  loadingText: {
    ...typography.body,
    color: colors.textSecondary,
    marginTop: spacing.md,
  },
  errorContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
    paddingTop: 60,
  },
  errorTitle: {
    ...typography.h3,
    color: colors.text,
    marginTop: spacing.md,
    marginBottom: spacing.xs,
  },
  errorSubtitle: {
    ...typography.body,
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: spacing.lg,
  },
  retryBtn: {
    backgroundColor: colors.primaryFill,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
  },
  retryBtnText: {
    ...typography.bodyStrong,
    color: colors.white,
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
    marginBottom: spacing.xs,
  },
  emptySubtitle: {
    ...typography.body,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: spacing.md,
  },
  clearFilterBtn: {
    backgroundColor: colors.tealBg,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs + 3,
    borderRadius: radius.pill,
  },
  clearFilterText: {
    fontSize: 12,
    fontFamily: fonts.heading.bold,
    color: colors.teal,
  },
  paginationContainer: {
    alignItems: 'center',
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.md,
    marginTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  paginationSummary: {
    ...typography.caption,
    color: colors.textSecondary,
    marginBottom: spacing.md,
  },
  paginationControls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  pageBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs + 3,
    borderRadius: radius.pill,
    gap: 4,
    ...shadow.card,
  },
  pageBtnDisabled: {
    opacity: 0.4,
  },
  pageBtnText: {
    fontSize: 12,
    fontFamily: fonts.heading.bold,
    color: colors.navy,
  },
  pageBtnTextDisabled: {
    color: colors.textMuted,
  },
  pagePill: {
    backgroundColor: colors.bgMuted,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs + 3,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
  },
  pagePillText: {
    fontSize: 12,
    fontFamily: fonts.heading.bold,
    color: colors.text,
  },

});