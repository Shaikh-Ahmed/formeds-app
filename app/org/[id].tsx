import React, { useCallback, useEffect, useState } from 'react';
import { Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useAuth } from '../../src/context/AuthContext';
import { colors, radius, spacing, typography, fonts, MIN_TOUCH_TARGET } from '../../src/theme';
import { PageColumn } from '../../src/components/web';
import { Avatar, Button, Chip, EmptyState, ErrorState } from '../../src/components';
import { Skeleton, SkeletonText } from '../../src/components/Skeleton';
import { OrgVerifiedBadge } from '../../src/components/organizations/OrgVerifiedBadge';
import { JobCard } from '../../src/components/jobs/JobCard';
import { fetchOrgJobs, fetchOrganization } from '../../src/api/organizations';
import { ORG_TYPE_LABELS, type Organization } from '../../src/types/organizations';
import type { Job } from '../../src/types/jobs';

/**
 * An organisation's public page.
 *
 * Reachable from any job card, so it has to stand on its own for someone who
 * arrived from a shared link and has never heard of this employer. That means
 * answering the three questions a clinician actually has — who are you, are you
 * real, and what are you hiring for — in that order, above the fold.
 *
 * The verification badge is rendered from the organisation's reviewed status
 * alone. See OrgVerifiedBadge for why nothing else is allowed to produce a tick.
 */
export default function OrganizationScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { token } = useAuth();
  const router = useRouter();

  const [org, setOrg] = useState<Organization | null>(null);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!id) return;
    setError(null);
    try {
      // Roles are fetched alongside, not after: a member arriving here should
      // see the Manage button on the first paint, not a beat later.
      const [o, j] = await Promise.all([
        fetchOrganization(token, id),
        fetchOrgJobs(token, id).catch(() => []),
      ]);
      setOrg(o);
      setJobs(j);
    } catch (e: any) {
      setError(e?.message || 'Could not load this organisation.');
    } finally {
      setLoading(false);
    }
  }, [id, token]);

  useEffect(() => { load(); }, [load]);

  if (error) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <PageColumn><Header onBack={() => router.back()} title="Organisation" /></PageColumn>
        <ErrorState message={error} onRetry={load} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <PageColumn testID="org-column">
        <Header onBack={() => router.back()} title={org?.name || 'Organisation'} />

        <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
          {loading || !org ? (
            <View style={styles.section}>
              <Skeleton height={72} width={72} radius={radius.lg} />
              <Skeleton height={20} width="60%" />
              <Skeleton height={22} width={150} radius={radius.pill} />
              <SkeletonText lines={3} />
            </View>
          ) : (
            <>
              <View style={styles.identity}>
                <Avatar name={org.name} uri={org.logo || undefined} size={72} />
                <View style={styles.identityText}>
                  <Text style={styles.name} accessibilityRole="header">{org.name}</Text>
                  <Text style={styles.type}>
                    {ORG_TYPE_LABELS[org.org_type] ?? org.org_type}
                    {org.city ? ` · ${[org.city, org.state].filter(Boolean).join(', ')}` : ''}
                  </Text>
                  <OrgVerifiedBadge status={org.verification_status} />
                </View>
              </View>

              {org.headline ? <Text style={styles.headline}>{org.headline}</Text> : null}

              {org.can_edit ? (
                <Button
                  label="Manage organisation"
                  variant="outline"
                  onPress={() => router.push(`/org/manage/${org.id}` as any)}
                  testID="org-manage"
                />
              ) : null}

              <View style={styles.factRow}>
                <Fact icon="briefcase-outline" value={`${org.job_count}`} label="open roles" />
                <Fact icon="people-outline" value={`${org.member_count}`} label="on ForMeds" />
                {org.bed_count ? (
                  <Fact icon="bed-outline" value={`${org.bed_count}`} label="beds" />
                ) : null}
                {org.founded_year ? (
                  <Fact icon="calendar-outline" value={`${org.founded_year}`} label="founded" />
                ) : null}
              </View>

              {org.about ? (
                <Section title="About">
                  <Text style={styles.prose}>{org.about}</Text>
                </Section>
              ) : null}

              {org.specialties?.length ? (
                <Section title="Specialties">
                  <View style={styles.chips}>
                    {org.specialties.map(s => <Chip key={s} label={s} tone="teal" />)}
                  </View>
                </Section>
              ) : null}

              {org.website || org.public_email || org.public_phone || org.address_line ? (
                <Section title="Contact">
                  {org.address_line ? (
                    <ContactRow icon="location-outline" text={org.address_line} />
                  ) : null}
                  {org.public_phone ? (
                    <ContactRow icon="call-outline" text={org.public_phone} />
                  ) : null}
                  {org.public_email ? (
                    <ContactRow icon="mail-outline" text={org.public_email} />
                  ) : null}
                  {org.website ? (
                    <ContactRow
                      icon="globe-outline"
                      text={org.website}
                      onPress={() => Linking.openURL(org.website!).catch(() => {})}
                    />
                  ) : null}
                </Section>
              ) : null}

              <Section title={`Open roles${jobs.length ? ` (${jobs.length})` : ''}`}>
                {jobs.length ? (
                  <View style={styles.jobs}>
                    {jobs.map(job => (
                      <JobCard
                        key={job.id}
                        item={job}
                        onPress={() => router.push(`/jobs/${job.id}` as any)}
                      />
                    ))}
                  </View>
                ) : (
                  <EmptyState
                    icon="briefcase-outline"
                    title="Nothing open right now"
                    hint="New roles from this organisation will appear here."
                  />
                )}
              </Section>
            </>
          )}
        </ScrollView>
      </PageColumn>
    </SafeAreaView>
  );
}

