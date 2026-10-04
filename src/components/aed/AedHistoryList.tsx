import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, fonts, radius, spacing, typography, MIN_TOUCH_TARGET } from '../../theme';
import {
  deleteSavedConversation, fetchSavedConversations, type SavedConversation,
} from '../../api/aedMemory';

export interface HistoryGroup { label: string; items: SavedConversation[] }

const DAY = 24 * 60 * 60 * 1000;

/** Chats grouped the way people remember them: Today, Yesterday, the past week, the past month, then by month. */
export function groupByDate(items: SavedConversation[], now: Date = new Date()): HistoryGroup[] {
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const groups: HistoryGroup[] = [];
  const add = (label: string, item: SavedConversation) => {
    const last = groups[groups.length - 1];
    if (last && last.label === label) last.items.push(item);
    else groups.push({ label, items: [item] });
  };
  const sorted = [...items].sort((a, b) => b.last_message_at.localeCompare(a.last_message_at));
  for (const item of sorted) {
    const t = new Date(item.last_message_at).getTime();
    if (t >= startOfToday) add('Today', item);
    else if (t >= startOfToday - DAY) add('Yesterday', item);
    else if (t >= startOfToday - 7 * DAY) add('Previous 7 days', item);
    else if (t >= startOfToday - 30 * DAY) add('Previous 30 days', item);
    else add(new Date(t).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' }), item);
  }
  return groups;
}

export function confirmDelete(message: string, onYes: () => void) {
  if (Platform.OS === 'web') {
    if (typeof window !== 'undefined' && window.confirm(message)) onYes();
    return;
  }
  Alert.alert('Delete', message, [
    { text: 'Cancel', style: 'cancel' }, { text: 'Delete', style: 'destructive', onPress: onYes },
  ]);
}

interface Props {
  token: string | null | undefined;
  /** The conversation on screen, highlighted in the list. */
  activeId?: string | null;
  onOpen: (id: string) => void;
  onNewChat?: () => void;
  /** Change it to reload the list (after a new chat was saved, say). */
  refreshKey?: number;
  /** A narrow sidebar beside the chat, or the full history page. */
  variant?: 'sidebar' | 'page';
  onDeleted?: (id: string) => void;
  /** Saving state and retention, for the page's settings footer. */
  onLoaded?: (state: { saving: boolean; retentionDays: number | null; count: number }) => void;
  footer?: React.ReactNode;
  testID?: string;
}

/** The member's AED chats, newest first, with "New chat" on top -- like any chat assistant. */
export function AedHistoryList({
  token, activeId, onOpen, onNewChat, refreshKey = 0, variant = 'page', onDeleted, onLoaded, footer, testID,
}: Props) {
  const [items, setItems] = useState<SavedConversation[] | null>(null);
  const [saving, setSaving] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!token) return;
    try {
      const res = await fetchSavedConversations(token);
      setItems(res.conversations);
      setSaving(res.saving);
      setError(null);
      onLoaded?.({ saving: res.saving, retentionDays: res.retention_days ?? null, count: res.conversations.length });
    } catch {
      setError('Couldn’t load your chats.');
      setItems(prev => prev ?? []);
    }
    // onLoaded is a callback prop; reloading on its identity would loop.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  useEffect(() => { load(); }, [load, refreshKey]);

  const remove = (c: SavedConversation) => confirmDelete(`Delete “${c.title}”?`, async () => {
    if (!token) return;
    await deleteSavedConversation(token, c.id).catch(() => {});
    setItems(prev => (prev ?? []).filter(x => x.id !== c.id));
    onDeleted?.(c.id);
  });

  const sidebar = variant === 'sidebar';
  return (
    <View style={[styles.wrap, sidebar && styles.wrapSidebar]} testID={testID}>
      {onNewChat ? (
        <Pressable onPress={onNewChat} accessibilityRole="button" accessibilityLabel="Start a new chat"
          style={({ pressed }) => [styles.newChat, pressed && styles.pressed]} testID="aed-history-new-chat">
          <Ionicons name="create-outline" size={18} color={colors.navy} />
          <Text style={styles.newChatText}>New chat</Text>
        </Pressable>
      ) : null}
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {!saving ? (
          <Text style={styles.note} testID="aed-history-saving-off">Saving new chats is off.</Text>
        ) : null}
        {error ? <Text style={styles.error}>{error}</Text> : null}
        {items === null ? (
          <ActivityIndicator style={styles.loading} color={colors.teal} />
        ) : items.length === 0 && !error ? (
          <Text style={styles.empty} testID="aed-history-empty">Your chats will appear here.</Text>
        ) : (
          groupByDate(items).map(group => (
            <View key={group.label} style={styles.group}>
              <Text style={styles.groupLabel}>{group.label}</Text>
              {group.items.map(item => {
                const active = item.id === activeId;
                return (
                  // Open and delete are siblings: a button inside a button is invalid on web.
                  <View key={item.id} style={[styles.row, sidebar ? styles.rowSidebar : styles.rowPage,
                    active && styles.rowActive]}>
                    <Pressable onPress={() => onOpen(item.id)} accessibilityRole="button"
                      accessibilityLabel={`Open ${item.title}`} accessibilityState={{ selected: active }}
                      style={({ pressed }) => [styles.open, pressed && styles.pressed]}
                      testID={`aed-history-${item.id}`}>
                      {sidebar ? null : <Ionicons name="chatbubble-ellipses-outline" size={18} color={colors.teal} />}
                      <View style={styles.flex}>
                        <Text style={[styles.title, active && styles.titleActive]} numberOfLines={sidebar ? 1 : 2}>
                          {item.title}
                        </Text>
                        {sidebar ? null : (
                          <Text style={styles.meta}>
                            {new Date(item.last_message_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                            {' · '}{item.message_count} messages
                          </Text>
                        )}
                      </View>
                    </Pressable>
                    <Pressable onPress={() => remove(item)} accessibilityRole="button"
                      accessibilityLabel={`Delete ${item.title}`}
                      style={({ pressed }) => [styles.delete, pressed && styles.pressed]}
                      testID={`aed-history-delete-${item.id}`}>
                      <Ionicons name="trash-outline" size={16} color={colors.textSecondary} />
                    </Pressable>
                  </View>
                );
              })}
            </View>
          ))
        )}
        {footer}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  pressed: { opacity: 0.7 },
  wrap: { flex: 1 },
  wrapSidebar: { backgroundColor: colors.bg },
  scroll: { padding: spacing.md, gap: spacing.md, paddingBottom: spacing.xl },
  newChat: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm, margin: spacing.md, marginBottom: 0,
    minHeight: MIN_TOUCH_TARGET, paddingHorizontal: spacing.md, borderRadius: radius.lg,
    borderWidth: 1, borderColor: colors.border, backgroundColor: colors.white,
  },
  newChatText: { ...typography.label, color: colors.navy },
  note: { ...typography.small, color: colors.textSecondary },
  error: { ...typography.small, color: colors.redText },
  empty: { ...typography.caption, color: colors.textSecondary },
  loading: { marginTop: spacing.lg },
  group: { gap: 2 },
  groupLabel: {
    ...typography.small, fontFamily: fonts.body.semibold, color: colors.textSecondary,
    paddingHorizontal: spacing.xs, marginBottom: spacing.xs,
  },
  row: { flexDirection: 'row', alignItems: 'center', borderRadius: radius.md },
  rowSidebar: { minHeight: MIN_TOUCH_TARGET },
  rowPage: {
    gap: spacing.sm, padding: spacing.sm, marginBottom: spacing.xs, backgroundColor: colors.white,
    borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg,
  },
  rowActive: { backgroundColor: colors.tealBg },
  open: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: spacing.md, minHeight: MIN_TOUCH_TARGET,
    paddingHorizontal: spacing.sm },
  title: { ...typography.caption, color: colors.text },
  titleActive: { fontFamily: fonts.body.semibold, color: colors.teal },
  meta: { ...typography.small, color: colors.textSecondary, marginTop: 2 },
  delete: { width: MIN_TOUCH_TARGET, height: MIN_TOUCH_TARGET, alignItems: 'center', justifyContent: 'center',
    borderRadius: radius.md },
});
