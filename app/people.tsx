import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, TextInput, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useAuth } from '../src/context/AuthContext';
import { apiFetch } from '../src/utils/api';

const ROLE_LABELS: Record<string, { label: string; color: string; bg: string }> = {
  healthcare_professional: { label: 'Professional', color: '#0F766E', bg: '#F0FDF4' },
  hospital: { label: 'Hospital', color: '#1A3A5C', bg: '#EFF6FF' },
  clinic: { label: 'Clinic', color: '#0F766E', bg: '#F0FDFA' },
};

export default function PeopleScreen() {
  const { user, token } = useAuth();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<'search' | 'connections' | 'pending'>('connections');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [connections, setConnections] = useState<any[]>([]);
  const [pending, setPending] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searching, setSearching] = useState(false);

  const loadData = useCallback(async () => {
    try {
      const [conns, pend] = await Promise.all([
        apiFetch('/api/connections', token),
        apiFetch('/api/connections/pending', token),
      ]);
      setConnections(conns);
      setPending(pend);
    } catch (e) { console.log('People error:', e); }
    finally { setLoading(false); }
  }, [token]);

  useEffect(() => { loadData(); }, [loadData]);

  const handleSearch = async () => {
    if (!searchQuery.trim()) return;
    setSearching(true);
    try {
      const data = await apiFetch(`/api/users/search?q=${encodeURIComponent(searchQuery)}`, token);
      setSearchResults(data.filter((u: any) => u.id !== user?.id));
    } catch (e) { console.log('Search error:', e); }
    finally { setSearching(false); }
  };

  const sendRequest = async (targetId: string) => {
    try {
      await apiFetch(`/api/connections/request?target_id=${targetId}`, token, { method: 'POST' });
      setSearchResults(prev => prev.map(u => u.id === targetId ? { ...u, requested: true } : u));
    } catch (e: any) { alert(e.message); }
  };

  const acceptRequest = async (connId: string) => {
    try {
      await apiFetch(`/api/connections/${connId}/accept`, token, { method: 'POST' });
      loadData();
    } catch (e: any) { alert(e.message); }
  };

  const rejectRequest = async (connId: string) => {
    try {
      await apiFetch(`/api/connections/${connId}/reject`, token, { method: 'POST' });
      setPending(prev => prev.filter(p => p.id !== connId));
    } catch (e: any) { alert(e.message); }
  };

  const renderSearchUser = ({ item }: any) => {
    const role = ROLE_LABELS[item.role] || ROLE_LABELS.healthcare_professional;
    return (
      <View testID={`search-user-${item.id}`} style={styles.userCard}>
        <View style={[styles.avatar, { backgroundColor: role.color }]}><Text style={styles.avatarText}>{item.name?.charAt(0)}</Text></View>
        <View style={styles.userInfo}>
          <Text style={styles.userName}>{item.name}</Text>
          <View style={[styles.roleBadge, { backgroundColor: role.bg }]}><Text style={[styles.roleText, { color: role.color }]}>{role.label}</Text></View>
          {item.specialty && <Text style={styles.userDetail}>{item.specialty}</Text>}
          {item.city && <Text style={styles.userDetail}>{item.city}{item.state ? `, ${item.state}` : ''}</Text>}
        </View>
        <TouchableOpacity testID={`connect-btn-${item.id}`} style={[styles.connectBtn, item.requested && styles.requestedBtn]} onPress={() => sendRequest(item.id)} disabled={item.requested}>
          <Ionicons name={item.requested ? "checkmark" : "person-add"} size={18} color={item.requested ? "#94A3B8" : "#FFF"} />
          <Text style={[styles.connectText, item.requested && styles.requestedText]}>{item.requested ? 'Sent' : 'Connect'}</Text>
        </TouchableOpacity>
      </View>
    );
  };

  const renderConnection = ({ item }: any) => {
    const role = ROLE_LABELS[item.role] || ROLE_LABELS.healthcare_professional;
    return (
      <TouchableOpacity testID={`connection-${item.id}`} style={styles.userCard} onPress={() => router.push({ pathname: '/conversation', params: { userId: item.id, userName: item.name } })}>
        <View style={[styles.avatar, { backgroundColor: role.color }]}><Text style={styles.avatarText}>{item.name?.charAt(0)}</Text></View>
        <View style={styles.userInfo}>
          <Text style={styles.userName}>{item.name}</Text>
          {item.specialty && <Text style={styles.userDetail}>{item.specialty}</Text>}
          {item.city && <Text style={styles.userDetail}>{item.city}{item.state ? `, ${item.state}` : ''}</Text>}
        </View>
        <View style={styles.msgIcon}><Ionicons name="chatbubble-outline" size={20} color="#1A3A5C" /></View>
      </TouchableOpacity>
    );
  };

  const renderPending = ({ item }: any) => {
    const req = item.requester || {};
    return (
      <View testID={`pending-${item.id}`} style={styles.userCard}>
        <View style={[styles.avatar, { backgroundColor: '#1A3A5C' }]}><Text style={styles.avatarText}>{req.name?.charAt(0)}</Text></View>
        <View style={styles.userInfo}>
          <Text style={styles.userName}>{req.name}</Text>
          {req.specialty && <Text style={styles.userDetail}>{req.specialty}</Text>}
          <Text style={styles.pendingTime}>Wants to connect</Text>
        </View>
        <View style={styles.pendingActions}>
          <TouchableOpacity testID={`accept-${item.id}`} style={styles.acceptBtn} onPress={() => acceptRequest(item.id)}>
            <Ionicons name="checkmark" size={20} color="#FFF" />
          </TouchableOpacity>
          <TouchableOpacity testID={`reject-${item.id}`} style={styles.rejectBtn} onPress={() => rejectRequest(item.id)}>
            <Ionicons name="close" size={20} color="#E84545" />
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <TouchableOpacity testID="people-back-btn" style={styles.backBtn} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color="#1A3A5C" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>People</Text>
      </View>

      <View style={styles.tabBar}>
        {[
          { key: 'connections', label: `Connections (${connections.length})`, icon: 'people-outline' },
          { key: 'pending', label: `Requests (${pending.length})`, icon: 'person-add-outline' },
          { key: 'search', label: 'Search', icon: 'search-outline' },
        ].map(t => (
          <TouchableOpacity key={t.key} testID={`tab-${t.key}`} style={[styles.tab, activeTab === t.key && styles.tabActive]} onPress={() => setActiveTab(t.key as any)}>
            <Ionicons name={t.icon as any} size={15} color={activeTab === t.key ? '#FFF' : '#64748B'} />
            <Text style={[styles.tabText, activeTab === t.key && styles.tabTextActive]} numberOfLines={1}>{t.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {activeTab === 'search' && (
        <View style={styles.searchBar}>
          <View style={styles.searchWrap}>
            <Ionicons name="search" size={18} color="#94A3B8" />
            <TextInput testID="people-search-input" style={styles.searchInput} placeholder="Search professionals..." placeholderTextColor="#94A3B8" value={searchQuery} onChangeText={setSearchQuery} onSubmitEditing={handleSearch} returnKeyType="search" />
          </View>
          <TouchableOpacity testID="people-search-btn" style={styles.searchBtn} onPress={handleSearch}>
            <Ionicons name="search" size={18} color="#FFF" />
          </TouchableOpacity>
        </View>
      )}

      {loading ? (
        <View style={styles.center}><ActivityIndicator size="large" color="#1A3A5C" /></View>
      ) : activeTab === 'search' ? (
        <FlatList data={searchResults} renderItem={renderSearchUser} keyExtractor={item => item.id} contentContainerStyle={styles.list}
          ListEmptyComponent={<View style={styles.emptyBox}><Ionicons name="search-outline" size={40} color="#CBD5E1" /><Text style={styles.emptyText}>{searchQuery ? 'No results found' : 'Search for professionals to connect'}</Text></View>} />
      ) : activeTab === 'connections' ? (
        <FlatList data={connections} renderItem={renderConnection} keyExtractor={item => item.id} contentContainerStyle={styles.list}
          ListEmptyComponent={<View style={styles.emptyBox}><Ionicons name="people-outline" size={40} color="#CBD5E1" /><Text style={styles.emptyText}>No connections yet</Text><Text style={styles.emptyHint}>Search and connect with professionals</Text></View>} />
      ) : (
        <FlatList data={pending} renderItem={renderPending} keyExtractor={item => item.id} contentContainerStyle={styles.list}
          ListEmptyComponent={<View style={styles.emptyBox}><Ionicons name="person-add-outline" size={40} color="#CBD5E1" /><Text style={styles.emptyText}>No pending requests</Text></View>} />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#F8FAFC' },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14, backgroundColor: '#FFFFFF', borderBottomWidth: 1, borderBottomColor: '#E2E8F0' },
  backBtn: { width: 44, height: 44, borderRadius: 12, backgroundColor: '#F1F5F9', alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  headerTitle: { fontSize: 22, fontWeight: '700', color: '#0F172A', flex: 1 },
  tabBar: { flexDirection: 'row', backgroundColor: '#FFFFFF', paddingHorizontal: 12, paddingVertical: 8, gap: 6 },
  tab: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, paddingVertical: 9, borderRadius: 10, backgroundColor: '#F1F5F9' },
  tabActive: { backgroundColor: '#1A3A5C' },
  tabText: { fontSize: 12, fontWeight: '600', color: '#64748B' },
  tabTextActive: { color: '#FFFFFF' },
  searchBar: { flexDirection: 'row', paddingHorizontal: 16, paddingVertical: 10, backgroundColor: '#FFFFFF', gap: 8 },
  searchWrap: { flex: 1, flexDirection: 'row', alignItems: 'center', backgroundColor: '#F8FAFC', borderRadius: 12, paddingHorizontal: 12, borderWidth: 1, borderColor: '#E2E8F0', gap: 8 },
  searchInput: { flex: 1, fontSize: 15, color: '#0F172A', height: 44 },
  searchBtn: { width: 44, height: 44, borderRadius: 12, backgroundColor: '#1A3A5C', alignItems: 'center', justifyContent: 'center' },
  list: { paddingVertical: 4 },
  userCard: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14, backgroundColor: '#FFFFFF', borderBottomWidth: 1, borderBottomColor: '#F1F5F9' },
  avatar: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center', marginRight: 14 },
  avatarText: { color: '#FFF', fontSize: 18, fontWeight: '700' },
  userInfo: { flex: 1 },
  userName: { fontSize: 16, fontWeight: '600', color: '#0F172A' },
  roleBadge: { alignSelf: 'flex-start', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6, marginTop: 2 },
  roleText: { fontSize: 11, fontWeight: '600' },
  userDetail: { fontSize: 13, color: '#64748B', marginTop: 1 },
  connectBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#1A3A5C', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10 },
  requestedBtn: { backgroundColor: '#F1F5F9' },
  connectText: { color: '#FFF', fontSize: 13, fontWeight: '600' },
  requestedText: { color: '#94A3B8' },
  msgIcon: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#EFF6FF', alignItems: 'center', justifyContent: 'center' },
  pendingTime: { fontSize: 12, color: '#D97706', marginTop: 2 },
  pendingActions: { flexDirection: 'row', gap: 8 },
  acceptBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#0F766E', alignItems: 'center', justifyContent: 'center' },
  rejectBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#FEF2F2', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#FEE2E2' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  emptyBox: { alignItems: 'center', paddingTop: 60 },
  emptyText: { fontSize: 16, color: '#94A3B8', marginTop: 12 },
  emptyHint: { fontSize: 13, color: '#CBD5E1', marginTop: 4 },
});
