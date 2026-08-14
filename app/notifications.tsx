import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useFocusEffect } from 'expo-router';
import { useAuth } from '../src/context/AuthContext';
import { apiFetch } from '../src/utils/api';
import { timeAgo } from '../src/utils/time';
import { usePaginatedList } from '../src/hooks/usePaginatedList';
import { LoadingState, EmptyState, ErrorState } from '../src/components';

interface Notification {
  id: string;
  title: string;
  message: string;
  type: string;
  /** What the alert is about — a case id for `case`, a user id for `connection`. */
  ref_id?: string;
  read: boolean;
  created_at: string;
}

const TYPE_ICONS: Record<string, { icon: string; color: string; bg: string }> = {
  application: { icon: 'briefcase', color: '#1A3A5C', bg: '#EFF6FF' },
  optin: { icon: 'people', color: '#0F766E', bg: '#F0FDF4' },
  message: { icon: 'chatbubble', color: '#7C3AED', bg: '#F5F3FF' },
  case: { icon: 'help-buoy', color: '#0F766E', bg: '#F0FDFA' },
  general: { icon: 'notifications', color: '#D97706', bg: '#FFFBEB' },
  shift: { icon: 'time', color: '#E84545', bg: '#FEF2F2' },
};

export default function NotificationsScreen() {
  const { token } = useAuth();
  const router = useRouter();
  const {
    items: notifications, setItems: setNotifications,
    loading, refreshing, loadingMore, error, load, refresh, loadMore,
  } = usePaginatedList<Notification>({ path: '/api/notifications/', token });

  // Refetch on focus + pull-to-refresh (interval polling removed in Phase 5).
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const markRead = async (id: string) => {
    try {
      await apiFetch(`/api/notifications/${id}/read`, token, { method: 'POST' });
      setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
    } catch (e) { console.log('Mark read error:', e); }
  };

  const markAllRead = async () => {
    // Optimistic: reflect immediately, roll back if the request fails.
    const previous = notifications;
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
    try {
      await apiFetch('/api/notifications/read-all', token, { method: 'POST' });
    } catch {
      setNotifications(previous);
    }
  };


  // A case alert is only useful if it takes you to the thread it is about.
  const open = (item: Notification) => {
    markRead(item.id);
    if (item.type === 'case' && item.ref_id) {
      router.push({ pathname: '/case/[id]', params: { id: item.ref_id } } as any);
    }
  };

  const renderNotification = ({ item }: { item: Notification }) => {
    const config = TYPE_ICONS[item.type] || TYPE_ICONS.general;
    return (
      <TouchableOpacity testID={`notif-${item.id}`} style={[styles.notifCard, !item.read && styles.unreadCard]} onPress={() => open(item)}>
        <View style={[styles.notifIcon, { backgroundColor: config.bg }]}>
          <Ionicons name={config.icon as any} size={20} color={config.color} />
        </View>
        <View style={styles.notifContent}>
          <Text style={[styles.notifTitle, !item.read && styles.unreadTitle]}>{item.title}</Text>
          <Text style={styles.notifMessage} numberOfLines={2}>{item.message}</Text>
          <Text style={styles.notifTime}>{timeAgo(item.created_at)}</Text>
        </View>
        {!item.read && <View style={styles.unreadDot} />}
      </TouchableOpacity>
    );
  };

  const unreadCount = notifications.filter(n => !n.read).length;

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <TouchableOpacity testID="notif-back-btn" style={styles.backBtn} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color="#1A3A5C" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Notifications</Text>
        {unreadCount > 0 && (
          <TouchableOpacity testID="mark-all-read-btn" style={styles.markAllBtn} onPress={markAllRead}>
            <Text style={styles.markAllText}>Mark all read</Text>
          </TouchableOpacity>
        )}
      </View>

      {loading ? (
        <LoadingState label="Loading notifications…" />
      ) : error && notifications.length === 0 ? (
        <ErrorState message={error} onRetry={load} />
      ) : (
        <FlatList
          data={notifications}
          renderItem={renderNotification}
          keyExtractor={item => item.id}
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor="#1A3A5C" />}
          onEndReached={loadMore}
          onEndReachedThreshold={0.5}
          ListFooterComponent={loadingMore ? <ActivityIndicator style={styles.footer} color="#1A3A5C" /> : null}
          ListEmptyComponent={
            <EmptyState
              icon="notifications-off-outline"
              title="No notifications yet"
              hint="You'll see alerts for job applications, specialist opt-ins, and more here."
            />
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
  markAllBtn: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 8, backgroundColor: '#EFF6FF' },
  markAllText: { fontSize: 13, fontWeight: '600', color: '#1A3A5C' },
  list: { paddingVertical: 8 },
  footer: { paddingVertical: 20 },
  notifCard: { flexDirection: 'row', alignItems: 'flex-start', paddingHorizontal: 16, paddingVertical: 14, backgroundColor: '#FFFFFF', borderBottomWidth: 1, borderBottomColor: '#F1F5F9' },
  unreadCard: { backgroundColor: '#FAFBFF' },
  notifIcon: { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  notifContent: { flex: 1 },
  notifTitle: { fontSize: 15, fontWeight: '500', color: '#334155', marginBottom: 2 },
  unreadTitle: { fontWeight: '700', color: '#0F172A' },
  notifMessage: { fontSize: 14, color: '#64748B', lineHeight: 20, marginBottom: 4 },
  notifTime: { fontSize: 12, color: '#94A3B8' },
  unreadDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#E84545', marginTop: 6, marginLeft: 8 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  emptyBox: { alignItems: 'center', paddingTop: 80, paddingHorizontal: 40 },
  emptyIcon: { width: 80, height: 80, borderRadius: 40, backgroundColor: '#F1F5F9', alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: '#334155', marginBottom: 8 },
  emptySubtitle: { fontSize: 14, color: '#94A3B8', textAlign: 'center', lineHeight: 20 },
});
