import React, { useState } from 'react';
import { View, Text, StyleSheet, Image, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { ResearchPaper } from '../../types/research';
import { colors, spacing, radius, typography, fonts, shadow } from '../../theme';

interface Props {
  paper: ResearchPaper;
  onResume: (paper: ResearchPaper) => void;
  testID?: string;
}

export function ContinueReadingPaperCard({ paper, onResume, testID }: Props) {
  const [imgError, setImgError] = useState(false);
  const progress = Math.min(Math.max(paper.progress_pct || 0, 0), 100);

  return (
    <TouchableOpacity
      activeOpacity={0.85}
      style={styles.card}
      onPress={() => onResume(paper)}
      testID={testID || `continue-reading-paper-${paper.id}`}
      accessibilityRole="button"
      accessibilityLabel={`Resume reading ${paper.title}, page ${paper.last_page || 1}`}
    >
      <View style={styles.topRow}>
        <View style={styles.coverWrap}>
          {paper.cover_url && !imgError ? (
            <Image
              source={{ uri: paper.cover_url }}
              style={styles.cover}
              resizeMode="cover"
              onError={() => setImgError(true)}
            />
          ) : (
            <View style={styles.placeholder}>
              <View style={styles.placeholderAccent} />
              <View style={styles.placeholderIconWrap}>
                <Ionicons name="newspaper-outline" size={18} color={colors.navy} />
              </View>
            </View>
          )}
        </View>

        <View style={styles.meta}>
          <View style={styles.specialtyPill}>
            <Text style={styles.specialtyText} numberOfLines={1}>
              {paper.specialty || paper.journal || 'Medical Research'}
            </Text>
          </View>
          <Text style={styles.title} numberOfLines={2}>
            {paper.title}
          </Text>
          <Text style={styles.author} numberOfLines={1}>
            {paper.authors || paper.journal || 'Research Study'}
          </Text>
        </View>
      </View>

      <View style={styles.progressContainer}>
        <View style={styles.progressLabels}>
          <Text style={styles.pageLabel}>
            Page {paper.last_page || 1} of {Math.max(paper.pages || 1, paper.last_page || 1)}
          </Text>
          <Text style={styles.pctLabel}>{Math.round(progress)}%</Text>
        </View>
        <View style={styles.progressBarTrack}>
          <View style={[styles.progressBarFill, { width: `${progress}%` }]} />
        </View>
      </View>

      <View style={styles.resumeAction}>
        <Text style={styles.resumeText}>Resume Reading</Text>
        <Ionicons name="play-forward" size={12} color={colors.teal} />
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
    backgroundColor: '#F8FAFC',
    position: 'relative',
    overflow: 'hidden',
  },
  placeholderAccent: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 3,
    backgroundColor: colors.teal,
  },
  placeholderIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.tealBg,
    alignItems: 'center',
    justifyContent: 'center',
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
