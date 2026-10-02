import React, { useState, useEffect, useCallback } from 'react';
import { useSubmit } from '../../src/hooks/useSubmit';
import { FieldError } from '../../src/components/FieldError';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Pressable, TextInput, ActivityIndicator, KeyboardAvoidingView, Platform, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { sharePost } from '../../src/utils/share';
import { CopiedToast, useCopiedToast } from '../../src/components/CopiedToast';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useAuth } from '../../src/context/AuthContext';
import { apiFetch } from '../../src/utils/api';
import { timeAgo } from '../../src/utils/time';
import { Avatar, RoleBadge, MediaViewer } from '../../src/components';
import { PageColumn } from '../../src/components/web';
import { colors, fonts, spacing, radius, typography, compactAction, gloss } from '../../src/theme';
import { mediaUri } from '../../src/utils/media';

export default function PostDetailScreen() {
  const { id } = useLocalSearchParams();
  const { user, token } = useAuth();
  const router = useRouter();

  const [post, setPost] = useState<any>(null);
  const [comments, setComments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [newComment, setNewComment] = useState('');
  const { submitting, run: runComment } = useSubmit();
  const [commentError, setCommentError] = useState<string | null>(null);
  const [viewerOpen, setViewerOpen] = useState(false);

  const loadData = useCallback(async () => {
    try {
      const [postData, commentsData] = await Promise.all([
        apiFetch(`/api/feed/${id}`, token),
        apiFetch(`/api/feed/${id}/comments?_t=${Date.now()}`, token),
      ]);
      setPost(postData);
      setComments(commentsData);
    } catch (e) {
      console.log('Error loading post:', e);
    } finally {
      setLoading(false);
    }
  }, [id, token]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleLike = async () => {
    if (!post) return;
    try {
      const result = await apiFetch(`/api/feed/${post.id}/like`, token, { method: 'POST' });
      setPost({
        ...post,
        likes: result.liked ? [...post.likes, user?.id || ''] : post.likes.filter((l: string) => l !== user?.id),
        like_count: result.like_count
      });
    } catch (e) { console.log('Like error:', e); }
  };

  const handleSave = async () => {
    if (!post) return;
    try {
      const { saved } = await apiFetch(`/api/feed/${post.id}/save`, token, { method: 'POST' });
      setPost({ ...post, saved });
    } catch (e: any) { alert(e?.message || 'Could not save this post. Please try again.'); }
  };

  const handleRepost = async () => {
    if (!post) return;
    try {
      const { reposted, repost_count } = await apiFetch(`/api/feed/${post.id}/repost`, token, { method: 'POST' });
      setPost({ ...post, reposted, repost_count });
    } catch (e: any) { alert(e?.message || 'Could not repost. Please try again.'); }
  };

  const copiedToast = useCopiedToast();
  const handleShare = async () => { if (post) copiedToast.report(await sharePost(post)); };

  const handleComment = () => {
    if (!newComment.trim()) return;
    const content = newComment;
    return runComment(async key => {
      setCommentError(null);
      try {
        await apiFetch(`/api/feed/${id}/comment`, token, {
          method: 'POST',
          body: JSON.stringify({ content }),
          idempotencyKey: key,
        });
        setNewComment('');
        loadData(); // Reload to show new comment and updated count
      } catch (e: any) {
        // Never silent: the comment stays in the box and the reason shows above it.
        setCommentError(e?.message || 'Could not post your comment. Please try again.');
      }
    }, { id, content });
  };

  const renderPostHeader = () => {
    if (!post) return null;
    const isLiked = post.likes?.includes(user?.id || '');

    return (
      <View style={styles.postCard}>
        <View style={styles.postHeader}>
          <Avatar name={post.author_name} role={post.author_role} size={44} />
          <View style={styles.postMeta}>
            <Text style={styles.authorName}>{post.author_name}</Text>
            <View style={styles.metaRow}>
              <RoleBadge role={post.author_role} />
              <Text style={styles.timeText}>{timeAgo(post.created_at)}</Text>
            </View>
          </View>
        </View>
        <Text style={styles.postContent}>{post.content}</Text>
        {post.image_url ? (
          <Pressable
            testID="post-detail-image"
            onPress={() => setViewerOpen(true)}
            accessibilityRole="imagebutton"
            accessibilityLabel="Open image full screen"
            style={({ pressed }) => [styles.postImageWrap, pressed && { opacity: 0.9 }]}
          >
            <Image source={{ uri: mediaUri(post.image_url) }} style={styles.postImage} resizeMode="cover" />
            <View style={styles.expandHint} pointerEvents="none">
              <Ionicons name="expand-outline" size={14} color={colors.white} />
            </View>
          </Pressable>
        ) : null}
        {/* Matches the feed's compact row: 32px painted, 44px effective via
            hit slop. Previously these were bare icon+text with no minimum
            target at all. */}
        <View style={styles.postActions}>
          <Pressable
            testID="post-like-btn"
            style={({ pressed }) => [styles.actionBtn, pressed && styles.actionBtnPressed]}
            onPress={handleLike}
            hitSlop={compactAction.hitSlop}
            accessibilityRole="button"
            accessibilityLabel={`${isLiked ? 'Unlike' : 'Like'}, ${post.like_count} likes`}
          >
            <Ionicons name={isLiked ? 'heart' : 'heart-outline'} size={18} color={isLiked ? colors.redText : colors.textSecondary} />
            <Text style={[styles.actionText, isLiked && { color: colors.redText }]}>{post.like_count}</Text>
          </Pressable>
          {/* Not pressable — you are already on the post; this is a count. */}
          <View style={styles.actionBtn} accessible accessibilityLabel={`${post.comment_count} comments`}>
            <Ionicons name="chatbubble" size={18} color={colors.navy} />
            <Text style={[styles.actionText, { color: colors.navy }]}>{post.comment_count}</Text>
          </View>
          <Pressable
            testID="post-repost-btn"
            style={({ pressed }) => [styles.actionBtn, pressed && styles.actionBtnPressed]}
            onPress={handleRepost}
            hitSlop={compactAction.hitSlop}
            accessibilityRole="button"
            accessibilityLabel={`${post.reposted ? 'Undo repost' : 'Repost'}, ${post.repost_count ?? 0} reposts`}
          >
            <Ionicons name="repeat" size={19} color={post.reposted ? colors.action : colors.textSecondary} />
            <Text style={[styles.actionText, post.reposted && { color: colors.action }]}>{post.repost_count ?? 0}</Text>
          </Pressable>
          <Pressable
            testID="post-share-btn"
            style={({ pressed }) => [styles.actionBtn, pressed && styles.actionBtnPressed]}
            onPress={handleShare}
            hitSlop={compactAction.hitSlop}
            accessibilityRole="button"
            accessibilityLabel="Share this post"
          >
            <Ionicons name="share-social-outline" size={18} color={colors.textSecondary} />
          </Pressable>
          <Pressable
            testID="post-save-btn"
            style={({ pressed }) => [styles.actionBtn, styles.saveBtn, pressed && styles.actionBtnPressed]}
            onPress={handleSave}
            hitSlop={compactAction.hitSlop}
            accessibilityRole="button"
            accessibilityLabel={post.saved ? 'Remove from saved' : 'Save for later'}
          >
            <Ionicons name={post.saved ? 'bookmark' : 'bookmark-outline'} size={18}
              color={post.saved ? colors.action : colors.textSecondary} />
          </Pressable>
        </View>
        <View style={styles.commentsHeader}>
          <Text style={styles.commentsTitle}>Comments</Text>
        </View>
      </View>
    );
  };

  const renderComment = ({ item }: { item: any }) => (
    <View style={styles.commentCard}>
      <View style={styles.commentAvatar}><Text style={styles.commentAvatarText}>{item.author_name?.charAt(0)}</Text></View>
      <View style={styles.commentContent}>
        <View style={styles.commentMeta}>
          <Text style={styles.commentAuthor}>{item.author_name}</Text>
          <Text style={styles.commentTime}>{timeAgo(item.created_at)}</Text>
        </View>
        <Text style={styles.commentText}>{item.content}</Text>
      </View>
    </View>
  );

  return (
    <SafeAreaView style={styles.safe}>
      <PageColumn testID="post-column">
      <View style={styles.header}>
        <TouchableOpacity testID="back-btn" style={styles.backBtn} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color={colors.navy} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Post</Text>
        <View style={{ width: 44 }} />
      </View>

      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        {loading ? (
          <View style={styles.center}><ActivityIndicator size="large" color={colors.navy} /></View>
        ) : (
          <FlatList
            data={comments}
            renderItem={renderComment}
            keyExtractor={item => item.id}
            ListHeaderComponent={renderPostHeader}
            contentContainerStyle={styles.list}
            ListEmptyComponent={
              <View style={styles.emptyBox}>
                <Ionicons name="chatbubble-ellipses-outline" size={40} color={colors.iconFaint} />
                <Text style={styles.emptyText}>No comments yet</Text>
                <Text style={styles.emptyHint}>Be the first to share your thoughts!</Text>
              </View>
            }
          />
        )}

        {commentError ? <View style={styles.commentErrorWrap}><FieldError message={commentError} /></View> : null}
        <View style={styles.inputBar}>
          <TextInput maxLength={2000} 
            testID="comment-input" 
            style={styles.commentInput} 
            placeholder="Write a comment..." 
            placeholderTextColor={colors.textMuted} 
            value={newComment} 
            onChangeText={setNewComment} 
            multiline 
          />
          <TouchableOpacity 
            testID="submit-comment-btn" 
            style={[styles.sendBtn, !newComment.trim() && styles.sendBtnDisabled]} 
            onPress={handleComment} 
            disabled={submitting || !newComment.trim()}
          >
            {submitting ? <ActivityIndicator size="small" color="#FFF" /> : <Ionicons name="send" size={20} color="#FFF" />}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
      </PageColumn>

      {viewerOpen && post?.image_url ? (
        // No onOpenPost here — this already is the post.
        <MediaViewer
          visible
          imageUri={post.image_url}
          post={post}
          onClose={() => setViewerOpen(false)}
        />
      ) : null}
      <CopiedToast visible={copiedToast.visible} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  commentErrorWrap: { paddingHorizontal: 16, paddingTop: 6 },
  safe: { flex: 1, backgroundColor: colors.bg },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 14, backgroundColor: '#FFFFFF', borderBottomWidth: 1, borderBottomColor: colors.border },
  backBtn: { width: 44, height: 44, borderRadius: 12, backgroundColor: colors.bgMuted, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 18, fontWeight: '700', color: colors.text },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  list: { paddingBottom: 20 },
  
  postCard: { backgroundColor: '#FFFFFF', padding: 16, marginBottom: 8, borderBottomWidth: 1, borderBottomColor: colors.border },
  postHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginBottom: 12 },
  // The spacing lives on the row itself. It used to sit on an inline avatar
  // style that stopped being used when the shared Avatar replaced it, which
  // left the role badge touching the avatar and the time touching the badge.
  postMeta: { flex: 1, gap: 4 },
  authorName: { fontSize: 16, fontFamily: fonts.body.semibold, color: colors.text },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  // textSecondary, not the lighter textMuted: the time is read, and the
  // lighter grey falls below text contrast on white.
  timeText: { ...typography.small, color: colors.textSecondary },
  postContent: { fontSize: 16, color: colors.textBody, lineHeight: 24, marginBottom: 16 },
  postImageWrap: { marginBottom: 16, borderRadius: 12, overflow: 'hidden' },
  postImage: { width: '100%', height: 250 },
  expandHint: {
    position: 'absolute',
    right: spacing.sm,
    bottom: spacing.sm,
    width: 26,
    height: 26,
    borderRadius: radius.sm,
    backgroundColor: 'rgba(15, 23, 42, 0.55)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  postActions: {
    flexDirection: 'row',
    marginTop: spacing.xs,
    marginBottom: spacing.sm,
    marginLeft: -spacing.sm,
    gap: spacing.xs,
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    height: compactAction.height,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.sm,
  },
  actionBtnPressed: { backgroundColor: colors.bgMuted },
  saveBtn: { marginLeft: 'auto' },
  actionText: { fontSize: 13, color: colors.textSecondary, fontWeight: '600' },
  
  commentsHeader: { borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 16 },
  commentsTitle: { fontSize: 16, fontWeight: '700', color: colors.text },
  
  commentCard: { flexDirection: 'row', padding: 16, backgroundColor: '#FFFFFF', borderBottomWidth: 1, borderBottomColor: colors.borderLight },
  commentAvatar: { width: 36, height: 36, borderRadius: 18, backgroundColor: colors.border, alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  commentAvatarText: { color: colors.textSubtle, fontSize: 15, fontWeight: '700' },
  commentContent: { flex: 1 },
  commentMeta: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  commentAuthor: { fontSize: 14, fontWeight: '600', color: colors.text },
  commentTime: { fontSize: 12, color: colors.textMuted },
  commentText: { fontSize: 14, color: '#475569', lineHeight: 20 },
  
  emptyBox: { alignItems: 'center', paddingTop: 40, paddingBottom: 20 },
  emptyText: { fontSize: 16, color: colors.textMuted, marginTop: 12 },
  emptyHint: { fontSize: 13, color: colors.iconFaint, marginTop: 4 },
  
  inputBar: { flexDirection: 'row', alignItems: 'flex-end', padding: 12, paddingBottom: Platform.OS === 'ios' ? 24 : 12, backgroundColor: '#FFFFFF', borderTopWidth: 1, borderTopColor: colors.border, gap: 8 },
  commentInput: { flex: 1, backgroundColor: colors.bg, borderRadius: 20, paddingHorizontal: 16, paddingTop: 12, paddingBottom: 12, fontSize: 15, color: colors.text, maxHeight: 100, borderWidth: 1, borderColor: colors.border },
  sendBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.action, ...gloss.fill, alignItems: 'center', justifyContent: 'center', marginBottom: 2 },
  sendBtnDisabled: { opacity: 0.5 },
});
