import React, { useState } from 'react';
import { View, Text, StyleSheet, Image, TouchableOpacity, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Book } from '../../types/books';
import { colors, spacing, radius, typography, fonts, shadow } from '../../theme';

interface BookCardProps {
  book: Book;
  onReadPress?: (book: Book) => void;
  onToggleFavorite?: (bookId: string) => void;
  testID?: string;
}

export function BookCard({ book, onReadPress, onToggleFavorite, testID }: BookCardProps) {
  const [imgError, setImgError] = useState(false);
  const isFavorite = !!book.is_favorite;

  return (
    <View style={styles.card} testID={testID || `book-card-${book.id}`}>
      {/* Top Cover & Specialty Banner */}
      <View style={styles.coverRow}>
        <View style={styles.coverContainer}>
          {book.cover_url && !imgError ? (
            <Image
              source={{ uri: book.cover_url }}
              style={styles.coverImage}
              resizeMode="cover"
              onError={() => setImgError(true)}
            />
          ) : (
            <View style={styles.coverPlaceholder}>
              <Ionicons name="book" size={32} color={colors.navy} />
            </View>
          )}
          {book.progress_pct != null && book.progress_pct > 0 && (
            <View style={styles.miniProgressWrap}>
              <View style={[styles.miniProgressBar, { width: `${Math.min(book.progress_pct, 100)}%` }]} />
            </View>
          )}
        </View>

        {/* Book Header Meta */}
        <View style={styles.metaContainer}>
          <View style={styles.topBadgeRow}>
            <View style={styles.specialtyBadge}>
              <Text style={styles.specialtyText} numberOfLines={1}>{book.specialty}</Text>
            </View>
            <TouchableOpacity
              onPress={() => onToggleFavorite && onToggleFavorite(book.id)}
              style={styles.favoriteBtn}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              accessibilityRole="button"
              accessibilityLabel={isFavorite ? 'Remove from favorites' : 'Add to favorites'}
              testID={`book-fav-btn-${book.id}`}
            >
              <Ionicons
                name={isFavorite ? 'heart' : 'heart-outline'}
                size={20}
                color={isFavorite ? colors.redText : colors.textMuted}
              />
            </TouchableOpacity>
          </View>

          <Text style={styles.title} numberOfLines={2} testID={`book-title-${book.id}`}>
            {book.title}
          </Text>

          <View style={styles.authorRow}>
            <Ionicons name="person-outline" size={13} color={colors.textSecondary} style={{ marginRight: 4 }} />
            <Text style={styles.authorText} numberOfLines={1}>
              {book.author}
            </Text>
          </View>

          <View style={styles.statsRow}>
            <View style={styles.statItem}>
              <Ionicons name="document-text-outline" size={13} color={colors.textMuted} style={{ marginRight: 3 }} />
              <Text style={styles.statText}>{book.pages} pages</Text>
            </View>
            {book.published_year ? (
              <View style={styles.statItem}>
                <Ionicons name="calendar-outline" size={13} color={colors.textMuted} style={{ marginRight: 3 }} />
                <Text style={styles.statText}>{book.published_year}</Text>
              </View>
            ) : null}
            {book.category ? (
              <View style={styles.statItem}>
                <Ionicons name="folder-outline" size={13} color={colors.textMuted} style={{ marginRight: 3 }} />
                <Text style={styles.statText} numberOfLines={1}>{book.category}</Text>
              </View>
            ) : null}
          </View>
        </View>
      </View>

      {/* Description Snippet */}
      {book.description ? (
        <Text style={styles.description} numberOfLines={2}>
          {book.description}
        </Text>
      ) : null}

      {/* Card Actions Footer */}
      <View style={styles.footerRow}>
        {book.last_page ? (
          <Text style={styles.progressText}>
            Page {book.last_page} of {book.pages} ({Math.round(book.progress_pct || 0)}%)
          </Text>
        ) : (
          <Text style={styles.publisherText} numberOfLines={1}>
            {book.publisher || 'Reference Publication'}
          </Text>
        )}

        <TouchableOpacity
          style={styles.readBtn}
          onPress={() => onReadPress && onReadPress(book)}
          accessibilityRole="button"
          accessibilityLabel={`Read ${book.title}`}
          testID={`book-read-btn-${book.id}`}
        >
          <Ionicons name="reader-outline" size={15} color={colors.white} style={{ marginRight: 5 }} />
          <Text style={styles.readBtnText}>
            {book.is_recent && book.last_page ? 'Continue Reading' : 'Read Book'}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.card,
    borderRadius: radius.xl,
    padding: spacing.md + 2,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadow.card,
  },
  coverRow: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  coverContainer: {
    width: 88,
    height: 124,
    borderRadius: radius.md,
    overflow: 'hidden',
    backgroundColor: colors.bgMuted,
    borderWidth: 1,
    borderColor: colors.border,
    position: 'relative',
  },
  coverImage: {
    width: '100%',
    height: '100%',
  },
  coverPlaceholder: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.tealBg,
  },
  miniProgressWrap: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 4,
    backgroundColor: 'rgba(0,0,0,0.2)',
  },
  miniProgressBar: {
    height: '100%',
    backgroundColor: colors.teal,
  },
  metaContainer: {
    flex: 1,
    justifyContent: 'space-between',
  },
  topBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  specialtyBadge: {
    backgroundColor: colors.tealBg,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radius.pill,
    maxWidth: '75%',
  },
  specialtyText: {
    fontSize: 11,
    fontFamily: fonts.heading.bold,
    color: colors.teal,
  },
  favoriteBtn: {
    padding: 2,
  },
  title: {
    ...typography.h3,
    fontSize: 15,
    lineHeight: 20,
    color: colors.text,
    fontFamily: fonts.heading.bold,
    marginBottom: 4,
  },
  authorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  authorText: {
    ...typography.small,
    color: colors.textSecondary,
    fontFamily: fonts.body.medium,
    flex: 1,
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  statItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statText: {
    fontSize: 11,
    color: colors.textMuted,
    fontFamily: fonts.body.regular,
  },
  description: {
    ...typography.caption,
    color: colors.textSecondary,
    lineHeight: 18,
    marginTop: spacing.sm,
    marginBottom: spacing.sm,
  },
  footerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: spacing.xs,
    borderTopWidth: 1,
    borderTopColor: colors.borderLight,
    marginTop: spacing.xs,
  },
  publisherText: {
    ...typography.caption,
    color: colors.textMuted,
    maxWidth: '50%',
  },
  progressText: {
    fontSize: 11,
    fontFamily: fonts.body.medium,
    color: colors.teal,
    maxWidth: '50%',
  },
  readBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.navy,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs + 3,
    borderRadius: radius.pill,
  },
  readBtnText: {
    ...typography.small,
    fontFamily: fonts.heading.bold,
    color: colors.white,
  },
});
