import React, { useCallback, useMemo, useState } from 'react';
import { View, Text, StyleSheet, FlatList, Pressable, ActivityIndicator, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useFocusEffect } from 'expo-router';
import { useAuth } from '../context/AuthContext';
import { apiFetch } from '../utils/api';
import { timeAgo } from '../utils/time';
import { usePaginatedList } from '../hooks/usePaginatedList';
import { LoadingState, EmptyState, ErrorState } from './States';
import { PageColumn } from './web';
import { JobBadge } from './jobs/JobMeta';
import { isLocumNotification, locumNotificationMeta } from '../types/locum';
import { colors, spacing, radius, typography, fonts, MIN_TOUCH_TARGET } from '../theme';

/**
 * The notifications screen, rendered by two routes.
 *
 * `/(tabs)/alerts` is the tab, and `/notifications` is the stack route push
 * notifications and the drawer deep-link into. They were one screen before
 * Alerts became a tab; keeping a single component means the read/unread logic
 * can't drift between them. `withBack` is the only difference.
 */

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

const TYPE_ICONS: Record<string, { icon: keyof typeof Ionicons.glyphMap; color: string; bg: string }> = {
  application: { icon: 'briefcase', color: colors.navy, bg: '#EFF6FF' },
  optin: { icon: 'people', color: colors.teal, bg: '#F0FDF4' },
  message: { icon: 'chatbubble', color: '#7C3AED', bg: colors.recruiterBg },
  case: { icon: 'help-buoy', color: colors.teal, bg: colors.tealBg },
  general: { icon: 'notifications', color: colors.warning, bg: colors.warningBg },
  shift: { icon: 'time', color: colors.redText, bg: colors.redBg },
  locum: { icon: 'flash', color: colors.teal, bg: colors.tealBg },
  recruiter_invitation: { icon: 'mail-open', color: colors.recruiter, bg: colors.recruiterBg },
  invitation_accepted: { icon: 'thumbs-up', color: colors.teal, bg: colors.tealBg },
  recruiter_status: { icon: 'shield-checkmark', color: colors.recruiter, bg: colors.recruiterBg },
};

/** Filters map onto the notification types the backend actually emits. */
type Filter = 'all' | 'work' | 'cases' | 'network';

const FILTERS: { key: Filter; label: string; types?: string[]; locum?: boolean }[] = [
  { key: 'all', label: 'All' },
  { key: 'work', label: 'Jobs & shifts', types: ['application', 'application_status', 'shift', 'recruiter_invitation', 'invitation_accepted', 'recruiter_status'], locum: true },
  { key: 'cases', label: 'Cases', types: ['case'] },
  { key: 'network', label: 'Network', types: ['optin', 'message'] },
];

/** Locum notifications carry their workflow step in the type (`locum_selected`). */
function matchesFilter(f: { types?: string[]; locum?: boolean }, type: string): boolean {
  return !!f.types?.includes(type) || (!!f.locum && isLocumNotification(type));
}

