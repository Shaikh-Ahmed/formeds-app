import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, TextInput, ActivityIndicator, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useAuth } from '../src/context/AuthContext';
import { apiFetch } from '../src/utils/api';
import { Avatar, RoleBadge } from '../src/components';
import { PageColumn } from '../src/components/web';
import { ConnectActions } from '../src/components/network/ConnectActions';

import { colors, gloss } from '../src/theme';
export default function PeopleScreen() {
  const { user, token } = useAuth();
  const router = useRouter();
  type Tab = 'suggested' | 'search' | 'connections' | 'pending';
  const TABS: Tab[] = ['connections', 'pending', 'suggested', 'search'];
  // `?tab=suggested` -- where "People you may know › View all" lands.
  const params = useLocalSearchParams<{ tab?: string }>();
  const initialTab = (TABS as string[]).includes(params.tab ?? '') ? (params.tab as Tab) : 'connections';
  const [activeTab, setActiveTab] = useState<Tab>(initialTab);
  useEffect(() => { if ((TABS as string[]).includes(params.tab ?? '')) setActiveTab(params.tab as Tab); }, [params.tab]);
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [dismissed, setDismissed] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [connections, setConnections] = useState<any[]>([]);
  const [pending, setPending] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searching, setSearching] = useState(false);

  const loadData = useCallback(async () => {
    try {
      const [conns, pend, sugg] = await Promise.all([
        apiFetch('/api/connections/', token),
        apiFetch('/api/connections/pending', token),
        // Recruiters work from their own portal and have no network to grow.
        user?.role === 'recruiter' ? Promise.resolve([]) : apiFetch('/api/users/suggestions?limit=30', token).catch(() => []),
      ]);
      setConnections(conns);
      setPending(pend);
      setSuggestions(Array.isArray(sugg) ? sugg : []);
    } catch (e) { console.log('People error:', e); }
    finally { setLoading(false); }
  }, [token, user?.role]);

  // Refetch on focus (interval polling removed in Phase 5).
  useFocusEffect(useCallback(() => { loadData(); }, [loadData]));

  const handleSearch = async () => {
    if (!searchQuery.trim()) return;
    setSearching(true);
    try {
      const data = await apiFetch(`/api/users/search?q=${encodeURIComponent(searchQuery)}`, token);
      setSearchResults(data.filter((u: any) => u.id !== user?.id));
    } catch (e) { console.log('Search error:', e); }
    finally { setSearching(false); }
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

  /** Opens someone's professional profile. */
  const openProfile = (id: string) =>
    router.push({ pathname: '/profile/[id]', params: { id } } as any);

  const renderSearchUser = ({ item }: any) => {
    return (
      <View testID={`search-user-${item.id}`} style={styles.userCard}>
        <TouchableOpacity
          testID={`view-profile-${item.id}`}
          style={styles.identity}
          onPress={() => openProfile(item.id)}
          accessibilityRole="button"
          accessibilityLabel={`View ${item.name}'s profile`}
        >
          <Avatar name={item.name} role={item.role} size={48} />
          <View style={styles.userInfo}>
            <Text style={styles.userName}>{item.name}</Text>
            <RoleBadge role={item.role} />
            {item.specialty && <Text style={styles.userDetail}>{item.specialty}</Text>}
            {item.city && <Text style={styles.userDetail}>{item.city}{item.state ? `, ${item.state}` : ''}</Text>}
          </View>
        </TouchableOpacity>
        <ConnectActions compact userId={item.id} name={item.name} initialStatus={item.connection_status}
          connectionId={item.connection_id} testID={`connect-btn-${item.id}`} />
      </View>
    );
  };

  /** Someone the network suggests: why (specialty, place) and a way to connect. */
  const renderSuggestion = ({ item }: any) => {
    const org = item.role === 'hospital' || item.role === 'clinic';
    const what = org ? (item.role === 'hospital' ? 'Hospital' : 'Clinic')
      : (item.specialty || item.professional_role || 'Healthcare professional');
    return (
      <View testID={`suggestion-${item.id}`} style={styles.userCard}>
        <TouchableOpacity style={styles.identity} onPress={() => openProfile(item.id)}
          accessibilityRole="button" accessibilityLabel={`View ${item.name}'s profile`}>
          <Avatar name={item.name} role={item.role} uri={item.avatar} size={48} />
          <View style={styles.userInfo}>
            <Text style={styles.userName} numberOfLines={1}>{item.name}</Text>
            <Text style={styles.userDetail} numberOfLines={1}>
              {[what, [item.city, item.state].filter(Boolean).join(', ')].filter(Boolean).join(' · ')}
            </Text>
          </View>
        </TouchableOpacity>
        <View style={styles.suggestionActions}>
          <ConnectActions compact userId={item.id} name={item.name} initialStatus="none"
            testID={`suggestion-connect-${item.id}`} />
          <TouchableOpacity onPress={() => setDismissed(d => [...d, item.id])} hitSlop={8}
            accessibilityRole="button" accessibilityLabel={`Hide ${item.name}`} testID={`suggestion-dismiss-${item.id}`}>
            <Ionicons name="close" size={18} color={colors.textSubtle} />
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  const renderConnection = ({ item }: any) => {
    return (
      <View testID={`connection-${item.id}`} style={styles.userCard}>
        <TouchableOpacity
          testID={`view-profile-${item.id}`}
          style={styles.identity}
          onPress={() => openProfile(item.id)}
          accessibilityRole="button"
          accessibilityLabel={`View ${item.name}'s profile`}
        >
          <Avatar name={item.name} role={item.role} size={48} />
          <View style={styles.userInfo}>
            <Text style={styles.userName}>{item.name}</Text>
            {item.specialty && <Text style={styles.userDetail}>{item.specialty}</Text>}
            {item.city && <Text style={styles.userDetail}>{item.city}{item.state ? `, ${item.state}` : ''}</Text>}
          </View>
        </TouchableOpacity>
        <TouchableOpacity
          testID={`message-${item.id}`}
          style={styles.msgIcon}
          onPress={() => router.push({ pathname: '/conversation', params: { userId: item.id, userName: item.name } })}
          accessibilityRole="button"
          accessibilityLabel={`Message ${item.name}`}
        >
          <Ionicons name="chatbubble-outline" size={20} color={colors.navy} />
        </TouchableOpacity>
      </View>
    );
  };

  const renderPending = ({ item }: any) => {
    const req = item.requester || {};
    return (
      <View testID={`pending-${item.id}`} style={styles.userCard}>
        <TouchableOpacity
          testID={`view-profile-${req.id}`}
          style={styles.identity}
          onPress={() => req.id && openProfile(req.id)}
          disabled={!req.id}
          accessibilityRole="button"
          accessibilityLabel={`View ${req.name}'s profile`}
        >
          {/* Shared Avatar rather than a hand-rolled initial circle, so a
              requester looks the same here as everywhere else in the app. */}
          <Avatar name={req.name} role={req.role} size={48} />
          <View style={styles.userInfo}>
            <Text style={styles.userName}>{req.name}</Text>
            {req.specialty && <Text style={styles.userDetail}>{req.specialty}</Text>}
            <Text style={styles.pendingTime}>Wants to connect</Text>
          </View>
        </TouchableOpacity>
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
      <PageColumn testID="people-column">
      <View style={styles.header}>
        <TouchableOpacity testID="people-back-btn" style={styles.backBtn} onPress={() => {
          if (Platform.OS === 'web' && !router.canGoBack()) {
            router.replace('/(tabs)/community');
          } else {
            router.back();
          }
        }}>
          <Ionicons name="arrow-back" size={24} color={colors.navy} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>People</Text>
      </View>

      <View style={styles.tabBar}>
        {[
          { key: 'connections', label: `Connections (${connections.length})`, icon: 'people-outline' },
          { key: 'pending', label: `Requests (${pending.length})`, icon: 'person-add-outline' },
          ...(user?.role === 'recruiter' ? [] : [{ key: 'suggested', label: 'Suggested', icon: 'sparkles-outline' }]),
          { key: 'search', label: 'Search', icon: 'search-outline' },
        ].map(t => (
          <TouchableOpacity key={t.key} testID={`tab-${t.key}`} style={[styles.tab, activeTab === t.key && styles.tabActive]} onPress={() => setActiveTab(t.key as any)}>
            <Ionicons name={t.icon as any} size={15} color={activeTab === t.key ? '#FFF' : colors.textSubtle} />
            <Text style={[styles.tabText, activeTab === t.key && styles.tabTextActive]} numberOfLines={1}>{t.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {activeTab === 'search' && (
        <View style={styles.searchBar}>
          <View style={styles.searchWrap}>
            <Ionicons name="search" size={18} color={colors.textMuted} />
            <TextInput maxLength={100} testID="people-search-input" style={styles.searchInput} placeholder="Search professionals..." placeholderTextColor={colors.textMuted} value={searchQuery} onChangeText={setSearchQuery} onSubmitEditing={handleSearch} returnKeyType="search" />
          </View>
          <TouchableOpacity testID="people-search-btn" style={styles.searchBtn} onPress={handleSearch}>
            <Ionicons name="search" size={18} color="#FFF" />
          </TouchableOpacity>
        </View>
      )}

      {loading ? (
        <View style={styles.center}><ActivityIndicator size="large" color={colors.navy} /></View>
      ) : activeTab === 'search' ? (
        <FlatList data={searchResults} renderItem={renderSearchUser} keyExtractor={item => item.id} contentContainerStyle={styles.list}
          ListEmptyComponent={<View style={styles.emptyBox}><Ionicons name="search-outline" size={40} color={colors.iconFaint} /><Text style={styles.emptyText}>{searchQuery ? 'No results found' : 'Search for professionals to connect'}</Text></View>} />
      ) : activeTab === 'suggested' ? (
        <FlatList data={suggestions.filter(s => !dismissed.includes(s.id))} renderItem={renderSuggestion}
          keyExtractor={item => item.id} contentContainerStyle={styles.list}
          ListHeaderComponent={suggestions.length ? (
            <Text style={styles.listIntro}>People in your specialty and area, not yet in your network.</Text>
          ) : null}
          ListEmptyComponent={<View style={styles.emptyBox}><Ionicons name="sparkles-outline" size={40} color={colors.iconFaint} /><Text style={styles.emptyText}>No suggestions right now</Text><Text style={styles.emptyHint}>Try searching for someone by name</Text></View>} />
      ) : activeTab === 'connections' ? (
        <FlatList data={connections} renderItem={renderConnection} keyExtractor={item => item.id} contentContainerStyle={styles.list}
          ListEmptyComponent={
            <View style={styles.emptyBox}>
              <Ionicons name="people-outline" size={40} color={colors.iconFaint} />
              <Text style={styles.emptyText}>No connections yet</Text>
              {suggestions.length ? (
                <TouchableOpacity style={styles.emptyAction} onPress={() => setActiveTab('suggested')}
                  accessibilityRole="button" testID="people-see-suggestions">
                  <Text style={styles.emptyActionText}>See {suggestions.length} people you may know</Text>
                </TouchableOpacity>
              ) : <Text style={styles.emptyHint}>Search and connect with professionals</Text>}
            </View>
          } />
      ) : (
        <FlatList data={pending} renderItem={renderPending} keyExtractor={item => item.id} contentContainerStyle={styles.list}
          ListEmptyComponent={<View style={styles.emptyBox}><Ionicons name="person-add-outline" size={40} color={colors.iconFaint} /><Text style={styles.emptyText}>No pending requests</Text></View>} />
      )}
      </PageColumn>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14, backgroundColor: '#FFFFFF', borderBottomWidth: 1, borderBottomColor: colors.border },
  backBtn: { width: 44, height: 44, borderRadius: 12, backgroundColor: colors.bgMuted, alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  headerTitle: { fontSize: 22, fontWeight: '700', color: colors.text, flex: 1 },
  tabBar: { flexDirection: 'row', backgroundColor: '#FFFFFF', paddingHorizontal: 12, paddingVertical: 8, gap: 6 },
  tab: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, paddingVertical: 9, borderRadius: 10, backgroundColor: colors.bgMuted, ...gloss.glass },
  tabActive: { backgroundColor: colors.action, ...gloss.fill },
  tabText: { fontSize: 12, fontWeight: '600', color: colors.textSubtle },
  tabTextActive: { color: '#FFFFFF' },
  searchBar: { flexDirection: 'row', paddingHorizontal: 16, paddingVertical: 10, backgroundColor: '#FFFFFF', gap: 8 },
  searchWrap: { flex: 1, flexDirection: 'row', alignItems: 'center', backgroundColor: colors.bg, borderRadius: 12, paddingHorizontal: 12, borderWidth: 1, borderColor: colors.border, gap: 8 },
  searchInput: { flex: 1, fontSize: 15, color: colors.text, height: 44 },
  searchBtn: { width: 44, height: 44, borderRadius: 12, backgroundColor: colors.action, ...gloss.fill, alignItems: 'center', justifyContent: 'center' },
  list: { paddingVertical: 4 },
  identity: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 14 },
  userCard: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14, backgroundColor: '#FFFFFF', borderBottomWidth: 1, borderBottomColor: colors.borderLight },
  userInfo: { flex: 1 },
  userName: { fontSize: 16, fontWeight: '600', color: colors.text },
  roleBadge: { alignSelf: 'flex-start', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6, marginTop: 2 },
  roleText: { fontSize: 11, fontWeight: '600' },
  userDetail: { fontSize: 13, color: colors.textSubtle, marginTop: 1 },
  connectBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: colors.action, ...gloss.fill, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10 },
  requestedBtn: { backgroundColor: colors.bgMuted },
  connectText: { color: '#FFF', fontSize: 13, fontWeight: '600' },
  requestedText: { color: colors.textMuted },
  msgIcon: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.tintBg, alignItems: 'center', justifyContent: 'center' },
  pendingTime: { fontSize: 12, color: '#D97706', marginTop: 2 },
  pendingActions: { flexDirection: 'row', gap: 8 },
  acceptBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#0F766E', alignItems: 'center', justifyContent: 'center' },
  rejectBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#FEF2F2', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#FEE2E2' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  emptyBox: { alignItems: 'center', paddingTop: 60 },
  emptyText: { fontSize: 16, color: colors.textMuted, marginTop: 12 },
  emptyHint: { fontSize: 13, color: colors.textSubtle, marginTop: 4 },
  emptyAction: { marginTop: 14, paddingHorizontal: 16, paddingVertical: 10, borderRadius: 10, backgroundColor: colors.action, ...gloss.fill },
  emptyActionText: { color: '#FFFFFF', fontSize: 14, fontWeight: '600' },
  suggestionActions: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  listIntro: { fontSize: 13, color: colors.textSubtle, paddingHorizontal: 16, paddingTop: 12, paddingBottom: 4 },
});
