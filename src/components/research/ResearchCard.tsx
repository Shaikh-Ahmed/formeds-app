import React, { useState } from 'react';
import { View, Text, StyleSheet, Image, TouchableOpacity, Linking, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { ResearchPaper } from '../../types/research';
import { colors, spacing, radius, typography, fonts, shadow } from '../../theme';

interface ResearchCardProps {
  paper: ResearchPaper;
  onReadPress?: (paper: ResearchPaper) => void;
  onToggleFavorite?: (paperId: string) => void;
  testID?: string;
}

export function ResearchCard({ paper, onReadPress, onToggleFavorite, testID }: ResearchCardProps) {
  const router = useRouter();
  const [imgError, setImgError] = useState(false);
  const isFavorite = !!paper.is_favorite;

  const isExternal = paper.source !== 'upload';
  const targetUrl = paper.url || paper.pdf_url || paper.doi;

  const handleOpenSource = () => {
    if (targetUrl) {
      if (Platform.OS === 'web') {
        window.open(targetUrl, '_blank', 'noopener,noreferrer');
      } else {
        Linking.openURL(targetUrl);
      }
    } else {
      handleOpenInApp();
    }
  };

  const handleOpenInApp = () => {
    if (onReadPress) {
      onReadPress(paper);
      return;
    }
    const initialPageParam = paper.last_page ? `&initialPage=${paper.last_page}` : '';
    router.push(`/learning/reader/${paper.id}?type=research${initialPageParam}` as any);
  };

  const displayYear =
    paper.published_year ||
    paper.year ||
    (paper.published_date ? paper.published_date.slice(0, 4) : null) ||
    (paper.date ? paper.date.slice(0, 4) : null);

  const sourceBadgeLabel =
    paper.source === 'upload' ? 'Formeds Upload' : paper.source === 'pubmed' ? 'PubMed' : 'OpenAlex';

  const sourceBtnLabel =
    paper.source === 'pubmed' ? 'Read on PubMed' : paper.source === 'openalex' ? 'Read on OpenAlex' : 'Read at Source';

  return (
    <View style={styles.card} testID={testID || `research-card-${paper.id}`}>
      {/* Top Cover & Specialty Banner */}
      <View style={styles.coverRow}>
        <TouchableOpacity
          activeOpacity={0.8}
          onPress={isExternal ? handleOpenSource : handleOpenInApp}
          style={styles.coverContainer}
        >
          {paper.cover_url && !imgError ? (
            <Image
              source={{ uri: paper.cover_url }}
              style={styles.coverImage}
              resizeMode="cover"
              onError={() => setImgError(true)}
            />
          ) : (
            <View style={styles.coverPlaceholder}>
              <View style={styles.placeholderAccent} />
              <View style={styles.placeholderIconWrap}>
                <Ionicons name="newspaper-outline" size={26} color={colors.navy} />
              </View>
              <View style={styles.placeholderLines}>
                <View style={styles.placeholderLine1} />
                <View style={styles.placeholderLine2} />
                <View style={styles.placeholderLine3} />
              </View>
            </View>
          )}
          {paper.progress_pct != null && paper.progress_pct > 0 && (
            <View style={styles.miniProgressWrap}>
              <View style={[styles.miniProgressBar, { width: `${Math.min(paper.progress_pct, 100)}%` }]} />
            </View>
          )}
        </TouchableOpacity>

        {/* Paper Header Meta */}
        <View style={styles.metaContainer}>
          <View style={styles.topBadgeRow}>
            <View style={styles.badgesWrapper}>
              <View style={styles.specialtyBadge}>
                <Text style={styles.specialtyText} numberOfLines={1}>
                  {paper.specialty || paper.journal || 'General Medicine'}
                </Text>
              </View>
              <View
                style={[
                  styles.sourceBadge,
                  paper.source === 'upload' ? styles.uploadBadge : styles.pubBadge,
                ]}
              >
                <Text
                  style={[
                    styles.sourceBadgeText,
                    paper.source === 'upload' ? styles.uploadText : styles.pubText,
                  ]}
                >
                  {sourceBadgeLabel}
                </Text>
              </View>
            </View>

            <TouchableOpacity
              onPress={() => onToggleFavorite && onToggleFavorite(paper.id)}
              style={styles.favoriteBtn}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              accessibilityRole="button"
              accessibilityLabel={isFavorite ? 'Remove from favorites' : 'Add to favorites'}
              testID={`paper-fav-btn-${paper.id}`}
            >
              <Ionicons
                name={isFavorite ? 'heart' : 'heart-outline'}
                size={20}
                color={isFavorite ? colors.redText : colors.textMuted}
              />
            </TouchableOpacity>
          </View>

          <TouchableOpacity
            activeOpacity={0.7}
            onPress={isExternal ? handleOpenSource : handleOpenInApp}
          >
            <Text style={styles.title} numberOfLines={2} testID={`paper-title-${paper.id}`}>
              {paper.title}
            </Text>
          </TouchableOpacity>

          <View style={styles.authorRow}>
            <Ionicons name="person-outline" size={13} color={colors.textSecondary} style={{ marginRight: 4 }} />
            <Text style={styles.authorText} numberOfLines={1}>
              {paper.authors || paper.journal || 'Medical Research'}
            </Text>
          </View>

          <View style={styles.statsRow}>
            <View style={styles.statItem}>
              <Ionicons name="document-text-outline" size={13} color={colors.textMuted} style={{ marginRight: 3 }} />
              <Text style={styles.statText}>
                {paper.pages ? `${paper.pages} pages` : 'Clinical Study'}
              </Text>
            </View>
            {displayYear ? (
              <View style={styles.statItem}>
                <Ionicons name="calendar-outline" size={13} color={colors.textMuted} style={{ marginRight: 3 }} />
                <Text style={styles.statText}>{displayYear}</Text>
              </View>
            ) : null}
            {paper.journal ? (
              <View style={styles.statItem}>
                <Ionicons name="bookmarks-outline" size={13} color={colors.textMuted} style={{ marginRight: 3 }} />
                <Text style={styles.statText} numberOfLines={1}>
                  {paper.journal}
                </Text>
              </View>
            ) : null}
          </View>
        </View>
      </View>

      {/* Abstract Snippet */}
      {paper.abstract ? (
        <Text style={styles.description} numberOfLines={2}>
          {paper.abstract}
        </Text>
      ) : null}

      {/* Card Actions Footer */}
      <View style={styles.footerRow}>
        {paper.last_page ? (
          <Text style={styles.progressText}>
            Page {paper.last_page} of {paper.pages || 1} ({Math.round(paper.progress_pct || 0)}%)
          </Text>
        ) : (
          <Text style={styles.publisherText} numberOfLines={1}>
            {paper.journal || paper.doi || (paper.source === 'upload' ? 'Clinical Document' : 'Open Access')}
          </Text>
        )}

        <View style={styles.actionButtonsWrap}>
          {isExternal ? (
            <>
              <TouchableOpacity
                style={styles.abstractBtn}
                onPress={handleOpenInApp}
                accessibilityRole="button"
                accessibilityLabel="View Abstract in reader"
                testID={`paper-abstract-btn-${paper.id}`}
              >
                <Ionicons name="document-text-outline" size={13} color={colors.navy} style={{ marginRight: 4 }} />
                <Text style={styles.abstractBtnText}>Abstract</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.sourceBtn}
                onPress={handleOpenSource}
                accessibilityRole="button"
                accessibilityLabel={sourceBtnLabel}
                testID={`paper-source-btn-${paper.id}`}
              >
                <Ionicons
                  name="open-outline"
                  size={14}
                  color={colors.white}
                  style={{ marginRight: 4 }}
                />
                <Text style={styles.sourceBtnText}>{sourceBtnLabel}</Text>
              </TouchableOpacity>
            </>
          ) : (
            <TouchableOpacity
              style={styles.readBtn}
              onPress={handleOpenInApp}
              accessibilityRole="button"
              accessibilityLabel={`Read ${paper.title}`}
              testID={`paper-read-btn-${paper.id}`}
            >
              <Ionicons
                name="reader-outline"
                size={15}
                color={colors.white}
                style={{ marginRight: 5 }}
              />
              <Text style={styles.readBtnText}>
                {paper.is_recent && paper.last_page ? 'Continue Reading' : 'Read Paper'}
              </Text>
            </TouchableOpacity>
          )}
        </View>
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
    justifyContent: 'space-between',
    backgroundColor: '#F8FAFC',
    paddingVertical: 14,
    paddingHorizontal: 8,
    position: 'relative',
    overflow: 'hidden',
  },
  placeholderAccent: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 4,
    backgroundColor: colors.teal,
  },
  placeholderIconWrap: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: colors.tealBg,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
  },
  placeholderLines: {
    width: '100%',
    alignItems: 'center',
    gap: 4,
    marginBottom: 4,
  },
  placeholderLine1: {
    width: '72%',
    height: 3,
    borderRadius: 2,
    backgroundColor: '#CBD5E1',
  },
  placeholderLine2: {
    width: '50%',
    height: 3,
    borderRadius: 2,
    backgroundColor: '#E2E8F0',
  },
  placeholderLine3: {
    width: '36%',
    height: 3,
    borderRadius: 2,
    backgroundColor: '#F1F5F9',
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
  badgesWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
    maxWidth: '85%',
  },
  specialtyBadge: {
    backgroundColor: colors.tealBg,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radius.pill,
  },
  specialtyText: {
    fontSize: 11,
    fontFamily: fonts.heading.bold,
    color: colors.teal,
  },
  sourceBadge: {
    paddingHorizontal: spacing.xs + 3,
    paddingVertical: 1,
    borderRadius: radius.pill,
  },
  uploadBadge: {
    backgroundColor: '#E0F2FE',
  },
  pubBadge: {
    backgroundColor: colors.bgMuted,
  },
  sourceBadgeText: {
    fontSize: 10,
    fontFamily: fonts.body.medium,
  },
  uploadText: {
    color: '#0369A1',
    fontWeight: '600',
  },
  pubText: {
    color: colors.textMuted,
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
    gap: spacing.xs,
  },
  publisherText: {
    ...typography.caption,
    color: colors.textMuted,
    maxWidth: '40%',
  },
  progressText: {
    fontSize: 11,
    fontFamily: fonts.body.medium,
    color: colors.teal,
    maxWidth: '40%',
  },
  actionButtonsWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  abstractBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: spacing.xs + 3,
    borderRadius: radius.pill,
  },
  abstractBtnText: {
    fontSize: 12,
    fontFamily: fonts.body.medium,
    color: colors.navy,
  },
  sourceBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.teal,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs + 3,
    borderRadius: radius.pill,
  },
  sourceBtnText: {
    ...typography.small,
    fontSize: 12,
    fontFamily: fonts.heading.bold,
    color: colors.white,
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
