import React, { useCallback, useMemo, useState } from 'react';
import { FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useAuth } from '../../../../src/context/AuthContext';
import { colors, radius, spacing, typography, fonts, MIN_TOUCH_TARGET } from '../../../../src/theme';
import { PageColumn } from '../../../../src/components/web';
import { Avatar, EmptyState, ErrorBanner, ErrorState } from '../../../../src/components';
import { Skeleton } from '../../../../src/components/Skeleton';
import { JobBadge } from '../../../../src/components/jobs/JobMeta';
import { fetchApplicants, fetchJob, setApplicationStatus } from '../../../../src/api/jobs';
import { postedAgo } from '../../../../src/utils/time';
import { APPLICATION_STATUS_META, type Application, type ApplicationStatusKey, type Job } from '../../../../src/types/jobs';

const TONE_FOR_BADGE = {
  neutral: 'neutral', teal: 'teal', navy: 'navy', warning: 'warning', danger: 'danger',
} as const;

/** The pipeline, in the order a hire actually moves through it. */
const PIPELINE: ApplicationStatusKey[] = [
  'applied', 'reviewing', 'shortlisted', 'interviewing', 'offered', 'hired', 'rejected',
];

/** What an employer can move someone to from where they are now. */
const NEXT_STEPS: Partial<Record<ApplicationStatusKey, ApplicationStatusKey[]>> = {
  applied: ['reviewing', 'shortlisted', 'rejected'],
  reviewing: ['shortlisted', 'rejected'],
  shortlisted: ['interviewing', 'rejected'],
  interviewing: ['offered', 'rejected'],
  offered: ['hired', 'rejected'],
};

/**
 * Who applied to one posting.
 *
 * Deliberately not an ATS. The employer needs to see who is interested, judge
 * them, and move them along or not — so this offers exactly the transitions
 * that make sense from the applicant's current stage, and nothing else. There
 * are no bulk actions, no scoring and no notes-on-notes.
 *
 * The applicant summary is whatever `public_card` puts on the wire, which
 * deliberately excludes email and phone. Contacting someone goes through the
 * existing conversation route rather than handing over their details, because
 * this screen is reachable by anyone who can post a job.
 */
