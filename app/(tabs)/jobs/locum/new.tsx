import React, { useCallback, useState } from 'react';
import { useSubmit } from '../../../../src/hooks/useSubmit';
import { StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useAuth } from '../../../../src/context/AuthContext';
import { colors } from '../../../../src/theme';
import { PageColumn } from '../../../../src/components/web';
import { KycNotice } from '../../../../src/components';
import { LocumBackHeader } from '../../../../src/components/locum/LocumBackHeader';
import { errorFields } from '../../../../src/utils/api';
import { LOCUM_ERROR_FIELDS, LocumForm } from '../../../../src/components/locum/LocumForm';
import { createLocum } from '../../../../src/api/locum';

export default function NewLocumScreen() {
  const { token } = useAuth();
  const router = useRouter();
  const { submitting, run } = useSubmit();
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const submit = useCallback((payload: Record<string, unknown>) => run(async key => {
    if (!token) return;
    setError(null);
    try {
      // Keyed: a double click or a retry after a lost response returns this
      // same locum instead of posting a second one.
      const locum = await createLocum(token, payload, key);
      // Straight to its applicant list: that is where the hospital waits next.
      router.replace(`/jobs/locum/manage/${locum.id}` as any);
    } catch (e: any) {
      const fields = errorFields(e, LOCUM_ERROR_FIELDS);
      setFieldErrors(fields);
      // A field took it: say it there, not twice.
      setError(Object.keys(fields).length ? null : e?.message || 'Could not post this locum. Please try again.');
    }
  }, payload), [token, router, run]);

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <PageColumn testID="locum-new-column">
        <LocumBackHeader title="Post a locum" subtitle="Quick setup" fallback="/jobs/locum/mine" />
        <KycNotice action="post locums" />
        <LocumForm onSubmit={submit} submitting={submitting} error={error} serverFieldErrors={fieldErrors} />
      </PageColumn>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({ safe: { flex: 1, backgroundColor: colors.bg } });
