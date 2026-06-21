import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useAuth } from '../src/context/AuthContext';
import { apiFetch } from '../src/utils/api';

interface Conversation {
  user_id: string;
  user_name: string;
  user_role: string;
  specialty: string;
  last_message: string;
  last_time: string;
  last_sender_id: string;
  unread: number;
}

const ROLE_COLORS: Record<string, string> = { healthcare_professional: '#0F766E', hospital: '#1A3A5C', clinic: '#0F766E' };

export default function MessagesScreen() {
  const { user, token } = useAuth();
  const router = useRouter();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [onlineUsers, setOnlineUsers] = useState<string[]>([]);

  const load = useCallback(async () => {
    try {
      const [data, online] = await Promise.all([
        apiFetch('/api/messages/conversations', token),
        apiFetch('/api/users/online', token).catch(() => ({ online_users: [] })),
      ]);
      setConversations(data);
      setOnlineUsers(online.online_users || []);
    } catch (e) { console.log('Messages error:', e); }
    finally { setLoading(false); setRefreshing(false); }
  }, [token]);

  useEffect(() => { load(); }, [load]);

  const timeAgo = (d: string) => {
    const diff = Date.now() - new Date(d).getTime();
    const m = Math.floor(diff / 60000);
    if (m < 60) return `${m}m`;
    const h = Math.floor(m / 60);
    if (h < 24) return `${h}h`;
    return `${Math.floor(h / 24)}d`;
  };

  const renderConversation = ({ item }: { item: Conversation }) => (
    <TouchableOpacity testID={`convo-${item.user_id}`} style={styles.convoCard} onPress={() => router.push({ pathname: '/conversation', params: { userId: item.user_id, userName: item.user_name } })} activeOpacity={0.7}>
      <View style={styles.avatarWrap}>
        <View style={[styles.avatar, { backgroundColor: ROLE_COLORS[item.user_role] || '#1A3A5C' }]}>
          <Text style={styles.avatarText}>{item.user_name?.charAt(0)}</Text>
        </View>
        {onlineUsers.includes(item.user_id) && <View style={styles.onlineDot} />}
      </View>
      <View style={styles.convoContent}>
        <View style={styles.convoTop}>
          <Text style={[styles.convoName, item.unread > 0 && styles.unreadName]}>{item.user_name}</Text>
          <Text style={styles.convoTime}>{timeAgo(item.last_time)}</Text>
        </View>
        {item.specialty ? <Text style={styles.convoSpec}>{item.specialty}</Text> : null}
        <Text style={[styles.convoMsg, item.unread > 0 && styles.unreadMsg]} numberOfLines={1}>
          {item.last_sender_id === user?.id ? 'You: ' : ''}{item.last_message}
        </Text>
      </View>
      {item.unread > 0 && <View style={styles.unreadBadge}><Text style={styles.unreadCount}>{item.unread}</Text></View>}
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <TouchableOpacity testID="messages-back-btn" style={styles.backBtn} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color="#1A3A5C" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Messages</Text>
        <TouchableOpacity testID="people-btn" style={styles.peopleBtn} onPress={() => router.push('/people')}>
          <Ionicons name="person-add-outline" size={22} color="#1A3A5C" />
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.center}><ActivityIndicator size="large" color="#1A3A5C" /></View>
      ) : (
        <FlatList
          data={conversations}
          renderItem={renderConversation}
          keyExtractor={item => item.user_id}
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor="#1A3A5C" />}
          ListEmptyComponent={
            <View style={styles.emptyBox}>
              <View style={styles.emptyIcon}><Ionicons name="chatbubbles-outline" size={48} color="#CBD5E1" /></View>
              <Text style={styles.emptyTitle}>No messages yet</Text>
              <Text style={styles.emptySub}>Connect with professionals to start messaging</Text>
              <TouchableOpacity testID="find-people-btn" style={styles.findBtn} onPress={() => router.push('/people')}>
                <Ionicons name="people-outline" size={18} color="#FFF" />
                <Text style={styles.findBtnText}>Find People</Text>
              </TouchableOpacity>
            </View>
          }
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#F8FAFC' },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14, backgroundColor: '#FFFFFF', borderBottomWidth: 1, borderBottomColor: '#E2E8F0' },
  backBtn: { width: 44, height: 44, borderRadius: 12, backgroundColor: '#F1F5F9', alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  headerTitle: { fontSize: 22, fontWeight: '700', color: '#0F172A', flex: 1 },
  peopleBtn: { width: 44, height: 44, borderRadius: 12, backgroundColor: '#F1F5F9', alignItems: 'center', justifyContent: 'center' },
  list: { paddingVertical: 4 },
  convoCard: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14, backgroundColor: '#FFFFFF', borderBottomWidth: 1, borderBottomColor: '#F1F5F9' },
  avatarWrap: { position: 'relative', marginRight: 14 },
  avatar: { width: 50, height: 50, borderRadius: 25, alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: '#FFF', fontSize: 20, fontWeight: '700' },
  onlineDot: { position: 'absolute', bottom: 0, right: 0, width: 14, height: 14, borderRadius: 7, backgroundColor: '#22C55E', borderWidth: 2, borderColor: '#FFFFFF' },
  convoContent: { flex: 1 },
  convoTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  convoName: { fontSize: 16, fontWeight: '500', color: '#0F172A' },
  unreadName: { fontWeight: '700' },
  convoTime: { fontSize: 12, color: '#94A3B8' },
  convoSpec: { fontSize: 12, color: '#64748B', marginTop: 1 },
  convoMsg: { fontSize: 14, color: '#94A3B8', marginTop: 3 },
  unreadMsg: { color: '#334155', fontWeight: '500' },
  unreadBadge: { backgroundColor: '#E84545', borderRadius: 12, minWidth: 24, height: 24, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 6, marginLeft: 8 },
  unreadCount: { color: '#FFF', fontSize: 12, fontWeight: '700' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  emptyBox: { alignItems: 'center', paddingTop: 80, paddingHorizontal: 40 },
  emptyIcon: { width: 80, height: 80, borderRadius: 40, backgroundColor: '#F1F5F9', alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: '#334155', marginBottom: 8 },
  emptySub: { fontSize: 14, color: '#94A3B8', textAlign: 'center', marginBottom: 20 },
  findBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#1A3A5C', borderRadius: 12, paddingHorizontal: 20, paddingVertical: 12 },
  findBtnText: { color: '#FFF', fontSize: 15, fontWeight: '600' },
});
