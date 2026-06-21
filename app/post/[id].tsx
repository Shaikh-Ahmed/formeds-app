import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, TextInput, ActivityIndicator, KeyboardAvoidingView, Platform, Share } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useAuth } from '../../src/context/AuthContext';
import { apiFetch } from '../../src/utils/api';

const ROLE_TAGS: Record<string, { label: string; color: string; bg: string }> = {
  healthcare_professional: { label: 'Professional', color: '#0F766E', bg: '#F0FDF4' },
  hospital: { label: 'Hospital', color: '#1A3A5C', bg: '#EFF6FF' },
  clinic: { label: 'Clinic', color: '#0F766E', bg: '#F0FDFA' },
};

export default function PostDetailScreen() {
  const { id } = useLocalSearchParams();
  const { user, token } = useAuth();
  const router = useRouter();

  const [post, setPost] = useState<any>(null);
  const [comments, setComments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [newComment, setNewComment] = useState('');
  const [submitting, setSubmitting] = useState(false);

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

  const handleShare = async () => {
    if (!post) return;
    try {
      await Share.share({
        message: `${post.author_name} shared on ForMeds:\n\n"${post.content}"`
      });
    } catch (error) {
      console.log('Share error:', error);
    }
  };

  const handleComment = async () => {
    if (!newComment.trim()) return;
    setSubmitting(true);
    try {
      await apiFetch(`/api/feed/${id}/comment`, token, { 
        method: 'POST', 
        body: JSON.stringify({ content: newComment }) 
      });
      setNewComment('');
      loadData(); // Reload to show new comment and updated count
    } catch (e) {
      console.log('Comment error:', e);
    } finally {
      setSubmitting(false);
    }
  };

  const timeAgo = (date: string) => {
    const diff = Date.now() - new Date(date).getTime();
    const hours = Math.floor(diff / 3600000);
    if (hours < 1) return 'Just now';
    if (hours < 24) return `${hours}h ago`;
    return `${Math.floor(hours / 24)}d ago`;
  };

  const renderPostHeader = () => {
    if (!post) return null;
    const tag = ROLE_TAGS[post.author_role] || ROLE_TAGS.healthcare_professional;
    const isLiked = post.likes?.includes(user?.id || '');

    return (
      <View style={styles.postCard}>
        <View style={styles.postHeader}>
          <View style={styles.avatarCircle}><Text style={styles.avatarText}>{post.author_name?.charAt(0)}</Text></View>
          <View style={styles.postMeta}>
            <Text style={styles.authorName}>{post.author_name}</Text>
            <View style={styles.metaRow}>
              <View style={[styles.roleTag, { backgroundColor: tag.bg }]}><Text style={[styles.roleTagText, { color: tag.color }]}>{tag.label}</Text></View>
              <Text style={styles.timeText}>{timeAgo(post.created_at)}</Text>
            </View>
          </View>
        </View>
        <Text style={styles.postContent}>{post.content}</Text>
        <View style={styles.postActions}>
          <TouchableOpacity testID="post-like-btn" style={styles.actionBtn} onPress={handleLike}>
            <Ionicons name={isLiked ? "heart" : "heart-outline"} size={22} color={isLiked ? "#E84545" : "#94A3B8"} />
            <Text style={[styles.actionText, isLiked && { color: '#E84545' }]}>{post.like_count}</Text>
          </TouchableOpacity>
          <View style={styles.actionBtn}>
            <Ionicons name="chatbubble" size={20} color="#1A3A5C" />
            <Text style={[styles.actionText, { color: '#1A3A5C' }]}>{post.comment_count}</Text>
          </View>
          <TouchableOpacity testID="post-share-btn" style={styles.actionBtn} onPress={handleShare}>
            <Ionicons name="share-social-outline" size={20} color="#94A3B8" />
          </TouchableOpacity>
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
      <View style={styles.header}>
        <TouchableOpacity testID="back-btn" style={styles.backBtn} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color="#1A3A5C" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Post</Text>
        <View style={{ width: 44 }} />
      </View>

      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        {loading ? (
          <View style={styles.center}><ActivityIndicator size="large" color="#1A3A5C" /></View>
        ) : (
          <FlatList
            data={comments}
            renderItem={renderComment}
            keyExtractor={item => item.id}
            ListHeaderComponent={renderPostHeader}
            contentContainerStyle={styles.list}
            ListEmptyComponent={
              <View style={styles.emptyBox}>
                <Ionicons name="chatbubble-ellipses-outline" size={40} color="#CBD5E1" />
                <Text style={styles.emptyText}>No comments yet</Text>
                <Text style={styles.emptyHint}>Be the first to share your thoughts!</Text>
              </View>
            }
          />
        )}

        <View style={styles.inputBar}>
          <TextInput 
            testID="comment-input" 
            style={styles.commentInput} 
            placeholder="Write a comment..." 
            placeholderTextColor="#94A3B8" 
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
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#F8FAFC' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 14, backgroundColor: '#FFFFFF', borderBottomWidth: 1, borderBottomColor: '#E2E8F0' },
  backBtn: { width: 44, height: 44, borderRadius: 12, backgroundColor: '#F1F5F9', alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 18, fontWeight: '700', color: '#0F172A' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  list: { paddingBottom: 20 },
  
  postCard: { backgroundColor: '#FFFFFF', padding: 16, marginBottom: 8, borderBottomWidth: 1, borderBottomColor: '#E2E8F0' },
  postHeader: { flexDirection: 'row', marginBottom: 12 },
  avatarCircle: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#1A3A5C', alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  avatarText: { color: '#FFF', fontSize: 18, fontWeight: '700' },
  postMeta: { flex: 1 },
  authorName: { fontSize: 16, fontWeight: '600', color: '#0F172A' },
  metaRow: { flexDirection: 'row', alignItems: 'center', marginTop: 4 },
  roleTag: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8, marginRight: 8 },
  roleTagText: { fontSize: 11, fontWeight: '600' },
  timeText: { fontSize: 12, color: '#94A3B8' },
  postContent: { fontSize: 16, color: '#334155', lineHeight: 24, marginBottom: 16 },
  postActions: { flexDirection: 'row', paddingTop: 12, borderTopWidth: 1, borderTopColor: '#F1F5F9', gap: 24, paddingBottom: 16 },
  actionBtn: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  actionText: { fontSize: 14, color: '#94A3B8', fontWeight: '500' },
  
  commentsHeader: { borderTopWidth: 1, borderTopColor: '#E2E8F0', paddingTop: 16 },
  commentsTitle: { fontSize: 16, fontWeight: '700', color: '#0F172A' },
  
  commentCard: { flexDirection: 'row', padding: 16, backgroundColor: '#FFFFFF', borderBottomWidth: 1, borderBottomColor: '#F1F5F9' },
  commentAvatar: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#E2E8F0', alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  commentAvatarText: { color: '#64748B', fontSize: 15, fontWeight: '700' },
  commentContent: { flex: 1 },
  commentMeta: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  commentAuthor: { fontSize: 14, fontWeight: '600', color: '#0F172A' },
  commentTime: { fontSize: 12, color: '#94A3B8' },
  commentText: { fontSize: 14, color: '#475569', lineHeight: 20 },
  
  emptyBox: { alignItems: 'center', paddingTop: 40, paddingBottom: 20 },
  emptyText: { fontSize: 16, color: '#94A3B8', marginTop: 12 },
  emptyHint: { fontSize: 13, color: '#CBD5E1', marginTop: 4 },
  
  inputBar: { flexDirection: 'row', alignItems: 'flex-end', padding: 12, paddingBottom: Platform.OS === 'ios' ? 24 : 12, backgroundColor: '#FFFFFF', borderTopWidth: 1, borderTopColor: '#E2E8F0', gap: 8 },
  commentInput: { flex: 1, backgroundColor: '#F8FAFC', borderRadius: 20, paddingHorizontal: 16, paddingTop: 12, paddingBottom: 12, fontSize: 15, color: '#0F172A', maxHeight: 100, borderWidth: 1, borderColor: '#E2E8F0' },
  sendBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#1A3A5C', alignItems: 'center', justifyContent: 'center', marginBottom: 2 },
  sendBtnDisabled: { opacity: 0.5 },
});
