import React, { useCallback, useEffect, useState } from 'react';
import { useSubmit } from '../../../../src/hooks/useSubmit';
import { ApiError } from '../../../../src/utils/api';
import { StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useAuth } from '../../../../src/context/AuthContext';
import { colors, useBreakpoint } from '../../../../src/theme';
import { PageColumn } from '../../../../src/components/web';
import { ErrorBanner, ErrorState } from '../../../../src/components';
import { LocumScreen, applyBlocker } from '../../../../src/components/locum/LocumScreen';
import { LocumDetailPanel } from '../../../../src/components/locum/LocumDetailPanel';
import { LocumApplySheet } from '../../../../src/components/locum/LocumApplySheet';
import { LocumBackHeader } from '../../../../src/components/locum/LocumBackHeader';
import { applyToLocum, fetchLocum, withdrawLocumApplication } from '../../../../src/api/locum';
import { LOCUM_WITHDRAWABLE, type Locum } from '../../../../src/types/locum';

/**
 * One locum. On desktop this is Discover with the locum selected, so a shared
 * link opens in context; on a phone and tablet it is a pushed page.
 */
export default function LocumDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { token, user, isKycApproved } = useAuth();
  const { isDesktop } = useBreakpoint();
  const router = useRouter();

  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const [locum, setLocum] = useState<Locum | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [applyOpen, setApplyOpen] = useState(false);
  const { submitting: applying, run: runApply } = useSubmit();

  const load = useCallback(async () => {
    if (!id) return;
    setError(null);
    try {
      setLocum(await fetchLocum(token, id));
    } catch (e: any) {
      setError(e?.message || 'Could not load this locum.');
    } finally {
      setLoading(false);
    }
  }, [id, token]);

  useEffect(() => { load(); }, [load]);

  const submit = useCallback((note: string) => runApply(async key => {
    if (!token || !locum) return;
    setActionError(null);
    try {
      // Keyed: a second tap or a retry returns this same application.
      const mine = await applyToLocum(token, locum.id, note, key);
      setLocum(prev => (prev ? { ...prev, my_application: mine } : prev));
      setApplyOpen(false);
    } catch (e: any) {
      if (e instanceof ApiError && e.code === 'already_applied') { setApplyOpen(false); load(); }
      setActionError(e?.message || 'Could not send your application. Please try again.');
    }
  }, { locum: locum?.id, note }), [token, locum, runApply, load]);

  const withdraw = useCallback(async () => {
    const mine = locum?.my_application;
    if (!token || !mine) return;
    setActionError(null);
    try {
      await withdrawLocumApplication(token, mine.id);
      setLocum(prev => (prev ? { ...prev, my_application: null } : prev));
    } catch (e: any) {
      setActionError(e?.message || 'Could not withdraw your application.');
    }
  }, [token, locum]);

  // A recruiter sees their shift on its own, never inside the locum board.
  if (mounted && isDesktop && user?.role !== 'recruiter') {
    return (
      <SafeAreaView style={styles.safe} edges={[]}>
        <LocumScreen selectedId={id ?? null} />
      </SafeAreaView>
    );
  }

  const { canApply, reason } = applyBlocker(user, isKycApproved);
  const mine = locum?.my_application;
  const canWithdraw = !!mine && LOCUM_WITHDRAWABLE.includes(mine.status);

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <PageColumn testID="locum-column">
        <LocumBackHeader title="Locum" fallback="/jobs/locum" />
        <ErrorBanner message={actionError} />
        {error ? (
          <ErrorState message={error} onRetry={load} />
        ) : (
          <LocumDetailPanel
            locum={locum}
            loading={loading || !mounted}
            onApply={canApply ? () => setApplyOpen(true) : undefined}
            applyDisabledReason={reason}
            onWithdraw={canWithdraw ? withdraw : undefined}
            onManage={() => locum && router.push(`/jobs/locum/manage/${locum.id}` as any)}
            onEdit={() => locum && router.push(`/jobs/locum/edit/${locum.id}` as any)}
            onViewOrganization={orgId => router.push(`/org/${orgId}` as any)}
          />
        )}
      </PageColumn>
      <LocumApplySheet
        visible={applyOpen}
        locum={locum}
        onClose={() => setApplyOpen(false)}
        onSubmit={submit}
        submitting={applying}
        error={actionError}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({ safe: { flex: 1, backgroundColor: colors.bg } });
