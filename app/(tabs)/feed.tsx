import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, TextInput, ActivityIndicator, RefreshControl, Share, Image, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../src/context/AuthContext';
import { apiFetch, API_URL } from '../../src/utils/api';
import { useRouter, useFocusEffect } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { timeAgo } from '../../src/utils/time';
import { Avatar, RoleBadge } from '../../src/components';

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

interface PubMedArticle {
  id: string;
  pmid: string;
  title: string;
  journal: string;
  abstract: string;
  authors: string | string[];
  pub_date: string;
  keywords: string[];
  doi: string;
  source: string;
}


export default function FeedScreen() {
  const { user, token } = useAuth();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<'community' | 'research'>('community');
  const [posts, setPosts] = useState<Post[]>([]);
  const [pubmedArticles, setPubmedArticles] = useState<PubMedArticle[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [newPost, setNewPost] = useState('');
  const [posting, setPosting] = useState(false);
  const [showCompose, setShowCompose] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [attachedImage, setAttachedImage] = useState<string | null>(null);
  const [unreadCount, setUnreadCount] = useState(0);
  const [unreadMsgs, setUnreadMsgs] = useState(0);

  const loadData = useCallback(async () => {
    try {
      const [feedData, pubmedData, notifCount, msgCount] = await Promise.all([
        apiFetch('/api/feed', token),
        apiFetch('/api/feed/pubmed', token).catch(() => []),
        apiFetch('/api/notifications/unread-count', token).catch(() => ({ count: 0 })),
        apiFetch('/api/messages/unread-total', token).catch(() => ({ count: 0 })),
      ]);
      setPosts(feedData);
      setPubmedArticles(pubmedData);
      setUnreadCount(notifCount.count || 0);
      setUnreadMsgs(msgCount.count || 0);
    } catch (e) { console.log('Feed error:', e); }
    finally { setLoading(false); setRefreshing(false); }
  }, [token]);

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

  const renderPubMedArticle = ({ item }: { item: PubMedArticle }) => (
    <View testID={`pubmed-${item.pmid || item.id}`} style={styles.pubmedCard}>
      <View style={styles.pubmedHeader}>
        <View style={styles.pubmedIcon}><Ionicons name="document-text" size={20} color="#7C3AED" /></View>
        <View style={styles.pubmedBadge}><Text style={styles.pubmedBadgeText}>PubMed Research</Text></View>
      </View>
      <Text style={styles.pubmedTitle}>{item.title}</Text>
      {item.journal ? <Text style={styles.pubmedJournal}>{item.journal}</Text> : null}
      {(() => {
        const auths = item.authors ? (typeof item.authors === 'string' ? item.authors.split(', ') : (Array.isArray(item.authors) ? item.authors : [])) : [];
        return auths.length > 0 ? <Text style={styles.pubmedAuthors}>{auths.slice(0, 3).join(', ')}{auths.length > 3 ? ` +${auths.length - 3} more` : ''}</Text> : null;
      })()}
      <Text style={styles.pubmedAbstract} numberOfLines={4}>{item.abstract}</Text>
      <View style={styles.pubmedFooter}>
        {Array.isArray(item.keywords) && item.keywords.length > 0 && item.keywords.slice(0, 3).map((kw, i) => (
          <View key={i} style={styles.keywordTag}><Text style={styles.keywordText}>{kw}</Text></View>
        ))}
      </View>
      {item.doi ? <Text style={styles.doiText}>DOI: {item.doi}</Text> : null}
    </View>
  );

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Feed</Text>
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
        <TouchableOpacity testID="tab-community" style={[styles.tab, activeTab === 'community' && styles.tabActive]} onPress={() => setActiveTab('community')}>
          <Ionicons name="people-outline" size={16} color={activeTab === 'community' ? '#FFF' : '#64748B'} />
          <Text style={[styles.tabText, activeTab === 'community' && styles.tabTextActive]}>Community</Text>
        </TouchableOpacity>
        <TouchableOpacity testID="tab-research" style={[styles.tab, activeTab === 'research' && styles.tabActive]} onPress={() => setActiveTab('research')}>
          <Ionicons name="flask-outline" size={16} color={activeTab === 'research' ? '#FFF' : '#64748B'} />
          <Text style={[styles.tabText, activeTab === 'research' && styles.tabTextActive]}>Research</Text>
        </TouchableOpacity>
      </View>

      {showCompose && activeTab === 'community' && (
        <View style={styles.composeBox}>
          <TextInput testID="post-input" style={styles.composeInput} placeholder="Share something with the community..." placeholderTextColor="#94A3B8" value={newPost} onChangeText={setNewPost} multiline />
          
          {attachedImage && (
            <View style={styles.attachedImageWrap}>
              <Image source={{ uri: attachedImage }} style={styles.attachedImagePreview} />
              <TouchableOpacity style={styles.removeImageBtn} onPress={() => setAttachedImage(null)}>
                <Ionicons name="close-circle" size={24} color="#FFF" />
              </TouchableOpacity>
            </View>
          )}

          <View style={styles.composeActions}>
            <TouchableOpacity testID="attach-image-btn" style={styles.attachBtn} onPress={pickImage} disabled={uploadingImage}>
              {uploadingImage ? <ActivityIndicator size="small" color="#1A3A5C" /> : <Ionicons name="image-outline" size={24} color="#1A3A5C" />}
            </TouchableOpacity>
            <TouchableOpacity testID="submit-post-btn" style={[styles.postBtn, (!newPost.trim() && !attachedImage) && styles.postBtnDisabled]} onPress={handlePost} disabled={posting || (!newPost.trim() && !attachedImage)}>
              {posting ? <ActivityIndicator color="#FFF" size="small" /> : <Text style={styles.postBtnText}>Post</Text>}
            </TouchableOpacity>
          </View>
        </View>
      )}

      {loading ? (
        <View style={styles.center}><ActivityIndicator size="large" color="#1A3A5C" /></View>
      ) : activeTab === 'community' ? (
        <FlatList data={posts} renderItem={renderPost} keyExtractor={item => item.id} contentContainerStyle={styles.list}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadData(); }} tintColor="#1A3A5C" />}
          ListEmptyComponent={<View style={styles.center}><Ionicons name="newspaper-outline" size={48} color="#CBD5E1" /><Text style={styles.emptyText}>No posts yet</Text></View>} />
      ) : (
        <FlatList data={pubmedArticles} renderItem={renderPubMedArticle} keyExtractor={item => item.id} contentContainerStyle={styles.list}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadData(); }} tintColor="#1A3A5C" />}
          ListEmptyComponent={<View style={styles.center}><Ionicons name="flask-outline" size={48} color="#CBD5E1" /><Text style={styles.emptyText}>Loading research articles...</Text></View>} />
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
  // PubMed styles
  pubmedCard: { backgroundColor: '#FFFFFF', borderRadius: 16, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: '#E2E8F0', borderLeftWidth: 4, borderLeftColor: '#7C3AED' },
  pubmedHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 10, gap: 8 },
  pubmedIcon: { width: 36, height: 36, borderRadius: 10, backgroundColor: '#F5F3FF', alignItems: 'center', justifyContent: 'center' },
  pubmedBadge: { backgroundColor: '#F5F3FF', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  pubmedBadgeText: { fontSize: 11, fontWeight: '700', color: '#7C3AED' },
  pubmedTitle: { fontSize: 16, fontWeight: '700', color: '#0F172A', lineHeight: 22, marginBottom: 6 },
  pubmedJournal: { fontSize: 13, color: '#7C3AED', fontWeight: '500', marginBottom: 4 },
  pubmedAuthors: { fontSize: 13, color: '#64748B', marginBottom: 8 },
  pubmedAbstract: { fontSize: 14, color: '#475569', lineHeight: 20, marginBottom: 10 },
  pubmedFooter: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 6 },
  keywordTag: { backgroundColor: '#F1F5F9', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  keywordText: { fontSize: 11, color: '#64748B', fontWeight: '500' },
  doiText: { fontSize: 11, color: '#94A3B8', marginTop: 4 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 80 },
  emptyText: { fontSize: 16, color: '#94A3B8', marginTop: 12 },
});
