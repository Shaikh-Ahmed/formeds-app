import React, { useState, useEffect, useCallback, useRef } from 'react';

const FEED_PAGE_SIZE = 20;
import { View, Text, StyleSheet, FlatList, TouchableOpacity, TextInput, ActivityIndicator, RefreshControl, Share, Image, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../src/context/AuthContext';
import { apiFetch, API_URL } from '../../src/utils/api';
import { useRouter, useFocusEffect } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { timeAgo } from '../../src/utils/time';
import { Avatar, RoleBadge, KycNotice, CasesList } from '../../src/components';
import { PageGrid, ProfileRail, FeedRail, Hoverable } from '../../src/components/web';
import { colors, spacing, radius, typography, useBreakpoint } from '../../src/theme';

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

export default function FeedScreen() {
  const { user, token, isKycApproved } = useAuth();
  const router = useRouter();
  const { isMobile } = useBreakpoint();
  const [activeTab, setActiveTab] = useState<'feed' | 'cases'>('feed');
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [newPost, setNewPost] = useState('');
  const [posting, setPosting] = useState(false);
  const [showCompose, setShowCompose] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [attachedImage, setAttachedImage] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMorePosts, setHasMorePosts] = useState(true);
  const pageRef = useRef(1);

  // Unread counts moved to the layouts that own the persistent bars, which
  // also drops two requests from every feed load and refresh.
  const loadData = useCallback(async () => {
    try {
      const feedData = await apiFetch(`/api/feed/?page=1&limit=${FEED_PAGE_SIZE}`, token);
      const items = Array.isArray(feedData) ? feedData : (feedData?.items ?? []);
      setPosts(items);
      pageRef.current = 1;
      setHasMorePosts(items.length >= FEED_PAGE_SIZE);
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
      <View testID={`feed-post-${item.id}`} style={[styles.postCard, !isMobile && styles.postCardWide]}>
        {/* The author block opens the post on desktop, where a pointer user
            expects the header to be clickable; on mobile the dedicated
            comment button stays the only route in. */}
        <Hoverable
          onPress={isMobile ? undefined : () => router.push({ pathname: '/post/[id]', params: { id: item.id } } as any)}
          accessibilityLabel={`Post by ${item.author_name}`}
          style={styles.postHeader}
          hoverStyle={styles.postHeaderHover}
        >
          <Avatar name={item.author_name} role={item.author_role} size={44} />
          <View style={styles.postMeta}>
            <Text style={styles.authorName}>{item.author_name}</Text>
            <View style={styles.metaRow}>
              <RoleBadge role={item.author_role} />
              <Text style={styles.timeText}>{timeAgo(item.created_at)}</Text>
            </View>
          </View>
        </Hoverable>
        <Text style={styles.postContent}>{item.content}</Text>
        {item.image_url ? (
          <Image source={{ uri: item.image_url }} style={styles.postImage} resizeMode="cover" />
        ) : null}
        <View style={styles.postActions}>
          <Hoverable
            testID={`like-btn-${item.id}`}
            style={styles.actionBtn}
            hoverStyle={styles.actionBtnHover}
            onPress={() => handleLike(item.id)}
            accessibilityLabel={`${isLiked ? 'Unlike' : 'Like'}, ${item.like_count} likes`}
          >
            <Ionicons name={isLiked ? 'heart' : 'heart-outline'} size={22} color={isLiked ? colors.red : colors.textMuted} />
            <Text style={[styles.actionText, isLiked && { color: colors.red }]}>{item.like_count}</Text>
          </Hoverable>
          <Hoverable
            style={styles.actionBtn}
            hoverStyle={styles.actionBtnHover}
            onPress={() => router.push({ pathname: '/post/[id]', params: { id: item.id } } as any)}
            accessibilityLabel={`Comments, ${item.comment_count}`}
          >
            <Ionicons name="chatbubble-outline" size={20} color={colors.textMuted} />
            <Text style={styles.actionText}>{item.comment_count}</Text>
          </Hoverable>
          <Hoverable
            style={styles.actionBtn}
            hoverStyle={styles.actionBtnHover}
            onPress={() => handleShare(item)}
            accessibilityLabel="Share this post"
          >
            <Ionicons name="share-social-outline" size={20} color={colors.textMuted} />
          </Hoverable>
        </View>
      </View>
    );
  };

  return (
    // No page title and no header icon row: the persistent top bar already
    // identifies the app and owns search and messages, Alerts is its own tab
    // and My network lives in the drawer. Repeating any of them here would be
    // two navigation systems stacked on top of each other.
    <SafeAreaView style={styles.safe} edges={[]}>
      <PageGrid left={<ProfileRail />} right={<FeedRail />} testID="community-grid">
      <View style={[styles.tabBar, !isMobile && styles.tabBarWide]}>
        <TouchableOpacity testID="tab-feed" style={[styles.tab, activeTab === 'feed' && styles.tabActive]} onPress={() => setActiveTab('feed')} accessibilityRole="tab" accessibilityState={{ selected: activeTab === 'feed' }}>
          <Ionicons name="newspaper-outline" size={16} color={activeTab === 'feed' ? '#FFF' : '#64748B'} />
          <Text style={[styles.tabText, activeTab === 'feed' && styles.tabTextActive]}>Feed</Text>
        </TouchableOpacity>
        <TouchableOpacity testID="tab-cases" style={[styles.tab, activeTab === 'cases' && styles.tabActive]} onPress={() => setActiveTab('cases')} accessibilityRole="tab" accessibilityState={{ selected: activeTab === 'cases' }}>
          <Ionicons name="help-buoy-outline" size={16} color={activeTab === 'cases' ? '#FFF' : '#64748B'} />
          <Text style={[styles.tabText, activeTab === 'cases' && styles.tabTextActive]}>Cases</Text>
        </TouchableOpacity>
      </View>

      {/* A persistent "start a post" row at every width. It replaced the
          header icon on mobile: a labelled row with your own avatar reads as
          an invitation, where a bare pencil glyph in a header did not. On the
          Cases tab it routes to the full composer, which needs a title and
          tags and so can't expand inline. */}
      {!showCompose && (
        <Hoverable
          testID="compose-trigger"
          onPress={() =>
            activeTab === 'cases' ? router.push('/case/new' as any) : setShowCompose(true)
          }
          accessibilityLabel={activeTab === 'cases' ? 'Post a case' : 'Write a post'}
          style={[styles.composeTrigger, isMobile && styles.composeTriggerMobile]}
          hoverStyle={styles.composeTriggerHover}
        >
          <Avatar name={user?.name} role={user?.role} uri={user?.avatar} size={40} />
          <Text style={styles.composeTriggerText} numberOfLines={1}>
            {activeTab === 'cases' ? 'Ask the community about a case…' : 'Share something with the community…'}
          </Text>
          <Ionicons name="create-outline" size={20} color={colors.navy} />
        </Hoverable>
      )}

      {showCompose && activeTab === 'feed' && (
        <View style={[styles.composeBox, !isMobile && styles.composeBoxWide]}>
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
            <TouchableOpacity testID="attach-image-btn" style={styles.attachBtn} onPress={pickImage} disabled={uploadingImage || !isKycApproved} accessibilityRole="button" accessibilityLabel="Attach an image">
              {uploadingImage ? <ActivityIndicator size="small" color={colors.navy} /> : <Ionicons name="image-outline" size={24} color={isKycApproved ? colors.navy : colors.textMuted} />}
            </TouchableOpacity>
            <View style={styles.composeRight}>
              {/* Desktop has no header close button to fall back on, so the
                  composer carries its own way out. */}
              {!isMobile && (
                <Hoverable
                  testID="compose-cancel-btn"
                  onPress={() => { setShowCompose(false); setNewPost(''); setAttachedImage(null); }}
                  accessibilityLabel="Cancel post"
                  style={styles.cancelBtn}
                  hoverStyle={styles.cancelBtnHover}
                >
                  <Text style={styles.cancelBtnText}>Cancel</Text>
                </Hoverable>
              )}
              <TouchableOpacity testID="submit-post-btn" style={[styles.postBtn, (!isKycApproved || (!newPost.trim() && !attachedImage)) && styles.postBtnDisabled]} onPress={handlePost} disabled={posting || !isKycApproved || (!newPost.trim() && !attachedImage)} accessibilityRole="button" accessibilityLabel="Publish post">
                {posting ? <ActivityIndicator color="#FFF" size="small" /> : <Text style={styles.postBtnText}>Post</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}

      {activeTab === 'cases' ? (
        <CasesList />
      ) : loading ? (
        <View style={styles.center}><ActivityIndicator size="large" color={colors.navy} /></View>
      ) : (
        <FlatList data={posts} renderItem={renderPost} keyExtractor={item => item.id}
          contentContainerStyle={[styles.list, !isMobile && styles.listWide]}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadData(); }} tintColor={colors.navy} />}
          onEndReached={loadMorePosts}
          onEndReachedThreshold={0.5}
          ListFooterComponent={loadingMore ? <ActivityIndicator style={{ paddingVertical: 20 }} color={colors.navy} /> : null}
          ListEmptyComponent={<View style={styles.center}><Ionicons name="newspaper-outline" size={48} color="#CBD5E1" /><Text style={styles.emptyText}>No posts yet</Text></View>} />
      )}
      </PageGrid>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#F8FAFC' },
  // The header row, its icon buttons and their badges were removed with the
  // in-screen header — MobileTopBar and the Alerts tab own those now.
  tabBar: { flexDirection: 'row', backgroundColor: '#FFFFFF', paddingHorizontal: 16, paddingVertical: 8, gap: 8 },
  // On desktop the segmented control becomes a card in the content column
  // instead of a full-bleed strip, so it reads as part of the feed.
  tabBarWide: {
    marginTop: spacing.xxl,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.sm,
  },
  tab: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 10, borderRadius: 10, backgroundColor: '#F1F5F9' },
  tabActive: { backgroundColor: '#1A3A5C' },
  tabText: { fontSize: 14, fontWeight: '600', color: '#64748B' },
  tabTextActive: { color: '#FFFFFF' },

  composeTrigger: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.white,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    marginTop: spacing.lg,
  },
  // The grid supplies side gutters on desktop; on a phone the row needs its own.
  composeTriggerMobile: { marginHorizontal: spacing.lg, marginTop: spacing.md },
  composeTriggerHover: { backgroundColor: colors.bgMuted, borderColor: colors.textMuted },
  composeTriggerText: { ...typography.body, color: colors.textSecondary, flex: 1 },

  composeBox: { backgroundColor: '#FFFFFF', padding: 16, borderBottomWidth: 1, borderBottomColor: '#E2E8F0' },
  composeBoxWide: {
    marginTop: spacing.lg,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    borderBottomColor: colors.border,
  },
  composeRight: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  cancelBtn: { paddingHorizontal: spacing.lg, paddingVertical: spacing.md, borderRadius: radius.md },
  cancelBtnHover: { backgroundColor: colors.bgMuted },
  cancelBtnText: { ...typography.label, color: colors.textSecondary },
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
  // The grid already supplies the horizontal gutter; doubling it would push
  // the readable column narrower than the 65–75ch target.
  listWide: { paddingHorizontal: 0, paddingTop: spacing.lg, paddingBottom: spacing.xxxl },
  postCard: { backgroundColor: '#FFFFFF', borderRadius: 16, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: '#E2E8F0' },
  postCardWide: { marginBottom: spacing.lg },
  postHeader: { flexDirection: 'row', marginBottom: 12, borderRadius: radius.md, marginHorizontal: -4, paddingHorizontal: 4, paddingVertical: 2 },
  postHeaderHover: { backgroundColor: colors.bgMuted },
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
  postActions: { flexDirection: 'row', paddingTop: 12, borderTopWidth: 1, borderTopColor: '#F1F5F9', gap: 8 },
  // Padding rather than bare icons: gives the hover tint something to fill and
  // keeps every action at the 44px minimum target.
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    minHeight: 44,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
  },
  actionBtnHover: { backgroundColor: colors.bgMuted },
  actionText: { fontSize: 14, color: '#94A3B8', fontWeight: '500' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 80 },
  emptyText: { fontSize: 16, color: '#94A3B8', marginTop: 12 },
});
