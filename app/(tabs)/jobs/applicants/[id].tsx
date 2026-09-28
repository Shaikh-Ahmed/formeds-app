import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useAuth } from '../../../../src/context/AuthContext';
import { colors, fonts, radius, spacing, typography, useBreakpoint, MIN_TOUCH_TARGET } from '../../../../src/theme';
import { Button, ErrorBanner, ErrorState, LoadingState, SelectField, Sheet } from '../../../../src/components';
import { ChoiceChips } from '../../../../src/components/locum/ChoiceChips';
import { JobBadge } from '../../../../src/components/jobs/JobMeta';
import { ApplicantList, SORT_LABELS } from '../../../../src/components/jobs/applicants/ApplicantList';
import { ApplicantDetailPanel } from '../../../../src/components/jobs/applicants/ApplicantDetail';
import { InterviewSheet } from '../../../../src/components/jobs/applicants/InterviewSheet';
import { openFileUrl } from '../../../../src/components/jobs/ResumeCard';
import { fetchJob, setApplicationStatus } from '../../../../src/api/jobs';
import {
  bulkSetStatus, fetchApplicantDetail, fetchApplicantResume, scheduleInterview, searchApplicants,
} from '../../../../src/api/applicants';
import { EMPLOYMENT_TYPE_LABELS, APPLICATION_STATUS_META, type ApplicationStatusKey, type Job } from '../../../../src/types/jobs';
import type { ApplicantDetail, ApplicantPage, ApplicantSort } from '../../../../src/types/applicants';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const day = (iso?: string | null) => {
  if (!iso) return '';
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '' : `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
};
const JOB_STATUS_TONE = { active: 'teal', draft: 'neutral', paused: 'warning', closed: 'neutral', filled: 'navy', expired: 'neutral' } as const;
const EMPLOYER_MOVES: ApplicationStatusKey[] = ['reviewing', 'shortlisted', 'interviewing', 'offered', 'hired', 'rejected'];

interface Filters { verified?: boolean; city?: string; exp_min?: number; has_resume?: boolean; screening?: 'meets' | 'unmet' }

/**
 * The applicant workspace for one posting.
 *
 * Wide screens: the job at the top, the applicant list on the left and the
 * selected applicant on the right, so an employer can work through a pool
 * without leaving the page. Phones: the list, then one applicant, then back.
 *
 * The list is searched, filtered, sorted and paged on the server; one
 * applicant's detail (profile, screening answers, resume, timeline) loads
 * only when they are opened. Every action goes through the server's rules --
 * this screen only shows what those rules allow.
 */
export default function ApplicantWorkspace() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { token, user } = useAuth();
  const router = useRouter();
  const { width, isMobile } = useBreakpoint();
  const split = !isMobile && width >= 900;

  const [job, setJob] = useState<Job | null>(null);
  const [jobError, setJobError] = useState<string | null>(null);

  const [query, setQuery] = useState('');
  const [debounced, setDebounced] = useState('');
  const [status, setStatus] = useState<ApplicationStatusKey | 'all'>('all');
  const [sort, setSort] = useState<ApplicantSort>('newest');
  const [filters, setFilters] = useState<Filters>({});
  const [pageData, setPageData] = useState<ApplicantPage | null>(null);
  const [listLoading, setListLoading] = useState(true);
  const [listError, setListError] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<ApplicantDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [checked, setChecked] = useState<string[]>([]);

  const [sheet, setSheet] = useState<null | 'filters' | 'sort' | 'status' | 'bulk' | 'more' | 'interview'>(null);
  const [confirmReject, setConfirmReject] = useState<null | { ids: string[] }>(null);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [draftFilters, setDraftFilters] = useState<Filters>({});

  // ── Loading ──────────────────────────────────────────────────────────────
  useEffect(() => { const t = setTimeout(() => setDebounced(query.trim()), 300); return () => clearTimeout(t); }, [query]);
  useEffect(() => { if (toast) { const t = setTimeout(() => setToast(null), 3000); return () => clearTimeout(t); } }, [toast]);

  const loadJob = useCallback(async () => {
    if (!token || !id) return;
    try { setJob(await fetchJob(token, id)); setJobError(null); } catch (e: any) {
      setJobError(e?.status === 403 ? 'You can only manage applicants for your own postings.' : 'Unable to load this posting.');
    }
  }, [token, id]);

  const reqSeq = useRef(0);
  const loadList = useCallback(async (pageNo = 1) => {
    if (!token || !id) return;
    const seq = ++reqSeq.current;
    if (pageNo === 1) setListLoading(true); else setLoadingMore(true);
    try {
      const res = await searchApplicants(token, id, {
        q: debounced, status: status === 'all' ? undefined : status, sort, page: pageNo, limit: 25, ...filters,
      });
      if (seq !== reqSeq.current) return; // a newer search has started
      setPageData(prev => (pageNo > 1 && prev ? { ...res, items: [...prev.items, ...res.items] } : res));
      setListError(null);
    } catch (e: any) {
      if (seq === reqSeq.current) setListError(e?.message || 'Unable to load applicants.');
    } finally {
      if (seq === reqSeq.current) { setListLoading(false); setLoadingMore(false); }
    }
  }, [token, id, debounced, status, sort, filters]);

  useFocusEffect(useCallback(() => { loadJob(); }, [loadJob]));
  useEffect(() => { loadList(1); }, [loadList]);

  // A wide screen always has someone open: the first applicant, until chosen.
  useEffect(() => {
    if (split && !selectedId && pageData?.items.length) setSelectedId(pageData.items[0].id);
  }, [split, selectedId, pageData]);

  const loadDetail = useCallback(async (appId: string) => {
    if (!token) return;
    setDetailLoading(true); setDetailError(null);
    try { setDetail(await fetchApplicantDetail(token, appId)); } catch (e: any) {
      setDetail(null); setDetailError(e?.message || 'Unable to load this applicant.');
    } finally { setDetailLoading(false); }
  }, [token]);

  useEffect(() => { if (selectedId) { setDetail(null); loadDetail(selectedId); } }, [selectedId, loadDetail]);

  const refresh = useCallback(async () => {
    await Promise.all([loadList(1), selectedId ? loadDetail(selectedId) : Promise.resolve()]);
  }, [loadList, loadDetail, selectedId]);

  // ── Actions ──────────────────────────────────────────────────────────────
  const move = useCallback(async (next: ApplicationStatusKey) => {
    if (!token || !detail) return;
    if (next === 'rejected') { setConfirmReject({ ids: [detail.application.id] }); return; }
    setBusy(true); setActionError(null); setSheet(null);
    try {
      await setApplicationStatus(token, detail.application.id, next);
      setToast(`Moved to ${APPLICATION_STATUS_META[next].label}`);
      await refresh();
    } catch (e: any) {
      setActionError(e?.status === 409 ? e.message : `Unable to update application status. Your changes were not saved.${e?.message ? ` (${e.message})` : ''}`);
    } finally { setBusy(false); }
  }, [token, detail, refresh]);

  const reject = async () => {
    if (!token || !confirmReject) return;
    const ids = confirmReject.ids;
    setBusy(true); setActionError(null);
    try {
      if (ids.length === 1 && detail?.application.id === ids[0]) await setApplicationStatus(token, ids[0], 'rejected');
      else {
        const res = await bulkSetStatus(token, id!, ids, 'rejected');
        setToast(`${res.moved.length} marked not selected${res.skipped.length ? `, ${res.skipped.length} skipped` : ''}`);
      }
      setConfirmReject(null); setChecked([]);
      await refresh();
    } catch {
      setActionError('Unable to update application status. Your changes were not saved.');
    } finally { setBusy(false); }
  };

  const bulk = async (next: ApplicationStatusKey) => {
    if (!token || !id || !checked.length) return;
    if (next === 'rejected') { setSheet(null); setConfirmReject({ ids: checked }); return; }
    setBusy(true); setSheet(null); setActionError(null);
    try {
      const res = await bulkSetStatus(token, id, checked, next);
      setToast(`${res.moved.length} moved to ${APPLICATION_STATUS_META[next].label}${res.skipped.length ? `, ${res.skipped.length} skipped` : ''}`);
      setChecked([]);
      await refresh();
    } catch {
      setActionError('Unable to update application status. Your changes were not saved.');
    } finally { setBusy(false); }
  };

  const saveInterview = async (v: Parameters<typeof scheduleInterview>[2]) => {
    if (!token || !detail) return;
    setBusy(true); setActionError(null);
    try {
      await scheduleInterview(token, detail.application.id, v);
      setSheet(null); setToast('Interview scheduled. The applicant has been told.');
      await refresh();
    } catch (e: any) {
      setActionError(e?.message || 'Unable to schedule the interview.');
    } finally { setBusy(false); }
  };

  const openResume = async (download: boolean) => {
    if (!token || !detail) return;
    setSheet(null);
    try {
      const res = await fetchApplicantResume(token, detail.application.id);
      openFileUrl(download && res.url.includes('token=') ? `${res.url}&download=${encodeURIComponent(res.name)}` : res.url);
    } catch { setActionError('Unable to load this resume. Please try again.'); }
  };

  const filterCount = Object.values(filters).filter(v => v !== undefined && v !== '' && v !== 0).length;
  const counts = pageData?.counts;

  // ── Render ───────────────────────────────────────────────────────────────
  if (jobError && !job) return <ErrorState message={jobError} onRetry={loadJob} />;
  if (!job) return <LoadingState />;

  const header = (
    <View style={styles.header}>
      <Pressable onPress={() => (router.canGoBack() ? router.back()
        : router.replace((user?.role === 'recruiter' ? '/recruiter/jobs' : '/jobs/posted') as any))}
        accessibilityRole="button" accessibilityLabel="Back to your postings" hitSlop={8} style={styles.back}>
        <Ionicons name="arrow-back" size={22} color={colors.navy} />
      </Pressable>
      <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
        <View style={styles.titleRow}>
          <Text style={styles.title} numberOfLines={2} accessibilityRole="header">{job.title}</Text>
          <JobBadge label={job.status.charAt(0).toUpperCase() + job.status.slice(1)} tone={JOB_STATUS_TONE[job.status] ?? 'neutral'} />
        </View>
        <Text style={styles.sub} numberOfLines={2}>
          {[job.employer_name, job.location, EMPLOYMENT_TYPE_LABELS[job.employment_type],
            job.published_at || job.created_at ? `Posted ${day(job.published_at || job.created_at)}` : null,
            job.expires_at ? `Closes ${day(job.expires_at)}` : null].filter(Boolean).join(' · ')}
        </Text>
      </View>
      {!isMobile ? (
        <View style={styles.kpis}>
          <Kpi label="Applicants" value={pageData?.all_total ?? job.applicant_count ?? 0} />
          <Kpi label="Shortlisted" value={counts?.shortlisted ?? 0} />
          <Kpi label="Interviewing" value={counts?.interviewing ?? 0} />
          <Kpi label="Hired" value={counts?.hired ?? 0} />
        </View>
      ) : null}
      <Pressable onPress={() => router.push(`/jobs/edit/${job.id}` as any)} accessibilityRole="button"
        style={({ hovered }: any) => [styles.manage, hovered && { backgroundColor: colors.bgMuted }]} testID="workspace-edit-job">
        <Ionicons name="create-outline" size={16} color={colors.navy} />
        {!isMobile ? <Text style={styles.manageText}>Edit job</Text> : null}
      </Pressable>
    </View>
  );

  const list = (
    <ApplicantList
      page={pageData} loading={listLoading} error={listError} onRetry={() => loadList(1)}
      query={query} onQuery={setQuery} status={status} onStatus={s => { setStatus(s); setChecked([]); }}
      sort={sort} onSort={() => setSheet('sort')}
      onOpenFilters={() => { setDraftFilters(filters); setSheet('filters'); }} filterCount={filterCount}
      selectedId={selectedId} onSelect={setSelectedId}
      checked={checked} onToggle={a => setChecked(prev => (prev.includes(a) ? prev.filter(x => x !== a) : [...prev, a]))}
      onLoadMore={() => pageData && loadList(pageData.page + 1)} loadingMore={loadingMore}
    />
  );

  const detailPane = (
    <ApplicantDetailPanel
      detail={detail} loading={detailLoading} error={detailError} onRetry={() => selectedId && loadDetail(selectedId)}
      onBack={split ? undefined : () => { setSelectedId(null); setDetail(null); }}
      onMessage={() => detail && router.push(`/conversation?userId=${detail.applicant.id}` as any)}
      onMove={s => ((s as string) === '__menu' ? setSheet('status') : move(s))}
      onInterview={() => setSheet('interview')}
      onMore={() => setSheet('more')}
      busy={busy}
    />
  );

  const bulkBar = checked.length ? (
    <View style={styles.bulk} testID="bulk-bar">
      <Text style={styles.bulkText}>{checked.length} selected</Text>
      <View style={styles.bulkActions}>
        <BulkBtn label="Shortlist" onPress={() => bulk('shortlisted')} testID="bulk-shortlist" />
        <BulkBtn label="Change status" onPress={() => setSheet('bulk')} testID="bulk-status" />
        <BulkBtn label="Not selected" danger onPress={() => bulk('rejected')} testID="bulk-reject" />
        <Pressable onPress={() => setChecked([])} accessibilityRole="button" accessibilityLabel="Clear selection" hitSlop={8}>
          <Ionicons name="close" size={20} color={colors.white} />
        </Pressable>
      </View>
    </View>
  ) : null;

  return (
    <SafeAreaView style={styles.safe} edges={['top']} testID="applicant-workspace">
      {header}
      <ErrorBanner message={actionError} />
      {toast ? <View style={styles.toast} accessibilityLiveRegion="polite"><Text style={styles.toastText}>{toast}</Text></View> : null}
      {split ? (
        <View style={styles.split}>
          <View style={styles.listPane}>{list}{bulkBar}</View>
          <View style={styles.detailPane}>
            {selectedId ? detailPane : (
              <View style={styles.pick}><Ionicons name="person-outline" size={28} color={colors.textMuted} />
                <Text style={styles.sub}>Select an applicant to see their details.</Text></View>
            )}
          </View>
        </View>
      ) : selectedId ? (
        <View style={styles.flex}>{detailPane}</View>
      ) : (
        <View style={styles.flex}>{list}{bulkBar}</View>
      )}

      {/* Sort */}
      <Sheet visible={sheet === 'sort'} onClose={() => setSheet(null)} title="Sort applicants">
        <View style={styles.sheetBody}>
          {(Object.keys(SORT_LABELS) as ApplicantSort[]).map(s => (
            <MenuRow key={s} label={SORT_LABELS[s]} selected={sort === s} onPress={() => { setSort(s); setSheet(null); }}
              testID={`sort-${s}`} />
          ))}
        </View>
      </Sheet>

      {/* Filters: only what the data actually has. */}
      <Sheet visible={sheet === 'filters'} onClose={() => setSheet(null)} title="Filter applicants" testID="filter-sheet"
        footer={(
          <View style={styles.row}>
            <Button label="Clear" variant="outline" style={styles.flex} onPress={() => setDraftFilters({})} />
            <Button label="Show applicants" style={styles.flex} testID="filters-apply"
              onPress={() => { setFilters(draftFilters); setSheet(null); }} />
          </View>
        )}>
        <View style={styles.sheetBody}>
          <ChoiceChips label="Verification" allowDeselect value={draftFilters.verified === undefined ? '' : draftFilters.verified ? 'yes' : 'no'}
            onChange={v => setDraftFilters(f => ({ ...f, verified: v ? v === 'yes' : undefined }))}
            choices={[{ value: 'yes', label: 'Verified' }, { value: 'no', label: 'Not verified' }]} testID="filter-verified" />
          <SelectField label="City" value={draftFilters.city || ''} options={['', ...(pageData?.cities ?? [])]}
            placeholder="Any city" onChange={v => setDraftFilters(f => ({ ...f, city: v || undefined }))} testID="filter-city" />
          <ChoiceChips label="Experience" allowDeselect value={draftFilters.exp_min ? String(draftFilters.exp_min) : ''}
            onChange={v => setDraftFilters(f => ({ ...f, exp_min: v ? Number(v) : undefined }))}
            choices={[{ value: '1', label: '1+ yrs' }, { value: '3', label: '3+ yrs' }, { value: '5', label: '5+ yrs' },
              { value: '10', label: '10+ yrs' }]} testID="filter-exp" />
          <ChoiceChips label="Resume" allowDeselect value={draftFilters.has_resume === undefined ? '' : draftFilters.has_resume ? 'yes' : 'no'}
            onChange={v => setDraftFilters(f => ({ ...f, has_resume: v ? v === 'yes' : undefined }))}
            choices={[{ value: 'yes', label: 'Has a resume' }, { value: 'no', label: 'No resume' }]} testID="filter-resume" />
          {pageData?.has_screening ? (
            <ChoiceChips label="Screening" allowDeselect value={draftFilters.screening || ''}
              onChange={v => setDraftFilters(f => ({ ...f, screening: (v || undefined) as Filters['screening'] }))}
              choices={[{ value: 'meets', label: 'Meets preferences' }, { value: 'unmet', label: 'Some not met' }]}
              testID="filter-screening" />
          ) : null}
        </View>
      </Sheet>

      {/* Change status: only the moves the server allows from here. */}
      <Sheet visible={sheet === 'status'} onClose={() => setSheet(null)} title="Move to">
        <View style={styles.sheetBody}>
          {(detail?.application.allowed_moves ?? []).map(s => (
            <MenuRow key={s} label={APPLICATION_STATUS_META[s].label} icon={APPLICATION_STATUS_META[s].icon as any}
              danger={s === 'rejected'} onPress={() => move(s)} testID={`move-${s}`} />
          ))}
        </View>
      </Sheet>

      <Sheet visible={sheet === 'bulk'} onClose={() => setSheet(null)} title={`Move ${checked.length} applicants to`}>
        <View style={styles.sheetBody}>
          <Text style={styles.sub}>Applicants who cannot make this move (a hire, a withdrawal) are skipped and reported.</Text>
          {EMPLOYER_MOVES.map(s => (
            <MenuRow key={s} label={APPLICATION_STATUS_META[s].label} icon={APPLICATION_STATUS_META[s].icon as any}
              danger={s === 'rejected'} onPress={() => bulk(s)} testID={`bulk-move-${s}`} />
          ))}
        </View>
      </Sheet>

      <Sheet visible={sheet === 'more'} onClose={() => setSheet(null)} title="More">
        <View style={styles.sheetBody}>
          <MenuRow label="View full ForMeds profile" icon="person-circle-outline"
            onPress={() => { setSheet(null); if (detail) router.push(`/profile/${detail.applicant.id}` as any); }} />
          {detail?.resume.available ? (
            <>
              <MenuRow label="Open resume in a new tab" icon="open-outline" onPress={() => openResume(false)} />
              <MenuRow label="Download resume" icon="download-outline" onPress={() => openResume(true)} />
            </>
          ) : null}
        </View>
      </Sheet>

      <InterviewSheet visible={sheet === 'interview'} name={detail?.applicant.name ?? ''} current={detail?.application.interview ?? null}
        onClose={() => setSheet(null)} onSave={saveInterview} saving={busy} error={sheet === 'interview' ? actionError : null} />

      <Sheet visible={!!confirmReject} onClose={() => setConfirmReject(null)}
        title={confirmReject && confirmReject.ids.length > 1 ? `Mark ${confirmReject.ids.length} applicants as not selected?` : 'Mark as not selected?'}
        footer={(
          <View style={styles.row}>
            <Button label="Cancel" variant="outline" style={styles.flex} onPress={() => setConfirmReject(null)} />
            <Button label="Not selected" variant="danger" style={styles.flex} onPress={reject} loading={busy}
              testID="confirm-reject" />
          </View>
        )}>
        <View style={styles.sheetBody}>
          <Text style={styles.body}>They will be told their application was not taken forward. You can reconsider later from their profile.</Text>
        </View>
      </Sheet>
    </SafeAreaView>
  );
}

function Kpi({ label, value }: { label: string; value: number }) {
  return (
    <View style={styles.kpi} accessible accessibilityLabel={`${label}: ${value}`}>
      <Text style={styles.kpiValue}>{value}</Text>
      <Text style={styles.kpiLabel}>{label}</Text>
    </View>
  );
}

function MenuRow({ label, icon, selected, danger, onPress, testID }: {
  label: string; icon?: keyof typeof Ionicons.glyphMap; selected?: boolean; danger?: boolean; onPress: () => void; testID?: string;
}) {
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityState={{ selected }} testID={testID}
      style={({ pressed, hovered }: any) => [styles.menuRow, (hovered || pressed) && { backgroundColor: colors.bgMuted }]}>
      {icon ? <Ionicons name={icon} size={20} color={danger ? colors.redText : colors.navy} /> : null}
      <Text style={[styles.menuText, danger && { color: colors.redText }]}>{label}</Text>
      {selected ? <Ionicons name="checkmark" size={20} color={colors.navy} /> : null}
    </Pressable>
  );
}

function BulkBtn({ label, onPress, danger, testID }: { label: string; onPress: () => void; danger?: boolean; testID?: string }) {
  return (
    <Pressable onPress={onPress} accessibilityRole="button" testID={testID}
      style={({ pressed }) => [styles.bulkBtn, danger && styles.bulkBtnDanger, pressed && { opacity: 0.8 }]}>
      <Text style={styles.bulkBtnText}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  flex: { flex: 1 },
  row: { flexDirection: 'row', gap: spacing.sm },
  header: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingHorizontal: spacing.lg, paddingVertical: spacing.md,
    backgroundColor: colors.white, borderBottomWidth: 1, borderBottomColor: colors.border, flexWrap: 'wrap',
  },
  back: { width: MIN_TOUCH_TARGET, height: MIN_TOUCH_TARGET, alignItems: 'flex-start', justifyContent: 'center' },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, flexWrap: 'wrap' },
  title: { ...typography.h2, color: colors.text, flexShrink: 1 },
  sub: { ...typography.caption, color: colors.textSecondary },
  body: { ...typography.body, color: colors.text },
  kpis: { flexDirection: 'row', gap: spacing.lg },
  kpi: { alignItems: 'center', minWidth: 64 },
  kpiValue: { fontSize: 22, lineHeight: 26, fontFamily: fonts.heading.bold, color: colors.text },
  kpiLabel: { ...typography.small, color: colors.textSecondary },
  manage: {
    flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 40, paddingHorizontal: spacing.md,
    borderRadius: radius.pill, borderWidth: 1, borderColor: colors.border,
  },
  manageText: { ...typography.label, color: colors.navy },
  split: { flex: 1, flexDirection: 'row' },
  listPane: { width: 380, borderRightWidth: 1, borderRightColor: colors.border, backgroundColor: colors.white },
  detailPane: { flex: 1, minWidth: 0 },
  pick: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.sm },
  bulk: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm, flexWrap: 'wrap',
    padding: spacing.md, backgroundColor: colors.navy,
  },
  bulkText: { ...typography.label, color: colors.white },
  bulkActions: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, flexWrap: 'wrap' },
  bulkBtn: { minHeight: 36, paddingHorizontal: spacing.md, borderRadius: radius.pill, backgroundColor: colors.navyLight, justifyContent: 'center' },
  bulkBtnDanger: { backgroundColor: colors.redText },
  bulkBtnText: { ...typography.label, color: colors.white },
  toast: {
    position: 'absolute', bottom: spacing.xl, alignSelf: 'center', zIndex: 10, backgroundColor: colors.text,
    paddingHorizontal: spacing.lg, paddingVertical: spacing.md, borderRadius: radius.pill,
  },
  toastText: { ...typography.label, color: colors.white },
  sheetBody: { padding: spacing.lg, gap: spacing.xs },
  menuRow: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.md, minHeight: 48, paddingHorizontal: spacing.md,
    borderRadius: radius.md,
  },
  menuText: { ...typography.body, color: colors.text, flex: 1 },
});
