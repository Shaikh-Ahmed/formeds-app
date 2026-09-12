import React, { useCallback, useEffect, useState } from 'react';
import { Animated, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../context/AuthContext';
import { colors, layout, radius, spacing, typography, useBreakpoint, MIN_TOUCH_TARGET } from '../../theme';
import { API_URL } from '../../utils/api';
import { shareLink } from '../../utils/share';
import { PageGrid } from '../web';
import { Button } from '../Button';
import { ErrorBanner } from '../States';
import { JobsList } from './JobsList';
import { JobDetailPanel } from './JobDetailPanel';
import { JobsSegmentedNav, type JobsSegment } from './JobsSegmentedNav';
import { ApplySheet } from './ApplySheet';
import { applyToJob, createJobAlert, fetchJob, toggleSaveJob } from '../../api/jobs';
import { useCollapsibleHeader } from '../../hooks/useCollapsibleHeader';
import type { Job, JobFilters } from '../../types/jobs';

/** Width of the list pane in the split view. See the arithmetic below. */
const LIST_PANE = 400;

/**
 * Discover, at every width.
 *
 * ## The split view
 *
 * `PageGrid` caps its whole grid at `layout.maxWidth` (1128) with 24px of
 * padding either side, so the centre column is 1080px once both rails are
 * dropped — which gives 400 + 24 + 656. That 656px of prose is close to
 * `layout.contentMax` (612), i.e. a genuinely readable measure rather than a
 * squeezed one.
 *
 * Jobs is the one tab that passes no rails at all. Keeping `ProfileRail` would
 * leave 1128 − 48 − 240 − 24 = 816, splitting to 340 + 24 + 452, and 452px of
 * job description is cramped. The segmented control below takes over the rail's
 * navigational job, and `TopBar` already carries identity.
 *
 * ## Why the split is gated on `isDesktop`, not `!isMobile`
 *
 * At the tablet floor (768) the centre is 720px; splitting that gives a 296px
 * detail pane, which is unusable. Tablet therefore behaves like the phone —
 * full-width list, tap pushes a route.
 *
 * ## The hydration guard
 *
 * `useBreakpoint()` reports `isMobile: true` on the very first render at ANY
 * width, because the web build is statically exported and the server has no
 * window. Without the `mounted` gate, a cold load of /jobs/{id} at 1440px would
 * paint the mobile full-screen detail for one frame and then snap to the split
 * — and any fetch mounted inside the detail pane would fire, unmount and refire.
 * Holding the skeleton for that frame is honest: no data has arrived yet either.
 */
export function JobsScreen({
  selectedId = null,
  segment = 'discover',
}: {
  selectedId?: string | null;
  segment?: JobsSegment;
}) {
  const { token, user } = useAuth();
  const { isDesktop } = useBreakpoint();
  const router = useRouter();

  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  /**
   * The title and segmented control slide away as the list scrolls down and
   * come back on the first scroll up.
   *
   * On a phone the persistent top bar, this heading and the segmented control
   * together cost most of a card before the feed even starts — and the heading
   * is a thing you read once. Disabled on desktop, where the split view has the
   * room and a moving header beside a static detail pane reads as a glitch.
   */
  const { headerHeight, headerStyle, onHeaderLayout, scrollProps } =
    useCollapsibleHeader({ enabled: mounted && !isDesktop });

  const split = mounted && isDesktop;

  // The selected job is fetched HERE, keyed by id — never inside the detail
  // panel. If the panel owned the request, the layout swap on the second frame
  // would remount it and fire the same request twice.
  const [detail, setDetail] = useState<Job | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [applyFor, setApplyFor] = useState<Job | null>(null);
  const [applying, setApplying] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  useEffect(() => {
    if (!selectedId) { setDetail(null); return; }
    let cancelled = false;
    setDetailLoading(true);
    fetchJob(token, selectedId)
      .then(job => { if (!cancelled) setDetail(job); })
      .catch(() => { if (!cancelled) setDetail(null); })
      .finally(() => { if (!cancelled) setDetailLoading(false); });
    return () => { cancelled = true; };
  }, [selectedId, token]);

  /**
   * Desktop replaces rather than pushes: clicking through fifteen roles should
   * not bury the list under fifteen Back presses. On a phone, push is exactly
   * right — the detail is a new place.
   */
  const openJob = useCallback((job: Job) => {
    const href = `/jobs/${job.id}` as any;
    if (split) router.replace(href);
    else router.push(href);
  }, [split, router]);

  const onToggleSave = useCallback(async () => {
    if (!token || !detail) return;
    const next = !detail.saved;
    setDetail({ ...detail, saved: next });
    try {
      const res = await toggleSaveJob(token, detail.id);
      setDetail(prev => (prev ? { ...prev, saved: res.saved } : prev));
    } catch {
      setDetail(prev => (prev ? { ...prev, saved: !next } : prev));
    }
  }, [token, detail]);

  const onShare = useCallback(() => {
    if (!detail) return;
    shareLink({
      url: `${API_URL.replace(/\/$/, '')}/jobs/${detail.id}`,
      title: detail.title,
      message: `${detail.title} at ${detail.employer_name}`,
    });
  }, [detail]);

  const submitApplication = useCallback(async (note: string) => {
    if (!token || !applyFor) return;
    setApplying(true);
    setActionError(null);
    try {
      await applyToJob(token, applyFor.id, note);
      setApplyFor(null);
      setDetail(prev => (prev && prev.id === applyFor.id ? { ...prev, has_applied: true } : prev));
    } catch (e: any) {
      setActionError(e?.message || 'Could not submit your application.');
    } finally {
      setApplying(false);
    }
  }, [token, applyFor]);

  /**
   * Turns the filters that just returned nothing into a saved search, so the
   * dead end becomes "we will tell you" rather than "try again later".
   */
  const saveSearch = useCallback(async (filters: JobFilters) => {
    if (!token) return;
    setActionError(null);
    try {
      await createJobAlert(token, filters.specialty || filters.q || 'Saved search', filters);
      router.push('/jobs/saved' as any);
    } catch (e: any) {
      setActionError(e?.message || 'Could not save that search.');
    }
  }, [token, router]);

  const list = (
    <JobsList
      selectedId={split ? selectedId : null}
      onSelect={openJob}
      compact={split}
      emptyAction={
        user?.role
          ? { label: 'Post an opportunity', onPress: () => router.push('/jobs/posted' as any) }
          : undefined
      }
    />
  );

  return (
    <View style={styles.flex}>
      <PageGrid fluid testID="jobs-grid">
        {split ? (
          <>
            <View style={styles.header}>
              <Text style={styles.h1} accessibilityRole="header">
                Find your next healthcare opportunity
              </Text>
              <Text style={styles.sub}>
                Roles, locum shifts, fellowships and training posts, matched to your expertise.
              </Text>
            </View>
            <JobsSegmentedNav active={segment} />
          </>
        ) : null}
        <ErrorBanner message={actionError} />

        {!mounted ? (
          <View style={styles.flex} testID="jobs-hydrating" />
        ) : split ? (
          <View style={styles.split}>
            <View style={styles.listPane} testID="jobs-list-pane">{list}</View>
            <View style={styles.detailPane} testID="jobs-detail-pane">
              <JobDetailPanel
                job={detail}
                loading={detailLoading}
                embedded
                onApply={() => setApplyFor(detail)}
                onToggleSave={onToggleSave}
                onShare={onShare}
                onViewOrganization={orgId => router.push(`/org/${orgId}` as any)}
              />
            </View>
          </View>
        ) : (
          <View style={styles.scrollHost}>
            <Animated.View
              style={[styles.floatingHeader, headerStyle]}
              onLayout={onHeaderLayout}
            >
              <View style={styles.header}>
                <Text style={styles.h1} accessibilityRole="header">
                  Find your next healthcare opportunity
                </Text>
                <Text style={styles.sub}>
                  Roles, locum shifts, fellowships and training posts, matched to your expertise.
                </Text>
              </View>
              <JobsSegmentedNav active={segment} />
            </Animated.View>
            <JobsList
              onSelect={openJob}
              scrollProps={scrollProps}
              contentInsetTop={headerHeight}
              onSaveSearch={saveSearch}
              emptyAction={
                user?.role
                  ? { label: 'Post an opportunity', onPress: () => router.push('/jobs/new' as any) }
                  : undefined
              }
            />
          </View>
        )}
      </PageGrid>

      <ApplySheet
        visible={!!applyFor}
        job={applyFor}
        onClose={() => setApplyFor(null)}
        onSubmit={submitApplication}
        submitting={applying}
        error={actionError}
      />
    </View>
  );
}

/** The pinned action bar the phone detail route uses. Exported for that route. */
export function JobActionBar({
  job, onApply, onToggleSave, onShare, bottomInset,
}: {
  job: Job;
  onApply: () => void;
  onToggleSave: () => void;
  onShare: () => void;
  bottomInset: number;
}) {
  const closed = job.status !== 'active';
  return (
    <View style={[styles.actionBar, { paddingBottom: bottomInset + spacing.md }]}>
      <Pressable
        onPress={onToggleSave}
        accessibilityRole="button"
        accessibilityLabel={job.saved ? 'Remove from saved' : 'Save this role'}
        accessibilityState={{ selected: job.saved }}
        style={({ pressed }) => [styles.barIcon, pressed && styles.pressed]}
        testID="job-save"
      >
        <Ionicons
          name={job.saved ? 'bookmark' : 'bookmark-outline'}
          size={22}
          color={job.saved ? colors.navy : colors.textSecondary}
        />
      </Pressable>
      <Pressable
        onPress={onShare}
        accessibilityRole="button"
        accessibilityLabel="Share this role"
        style={({ pressed }) => [styles.barIcon, pressed && styles.pressed]}
        testID="job-share"
      >
        <Ionicons name="share-social-outline" size={22} color={colors.textSecondary} />
      </Pressable>
      <Button
        label={job.has_applied ? 'Applied' : closed ? 'Closed' : 'Apply now'}
        onPress={onApply}
        disabled={job.has_applied || closed}
        style={styles.barApply}
        testID="job-apply"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },

  header: { paddingTop: spacing.xl, paddingHorizontal: spacing.lg, gap: spacing.xs },
  h1: { ...typography.h2, color: colors.text },
  sub: { ...typography.caption, color: colors.textSecondary, lineHeight: 20 },

  // overflow hidden is what lets the header slide out of view rather than
  // over the tab bar; the list scrolls underneath it.
  scrollHost: { flex: 1, overflow: 'hidden' },
  floatingHeader: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 2,
    backgroundColor: colors.bg,
  },
  split: { flex: 1, flexDirection: 'row', gap: layout.gutter, minHeight: 0 },
  // flexShrink 0: the list must hold its width so the card layout inside it
  // stays stable while the detail pane absorbs the remaining space.
  listPane: { width: LIST_PANE, flexGrow: 0, flexShrink: 0 },
  detailPane: {
    flex: 1,
    minWidth: 0,
    backgroundColor: colors.white,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.xxl,
    overflow: 'hidden',
  },

  actionBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    backgroundColor: colors.white,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    ...Platform.select({
      web: { boxShadow: '0 -4px 20px rgba(0,0,0,0.05)' } as any,
      default: {
        shadowColor: colors.text,
        shadowOpacity: 0.06,
        shadowRadius: 12,
        shadowOffset: { width: 0, height: -4 },
        elevation: 8,
      },
    }),
  },
  barIcon: {
    width: MIN_TOUCH_TARGET,
    height: MIN_TOUCH_TARGET,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  barApply: { flex: 1 },
  pressed: { opacity: 0.7 },
});