export default function ApplicantsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { token } = useAuth();
  const router = useRouter();

  const [job, setJob] = useState<Job | null>(null);
  const [apps, setApps] = useState<Application[]>([]);
  const [filter, setFilter] = useState<ApplicationStatusKey | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [selectMode, setSelectMode] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkBusy, setBulkBusy] = useState(false);

  const load = useCallback(async () => {
    if (!token || !id) { setLoading(false); return; }
    setError(null);
    try {
      const [j, a] = await Promise.all([fetchJob(token, id), fetchApplicants(token, id)]);
      setJob(j);
      setApps(a);
    } catch (e: any) {
      setError(e?.message || 'Could not load applicants for this posting.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [token, id]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const counts = useMemo(() => {
    const out: Partial<Record<ApplicationStatusKey, number>> = {};
    for (const a of apps) out[a.status] = (out[a.status] ?? 0) + 1;
    return out;
  }, [apps]);

  const visible = useMemo(
    () => (filter ? apps.filter(a => a.status === filter) : apps),
    [apps, filter],
  );

  /**
   * Bulk actions only make sense against a single pipeline stage — mixing
   * statuses would mean offering the union of every stage's next steps, most
   * of which wouldn't apply to most of the selection. Selecting a filter
   * scopes it to one stage automatically, so bulk mode piggybacks on that
   * instead of its own status picker.
   */
  const bulkSteps = filter ? NEXT_STEPS[filter] ?? [] : [];

  const setFilterAndReset = (next: ApplicationStatusKey | null) => {
    setFilter(next);
    setSelectMode(false);
    setSelected(new Set());
  };

  const toggleSelect = useCallback((appId: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(appId)) next.delete(appId); else next.add(appId);
      return next;
    });
  }, []);

  const selectAllVisible = useCallback(() => {
    setSelected(new Set(visible.map(a => a.id)));
  }, [visible]);

  const bulkMove = useCallback(async (status: ApplicationStatusKey) => {
    if (!token || selected.size === 0) return;
    const ids = Array.from(selected);
    setActionError(null);
    setBulkBusy(true);
    const results = await Promise.allSettled(ids.map(appId => setApplicationStatus(token, appId, status)));
    const failed = results.filter(r => r.status === 'rejected').length;
    const succeededIds = ids.filter((_, i) => results[i].status === 'fulfilled');
    setApps(prev => prev.map(a => (succeededIds.includes(a.id) ? { ...a, status } : a)));
    setBulkBusy(false);
    setSelectMode(false);
    setSelected(new Set());
    if (failed > 0) {
      setActionError(
        succeededIds.length > 0
          ? `Moved ${succeededIds.length} to ${APPLICATION_STATUS_META[status].label}. ${failed} couldn't be updated — try those again.`
          : `Couldn't update ${failed === 1 ? 'that applicant' : 'those applicants'}. Try again.`,
      );
    }
  }, [token, selected]);

  /**
   * Optimistic, then reconciled. A pipeline move is a considered click, and
   * making the employer wait a round trip to see the chip change invites them
   * to click it twice.
   */
  const move = useCallback(async (app: Application, status: ApplicationStatusKey) => {
    if (!token) return;
    setActionError(null);
    setBusy(app.id);
    const previous = apps;
    setApps(prev => prev.map(a => (a.id === app.id ? { ...a, status } : a)));
    try {
      await setApplicationStatus(token, app.id, status);
    } catch (e: any) {
      setApps(previous);
      setActionError(e?.message || 'Could not update this application.');
    } finally {
      setBusy(null);
    }
  }, [token, apps]);

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <PageColumn testID="applicants-column">
        <View style={styles.header}>
          <Pressable
            onPress={() => (router.canGoBack() ? router.back() : router.replace('/jobs/posted' as any))}
            accessibilityRole="button"
            accessibilityLabel="Back to your postings"
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            style={({ pressed }) => [styles.back, pressed && styles.pressed]}
          >
            <Ionicons name="arrow-back" size={22} color={colors.text} />
          </Pressable>
          <View style={styles.headerText}>
            <Text style={styles.headerTitle} numberOfLines={1}>
              {job?.title || 'Applicants'}
            </Text>
            <Text style={styles.headerSub}>
              {apps.length} {apps.length === 1 ? 'applicant' : 'applicants'}
            </Text>
          </View>
        </View>

        <ErrorBanner message={actionError} />

        {apps.length ? (
          <View style={styles.filterRow} accessibilityRole="tablist">
            <FilterChip
              label={`All ${apps.length}`}
              selected={filter === null}
              onPress={() => setFilterAndReset(null)}
            />
            {PIPELINE.filter(s => counts[s]).map(s => (
              <FilterChip
                key={s}
                label={`${APPLICATION_STATUS_META[s].label} ${counts[s]}`}
                selected={filter === s}
                onPress={() => setFilterAndReset(filter === s ? null : s)}
                testID={`applicant-filter-${s}`}
              />
            ))}
          </View>
        ) : null}

        {/* Bulk selection only makes sense once a single stage is picked —
            see the note on bulkSteps above. */}
        {filter && bulkSteps.length > 0 && visible.length > 0 ? (
          <View style={styles.selectRow}>
            {selectMode ? (
              <>
                <Pressable
                  onPress={() => (selected.size === visible.length ? setSelected(new Set()) : selectAllVisible())}
                  accessibilityRole="button"
                  accessibilityLabel={selected.size === visible.length ? 'Deselect all' : 'Select all'}
                  style={({ pressed }) => [styles.selectLink, pressed && styles.pressed]}
                >
                  <Text style={styles.selectLinkText}>
                    {selected.size === visible.length ? 'Deselect all' : `Select all ${visible.length}`}
                  </Text>
                </Pressable>
                <Text style={styles.selectedCount}>{selected.size} selected</Text>
                <Pressable
                  onPress={() => { setSelectMode(false); setSelected(new Set()); }}
                  accessibilityRole="button"
                  accessibilityLabel="Cancel selection"
                  style={({ pressed }) => [styles.selectLink, pressed && styles.pressed]}
                >
                  <Text style={styles.selectLinkText}>Cancel</Text>
                </Pressable>
              </>
            ) : (
              <Pressable
                testID="bulk-select-toggle"
                onPress={() => setSelectMode(true)}
                accessibilityRole="button"
                accessibilityLabel="Select multiple applicants"
                style={({ pressed }) => [styles.selectLink, pressed && styles.pressed]}
              >
                <Ionicons name="checkbox-outline" size={16} color={colors.navy} />
                <Text style={styles.selectLinkText}>Select</Text>
              </Pressable>
            )}
          </View>
        ) : null}

        <FlatList
          data={loading ? [] : visible}
          keyExtractor={item => item.id}
          renderItem={({ item }) => (
            <ApplicantRow
              app={item}
              busy={busy === item.id}
              onMove={status => move(item, status)}
              onOpenProfile={() => router.push(`/profile/${item.user_id}` as any)}
              onMessage={() => router.push(`/conversation?userId=${item.user_id}` as any)}
              selectMode={selectMode}
              selected={selected.has(item.id)}
              onToggleSelect={() => toggleSelect(item.id)}
            />
          )}
          contentContainerStyle={[styles.list, selectMode && bulkSteps.length > 0 && styles.listWithBulkBar]}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => { setRefreshing(true); load(); }}
              tintColor={colors.navy}
            />
          }
          ListEmptyComponent={
            loading ? (
              <View style={styles.pad}>
                {[0, 1, 2].map(i => (
                  <View key={i} style={styles.card}>
                    <Skeleton height={40} width={40} radius={20} />
                    <Skeleton height={13} width="55%" />
                    <Skeleton height={11} width="35%" />
                  </View>
                ))}
              </View>
            ) : error ? (
              <ErrorState message={error} onRetry={load} />
            ) : filter ? (
              <EmptyState
                icon="funnel-outline"
                title={`Nobody at ${APPLICATION_STATUS_META[filter].label.toLowerCase()}`}
                hint="Clear the filter to see everyone who applied."
                actionLabel="Show all applicants"
                onAction={() => setFilterAndReset(null)}
              />
            ) : (
              <EmptyState
                icon="people-outline"
                title="No applicants yet"
                hint="Verified professionals who apply to this posting will appear here."
                actionLabel="View the posting"
                onAction={() => router.push(`/jobs/${id}` as any)}
              />
            )
          }
        />

        {selectMode && bulkSteps.length > 0 ? (
          <View style={styles.bulkBar}>
            <Text style={styles.bulkBarCount}>
              {selected.size === 0 ? 'Select applicants to move together' : `${selected.size} selected`}
            </Text>
            <View style={styles.bulkBarActions}>
              {bulkSteps.map(status => (
                <Pressable
                  key={status}
                  testID={`bulk-move-${status}`}
                  onPress={() => bulkMove(status)}
                  disabled={selected.size === 0 || bulkBusy}
                  accessibilityRole="button"
                  accessibilityLabel={`Move ${selected.size} selected to ${APPLICATION_STATUS_META[status].label}`}
                  style={({ pressed }) => [
                    styles.bulkAction,
                    status === 'rejected' && styles.bulkActionQuiet,
                    (selected.size === 0 || bulkBusy || pressed) && styles.pressed,
                  ]}
                >
                  <Text style={[styles.bulkActionText, status === 'rejected' && styles.actionTextQuiet]}>
                    {bulkBusy ? 'Updating…' : `Move to ${APPLICATION_STATUS_META[status].label}`}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>
        ) : null}
      </PageColumn>
    </SafeAreaView>
  );
}

function ApplicantRow({
  app, busy, onMove, onOpenProfile, onMessage, selectMode, selected, onToggleSelect,
}: {
  app: Application;
  busy: boolean;
  onMove: (status: ApplicationStatusKey) => void;
  onOpenProfile: () => void;
  onMessage: () => void;
  selectMode?: boolean;
  selected?: boolean;
  onToggleSelect?: () => void;
}) {
  const meta = APPLICATION_STATUS_META[app.status] ?? APPLICATION_STATUS_META.applied;
  const card = (app as any).applicant ?? {};
  const next = NEXT_STEPS[app.status] ?? [];

  return (
    <View style={styles.card} testID={`applicant-${app.id}`}>
      <Pressable
        onPress={selectMode ? onToggleSelect : onOpenProfile}
        accessibilityRole="button"
        accessibilityLabel={selectMode ? `${selected ? 'Deselect' : 'Select'} ${app.user_name}` : `View the profile of ${app.user_name}`}
        accessibilityState={selectMode ? { selected: !!selected } : undefined}
        style={({ pressed }) => [styles.identity, pressed && styles.pressed]}
      >
        {selectMode ? (
          <Ionicons
            name={selected ? 'checkbox' : 'square-outline'}
            size={22}
            color={selected ? colors.navy : colors.textSecondary}
          />
        ) : null}
        <Avatar name={app.user_name} uri={card.avatar} role={card.role} size={44} />
        <View style={styles.identityText}>
          <View style={styles.nameRow}>
            <Text style={styles.name} numberOfLines={1}>{app.user_name}</Text>
            {card.account_verified ? (
              <Ionicons
                name="checkmark-circle"
                size={14}
                color={colors.teal}
                accessibilityLabel="Verified healthcare professional"
              />
            ) : null}
          </View>
          {card.headline ? (
            <Text style={styles.headline} numberOfLines={1}>{card.headline}</Text>
          ) : null}
          <Text style={styles.meta} numberOfLines={1}>
            {[
              app.specialty || card.specialty,
              card.years_experience ? `${card.years_experience} years` : null,
              card.city || card.location,
            ].filter(Boolean).join(' · ')}
          </Text>
        </View>
      </Pressable>

      {app.cover_note ? (
        <Text style={styles.note} numberOfLines={4}>{app.cover_note}</Text>
      ) : null}

      <View style={styles.statusRow}>
        <JobBadge label={meta.label} icon={meta.icon as any} tone={TONE_FOR_BADGE[meta.tone]} />
        <Text style={styles.applied}>
          {postedAgo(app.created_at).replace('Posted', 'Applied')}
        </Text>
      </View>

      <View style={styles.actions}>
        {next.map(status => (
          <Pressable
            key={status}
            testID={`move-${app.id}-${status}`}
            onPress={() => onMove(status)}
            disabled={busy}
            accessibilityRole="button"
            accessibilityLabel={`Move ${app.user_name} to ${APPLICATION_STATUS_META[status].label}`}
            style={({ pressed }) => [
              styles.action,
              status === 'rejected' && styles.actionQuiet,
              (pressed || busy) && styles.pressed,
            ]}
          >
            <Text
              style={[styles.actionText, status === 'rejected' && styles.actionTextQuiet]}
            >
              {APPLICATION_STATUS_META[status].label}
            </Text>
          </Pressable>
        ))}
        {/* Contact goes through a conversation, never an email address: the
            applicant list is reachable by anyone who can post a job, so
            public_card withholds email and phone by design. */}
        <Pressable
          onPress={onMessage}
          accessibilityRole="button"
          accessibilityLabel={`Message ${app.user_name}`}
          style={({ pressed }) => [styles.action, styles.actionQuiet, pressed && styles.pressed]}
        >
          <Ionicons name="chatbubble-outline" size={14} color={colors.textSecondary} />
          <Text style={styles.actionTextQuiet}>Message</Text>
        </Pressable>
      </View>
    </View>
  );
}

function FilterChip({
  label, selected, onPress, testID,
}: {
  label: string; selected: boolean; onPress: () => void; testID?: string;
}) {
  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      accessibilityRole="tab"
      accessibilityState={{ selected }}
      accessibilityLabel={label}
      style={({ pressed }) => [styles.chip, selected && styles.chipOn, pressed && styles.pressed]}
    >
      <Text style={[styles.chipText, selected && styles.chipTextOn]}>{label}</Text>
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
  headerText: { flex: 1, gap: 2 },
  headerTitle: { ...typography.h3, color: colors.text },
  headerSub: { ...typography.small, color: colors.textSecondary },

  filterRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
  },
  chip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.white,
    minHeight: 34,
    justifyContent: 'center',
  },
  chipOn: { backgroundColor: colors.navy, borderColor: colors.navy },
  chipText: { ...typography.small, color: colors.textSecondary },
  chipTextOn: { color: colors.white, fontFamily: fonts.body.semibold },

  selectRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
  },
  selectLink: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, minHeight: MIN_TOUCH_TARGET, justifyContent: 'center' },
  selectLinkText: { ...typography.small, fontFamily: fonts.body.semibold, color: colors.navy },
  selectedCount: { ...typography.small, color: colors.textSecondary, flex: 1, textAlign: 'center' },

  list: { padding: spacing.lg, paddingBottom: spacing.xxxl * 2, gap: spacing.md },
  listWithBulkBar: { paddingBottom: spacing.xxxl * 3 },

  bulkBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: colors.white,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    padding: spacing.lg,
    gap: spacing.sm,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 12,
  },
  bulkBarCount: { ...typography.small, color: colors.textSecondary, textAlign: 'center' },
  bulkBarActions: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, justifyContent: 'center' },
  bulkAction: {
    minHeight: MIN_TOUCH_TARGET,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.navy,
    backgroundColor: colors.navy,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bulkActionQuiet: { backgroundColor: colors.white, borderColor: colors.border },
  bulkActionText: { ...typography.small, fontFamily: fonts.body.semibold, color: colors.white },
  pad: { gap: spacing.md },
  card: {
    backgroundColor: colors.card,
    borderRadius: radius.xl + 2,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    gap: spacing.md,
  },
  identity: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  identityText: { flex: 1, gap: 2 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  name: { ...typography.bodyStrong, color: colors.text, flexShrink: 1 },
  headline: { ...typography.caption, color: colors.textSecondary },
  meta: { ...typography.small, color: colors.textSecondary },

  note: {
    ...typography.caption,
    color: colors.textSecondary,
    lineHeight: 19,
    paddingLeft: spacing.md,
    borderLeftWidth: 2,
    borderLeftColor: colors.border,
  },

  statusRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, flexWrap: 'wrap' },
  applied: { ...typography.small, color: colors.textSecondary },

  actions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.borderLight,
  },
  action: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    minHeight: 36,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.navy,
    backgroundColor: colors.white,
    justifyContent: 'center',
  },
  actionQuiet: { borderColor: colors.border },
  actionText: { ...typography.small, fontFamily: fonts.body.semibold, color: colors.navy },
  actionTextQuiet: { ...typography.small, color: colors.textSecondary },
  pressed: { opacity: 0.65 },
});
