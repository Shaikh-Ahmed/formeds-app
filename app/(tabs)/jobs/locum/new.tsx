import React, { useCallback, useState } from 'react';
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
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const submit = useCallback(async (payload: Record<string, unknown>) => {
    if (!token) return;
    setSubmitting(true);
    setError(null);
    try {
      const locum = await createLocum(token, payload);
      // Straight to its applicant list: that is where the hospital waits next.
      router.replace(`/jobs/locum/manage/${locum.id}` as any);
    } catch (e: any) {
      setError(e?.message || 'Could not post this locum.');
      setFieldErrors(errorFields(e, LOCUM_ERROR_FIELDS));
    } finally {
      setSubmitting(false);
    }
  }, [token, router]);

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
