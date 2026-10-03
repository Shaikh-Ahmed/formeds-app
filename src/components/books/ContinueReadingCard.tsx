import React, { useState } from 'react';
import { View, Text, StyleSheet, Image, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Book } from '../../types/books';
import { colors, spacing, radius, fonts, shadow } from '../../theme';

interface Props {
  book: Book;
  onResume: (book: Book) => void;
  testID?: string;
}

/**
 * A compact shelf card: the cover beside one column holding the title, who
 * wrote it, a thin progress bar and the page + resume line. One row, so the
 * shelf takes little height above the catalogue.
 */
export function ContinueReadingCard({ book, onResume, testID }: Props) {
  const [imgError, setImgError] = useState(false);
  const progress = Math.min(Math.max(book.progress_pct || 0, 0), 100);
  const byline = [book.author, book.specialty].filter(Boolean).join(' · ');

  return (
    <TouchableOpacity
      activeOpacity={0.85}
      style={styles.card}
      onPress={() => onResume(book)}
      testID={testID || `continue-reading-${book.id}`}
      accessibilityRole="button"
      accessibilityLabel={`Resume reading ${book.title}, page ${book.last_page || 1}`}
    >
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
            <Ionicons name="book" size={16} color={colors.navy} />
          </View>
        )}
      </View>

      <View style={styles.meta}>
        <Text style={styles.title} numberOfLines={1}>{book.title}</Text>
        {byline ? <Text style={styles.byline} numberOfLines={1}>{byline}</Text> : null}
        <View style={styles.track}>
          <View style={[styles.fill, { width: `${progress}%` }]} />
        </View>
        <View style={styles.footer}>
          <View style={styles.progressText}>
            <Text style={styles.page} numberOfLines={1}>
              Page {book.last_page || 1} of {Math.max(book.pages || 0, book.last_page || 0)}
            </Text>
            <Text style={styles.pct}>{Math.round(progress)}%</Text>
          </View>
          <View style={styles.resume}>
            <Text style={styles.resumeText}>Resume Reading</Text>
            <Ionicons name="play-forward" size={10} color={colors.teal} />
          </View>
        </View>
      </View>
    </TouchableOpacity>
  );
}

export const continueCardStyles = StyleSheet.create({
  card: {
    width: 280,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm + 2,
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.sm + 2,
    marginRight: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadow.card,
  },
  coverWrap: {
    width: 40,
    height: 54,
    borderRadius: radius.sm,
    overflow: 'hidden',
    backgroundColor: colors.bgMuted,
    borderWidth: 1,
    borderColor: colors.border,
  },
  cover: { width: '100%', height: '100%' },
  placeholder: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.tealBg },
  meta: { flex: 1, minWidth: 0, gap: 3 },
  title: { fontSize: 13, lineHeight: 17, fontFamily: fonts.heading.bold, color: colors.text },
  byline: { fontSize: 11, lineHeight: 14, fontFamily: fonts.body.regular, color: colors.textSecondary },
  track: { height: 3, backgroundColor: colors.bgMuted, borderRadius: 2, overflow: 'hidden', marginTop: 2 },
  fill: { height: '100%', backgroundColor: colors.teal, borderRadius: 2 },
  footer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.xs },
  page: { flexShrink: 1, fontSize: 10, lineHeight: 13, fontFamily: fonts.body.medium, color: colors.textSubtle },
  progressText: { flexDirection: 'row', alignItems: 'center', gap: 6, flexShrink: 1 },
  pct: { fontSize: 10, lineHeight: 13, fontFamily: fonts.body.bold, color: colors.teal },
  resume: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  resumeText: { fontSize: 10.5, lineHeight: 13, fontFamily: fonts.heading.bold, color: colors.teal },
});

const styles = continueCardStyles;
