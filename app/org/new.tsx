import React, { useCallback, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useAuth } from '../../src/context/AuthContext';
import { colors, spacing, typography, MIN_TOUCH_TARGET } from '../../src/theme';
import { PageColumn } from '../../src/components/web';
import { KycNotice } from '../../src/components';
import { OrgForm } from '../../src/components/organizations/OrgForm';
import { createOrganization } from '../../src/api/organizations';

/**
 * Create an employer page.
 *
 * KYC-gated, like posting a job: an unverified account minting institutions is
 * the cheapest way to manufacture a plausible-looking employer. The page still
 * starts UNVERIFIED regardless — the creator's own verification says nothing
 * about whether the institution exists, which is stated here rather than left
 * for someone to discover when no tick appears.
 */
export default function NewOrganizationScreen() {
  const { token, isKycApproved } = useAuth();
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = useCallback(async (payload: Record<string, unknown>) => {
    if (!token) return;
    setSubmitting(true);
    setError(null);
    try {
      const org = await createOrganization(token, payload);
      router.replace(`/org/manage/${org.id}` as any);
    } catch (e: any) {
      setError(e?.message || 'Could not create this organisation.');
    } finally {
      setSubmitting(false);
    }
  }, [token, router]);

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <PageColumn testID="org-new-column">
        <View style={styles.header}>
          <Pressable
            onPress={() => router.back()}
            accessibilityRole="button"
            accessibilityLabel="Back"
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            style={({ pressed }) => [styles.back, pressed && styles.pressed]}
          >
            <Ionicons name="arrow-back" size={22} color={colors.text} />
          </Pressable>
          <Text style={styles.headerTitle}>Create an organisation</Text>
        </View>

        <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
          <Text style={styles.intro}>
            An organisation page lets several people post and manage roles under one
            employer identity, so every listing reads as the same institution.
          </Text>
          <View style={styles.noteCard}>
            <Ionicons name="information-circle-outline" size={18} color={colors.textSecondary} />
            <Text style={styles.noteText}>
              New organisations start unverified. Once created you can submit a
              registration document for review, and the verified badge appears
              only after an admin approves it.
            </Text>
          </View>

          <KycNotice action="create an organisation" />

          {isKycApproved ? (
            <OrgForm
              submitLabel="Create organisation"
              submitting={submitting}
              error={error}
              onSubmit={submit}
              onCancel={() => router.back()}
            />
          ) : null}
        </ScrollView>
      </PageColumn>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: colors.white,
  },
  back: {
    width: MIN_TOUCH_TARGET,
    height: MIN_TOUCH_TARGET,
    alignItems: 'flex-start',
    justifyContent: 'center',
  },
  headerTitle: { ...typography.h3, color: colors.text, flex: 1 },
  body: { padding: spacing.lg, gap: spacing.lg, paddingBottom: spacing.xxxl * 2 },
  intro: { ...typography.body, color: colors.textSecondary, lineHeight: 22 },
  noteCard: {
    flexDirection: 'row',
    gap: spacing.sm,
    padding: spacing.md,
    backgroundColor: colors.bgMuted,
    borderRadius: 12,
  },
  noteText: { ...typography.small, color: colors.textSecondary, flex: 1, lineHeight: 18 },
  pressed: { opacity: 0.6 },
});
