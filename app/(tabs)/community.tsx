import React, { useState, useEffect, useCallback, useRef } from 'react';

const FEED_PAGE_SIZE = 20;
import { View, Text, StyleSheet, FlatList, ScrollView, TouchableOpacity, TextInput, ActivityIndicator, RefreshControl, Share, Image, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../src/context/AuthContext';
import { apiFetch, API_URL } from '../../src/utils/api';
import { useRouter, useFocusEffect } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { timeAgo } from '../../src/utils/time';
import { Avatar, RoleBadge, KycNotice, ComingSoon } from '../../src/components';

interface Post {
  id: string;
  author_name: string;
  author_role: string;
  content: string;
  post_type: string;
  image_url?: string;
  like_count: number;
  comment_count: number;
  likes: string[];
  created_at: string;
}

/** Clinical Q&A ships in a later phase; the tab is a placeholder for now. */
const CASES_COPY = {
  title: 'Cases are coming soon',
  description:
    'Post a case, ask the room, and get answers from colleagues who have seen it before — with the useful answer voted to the top.',
  bullets: [
    'Ask a question against a real case',
    'Answers ranked by peer upvotes',
    'Mark the answer that resolved it',
  ],
};


export default function FeedScreen() {
  const { user, token, isKycApproved } = useAuth();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<'feed' | 'cases'>('feed');
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [newPost, setNewPost] = useState('');
  const [posting, setPosting] = useState(false);
  const [showCompose, setShowCompose] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [attachedImage, setAttachedImage] = useState<string | null>(null);
  const [unreadCount, setUnreadCount] = useState(0);
  const [unreadMsgs, setUnreadMsgs] = useState(0);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMorePosts, setHasMorePosts] = useState(true);
  const pageRef = useRef(1);

  const loadData = useCallback(async () => {
    try {
      const [feedData, notifCount, msgCount] = await Promise.all([
        apiFetch(`/api/feed/?page=1&limit=${FEED_PAGE_SIZE}`, token),
        apiFetch('/api/notifications/unread-count', token).catch(() => ({ count: 0 })),
        apiFetch('/api/messages/unread-total', token).catch(() => ({ count: 0 })),
      ]);
      const items = Array.isArray(feedData) ? feedData : (feedData?.items ?? []);
      setPosts(items);
      pageRef.current = 1;
      setHasMorePosts(items.length >= FEED_PAGE_SIZE);
      setUnreadCount(notifCount.count || 0);
      setUnreadMsgs(msgCount.count || 0);
    } catch (e) { console.log('Feed error:', e); }
    finally { setLoading(false); setRefreshing(false); }
  }, [token]);

  // Append the next page when the user reaches the end of the list.
  const loadMorePosts = useCallback(async () => {
    if (!hasMorePosts || loadingMore || loading) return;
    setLoadingMore(true);
    try {
      const next = pageRef.current + 1;
      const raw = await apiFetch(`/api/feed/?page=${next}&limit=${FEED_PAGE_SIZE}`, token);
      const items = Array.isArray(raw) ? raw : (raw?.items ?? []);
      setPosts(prev => [...prev, ...items]);
      pageRef.current = next;
      setHasMorePosts(items.length >= FEED_PAGE_SIZE);
    } catch (e) { console.log('Feed page error:', e); }
    finally { setLoadingMore(false); }
  }, [token, hasMorePosts, loadingMore, loading]);

  // Refetch on focus + pull-to-refresh (interval polling removed in Phase 5).
  useFocusEffect(useCallback(() => { loadData(); }, [loadData]));

  const handlePost = async () => {
    if (!newPost.trim() && !attachedImage) return;
    setPosting(true);
    try {
      const body = { 
        content: newPost, 
        post_type: attachedImage ? 'image' : 'text',
        image_url: attachedImage || ''
      };
      await apiFetch('/api/feed', token, { method: 'POST', body: JSON.stringify(body) });
      setNewPost(''); 
      setAttachedImage(null);
      setShowCompose(false); 
      loadData();
    } catch (e) { console.log('Post error:', e); }
    finally { setPosting(false); }
  };

  const pickImage = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) { alert('Permission required to access photos'); return; }
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.5, allowsEditing: true });
    if (result.canceled || !result.assets?.[0]?.uri) return;
    setUploadingImage(true);
    try {
      const formData = new FormData();
      const asset = result.assets[0];
      const filename = asset.uri.split('/').pop() || 'image.jpg';
      const match = /\.(\w+)$/.exec(filename);
      const type = match ? `image/${match[1]}` : `image`;
      
      if (Platform.OS === 'web') {
        const res = await fetch(asset.uri);
        const blob = await res.blob();
        formData.append('file', blob, filename);
      } else {
        formData.append('file', { uri: asset.uri, name: filename, type } as any);
      }
      
      const upload = await apiFetch('/api/upload/image', token, { method: 'POST', body: formData });
      const finalUrl = upload.url.startsWith('http') ? upload.url : `${API_URL}${upload.url}`;
      setAttachedImage(finalUrl);
    } catch (e: any) { alert(e.message || 'Upload failed'); }
    finally { setUploadingImage(false); }
  };

  const handleLike = async (postId: string) => {
    try {
      const result = await apiFetch(`/api/feed/${postId}/like`, token, { method: 'POST' });
      setPosts(prev => prev.map(p => p.id === postId ? { ...p, likes: result.liked ? [...p.likes, user?.id || ''] : p.likes.filter((l: string) => l !== user?.id), like_count: result.like_count } : p));
    } catch (e) { console.log('Like error:', e); }
  };

  const handleShare = async (post: Post) => {
    try {
      await Share.share({
        message: `${post.author_name} shared on ForMeds:\n\n"${post.content}"`
      });
    } catch (error) {
      console.log('Share error:', error);
    }
  };

  const renderPost = ({ item }: { item: Post }) => {
    const isLiked = item.likes?.includes(user?.id || '');
    return (
      <View testID={`feed-post-${item.id}`} style={styles.postCard}>
        <View style={styles.postHeader}>
          <Avatar name={item.author_name} role={item.author_role} size={44} />
          <View style={styles.postMeta}>
            <Text style={styles.authorName}>{item.author_name}</Text>
            <View style={styles.metaRow}>
              <RoleBadge role={item.author_role} />
              <Text style={styles.timeText}>{timeAgo(item.created_at)}</Text>
            </View>
          </View>
        </View>
        <Text style={styles.postContent}>{item.content}</Text>
        {item.image_url ? (
          <Image source={{ uri: item.image_url }} style={styles.postImage} resizeMode="cover" />
        ) : null}
        <View style={styles.postActions}>
          <TouchableOpacity testID={`like-btn-${item.id}`} style={styles.actionBtn} onPress={() => handleLike(item.id)}>
            <Ionicons name={isLiked ? "heart" : "heart-outline"} size={22} color={isLiked ? "#E84545" : "#94A3B8"} />
            <Text style={[styles.actionText, isLiked && { color: '#E84545' }]}>{item.like_count}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.actionBtn} onPress={() => router.push({ pathname: '/post/[id]', params: { id: item.id } } as any)}><Ionicons name="chatbubble-outline" size={20} color="#94A3B8" /><Text style={styles.actionText}>{item.comment_count}</Text></TouchableOpacity>
          <TouchableOpacity style={styles.actionBtn} onPress={() => handleShare(item)}><Ionicons name="share-social-outline" size={20} color="#94A3B8" /></TouchableOpacity>
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Community</Text>
        <View style={styles.headerActions}>
          <TouchableOpacity testID="network-btn" style={styles.iconBtn} onPress={() => router.push('/people')}>
            <Ionicons name="people-outline" size={24} color="#1A3A5C" />
          </TouchableOpacity>
          <TouchableOpacity testID="messages-btn" style={styles.iconBtn} onPress={() => router.push('/messages')}>
            <Ionicons name="chatbubbles-outline" size={24} color="#1A3A5C" />
            {unreadMsgs > 0 && <View style={styles.badge}><Text style={styles.badgeText}>{unreadMsgs > 9 ? '9+' : unreadMsgs}</Text></View>}
          </TouchableOpacity>
          <TouchableOpacity testID="notifications-btn" style={styles.iconBtn} onPress={() => router.push('/notifications')}>
            <Ionicons name="notifications-outline" size={24} color="#1A3A5C" />
            {unreadCount > 0 && <View style={styles.badge}><Text style={styles.badgeText}>{unreadCount > 9 ? '9+' : unreadCount}</Text></View>}
          </TouchableOpacity>
          <TouchableOpacity testID="compose-post-btn" style={styles.iconBtn} onPress={() => setShowCompose(!showCompose)}>
            <Ionicons name={showCompose ? "close" : "create-outline"} size={24} color="#1A3A5C" />
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.tabBar}>
        <TouchableOpacity testID="tab-feed" style={[styles.tab, activeTab === 'feed' && styles.tabActive]} onPress={() => setActiveTab('feed')} accessibilityRole="tab" accessibilityState={{ selected: activeTab === 'feed' }}>
          <Ionicons name="newspaper-outline" size={16} color={activeTab === 'feed' ? '#FFF' : '#64748B'} />
          <Text style={[styles.tabText, activeTab === 'feed' && styles.tabTextActive]}>Feed</Text>
        </TouchableOpacity>
        <TouchableOpacity testID="tab-cases" style={[styles.tab, activeTab === 'cases' && styles.tabActive]} onPress={() => setActiveTab('cases')} accessibilityRole="tab" accessibilityState={{ selected: activeTab === 'cases' }} accessibilityLabel="Cases — coming soon">
          <Ionicons name="help-buoy-outline" size={16} color={activeTab === 'cases' ? '#FFF' : '#64748B'} />
          <Text style={[styles.tabText, activeTab === 'cases' && styles.tabTextActive]}>Cases</Text>
        </TouchableOpacity>
      </View>

      {showCompose && activeTab === 'feed' && (
        <View style={styles.composeBox}>
          {/* Posting is KYC-gated server-side; explain that instead of letting
              the user write a post and only then hit a 403. */}
          <KycNotice action="post to the community" />
          <TextInput testID="post-input" style={styles.composeInput} placeholder="Share something with the community..." placeholderTextColor="#94A3B8" value={newPost} onChangeText={setNewPost} multiline editable={isKycApproved} />
          
          {attachedImage && (
            <View style={styles.attachedImageWrap}>
              <Image source={{ uri: attachedImage }} style={styles.attachedImagePreview} />
              <TouchableOpacity style={styles.removeImageBtn} onPress={() => setAttachedImage(null)}>
                <Ionicons name="close-circle" size={24} color="#FFF" />
              </TouchableOpacity>
            </View>
          )}

          <View style={styles.composeActions}>
            <TouchableOpacity testID="attach-image-btn" style={styles.attachBtn} onPress={pickImage} disabled={uploadingImage || !isKycApproved}>
              {uploadingImage ? <ActivityIndicator size="small" color="#1A3A5C" /> : <Ionicons name="image-outline" size={24} color={isKycApproved ? '#1A3A5C' : '#94A3B8'} />}
            </TouchableOpacity>
            <TouchableOpacity testID="submit-post-btn" style={[styles.postBtn, (!isKycApproved || (!newPost.trim() && !attachedImage)) && styles.postBtnDisabled]} onPress={handlePost} disabled={posting || !isKycApproved || (!newPost.trim() && !attachedImage)}>
              {posting ? <ActivityIndicator color="#FFF" size="small" /> : <Text style={styles.postBtnText}>Post</Text>}
            </TouchableOpacity>
          </View>
        </View>
      )}

      {activeTab === 'cases' ? (
        <ScrollView contentContainerStyle={styles.comingSoonBody}>
          <ComingSoon
            testID="coming-soon-cases"
            icon="help-buoy-outline"
            title={CASES_COPY.title}
            description={CASES_COPY.description}
            bullets={CASES_COPY.bullets}
          />
        </ScrollView>
      ) : loading ? (
        <View style={styles.center}><ActivityIndicator size="large" color="#1A3A5C" /></View>
      ) : (
        <FlatList data={posts} renderItem={renderPost} keyExtractor={item => item.id} contentContainerStyle={styles.list}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadData(); }} tintColor="#1A3A5C" />}
          onEndReached={loadMorePosts}
          onEndReachedThreshold={0.5}
          ListFooterComponent={loadingMore ? <ActivityIndicator style={{ paddingVertical: 20 }} color="#1A3A5C" /> : null}
          ListEmptyComponent={<View style={styles.center}><Ionicons name="newspaper-outline" size={48} color="#CBD5E1" /><Text style={styles.emptyText}>No posts yet</Text></View>} />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#F8FAFC' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 14, backgroundColor: '#FFFFFF', borderBottomWidth: 1, borderBottomColor: '#E2E8F0' },
  headerTitle: { fontSize: 24, fontWeight: '700', color: '#0F172A' },
  headerActions: { flexDirection: 'row', gap: 8 },
  iconBtn: { width: 44, height: 44, borderRadius: 12, backgroundColor: '#F1F5F9', alignItems: 'center', justifyContent: 'center' },
  badge: { position: 'absolute', top: 2, right: 2, backgroundColor: '#E84545', borderRadius: 10, minWidth: 18, height: 18, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4 },
  badgeText: { color: '#FFF', fontSize: 10, fontWeight: '700' },
  tabBar: { flexDirection: 'row', backgroundColor: '#FFFFFF', paddingHorizontal: 16, paddingVertical: 8, gap: 8 },
  tab: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 10, borderRadius: 10, backgroundColor: '#F1F5F9' },
  tabActive: { backgroundColor: '#1A3A5C' },
  tabText: { fontSize: 14, fontWeight: '600', color: '#64748B' },
  tabTextActive: { color: '#FFFFFF' },
  composeBox: { backgroundColor: '#FFFFFF', padding: 16, borderBottomWidth: 1, borderBottomColor: '#E2E8F0' },
  composeInput: { backgroundColor: '#F8FAFC', borderRadius: 12, padding: 14, fontSize: 15, color: '#0F172A', minHeight: 80, textAlignVertical: 'top', borderWidth: 1, borderColor: '#E2E8F0' },
  composeActions: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 10 },
  attachBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#F1F5F9', alignItems: 'center', justifyContent: 'center' },
  attachedImageWrap: { marginTop: 10, position: 'relative', alignSelf: 'flex-start' },
  attachedImagePreview: { width: 100, height: 100, borderRadius: 12 },
  removeImageBtn: { position: 'absolute', top: -10, right: -10, backgroundColor: 'rgba(0,0,0,0.5)', borderRadius: 12 },
  postBtn: { backgroundColor: '#1A3A5C', borderRadius: 10, paddingVertical: 10, paddingHorizontal: 24 },
  postBtnDisabled: { opacity: 0.5 },
  postBtnText: { color: '#FFF', fontWeight: '700', fontSize: 14 },
  list: { padding: 16, paddingBottom: 100 },
  postCard: { backgroundColor: '#FFFFFF', borderRadius: 16, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: '#E2E8F0' },
  postHeader: { flexDirection: 'row', marginBottom: 12 },
  avatarCircle: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#1A3A5C', alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  avatarText: { color: '#FFF', fontSize: 18, fontWeight: '700' },
  postMeta: { flex: 1 },
  authorName: { fontSize: 16, fontWeight: '600', color: '#0F172A' },
  metaRow: { flexDirection: 'row', alignItems: 'center', marginTop: 4 },
  roleTag: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8, marginRight: 8 },
  roleTagText: { fontSize: 11, fontWeight: '600' },
  timeText: { fontSize: 12, color: '#94A3B8' },
  postContent: { fontSize: 15, color: '#334155', lineHeight: 22, marginBottom: 12 },
  postImage: { width: '100%', height: 250, borderRadius: 12, marginBottom: 12 },
  postActions: { flexDirection: 'row', paddingTop: 12, borderTopWidth: 1, borderTopColor: '#F1F5F9', gap: 24 },
  actionBtn: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  actionText: { fontSize: 14, color: '#94A3B8', fontWeight: '500' },
  comingSoonBody: { padding: 16, paddingBottom: 100 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 80 },
  emptyText: { fontSize: 16, color: '#94A3B8', marginTop: 12 },
});
