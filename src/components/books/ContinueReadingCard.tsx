import React, { useState } from 'react';
import { View, Text, StyleSheet, Image, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Book } from '../../types/books';
import { colors, spacing, radius, typography, fonts, shadow } from '../../theme';

interface Props {
  book: Book;
  onResume: (book: Book) => void;
  testID?: string;
}

export function ContinueReadingCard({ book, onResume, testID }: Props) {
  const [imgError, setImgError] = useState(false);
  const progress = Math.min(Math.max(book.progress_pct || 0, 0), 100);

  return (
    <TouchableOpacity
      activeOpacity={0.85}
      style={styles.card}
      onPress={() => onResume(book)}
      testID={testID || `continue-reading-${book.id}`}
      accessibilityRole="button"
      accessibilityLabel={`Resume reading ${book.title}, page ${book.last_page || 1}`}
    >
      <View style={styles.topRow}>
        <View style={styles.coverWrap}>
          {book.cover_url && !imgError ? (
            <Image
              source={{ uri: book.cover_url }}
              style={styles.cover}
              resizeMode="cover"
              onError={() => setImgError(true)}
            />
          ) : (
            <View style={styles.placeholder}>
              <Ionicons name="book" size={20} color={colors.navy} />
            </View>
          )}
        </View>

        <View style={styles.meta}>
          <View style={styles.specialtyPill}>
            <Text style={styles.specialtyText} numberOfLines={1}>{book.specialty}</Text>
          </View>
          <Text style={styles.title} numberOfLines={2}>{book.title}</Text>
          <Text style={styles.author} numberOfLines={1}>{book.author}</Text>
        </View>
      </View>

      <View style={styles.progressContainer}>
        <View style={styles.progressLabels}>
          <Text style={styles.pageLabel}>
            Page {book.last_page || 1} of {Math.max(book.pages || 0, book.last_page || 0)}
          </Text>
          <Text style={styles.pctLabel}>{Math.round(progress)}%</Text>
        </View>
        <View style={styles.progressBarTrack}>
          <View style={[styles.progressBarFill, { width: `${progress}%` }]} />
        </View>
      </View>

      <View style={styles.resumeAction}>
        <Text style={styles.resumeText}>Resume Reading</Text>
        <Ionicons name="play-forward" size={12} color={colors.navy} />
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    width: 260,
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    padding: spacing.md,
    marginRight: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadow.card,
    justifyContent: 'space-between',
  },
  topRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  coverWrap: {
    width: 52,
    height: 72,
    borderRadius: radius.sm,
    overflow: 'hidden',
    backgroundColor: colors.bgMuted,
    borderWidth: 1,
    borderColor: colors.border,
  },
  cover: {
    width: '100%',
    height: '100%',
  },
  placeholder: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.tealBg,
  },
  meta: {
    flex: 1,
    justifyContent: 'center',
  },
  specialtyPill: {
    alignSelf: 'flex-start',
    backgroundColor: colors.tealBg,
    paddingHorizontal: spacing.xs + 2,
    paddingVertical: 1,
    borderRadius: radius.pill,
    marginBottom: 3,
  },
  specialtyText: {
    fontSize: 9,
    fontFamily: fonts.heading.bold,
    color: colors.teal,
  },
  title: {
    fontSize: 13,
    lineHeight: 17,
    fontFamily: fonts.heading.bold,
    color: colors.text,
    marginBottom: 2,
  },
  author: {
    fontSize: 11,
    color: colors.textSecondary,
    fontFamily: fonts.body.regular,
  },
  progressContainer: {
    marginVertical: spacing.xs,
  },
  progressLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  pageLabel: {
    fontSize: 10,
    fontFamily: fonts.body.medium,
    color: colors.textMuted,
  },
  pctLabel: {
    fontSize: 10,
    fontFamily: fonts.body.medium,
    color: colors.teal,
    fontWeight: '700',
  },
  progressBarTrack: {
    height: 4,
    backgroundColor: colors.bgMuted,
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: colors.teal,
    borderRadius: 2,
  },
  resumeAction: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 4,
    marginTop: spacing.xs,
    paddingTop: 4,
  },
  resumeText: {
    fontSize: 11,
    fontFamily: fonts.heading.bold,
    color: colors.navy,
  },
});
