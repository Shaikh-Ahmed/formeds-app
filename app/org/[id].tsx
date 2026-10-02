import React, { useEffect, useState } from 'react';
import { StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { colors } from '../../src/theme';
import { ErrorState, LoadingState, ScreenHeader } from '../../src/components';
import { useAuth } from '../../src/context/AuthContext';
import { fetchOrganization } from '../../src/api/organizations';
import { OrganizationProfile } from '../../src/components/organizations/profile/OrganizationProfile';

/**
 * Where "view employer" links from jobs and locums land.
 *
 * ForMeds has accounts, not separate organisation pages: a hospital's or
 * clinic's profile IS its account's profile, at /profile/<account>. So when the
 * employer belongs to an account, this simply opens that account. Only an
 * employer with no account behind it (a recruiter's agency, or one created
 * before accounts carried profiles) is shown here directly.
 */
export default function EmployerRedirect() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { token } = useAuth();
  const router = useRouter();
  const [standalone, setStandalone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    fetchOrganization(token, String(id))
      .then(org => {
        if (!live) return;
        if (org.account_user_id) router.replace(`/profile/${org.account_user_id}` as any);
        else setStandalone(true);
      })
      .catch(e => live && setError(e?.message || 'Could not load this profile.'));
    return () => { live = false; };
  }, [id, token, router]);

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <ScreenHeader title="Profile" onBack={() => router.back()} />
      {error ? <ErrorState message={error} /> : standalone ? <OrganizationProfile orgId={String(id)} /> : <LoadingState />}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.white },
});