function Header({ onBack, title }: { onBack: () => void; title: string }) {
  return (
    <View style={styles.header}>
      <Pressable
        onPress={onBack}
        accessibilityRole="button"
        accessibilityLabel="Back"
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        style={({ pressed }) => [styles.back, pressed && styles.pressed]}
      >
        <Ionicons name="arrow-back" size={22} color={colors.text} />
      </Pressable>
      <Text style={styles.headerTitle} numberOfLines={1}>{title}</Text>
    </View>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle} accessibilityRole="header">{title}</Text>
      {children}
    </View>
  );
}

function Fact({
  icon, value, label,
}: {
  icon: keyof typeof Ionicons.glyphMap; value: string; label: string;
}) {
  return (
    <View style={styles.fact} accessible accessibilityLabel={`${value} ${label}`}>
      <Ionicons name={icon} size={16} color={colors.textSecondary} />
      <Text style={styles.factValue}>{value}</Text>
      <Text style={styles.factLabel}>{label}</Text>
    </View>
  );
}

function ContactRow({
  icon, text, onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap; text: string; onPress?: () => void;
}) {
  const body = (
    <View style={styles.contact}>
      <Ionicons name={icon} size={16} color={colors.textSecondary} />
      <Text style={[styles.contactText, onPress && styles.link]} numberOfLines={2}>{text}</Text>
    </View>
  );
  if (!onPress) return body;
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="link"
      accessibilityLabel={text}
      style={({ pressed }) => pressed && styles.pressed}
    >
      {body}
    </Pressable>
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

  body: { padding: spacing.lg, gap: spacing.xl, paddingBottom: spacing.xxxl * 2 },
  identity: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.lg },
  identityText: { flex: 1, gap: spacing.xs },
  name: { ...typography.h2, color: colors.text },
  type: { ...typography.caption, color: colors.textSecondary },
  headline: { ...typography.body, color: colors.textSecondary, lineHeight: 22 },

  factRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.lg,
    paddingVertical: spacing.md,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: colors.border,
  },
  fact: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  factValue: { ...typography.bodyStrong, color: colors.text },
  factLabel: { ...typography.small, color: colors.textSecondary },

  section: { gap: spacing.sm },
  sectionTitle: { ...typography.overline, color: colors.teal },
  prose: { ...typography.body, color: colors.textSecondary, lineHeight: 23 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs + 2 },
  jobs: { gap: spacing.md },

  contact: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, minHeight: 32 },
  contactText: { ...typography.caption, color: colors.textSecondary, flex: 1 },
  link: { color: colors.navy, fontFamily: fonts.body.semibold },
  pressed: { opacity: 0.6 },
});
