import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useSubmit } from '../../../../../src/hooks/useSubmit';
import { StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useAuth } from '../../../../../src/context/AuthContext';
import { colors } from '../../../../../src/theme';
import { PageColumn } from '../../../../../src/components/web';
import { ErrorState, LoadingState } from '../../../../../src/components';
import { LocumBackHeader } from '../../../../../src/components/locum/LocumBackHeader';
import { errorFields } from '../../../../../src/utils/api';
import { LOCUM_ERROR_FIELDS, LocumForm, formFromLocum } from '../../../../../src/components/locum/LocumForm';
import { fetchLocum, updateLocum } from '../../../../../src/api/locum';
import type { Locum } from '../../../../../src/types/locum';

export default function EditLocumScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { token } = useAuth();
  const router = useRouter();
  const [locum, setLocum] = useState<Locum | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const { submitting, run } = useSubmit();
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    if (!token || !id) return;
    setLoadError(null);
    try {
      setLocum(await fetchLocum(token, id));
    } catch (e: any) {
      setLoadError(e?.message || 'Could not load this locum.');
    }
  }, [token, id]);

  useEffect(() => { load(); }, [load]);
  const initial = useMemo(() => (locum ? formFromLocum(locum) : undefined), [locum]);

  const submit = useCallback((patch: Record<string, unknown>) => run(async () => {
    if (!token || !id) return;
    if (!Object.keys(patch).length) { router.back(); return; }
    setError(null);
    try {
      await updateLocum(token, id, patch);
      if (router.canGoBack()) router.back();
      else router.replace(`/jobs/locum/manage/${id}` as any);
    } catch (e: any) {
      const fields = errorFields(e, LOCUM_ERROR_FIELDS);
      setFieldErrors(fields);
      setError(Object.keys(fields).length ? null : e?.message || 'Could not save your changes. Please try again.');
    }
  }, patch), [token, id, router, run]);

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <PageColumn testID="locum-edit-column">
        <LocumBackHeader title="Edit locum" fallback={`/jobs/locum/manage/${id}`} />
        {loadError ? (
          <ErrorState message={loadError} onRetry={load} />
        ) : !initial ? (
          <LoadingState />
        ) : (
          <LocumForm initial={initial} editing onSubmit={submit} submitting={submitting} error={error} serverFieldErrors={fieldErrors} />
        )}
      </PageColumn>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({ safe: { flex: 1, backgroundColor: colors.bg } });
