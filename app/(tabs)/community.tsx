import React, { useState, useCallback, useRef } from 'react';
import { HeroCard, GlassPanel, SoftCross } from '../../src/components/material';
import { TrustMark } from '../../src/components/TrustMark';
import { useSubmit } from '../../src/hooks/useSubmit';
import { FieldError } from '../../src/components/FieldError';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Pressable, TextInput, ActivityIndicator, RefreshControl, Image, Platform, Animated } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../src/context/AuthContext';
import { apiFetch, API_URL } from '../../src/utils/api';
import { useRouter, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { sharePost } from '../../src/utils/share';
import { CopiedToast, useCopiedToast } from '../../src/components/CopiedToast';
import * as ImagePicker from 'expo-image-picker';
import { timeAgo } from '../../src/utils/time';
import { Avatar, RoleBadge, KycNotice, CasesList, ExpandableText, MediaViewer, EmptyState, ArticleFeedCard } from '../../src/components';
import type { ArticleFeedPost } from '../../src/types/feed';
import { PostActions } from '../../src/components/PostActions';
import { PageGrid, ProfileRail, FeedRail, Hoverable } from '../../src/components/web';
import { colors, fonts, spacing, radius, typography, shadow, elevation, useBreakpoint, activeTheme, isRefined, isMaterial, isTerracotta, gloss } from '../../src/theme';
import { useCollapsibleHeader, focusScrollInset } from '../../src/hooks/useCollapsibleHeader';
import { mediaUri } from '../../src/utils/media';

const FEED_PAGE_SIZE = 20;

interface Post {
  id: string;
  author_id?: string;
  author_name: string;
  author_role: string;
  content: string;
  post_type: string;
  image_url?: string;
  like_count: number;
  comment_count: number;
  likes: string[];
  created_at: string;
  /** For the reader: saved for later / reposted to their network. */
  saved?: boolean;
  reposted?: boolean;
  repost_count?: number;
  /** A repost: who reposted is this row; what they reposted is `original`. */
  repost_of?: string | null;
  original?: Post;
}

export default function FeedScreen() {
  const { user, token, isKycApproved } = useAuth();
  const router = useRouter();
  const { isMobile } = useBreakpoint();
  // `?tab=cases&tag=…` / `&saved=1`: the rails link straight into Cases.
  const params = useLocalSearchParams<{ tab?: string; tag?: string; saved?: string }>();
  const [activeTab, setActiveTab] = useState<'feed' | 'cases'>(params.tab === 'cases' ? 'cases' : 'feed');
  // "Saved posts": the feed narrowed to what the reader saved. Saved CASES
  // keep their own filter inside the Cases tab (?tab=cases&saved=1).
  const [savedOnly, setSavedOnly] = useState(params.saved === '1' && params.tab !== 'cases');
  React.useEffect(() => {
    if (params.saved === '1' && params.tab !== 'cases') { setSavedOnly(true); setActiveTab('feed'); }
  }, [params.saved, params.tab]);
  React.useEffect(() => { if (params.tab === 'cases') setActiveTab('cases'); }, [params.tab, params.tag, params.saved]);
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [newPost, setNewPost] = useState('');
  const { submitting: posting, run: runPost } = useSubmit();
  const [postError, setPostError] = useState<string | null>(null);
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
  // Material's greeting hero scrolls away with the feed as soon as the reader
  // scrolls, and returns at the top; measured so the header knows how far.
  const [heroHeight, setHeroHeight] = useState(0);
  const { headerHeight, headerStyle, onHeaderLayout, scrollProps, reveal } =
    useCollapsibleHeader({ enabled: !composerOpen, leadHeight: isMaterial ? heroHeight : 0 });

  // Unread counts moved to the layouts that own the persistent bars, which
  // also drops two requests from every feed load and refresh.
  const loadData = useCallback(async () => {
    try {
      const feedData = await apiFetch(savedOnly ? `/api/feed/saved?page=1&limit=${FEED_PAGE_SIZE}`
        : `/api/feed/?page=1&limit=${FEED_PAGE_SIZE}`, token);
      const items = Array.isArray(feedData) ? feedData : (feedData?.items ?? []);
      setPosts(items);
      pageRef.current = 1;
      setHasMorePosts(items.length >= FEED_PAGE_SIZE);
    } catch (e) { console.log('Feed error:', e); }
    finally { setLoading(false); setRefreshing(false); }
  }, [token, savedOnly]);

  // Append the next page when the user reaches the end of the list.
  const loadMorePosts = useCallback(async () => {
    if (!hasMorePosts || loadingMore || loading) return;
    setLoadingMore(true);
    try {
      const next = pageRef.current + 1;
      const raw = await apiFetch(`/api/feed/${savedOnly ? 'saved' : ''}?page=${next}&limit=${FEED_PAGE_SIZE}`, token);
      const items = Array.isArray(raw) ? raw : (raw?.items ?? []);
      setPosts(prev => [...prev, ...items]);
      pageRef.current = next;
      setHasMorePosts(items.length >= FEED_PAGE_SIZE);
    } catch (e) { console.log('Feed page error:', e); }
    finally { setLoadingMore(false); }
  }, [token, hasMorePosts, loadingMore, loading, savedOnly]);

  // Refetch on focus + pull-to-refresh (interval polling removed in Phase 5).
  useFocusEffect(useCallback(() => { loadData(); }, [loadData]));

  const handlePost = () => {
    if (!newPost.trim() && !attachedImage) {
      setPostError('Write something or attach an image to post.');
      return;
    }
    const body = {
      content: newPost,
      post_type: attachedImage ? 'image' : 'text',
      image_url: attachedImage || '',
    };
    // One post however many times Post is pressed: the guard stops repeats
    // while it is sending, and the key makes a retry return the same post.
    return runPost(async key => {
      setPostError(null);
      try {
        await apiFetch('/api/feed/', token, { method: 'POST', body: JSON.stringify(body), idempotencyKey: key });
        setNewPost('');
        setAttachedImage(null);
        setShowCompose(false);
        loadData();
      } catch (e: any) {
        // Never silent: the text stays in the box and the reason shows under it.
        setPostError(e?.message || 'Could not publish your post. Please try again.');
      }
    }, body);
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
      patchPost(postId, p => ({ ...p, likes: result.liked ? [...(p.likes || []), user?.id || ''] : (p.likes || []).filter((l: string) => l !== user?.id), like_count: result.like_count }));
    } catch (e) { console.log('Like error:', e); }
  };

  /** Apply a change to a post wherever it shows: as itself, or inside reposts. */
  const patchPost = (postId: string, fn: (p: Post) => Post) =>
    setPosts(prev => prev.map(p => p.id === postId ? fn(p)
      : p.original?.id === postId ? { ...p, original: fn(p.original) } : p));

  const handleSave = async (postId: string) => {
    try {
      const { saved } = await apiFetch(`/api/feed/${postId}/save`, token, { method: 'POST' });
      if (savedOnly && !saved) {
        // Unsaved from the Saved view: it leaves the list.
        setPosts(prev => prev.filter(p => (p.original?.id ?? p.id) !== postId));
      } else {
        patchPost(postId, p => ({ ...p, saved }));
      }
    } catch (e: any) { alert(e?.message || 'Could not save this post. Please try again.'); }
  };

  const handleRepost = async (postId: string) => {
    try {
      const { reposted, repost_count } = await apiFetch(`/api/feed/${postId}/repost`, token, { method: 'POST' });
      patchPost(postId, p => ({ ...p, reposted, repost_count }));
      // Reposting adds a row to the feed (and undoing removes it): refresh.
      if (!savedOnly) loadData();
    } catch (e: any) { alert(e?.message || 'Could not repost. Please try again.'); }
  };

  // A link to the post itself; where there is no share sheet (most desktop
  // browsers) the link is copied instead, and "Link copied" confirms it.
  const copiedToast = useCopiedToast();
  const handleShare = async (post: Post) => copiedToast.report(await sharePost(post));

  const renderPost = ({ item: row }: { item: Post }) => {
    // A repost shows its original; every action acts on the original.
    const item = row.original ?? row;
    const isLiked = item.likes?.includes(user?.id || '');
    const repostedBy = row.original ? (
      <View style={styles.repostedBy} testID={`reposted-by-${row.id}`}>
        <Ionicons name="repeat" size={14} color={colors.textSecondary} />
        <Text style={styles.repostedByText} numberOfLines={1}>
          {row.author_id === user?.id ? 'You reposted' : `${row.author_name} reposted`}
        </Text>
      </View>
    ) : null;

    if (item.post_type === 'article') {
      return (
        <ArticleFeedCard
          // Articles are feed rows with extra fields (journal, authors, link).
          post={item as unknown as ArticleFeedPost}
          testID={row.original ? `feed-post-${row.id}` : undefined}
          header={repostedBy}
          isLiked={isLiked}
          onLike={handleLike}
          onComment={(id) => router.push({ pathname: '/post/[id]', params: { id } } as any)}
          onRepost={handleRepost}
          onSave={handleSave}
          onShare={(p) => { handleShare(p as unknown as Post); }}
        />
      );
    }

    return (
      <View testID={`feed-post-${row.id}`} style={[styles.postCard, !isMobile && styles.postCardWide, isRefined && styles.pPostCard]}>
        {repostedBy}
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
            <Text style={[styles.authorName, isRefined && styles.pAuthorName]}>{item.author_name}</Text>
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
          style={[styles.postContent, isRefined && styles.pPostContent]}
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
            <Image source={{ uri: mediaUri(item.image_url) }} style={styles.postImage} resizeMode="cover" />
            <View style={styles.expandHint} pointerEvents="none">
              <Ionicons name="expand-outline" size={14} color={colors.white} />
            </View>
          </Pressable>
        ) : null}
        <PostActions
          post={item}
          liked={isLiked}
          onLike={() => handleLike(item.id)}
          onComment={() => router.push({ pathname: '/post/[id]', params: { id: item.id } } as any)}
          onRepost={() => handleRepost(item.id)}
          onShare={() => handleShare(item)}
          onSave={() => handleSave(item.id)}
          testIDs={{ like: `like-btn-${item.id}`, repost: `repost-btn-${item.id}`, save: `save-btn-${item.id}` }}
        />
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
          <CasesList scrollProps={scrollProps} contentInsetTop={headerHeight}
            initialTag={params.tag || undefined} initialSaved={params.saved === '1'} />
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
            ListEmptyComponent={isRefined ? (
              // Premium: a designed state with a next step -- into the
              // existing Cases tab -- rather than a grey icon and a dead end.
              savedOnly ? (
                <EmptyState icon="bookmark-outline" title="No saved posts yet"
                  hint="Tap the bookmark on any post to keep it here for later."
                  actionLabel="Back to the feed" onAction={() => { setSavedOnly(false); router.setParams({ saved: undefined } as any); }} />
              ) : <EmptyState icon="newspaper-outline" title="No posts yet"
                hint="Start a clinical discussion, or explore the cases colleagues are working through."
                actionLabel="Explore cases" onAction={() => setActiveTab('cases')} />
            ) : <View style={styles.center}><Ionicons name="newspaper-outline" size={48} color={colors.iconFaint} /><Text style={styles.emptyText}>No posts yet</Text></View>} />
        )}

        <Animated.View
          testID="community-header"
          onLayout={onHeaderLayout}
          style={[styles.header, isMaterial && styles.headerGlass, headerStyle]}
        >
        {/* Journal opens the feed like an issue of a journal: a greeting and
            a headline. Desktop only — on a phone the feed itself comes first. */}
        {activeTheme === 'journal' && !isMobile ? (
          <View style={styles.journalIntro} testID="journal-greeting">
            <Text style={styles.journalOverline}>{greeting()}{user?.name ? `, ${user.name}` : ''}</Text>
            <Text style={styles.journalHeadline} accessibilityRole="header">What your colleagues are discussing</Text>
          </View>
        ) : null}
        {/* Premium opens Home on the person: who they are professionally and
            whether they are verified -- all from the signed-in account, no
            new data -- above the same feed. */}
        {isMaterial ? (
          // Material: the greeting as a compact hero -- who you are and
          // whether you are verified, all from the account. The wrapper is
          // measured (margins included) for the scroll-away above.
          <View style={[styles.mHeroWrap, isMobile && styles.mHeroWrapMobile]}
            onLayout={e => setHeroHeight(Math.round(e.nativeEvent.layout.height))}>
          <HeroCard compact style={styles.mHero}
            object={<SoftCross size={isMobile ? 48 : 60} />} testID="material-hero">
            <Text style={styles.mOverline}>{greeting().toUpperCase()}</Text>
            <Text style={styles.mHeadline} accessibilityRole="header" numberOfLines={1}>
              {user?.name || 'Welcome to ForMeds'}
            </Text>
            <View style={styles.mIdentity}>
              {[user?.specialty || user?.professional_role, user?.city].filter(Boolean).length ? (
                <Text style={styles.mIdentityText} numberOfLines={1}>
                  {[user?.specialty || user?.professional_role, user?.city].filter(Boolean).join(' · ')}
                </Text>
              ) : null}
              {user?.verified ? (
                <GlassPanel onDark style={styles.mVerified}>
                  <Ionicons name="shield-checkmark" size={14} color="#FFFFFF" />
                  <Text style={styles.mVerifiedText}>Verified</Text>
                </GlassPanel>
              ) : null}
            </View>
          </HeroCard>
          </View>
        ) : isRefined && !isMobile ? (
          <View style={styles.pIntro} testID="premium-greeting">
            <Text style={styles.pOverline}>{greeting()}</Text>
            <Text style={styles.pHeadline} accessibilityRole="header" numberOfLines={1}>
              {user?.name || 'Welcome to ForMeds'}
            </Text>
            <View style={styles.pIdentity}>
              {[user?.specialty || user?.professional_role, user?.city].filter(Boolean).length ? (
                <Text style={styles.pIdentityText} numberOfLines={1}>
                  {[user?.specialty || user?.professional_role, user?.city].filter(Boolean).join(' · ')}
                </Text>
              ) : null}
              {user?.verified ? (
                <TrustMark size={15} label="Verified healthcare professional" text="Verified" />
              ) : null}
            </View>
          </View>
        ) : null}
        <View style={[styles.tabBar, !isMobile && styles.tabBarWide]}>
          <TouchableOpacity testID="tab-feed" style={[styles.tab, activeTab === 'feed' && styles.tabActive]} onPress={() => { setActiveTab('feed'); reveal(); }} accessibilityRole="tab" accessibilityState={{ selected: activeTab === 'feed' }}>
            <Ionicons name="newspaper-outline" size={16} color={activeTab === 'feed' ? '#FFF' : colors.textSubtle} />
            <Text style={[styles.tabText, activeTab === 'feed' && styles.tabTextActive]}>Feed</Text>
          </TouchableOpacity>
          <TouchableOpacity testID="tab-cases" style={[styles.tab, activeTab === 'cases' && styles.tabActive]} onPress={() => { setActiveTab('cases'); reveal(); }} accessibilityRole="tab" accessibilityState={{ selected: activeTab === 'cases' }}>
            <Ionicons name="help-buoy-outline" size={16} color={activeTab === 'cases' ? '#FFF' : colors.textSubtle} />
            <Text style={[styles.tabText, activeTab === 'cases' && styles.tabTextActive]}>Cases</Text>
          </TouchableOpacity>
        </View>

        {savedOnly && activeTab === 'feed' ? (
          <View style={[styles.savedBar, isMobile && { marginHorizontal: spacing.lg }]} testID="saved-posts-bar">
            <Text style={styles.savedBarText}>Saved posts</Text>
            <Pressable onPress={() => { setSavedOnly(false); router.setParams({ saved: undefined } as any); }}
              accessibilityRole="button" accessibilityLabel="Show all posts" style={styles.savedBarClose}
              testID="saved-posts-close">
              <Text style={styles.savedBarCloseText}>Show all</Text>
              <Ionicons name="close" size={14} color={colors.textSecondary} />
            </Pressable>
          </View>
        ) : null}

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
            <TextInput maxLength={5000} testID="post-input" style={styles.composeInput} placeholder="Share something with the community..." placeholderTextColor={colors.textMuted} value={newPost} onChangeText={setNewPost} multiline editable={isKycApproved} />
          
            {attachedImage && (
              <View style={styles.attachedImageWrap}>
                <Image source={{ uri: attachedImage }} style={styles.attachedImagePreview} />
                <TouchableOpacity style={styles.removeImageBtn} onPress={() => setAttachedImage(null)}>
                  <Ionicons name="close-circle" size={24} color="#FFF" />
                </TouchableOpacity>
              </View>
            )}

            <FieldError message={postError} />
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
                  {posting ? <Text style={styles.postBtnText}>Posting…</Text> : <Text style={styles.postBtnText}>Post</Text>}
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
      <CopiedToast visible={copiedToast.visible} bottom={isMobile ? 110 : spacing.xl} />
    </SafeAreaView>
  );
}

