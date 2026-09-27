import React, { useCallback, useState } from 'react';
import { StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from 'expo-router';
import { useAuth } from '../../../../src/context/AuthContext';
import { colors } from '../../../../src/theme';
import { PageGrid } from '../../../../src/components/web';
import { LocumNav } from '../../../../src/components/locum/LocumNav';
import { LocumApplicantsView } from '../../../../src/components/locum/LocumApplicantsView';
import { fetchReceivedLocumApplications } from '../../../../src/api/locum';
import type { ManagedLocumApplication } from '../../../../src/types/locum';

/**
 * Every applicant across every locum this hospital manages, newest first --
 * the place to work through a morning's applications without opening each
 * shift in turn. Each row names its locum and links to it.
 */
export default function LocumApplicantsInboxScreen() {
  const { token } = useAuth();
  const [apps, setApps] = useState<ManagedLocumApplication[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!token) { setLoading(false); return; }
    setError(null);
    try {
      setApps(await fetchReceivedLocumApplications(token));
    } catch (e: any) {
      setError(e?.message || 'Could not load applicants.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [token]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  return (
    <SafeAreaView style={styles.safe} edges={[]}>
      <PageGrid fluid testID="locum-inbox-grid">
        <LocumNav active="applicants" />
        <LocumApplicantsView
          apps={apps}
          setApps={setApps}
          loading={loading}
          error={error}
          refreshing={refreshing}
          onRefresh={() => { setRefreshing(true); load(); }}
          onRetry={load}
          showLocum
          empty={{
            title: 'No applicants yet',
            hint: 'Applications to any of your locums appear here as they arrive.',
          }}
        />
      </PageGrid>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({ safe: { flex: 1, backgroundColor: colors.bg } });
