import React, { useCallback, useState } from 'react';
import { Pressable, StyleSheet, Switch, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { useAuth } from '../../src/context/AuthContext';
import { Button, ScreenHeader } from '../../src/components';
import { PageColumn } from '../../src/components/web';
import { AedHistoryList, confirmDelete } from '../../src/components/aed/AedHistoryList';
import { colors, fonts, radius, spacing, typography } from '../../src/theme';
import { deleteAllSavedConversations, setHistorySaving } from '../../src/api/aedMemory';

/** How long ForMeds keeps a chat, in words. */
export function retentionLabel(days: number | null): string {
  if (!days) return '';
  if (days % 365 === 0) return days === 365 ? '12 months' : `${days / 365} years`;
  if (days % 30 === 0) return `${days / 30} months`;
  return `${days} days`;
}

/** The member's AED chats: open one, start a new one, or manage what is kept. */
export default function AedHistoryScreen() {
  const { token } = useAuth();
  const router = useRouter();
  const [saving, setSaving] = useState<boolean | null>(null);
  const [retentionDays, setRetentionDays] = useState<number | null>(null);
  const [count, setCount] = useState(0);
  const [refreshKey, setRefreshKey] = useState(0);
  const [error, setError] = useState<string | null>(null);

  // Reload whenever the screen comes back into view.
  useFocusEffect(useCallback(() => { setRefreshKey(k => k + 1); }, []));

  const open = (id: string) => router.navigate({ pathname: '/aed-chat', params: { c: id } } as any);
  const startNew = () => router.navigate({ pathname: '/aed-chat', params: { new: String(Date.now()) } } as any);

  const toggleSaving = async (value: boolean) => {
    if (!token) return;
    setSaving(value);
    try {
      await setHistorySaving(token, value);
      setError(null);
    } catch {
      setSaving(!value);
      setError('Couldn’t change this setting. Please try again.');
    }
  };

  const removeAll = () => confirmDelete('Delete all your AED chats? This can’t be undone.', async () => {
    if (!token) return;
    await deleteAllSavedConversations(token).catch(() => {});
    setRefreshKey(k => k + 1);
  });

  const settings = saving === null ? null : (
    <View style={styles.settings} testID="aed-history-settings">
      <View style={styles.settingRow}>
        <View style={styles.flex}>
          <Text style={styles.settingTitle}>Save new chats</Text>
          <Text style={styles.settingHint}>
            {saving
              ? `Chats are kept for ${retentionLabel(retentionDays) || 'a limited time'} after your last message, so you can come back to them.`
              : 'New chats are forgotten after 24 hours. Chats you already have stay until you delete them.'}
          </Text>
        </View>
        <Switch value={saving} onValueChange={toggleSaving} testID="aed-history-saving"
          accessibilityLabel="Save new chats" trackColor={{ true: colors.teal, false: colors.border }} />
      </View>
      {error ? <Text style={styles.error}>{error}</Text> : null}
      {count ? (
        <Button label="Delete all chats" variant="danger" onPress={removeAll} testID="aed-history-delete-all" />
      ) : null}
      <Text style={styles.settingHint}>
        Saved chats are encrypted, never used to train AI models, and never shown to anyone else.
      </Text>
    </View>
  );

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <PageColumn maxWidth={720} testID="aed-history">
        <ScreenHeader title="AED chats" right={(
          <Pressable onPress={() => router.push('/aed/preferences' as any)} accessibilityRole="button"
            accessibilityLabel="Answer preferences" testID="aed-open-preferences" hitSlop={10}>
            <Ionicons name="options-outline" size={22} color={colors.navy} />
          </Pressable>
        )} />
        <AedHistoryList
          token={token} variant="page" onOpen={open} onNewChat={startNew} refreshKey={refreshKey}
          onLoaded={s => { setSaving(s.saving); setRetentionDays(s.retentionDays); setCount(s.count); }}
          onDeleted={() => setCount(c => Math.max(0, c - 1))}
          footer={settings}
          testID="aed-history-list"
        />
      </PageColumn>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  flex: { flex: 1 },
  settings: {
    gap: spacing.md, marginTop: spacing.lg, padding: spacing.md, borderRadius: radius.lg,
    borderWidth: 1, borderColor: colors.border, backgroundColor: colors.white,
  },
  settingRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  settingTitle: { ...typography.label, fontFamily: fonts.body.semibold, color: colors.text },
  settingHint: { ...typography.small, color: colors.textSecondary, marginTop: 2 },
  error: { ...typography.small, color: colors.redText },
});