function greeting(): string {
  const h = new Date().getHours();
  return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
}

const styles = StyleSheet.create({
  journalIntro: { paddingTop: spacing.lg, paddingBottom: spacing.sm, gap: spacing.xs },
  pIntro: { paddingTop: spacing.lg, paddingBottom: spacing.md, gap: 2 },
  // The header clips at the column edge, so the hero takes the short shadow:
  // a long one would be cut into a visible box.
  // Padding, not margins: the wrapper's measured height is how far the hero
  // scrolls away, so it has to include the space around the card.
  mHeroWrap: { paddingTop: spacing.lg, paddingBottom: spacing.md },
  mHeroWrapMobile: { paddingHorizontal: spacing.lg, paddingTop: spacing.md, paddingBottom: spacing.sm },
  mHero: { ...elevation.subtle },
  mOverline: { ...typography.overline, color: 'rgba(255,255,255,0.72)' },
  mHeadline: { ...typography.h2, color: '#FFFFFF' },
  mIdentity: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, flexWrap: 'wrap', marginTop: 2 },
  mIdentityText: { ...typography.body, color: 'rgba(255,255,255,0.86)' },
  mVerified: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999 },
  mVerifiedText: { ...typography.small, fontFamily: fonts.body.semibold, color: '#FFFFFF' },
  pPostCard: { backgroundColor: colors.surface, borderColor: colors.border, borderRadius: radius.card, ...shadow.card },
  pAuthorName: { ...typography.label, fontSize: 15, color: colors.text },
  pPostContent: { ...typography.body, color: colors.text },
  pOverline: { ...typography.overline, color: colors.textSecondary },
  pHeadline: { ...typography.h1, color: colors.text },
  pIdentity: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginTop: spacing.xs, flexWrap: 'wrap' },
  pIdentityText: { ...typography.body, color: colors.textSecondary },
  journalOverline: { ...typography.overline, color: colors.teal },
  journalHeadline: { fontFamily: fonts.heading.semibold, fontSize: 27, lineHeight: 34, color: colors.text },
  safe: { flex: 1, backgroundColor: colors.bg },
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
  // Material: frosted glass over the page wallpaper -- posts blur as they pass
  // underneath. Phones get a near-opaque fill instead of a costly live blur.
  headerGlass: Platform.OS === 'web'
    ? ({ backgroundColor: isTerracotta ? 'rgba(246,240,232,0.74)' : 'rgba(243,248,248,0.72)', backdropFilter: 'blur(20px) saturate(160%)',
        WebkitBackdropFilter: 'blur(20px) saturate(160%)' } as object)
    : { backgroundColor: isTerracotta ? 'rgba(245,238,229,0.97)' : 'rgba(240,246,246,0.97)' },
  // The header row, its icon buttons and their badges were removed with the
  // in-screen header — MobileTopBar and the Alerts tab own those now.
  tabBar: { flexDirection: 'row', backgroundColor: colors.white, paddingHorizontal: 16, paddingVertical: 8, gap: 8 },
  // On desktop the segmented control becomes a card in the content column
  // instead of a full-bleed strip, so it reads as part of the feed.
  tabBarWide: {
    marginTop: spacing.xxl,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.sm,
  },
  tab: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 10, borderRadius: 10, backgroundColor: colors.bgMuted, ...gloss.glass },
  tabActive: { backgroundColor: colors.action, ...gloss.fill },
  tabText: { fontSize: 14, fontWeight: '600', color: colors.textSubtle },
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

  composeBox: { backgroundColor: '#FFFFFF', padding: 16, borderBottomWidth: 1, borderBottomColor: colors.border },
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
  composeInput: { backgroundColor: colors.bg, borderRadius: 12, padding: 14, fontSize: 15, color: colors.text, minHeight: 80, textAlignVertical: 'top', borderWidth: 1, borderColor: colors.border },
  composeActions: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 10 },
  attachBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.bgMuted, alignItems: 'center', justifyContent: 'center' },
  attachedImageWrap: { marginTop: 10, position: 'relative', alignSelf: 'flex-start' },
  attachedImagePreview: { width: 100, height: 100, borderRadius: 12 },
  removeImageBtn: { position: 'absolute', top: -10, right: -10, backgroundColor: 'rgba(0,0,0,0.5)', borderRadius: 12 },
  postBtn: { backgroundColor: colors.action, ...gloss.fill, borderRadius: 10, paddingVertical: 10, paddingHorizontal: 24 },
  postBtnDisabled: { opacity: 0.5 },
  postBtnText: { color: '#FFF', fontWeight: '700', fontSize: 14 },
  list: { padding: 16, paddingBottom: 100 },
  // The grid already supplies the horizontal gutter; doubling it would push
  // the readable column narrower than the 65–75ch target.
  listWide: { paddingHorizontal: 0, paddingTop: spacing.lg, paddingBottom: spacing.xxxl },
  postCard: { backgroundColor: '#FFFFFF', borderRadius: 16, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: colors.border },
  postCardWide: { marginBottom: spacing.lg },
  postHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginBottom: 12, borderRadius: radius.md, marginHorizontal: -4, paddingHorizontal: 4, paddingVertical: 2 },
  postHeaderHover: { backgroundColor: colors.bgMuted },
  // The spacing lives on the row itself. It used to sit on an inline avatar
  // style that stopped being used when the shared Avatar replaced it, which
  // left the role badge touching the avatar and the time touching the badge.
  postMeta: { flex: 1, gap: 4 },
  authorName: { fontSize: 16, fontFamily: fonts.body.semibold, color: colors.text },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  // textSecondary, not the lighter textMuted: the time is read, and the
  // lighter grey falls below text contrast on white.
  timeText: { ...typography.small, color: colors.textSecondary },
  postContent: { fontSize: 15, color: colors.textBody, lineHeight: 22 },
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
  repostedBy: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: spacing.sm },
  repostedByText: { ...typography.small, fontFamily: fonts.body.semibold, color: colors.textSecondary },
  savedBar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm,
    paddingHorizontal: spacing.md, paddingVertical: spacing.sm, marginTop: spacing.sm,
    borderRadius: radius.lg, backgroundColor: colors.tealBg,
  },
  savedBarText: { ...typography.label, color: colors.teal },
  savedBarClose: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingVertical: 4, paddingHorizontal: 6 },
  savedBarCloseText: { ...typography.small, fontFamily: fonts.body.semibold, color: colors.textSecondary },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 80 },
  emptyText: { fontSize: 16, color: colors.textMuted, marginTop: 12 },
});
