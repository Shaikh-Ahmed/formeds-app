import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, compactAction, radius, spacing } from '../theme';
import { Hoverable } from './web/Hoverable';

/**
 * The action row every feed post shares -- people's posts, reposts and
 * newsletter articles alike, in the feed and on the post's own page:
 * Like · Comment · Repost · Share, with Save set apart at the end (it is for
 * you, not the author).
 *
 * Buttons are painted at 32px and carry the shared compactAction hit slop,
 * so the area a finger has to hit stays 44px. Without `onComment` the
 * comment count is shown, not pressable (you are already on the post).
 */
export interface PostActionTarget {
  id: string;
  like_count: number;
  comment_count: number;
  saved?: boolean;
  reposted?: boolean;
  repost_count?: number;
}

type ActionKey = 'like' | 'comment' | 'repost' | 'share' | 'save';

export function PostActions({
  post, liked, onLike, onComment, onRepost, onShare, onSave, testIDs = {}, noun = 'post',
}: {
  post: PostActionTarget;
  liked: boolean;
  onLike: () => void;
  onComment?: () => void;
  onRepost: () => void;
  onShare: () => void;
  onSave: () => void;
  testIDs?: Partial<Record<ActionKey, string>>;
  /** "post" or "paper": used in the screen-reader labels. */
  noun?: string;
}) {
  const reposts = post.repost_count ?? 0;
  return (
    <View style={styles.row}>
      <Hoverable
        testID={testIDs.like}
        style={styles.btn}
        hoverStyle={styles.btnHover}
        hitSlop={compactAction.hitSlop}
        onPress={onLike}
        accessibilityLabel={`${liked ? 'Unlike' : 'Like'}, ${post.like_count} likes`}
      >
        {/* redText, not red: the bright brand red is only 3.9:1 on the card --
            fine for a glyph, below the minimum for the count beside it. */}
        <Ionicons name={liked ? 'heart' : 'heart-outline'} size={18} color={liked ? colors.redText : colors.textSecondary} />
        <Text style={[styles.count, liked && { color: colors.redText }]}>{post.like_count}</Text>
      </Hoverable>

      {onComment ? (
        <Hoverable
          testID={testIDs.comment}
          style={styles.btn}
          hoverStyle={styles.btnHover}
          hitSlop={compactAction.hitSlop}
          onPress={onComment}
          accessibilityLabel={`Comments, ${post.comment_count}`}
        >
          <Ionicons name="chatbubble-outline" size={18} color={colors.textSecondary} />
          <Text style={styles.count}>{post.comment_count}</Text>
        </Hoverable>
      ) : (
        <View style={styles.btn} accessible accessibilityLabel={`${post.comment_count} comments`} testID={testIDs.comment}>
          <Ionicons name="chatbubble" size={18} color={colors.navy} />
          <Text style={[styles.count, { color: colors.navy }]}>{post.comment_count}</Text>
        </View>
      )}

      <Hoverable
        testID={testIDs.repost}
        style={styles.btn}
        hoverStyle={styles.btnHover}
        hitSlop={compactAction.hitSlop}
        onPress={onRepost}
        accessibilityLabel={`${post.reposted ? 'Undo repost' : 'Repost'}, ${reposts} reposts`}
      >
        <Ionicons name="repeat" size={19} color={post.reposted ? colors.action : colors.textSecondary} />
        <Text style={[styles.count, post.reposted && { color: colors.action }]}>{reposts}</Text>
      </Hoverable>

      <Hoverable
        testID={testIDs.share}
        style={styles.btn}
        hoverStyle={styles.btnHover}
        hitSlop={compactAction.hitSlop}
        onPress={onShare}
        accessibilityLabel={`Share this ${noun}`}
      >
        <Ionicons name="share-social-outline" size={18} color={colors.textSecondary} />
      </Hoverable>

      <Hoverable
        testID={testIDs.save}
        style={[styles.btn, styles.save]}
        hoverStyle={styles.btnHover}
        hitSlop={compactAction.hitSlop}
        onPress={onSave}
        accessibilityLabel={post.saved ? 'Remove from saved' : 'Save for later'}
      >
        <Ionicons name={post.saved ? 'bookmark' : 'bookmark-outline'} size={18}
          color={post.saved ? colors.action : colors.textSecondary} />
      </Hoverable>
    </View>
  );
}

const styles = StyleSheet.create({
  // No divider rule: actions are separated from the body by whitespace alone.
  row: { flexDirection: 'row', alignItems: 'center', marginTop: spacing.xs, marginLeft: -spacing.sm, gap: spacing.xs },
  btn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    height: compactAction.height, paddingHorizontal: spacing.sm, borderRadius: radius.sm,
  },
  btnHover: { backgroundColor: colors.bgMuted },
  save: { marginLeft: 'auto' },
  // textMuted is too faint for a count that carries meaning.
  count: { fontSize: 13, color: colors.textSecondary, fontWeight: '600' },
});
