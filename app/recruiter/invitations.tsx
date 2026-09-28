import React, { useCallback, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { useAuth } from '../../src/context/AuthContext';
import { Avatar, EmptyState, ErrorState, LoadingState } from '../../src/components';
import { ChoiceChips } from '../../src/components/locum/ChoiceChips';
import { colors, radius, spacing } from '../../src/theme';
import { RecruiterScreen, formatDate, recruiterStyles } from '../../src/components/recruiters/RecruiterUI';
import { fetchSentInvitations } from '../../src/api/recruiters';
import type { Invitation } from '../../src/types/recruiters';
import { InviteStatus } from '../../src/components/recruiters/InviteStatus';

type Filter = 'all' | 'open' | 'ACCEPTED' | 'DECLINED';

/** Every invitation the recruiter has sent and where it stands. */
export default function SentInvitationsScreen() {
  const { token } = useAuth();
  const router = useRouter();
  const [items, setItems] = useState<Invitation[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>('all');

  const load = useCallback(async () => {
    if (!token) return;
    try { setItems(await fetchSentInvitations(token)); setError(null); } catch (e: any) { setError(e?.message); }
  }, [token]);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  if (!items && error) return <ErrorState message={error} onRetry={load} />;
  if (!items) return <LoadingState />;

  const shown = items.filter(i =>
    filter === 'all' ? true : filter === 'open' ? i.status === 'SENT' || i.status === 'VIEWED' : i.status === filter);

  return (
    <RecruiterScreen title="Invitations" subtitle="Everyone you have invited and where each invitation stands." active="invitations" testID="recruiter-invitations">
      <ChoiceChips value={filter} onChange={v => v && setFilter(v)} testID="invite-filter" choices={[
        { value: 'all', label: `All (${items.length})` }, { value: 'open', label: 'Awaiting' },
        { value: 'ACCEPTED', label: 'Applied' }, { value: 'DECLINED', label: 'Declined' },
      ]} />
      {shown.length === 0 ? (
        <EmptyState icon="paper-plane-outline" title="No invitations here"
          hint="Invite professionals from Find talent." actionLabel="Find talent"
          onAction={() => router.replace('/recruiter/candidates')} />
      ) : shown.map(inv => (
        <View key={inv.id} style={styles.row} testID={`sent-invite-${inv.id}`}>
          <Pressable style={styles.person} onPress={() => inv.professional && router.push(`/profile/${inv.professional.id}` as any)}
            accessibilityRole="link" accessibilityLabel={`View ${inv.professional?.name ?? 'professional'}`}>
            <Avatar name={inv.professional?.name} uri={inv.professional?.avatar} size={40} />
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={recruiterStyles.strong} numberOfLines={1}>{inv.professional?.name ?? 'Professional'}</Text>
              <Text style={recruiterStyles.muted} numberOfLines={1}>{inv.target.title}</Text>
              <Text style={recruiterStyles.muted}>Sent {formatDate(inv.created_at)}</Text>
            </View>
          </Pressable>
          <InviteStatus status={inv.status} />
        </View>
      ))}
    </RecruiterScreen>
  );
}

const styles = StyleSheet.create({
  row: {
    backgroundColor: colors.white, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border,
    padding: spacing.md, flexDirection: 'row', alignItems: 'center', gap: spacing.md,
  },
  person: { flex: 1, flexDirection: 'row', gap: spacing.md, minWidth: 0 },
});