export function NotificationsView({ withBack = false }: { withBack?: boolean }) {
  const { token } = useAuth();
  const router = useRouter();
  const [filter, setFilter] = useState<Filter>('all');
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
    } else if (item.type === 'recruiter_invitation') {
      router.push({ pathname: '/opportunities', params: { tab: 'invitations' } } as any);
    } else if (item.type === 'invitation_accepted') {
      router.push('/recruiter/invitations' as any);
    } else if (item.type === 'recruiter_status') {
      router.push('/recruiter' as any);
    } else if (isLocumNotification(item.type) && item.ref_id) {
      // Every Locum notification points at its locum; the page shows the
      // applicant their status and the hospital its Manage button.
      router.push(`/jobs/locum/${item.ref_id}` as any);
    }
  };

  const visible = useMemo(() => {
    const f = FILTERS.find(x => x.key === filter);
    return f?.types ? notifications.filter(n => matchesFilter(f, n.type)) : notifications;
  }, [notifications, filter]);

  const unreadCount = notifications.filter(n => !n.read).length;

  const renderNotification = ({ item }: { item: Notification }) => {
    const config = TYPE_ICONS[isLocumNotification(item.type) ? 'locum' : item.type] || TYPE_ICONS.general;
    const step = locumNotificationMeta(item.type);
    return (
      <Pressable
        testID={`notif-${item.id}`}
        onPress={() => open(item)}
        accessibilityRole="button"
        accessibilityLabel={`${item.read ? '' : 'Unread. '}${item.title}. ${item.message}. ${timeAgo(item.created_at)}`}
        style={({ pressed }) => [styles.notifCard, !item.read && styles.unreadCard, pressed && styles.pressed]}
      >
        {/* Unread is an accent bar plus a weight change, never colour alone. */}
        {!item.read && <View style={styles.unreadBar} />}
        <View style={[styles.notifIcon, { backgroundColor: config.bg }]}>
          <Ionicons name={config.icon} size={20} color={config.color} />
        </View>
        <View style={styles.notifContent}>
          <Text style={[styles.notifTitle, !item.read && styles.unreadTitle]}>{item.title}</Text>
          {step ? (
            <View style={styles.notifStep}>
              <JobBadge label={step.label} icon={step.icon as any} tone={step.tone} />
            </View>
          ) : null}
          <Text style={styles.notifMessage} numberOfLines={2}>{item.message}</Text>
          <Text style={styles.notifTime}>{timeAgo(item.created_at)}</Text>
        </View>
      </Pressable>
    );
  };

  return (
    <SafeAreaView style={styles.safe} edges={withBack ? ['top'] : []}>
      <PageColumn testID="notifications-column">
        <View style={styles.header}>
          {withBack && (
            <Pressable
              testID="notif-back-btn"
              style={({ pressed }) => [styles.backBtn, pressed && styles.pressed]}
              onPress={() => (router.canGoBack() ? router.back() : router.replace('/(tabs)/alerts'))}
              accessibilityRole="button"
              accessibilityLabel="Go back"
              hitSlop={8}
            >
              <Ionicons name="arrow-back" size={24} color={colors.navy} />
            </Pressable>
          )}
          <Text style={styles.headerTitle} accessibilityRole="header">Notifications</Text>
          {unreadCount > 0 && (
            <Pressable
              testID="mark-all-read-btn"
              style={({ pressed }) => [styles.markAllBtn, pressed && styles.pressed]}
              onPress={markAllRead}
              accessibilityRole="button"
              accessibilityLabel={`Mark all ${unreadCount} notifications as read`}
            >
              <Text style={styles.markAllText}>Mark all read</Text>
            </Pressable>
          )}
        </View>

        <View style={styles.filterRow}>
          {FILTERS.map(f => {
            const selected = filter === f.key;
            const count = f.types
              ? notifications.filter(n => matchesFilter(f, n.type)).length
              : notifications.length;
            return (
              <Pressable
                key={f.key}
                testID={`notif-filter-${f.key}`}
                onPress={() => setFilter(f.key)}
                accessibilityRole="tab"
                accessibilityState={{ selected }}
                accessibilityLabel={`${f.label}, ${count}`}
                style={({ pressed }) => [styles.chip, selected && styles.chipActive, pressed && styles.pressed]}
              >
                <Text style={[styles.chipText, selected && styles.chipTextActive]}>{f.label}</Text>
              </Pressable>
            );
          })}
        </View>

        {loading ? (
          <LoadingState label="Loading notifications…" />
        ) : error && notifications.length === 0 ? (
          <ErrorState message={error} onRetry={load} />
        ) : (
          <FlatList
            data={visible}
            renderItem={renderNotification}
            keyExtractor={item => item.id}
            contentContainerStyle={styles.list}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={colors.navy} />}
            onEndReached={loadMore}
            onEndReachedThreshold={0.5}
            ListFooterComponent={loadingMore ? <ActivityIndicator style={styles.footer} color={colors.navy} /> : null}
            ListEmptyComponent={
              filter === 'all' ? (
                <EmptyState
                  icon="notifications-off-outline"
                  title="No notifications yet"
                  hint="You'll see alerts for job applications, specialist opt-ins, and case activity here."
                />
              ) : (
                <EmptyState
                  icon="filter-outline"
                  title={`Nothing under ${FILTERS.find(f => f.key === filter)?.label}`}
                  hint="Switch back to All to see everything you've received."
                  actionLabel="Show all"
                  onAction={() => setFilter('all')}
                />
              )
            }
          />
        )}
      </PageColumn>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  pressed: { opacity: 0.7 },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    backgroundColor: colors.white,
  },
  backBtn: { width: MIN_TOUCH_TARGET, height: MIN_TOUCH_TARGET, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { ...typography.h2, color: colors.text, flex: 1 },
  markAllBtn: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.pill,
    backgroundColor: '#EFF6FF',
    minHeight: 34,
    justifyContent: 'center',
  },
  markAllText: { ...typography.caption, fontFamily: fonts.body.bold, color: colors.navy },

  filterRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
    backgroundColor: colors.white,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  chip: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    minHeight: 34,
    justifyContent: 'center',
  },
  chipActive: { backgroundColor: colors.navy, borderColor: colors.navy },
  chipText: { ...typography.caption, fontFamily: fonts.body.semibold, color: colors.textSecondary },
  chipTextActive: { color: colors.white },

  list: { paddingBottom: spacing.xxxl },
  footer: { paddingVertical: 20 },

  notifCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.lg,
    backgroundColor: colors.white,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.borderLight,
  },
  unreadCard: { backgroundColor: '#FAFBFF' },
  unreadBar: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 3,
    backgroundColor: colors.navy,
  },
  notifIcon: {
    width: 44,
    height: 44,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  notifContent: { flex: 1 },
  notifTitle: { ...typography.body, fontFamily: fonts.body.medium, color: colors.textSecondary, marginBottom: 2 },
  unreadTitle: { fontWeight: '700', color: colors.text },
  notifStep: { marginBottom: 4 },
  notifMessage: { ...typography.body, fontSize: 14, color: colors.textSecondary, lineHeight: 20, marginBottom: 4 },
  notifTime: { ...typography.small, color: colors.textSecondary },
});
