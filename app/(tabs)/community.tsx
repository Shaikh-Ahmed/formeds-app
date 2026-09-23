import React, { useState, useCallback, useRef } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Pressable, TextInput, ActivityIndicator, RefreshControl, Share, Image, Platform, Animated } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../src/context/AuthContext';
import { apiFetch, API_URL } from '../../src/utils/api';
import { useRouter, useFocusEffect } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { timeAgo } from '../../src/utils/time';
import { Avatar, RoleBadge, KycNotice, CasesList, ExpandableText, MediaViewer, ArticleFeedCard } from '../../src/components';
import { PageGrid, ProfileRail, FeedRail, Hoverable } from '../../src/components/web';
import { colors, spacing, radius, typography, compactAction, useBreakpoint } from '../../src/theme';
import { useCollapsibleHeader, focusScrollInset } from '../../src/hooks/useCollapsibleHeader';

const FEED_PAGE_SIZE = 20;

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
  /** Post whose image is open in the lightbox; null when it is closed. */
  const [viewerPost, setViewerPost] = useState<Post | null>(null);
  const pageRef = useRef(1);

  // The tab switcher and the composer row ride above the list and slide out of
  // the way as the reader moves down it, giving the feed the whole screen.
  // They stay pinned while the composer is expanded — pulling a field someone
  // is typing into off the screen is never the right call — and only the feed
  // renders that composer, so Cases keeps collapsing even with a draft open.
  const composerOpen = showCompose && activeTab === 'feed';
  const { headerHeight, headerStyle, onHeaderLayout, scrollProps, reveal } =
    useCollapsibleHeader({ enabled: !composerOpen });

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

  const renderPost = ({ item }: { item: any }) => {
    const isLiked = item.likes?.includes(user?.id || '');

    if (item.post_type === 'article') {
      return (
        <ArticleFeedCard
          post={item}
          isLiked={isLiked}
          onLike={handleLike}
          onComment={(id) => router.push({ pathname: '/post/[id]', params: { id } } as any)}
          onShare={handleShare}
        />
      );
    }

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
        <ExpandableText
          testID={`post-body-${item.id}`}
          text={item.content}
          numberOfLines={3}
          style={styles.postContent}
        />
        {item.image_url ? (
          <Pressable
            testID={`post-image-${item.id}`}
            onPress={() => setViewerPost(item)}
            accessibilityRole="imagebutton"
            accessibilityLabel="Open image full screen"
            style={({ pressed }) => [styles.postImageWrap, pressed && styles.postImagePressed]}
          >
            {/* Cropped on purpose so every card is the same height; the
                uncropped version is one tap away in MediaViewer. */}
            <Image source={{ uri: item.image_url }} style={styles.postImage} resizeMode="cover" />
            <View style={styles.expandHint} pointerEvents="none">
              <Ionicons name="expand-outline" size={14} color={colors.white} />
            </View>
          </Pressable>
        ) : null}
        {/* Compact action row: the buttons are drawn at 32px but carry
            the shared compactAction hit slop, so the area a finger actually has to hit stays 44px.
            Shrinking the painted box instead of the target is what buys the
            height back without making the row harder to use. */}
        <View style={styles.postActions}>
          <Hoverable
            testID={`like-btn-${item.id}`}
            style={styles.actionBtn}
            hoverStyle={styles.actionBtnHover}
            hitSlop={compactAction.hitSlop}
            onPress={() => handleLike(item.id)}
            accessibilityLabel={`${isLiked ? 'Unlike' : 'Like'}, ${item.like_count} likes`}
          >
            {/* redText, not red: the bright brand red is only 3.9:1 on the
                card, which is fine for a glyph but below the minimum for the
                count beside it. One colour for both keeps the pair matched. */}
            <Ionicons name={isLiked ? 'heart' : 'heart-outline'} size={18} color={isLiked ? colors.redText : colors.textSecondary} />
            <Text style={[styles.actionText, isLiked && { color: colors.redText }]}>{item.like_count}</Text>
          </Hoverable>
          <Hoverable
            style={styles.actionBtn}
            hoverStyle={styles.actionBtnHover}
            hitSlop={compactAction.hitSlop}
            onPress={() => router.push({ pathname: '/post/[id]', params: { id: item.id } } as any)}
            accessibilityLabel={`Comments, ${item.comment_count}`}
          >
            <Ionicons name="chatbubble-outline" size={18} color={colors.textSecondary} />
            <Text style={styles.actionText}>{item.comment_count}</Text>
          </Hoverable>
          <Hoverable
            style={styles.actionBtn}
            hoverStyle={styles.actionBtnHover}
            hitSlop={compactAction.hitSlop}
            onPress={() => handleShare(item)}
            accessibilityLabel="Share this post"
          >
            <Ionicons name="share-social-outline" size={18} color={colors.textSecondary} />
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
      {/* The collapsing header is an overlay, so it needs a clipping host:
          without one it slides up over the app's top bar instead of out of
          the screen. The list renders first and the header after it so the
          header paints on top at every width. */}
      <View style={styles.scrollHost}>
        {activeTab === 'cases' ? (
          <CasesList scrollProps={scrollProps} contentInsetTop={headerHeight} />
        ) : loading ? (
          <View style={styles.center}><ActivityIndicator size="large" color={colors.navy} /></View>
        ) : (
          <FlatList data={posts} renderItem={renderPost} keyExtractor={item => item.id}
            {...scrollProps}
            style={focusScrollInset(headerHeight)}
            contentContainerStyle={[styles.list, !isMobile && styles.listWide, { paddingTop: headerHeight + spacing.lg }]}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadData(); }} tintColor={colors.navy} progressViewOffset={headerHeight} />}
            onEndReached={loadMorePosts}
            onEndReachedThreshold={0.5}
            ListFooterComponent={loadingMore ? <ActivityIndicator style={{ paddingVertical: 20 }} color={colors.navy} /> : null}
            ListEmptyComponent={<View style={styles.center}><Ionicons name="newspaper-outline" size={48} color="#CBD5E1" /><Text style={styles.emptyText}>No posts yet</Text></View>} />
        )}

        <Animated.View
          testID="community-header"
          onLayout={onHeaderLayout}
          style={[styles.header, headerStyle]}
        >
        <View style={[styles.tabBar, !isMobile && styles.tabBarWide]}>
          <TouchableOpacity testID="tab-feed" style={[styles.tab, activeTab === 'feed' && styles.tabActive]} onPress={() => { setActiveTab('feed'); reveal(); }} accessibilityRole="tab" accessibilityState={{ selected: activeTab === 'feed' }}>
            <Ionicons name="newspaper-outline" size={16} color={activeTab === 'feed' ? '#FFF' : '#64748B'} />
            <Text style={[styles.tabText, activeTab === 'feed' && styles.tabTextActive]}>Feed</Text>
          </TouchableOpacity>
          <TouchableOpacity testID="tab-cases" style={[styles.tab, activeTab === 'cases' && styles.tabActive]} onPress={() => { setActiveTab('cases'); reveal(); }} accessibilityRole="tab" accessibilityState={{ selected: activeTab === 'cases' }}>
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

        {composerOpen && (
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

        </Animated.View>
      </View>

      </PageGrid>

      {viewerPost?.image_url ? (
        <MediaViewer
          visible
          imageUri={viewerPost.image_url}
          post={viewerPost}
          onClose={() => setViewerPost(null)}
          onOpenPost={() =>
            router.push({ pathname: '/post/[id]', params: { id: viewerPost.id } } as any)
          }
        />
      ) : null}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#F8FAFC' },
  // Clips the header at the top edge as it slides away.
  scrollHost: { flex: 1, overflow: 'hidden' },
  header: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 2,
    // Opaque: posts pass underneath, and the gap between the tab strip and the
    // composer row would otherwise let them show through.
    backgroundColor: colors.bg,
  },
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
  postContent: { fontSize: 15, color: '#334155', lineHeight: 22 },
  postImageWrap: { marginTop: 12, borderRadius: 12, overflow: 'hidden' },
  postImagePressed: { opacity: 0.9 },
  postImage: { width: '100%', height: 250 },
  // Small affordance so the image reads as openable rather than decorative.
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
    // No divider rule and minimal lead-in: the reference treatment separates
    // actions from body with whitespace alone. A rule plus padding was costing
    // ~10px per card for a boundary the eye already reads.
    marginTop: spacing.xs,
    marginLeft: -spacing.sm,
    gap: spacing.xs,
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    // 32 painted + 6 hit-slop top and bottom = the 44 a finger needs.
    height: compactAction.height,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.sm,
  },
  actionBtnHover: { backgroundColor: colors.bgMuted },
  // textMuted reaches only 2.6:1 on white — fine for a placeholder, not for a
  // count that carries meaning.
  actionText: { fontSize: 13, color: colors.textSecondary, fontWeight: '600' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 80 },
  emptyText: { fontSize: 16, color: '#94A3B8', marginTop: 12 },
});
