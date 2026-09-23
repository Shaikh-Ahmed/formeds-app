import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Platform, Pressable } from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import { Ionicons } from '@expo/vector-icons';
import { ArticleFeedPost } from '../../types/feed';
import { colors, spacing, radius, typography, fonts, shadow, compactAction } from '../../theme';
import { Avatar } from '../Avatar';
import { RoleBadge } from '../RoleBadge';
import { ExpandableText } from '../ExpandableText';
import { TagChip } from '../TagChip';
import { Hoverable } from '../web/Hoverable';
import { timeAgo } from '../../utils/time';

/** Formats a bare DOI into a valid URL if needed. */
export function formatArticleUrl(rawUrl: string): string {
  const trimmed = rawUrl.trim();
  if (!trimmed) return '';
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
    return trimmed;
  }
  if (trimmed.startsWith('10.')) {
    return `https://doi.org/${trimmed}`;
  }
  return `https://${trimmed}`;
}

interface Props {
  post: ArticleFeedPost;
  isLiked?: boolean;
  onLike?: (id: string) => void;
  onComment?: (id: string) => void;
  onShare?: (post: ArticleFeedPost) => void;
  testID?: string;
}

export function ArticleFeedCard({
  post,
  isLiked = false,
  onLike,
  onComment,
  onShare,
  testID,
}: Props) {
  const targetUrl = formatArticleUrl(post.article_url || '');

  const handleOpenPaper = async () => {
    if (!targetUrl) return;
    try {
      if (Platform.OS === 'web') {
        window.open(targetUrl, '_blank', 'noopener,noreferrer');
      } else {
        await WebBrowser.openBrowserAsync(targetUrl, {
          toolbarColor: colors.navy,
          controlsColor: colors.white,
          presentationStyle: WebBrowser.WebBrowserPresentationStyle.PAGE_SHEET,
        });
      }
    } catch (e) {
      console.log('Error opening paper URL:', e);
    }
  };

  const authorList = post.authors
    ? post.authors.split(',').map(a => a.trim()).filter(Boolean)
    : [];

  const displayedKeywords = (post.keywords || []).slice(0, 4);

  return (
    <View style={styles.card} testID={testID || `article-feed-post-${post.id}`}>
      {/* 1. Header: Formeds Newsletter + Official Role Badge + Timestamp */}
      <View style={styles.header}>
        <Avatar name="Formeds Newsletter" role="official" size={44} />
        <View style={styles.authorMeta}>
          <View style={styles.authorRow}>
            <Text style={styles.authorName}>Formeds Newsletter</Text>
            <View style={styles.officialPill}>
              <Ionicons name="checkmark-circle" size={13} color="#4338CA" style={{ marginRight: 3 }} />
              <Text style={styles.officialText}>Official</Text>
            </View>
          </View>
          <View style={styles.timeRow}>
            <Ionicons name="newspaper-outline" size={12} color={colors.textMuted} style={{ marginRight: 4 }} />
            <Text style={styles.timeText}>Medical Digest • {timeAgo(post.created_at)}</Text>
          </View>
        </View>
      </View>

      {/* 2. Article Headline (post.content) */}
      <TouchableOpacity
        activeOpacity={0.8}
        onPress={handleOpenPaper}
        accessibilityRole="link"
        accessibilityLabel={`Read paper: ${post.content}`}
      >
        <Text style={styles.title}>{post.content}</Text>
      </TouchableOpacity>

      {/* 3. Journal Row */}
      {post.journal || (post.cited_by != null && post.cited_by > 0) ? (
        <View style={styles.journalRow}>
          {post.journal ? (
            <Text style={styles.journal} numberOfLines={1}>
              {post.journal}
            </Text>
          ) : null}

          {post.cited_by != null && post.cited_by > 0 ? (
            <View style={styles.citationsBadge}>
              <Ionicons name="sparkles" size={10} color={colors.navy} style={{ marginRight: 3 }} />
              <Text style={styles.citationsText}>{post.cited_by} citations</Text>
            </View>
          ) : null}
        </View>
      ) : null}

      {/* 4. Authors Subdued Row */}
      {authorList.length > 0 && (
        <View style={styles.authorsRow}>
          <Ionicons name="person-outline" size={12} color={colors.textMuted} style={{ marginRight: 4 }} />
          <Text style={styles.authorsText} numberOfLines={1}>
            {authorList.slice(0, 3).join(', ')}
            {authorList.length > 3 ? ` +${authorList.length - 3} more` : ''}
          </Text>
        </View>
      )}

      {/* 5. Abstract with ExpandableText */}
      {post.abstract ? (
        <View style={styles.abstractContainer}>
          <ExpandableText text={post.abstract} numberOfLines={3} style={styles.abstractText} />
        </View>
      ) : null}

      {/* 6. Keywords Chips */}
      {displayedKeywords.length > 0 && (
        <View style={styles.keywordsRow}>
          {displayedKeywords.map((tag, idx) => (
            <TagChip key={`${tag}-${idx}`} label={tag} />
          ))}
        </View>
      )}

      {/* 7. Action Link: Read Full Paper */}
      {targetUrl ? (
        <TouchableOpacity
          style={styles.readPaperBtn}
          onPress={handleOpenPaper}
          accessibilityRole="button"
          accessibilityLabel="Read full paper"
        >
          <Text style={styles.readPaperText}>Read Full Paper</Text>
          <Ionicons name="open-outline" size={14} color={colors.navy} />
        </TouchableOpacity>
      ) : null}

      {/* 8. Social Engagement Bar: Like, Comment, Share */}
      <View style={styles.engagementBar}>
        <Hoverable
          testID={`article-like-btn-${post.id}`}
          style={styles.actionBtn}
          hoverStyle={styles.actionBtnHover}
          hitSlop={compactAction.hitSlop}
          onPress={() => onLike && onLike(post.id)}
          accessibilityLabel={`${isLiked ? 'Unlike' : 'Like'}, ${post.like_count} likes`}
        >
          <Ionicons
            name={isLiked ? 'heart' : 'heart-outline'}
            size={18}
            color={isLiked ? colors.redText : colors.textSecondary}
          />
          <Text style={[styles.actionText, isLiked && { color: colors.redText }]}>
            {post.like_count}
          </Text>
        </Hoverable>

        <Hoverable
          testID={`article-comment-btn-${post.id}`}
          style={styles.actionBtn}
          hoverStyle={styles.actionBtnHover}
          hitSlop={compactAction.hitSlop}
          onPress={() => onComment && onComment(post.id)}
          accessibilityLabel={`Discuss paper, ${post.comment_count} comments`}
        >
          <Ionicons name="chatbubble-outline" size={18} color={colors.textSecondary} />
          <Text style={styles.actionText}>{post.comment_count}</Text>
        </Hoverable>

        <Hoverable
          testID={`article-share-btn-${post.id}`}
          style={styles.actionBtn}
          hoverStyle={styles.actionBtnHover}
          hitSlop={compactAction.hitSlop}
          onPress={() => onShare && onShare(post)}
          accessibilityLabel="Share this paper"
        >
          <Ionicons name="share-social-outline" size={18} color={colors.textSecondary} />
        </Hoverable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.card,
    borderRadius: radius.xl,
    padding: spacing.lg,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    borderLeftWidth: 4,
    borderLeftColor: '#4338CA', // Indigo indicator for Official Publications
    ...shadow.card,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.md - 2,
  },
  authorMeta: {
    marginLeft: spacing.md,
    flex: 1,
  },
  authorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs + 2,
    flexWrap: 'wrap',
  },
  authorName: {
    fontSize: 15,
    fontFamily: fonts.heading.bold,
    color: colors.text,
  },
  officialPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EEF2FF',
    borderWidth: 1,
    borderColor: '#E0E7FF',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: radius.sm,
  },
  officialText: {
    fontSize: 10,
    fontFamily: fonts.heading.bold,
    color: '#4338CA',
    letterSpacing: 0.2,
  },
  timeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
  },
  timeText: {
    ...typography.small,
    color: colors.textMuted,
  },
  title: {
    ...typography.h3,
    fontSize: 16,
    lineHeight: 22,
    color: colors.text,
    fontFamily: fonts.heading.bold,
    marginBottom: spacing.xs + 2,
  },
  journalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.xs + 2,
  },
  journal: {
    ...typography.small,
    color: colors.textSecondary,
    fontFamily: fonts.body.medium,
    flex: 1,
  },
  citationsBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F1F5F9',
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radius.pill,
  },
  citationsText: {
    fontSize: 10,
    fontFamily: fonts.body.medium,
    color: colors.navy,
  },
  authorsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.xs + 2,
  },
  authorsText: {
    ...typography.caption,
    color: colors.textSecondary,
    fontFamily: fonts.body.regular,
    flex: 1,
  },
  abstractContainer: {
    marginVertical: spacing.xs,
  },
  abstractText: {
    ...typography.body,
    fontSize: 14,
    lineHeight: 20,
    color: colors.textSecondary,
  },
  keywordsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs + 2,
    marginTop: spacing.sm,
    marginBottom: spacing.sm,
  },
  readPaperBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.sm - 2,
    alignSelf: 'flex-start',
  },
  readPaperText: {
    ...typography.caption,
    fontFamily: fonts.body.semibold,
    color: colors.navy,
  },
  engagementBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xxl,
    marginTop: spacing.sm,
    paddingTop: spacing.sm + 2,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.borderLight,
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: radius.md,
  },
  actionBtnHover: {
    backgroundColor: colors.bgMuted,
  },
  actionText: {
    ...typography.small,
    color: colors.textSecondary,
    fontFamily: fonts.body.medium,
  },
});
