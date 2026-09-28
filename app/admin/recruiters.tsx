import React, { useCallback, useState } from 'react';
import { Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../src/context/AuthContext';
import { Button, EmptyState, ErrorBanner, FormInput, LoadingState, Sheet } from '../../src/components';
import { ChoiceChips } from '../../src/components/locum/ChoiceChips';
import { colors, radius, spacing, typography } from '../../src/theme';
import {
  Card, Notice, RecruiterScreen, RecruiterStatusPill, formatDate, recruiterStyles,
} from '../../src/components/recruiters/RecruiterUI';
import {
  adminListRecruiters, adminRecruiterAction, adminRecruiterDetail, adminRecruiterDocument,
} from '../../src/api/recruiters';
import {
  DOC_LABELS, STATUS_META,
  type AdminAction, type AdminRecruiterDetail, type AdminRecruiterRow, type RecruiterStatus,
} from '../../src/types/recruiters';

const FILTERS: { value: RecruiterStatus | 'ALL'; label: string }[] = [
  { value: 'UNDER_REVIEW', label: 'Under review' }, { value: 'NEEDS_INFORMATION', label: 'Needs info' },
  { value: 'APPROVED', label: 'Approved' }, { value: 'SUSPENDED', label: 'Suspended' },
  { value: 'REJECTED', label: 'Rejected' }, { value: 'PENDING', label: 'Not submitted' }, { value: 'ALL', label: 'All' },
];
const ACTIONS: Record<AdminAction, { label: string; variant: 'primary' | 'outline' | 'danger' | 'secondary'; needsReason: boolean }> = {
  approve: { label: 'Approve', variant: 'secondary', needsReason: false },
  request_info: { label: 'Request information', variant: 'outline', needsReason: true },
  reject: { label: 'Reject', variant: 'danger', needsReason: true },
  suspend: { label: 'Suspend', variant: 'danger', needsReason: true },
  reactivate: { label: 'Reactivate', variant: 'secondary', needsReason: false },
};
const DETAIL_FIELDS: [keyof AdminRecruiterDetail, string][] = [
  ['legal_name', 'Legal name'], ['business_type', 'Business type'], ['registration_number', 'Registration / CIN'],
  ['gstin', 'GSTIN'], ['pan', 'PAN'], ['website', 'Website'], ['address', 'Address'], ['city', 'City'],
  ['state', 'State'], ['pincode', 'PIN'], ['rep_name', 'Representative'], ['rep_designation', 'Designation'],
  ['rep_phone', 'Rep. phone'], ['rep_email', 'Rep. email'],
];

/** Admin: review recruiter accounts, with every decision audited server-side. */
export default function AdminRecruitersScreen() {
  const { token, user } = useAuth();
  const [filter, setFilter] = useState<RecruiterStatus | 'ALL'>('UNDER_REVIEW');
  const [rows, setRows] = useState<AdminRecruiterRow[] | null>(null);
  const [detail, setDetail] = useState<AdminRecruiterDetail | null>(null);
  const [pending, setPending] = useState<AdminAction | null>(null);
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    if (!token) return;
    try {
      setRows(await adminListRecruiters(token, filter === 'ALL' ? undefined : filter));
      setError(null);
    } catch (e: any) { setError(e?.message); setRows([]); }
  }, [token, filter]);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  if (!user?.is_admin) {
    return <RecruiterScreen title="Recruiter review"><Notice tone="danger" title="Admins only" /></RecruiterScreen>;
  }

  const openDetail = async (id: string) => {
    if (!token) return;
    setPending(null); setReason(''); setError(null);
    try { setDetail(await adminRecruiterDetail(token, id)); } catch (e: any) { setError(e?.message); }
  };
  const run = async (action: AdminAction) => {
    if (!token || !detail) return;
    if (ACTIONS[action].needsReason && !reason.trim()) { setPending(action); setError('Add a reason — the recruiter will see it.'); return; }
    setBusy(true); setError(null);
    try {
      setDetail(await adminRecruiterAction(token, detail.user_id, action, reason.trim()));
      setPending(null); setReason('');
      load();
    } catch (e: any) { setError(e?.message || 'Action failed.'); } finally { setBusy(false); }
  };
  const openDoc = async (docId: string) => {
    if (!token || !detail) return;
    try { const { url } = await adminRecruiterDocument(token, detail.user_id, docId); Linking.openURL(url); } catch (e: any) {
      setError(e?.message);
    }
  };

  return (
    <RecruiterScreen title="Recruiter review" testID="admin-recruiters">
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <ChoiceChips value={filter} onChange={v => v && setFilter(v)} choices={FILTERS} testID="admin-recruiter-filter" />
      </ScrollView>
      {!detail ? <ErrorBanner message={error} /> : null}
      {!rows ? <LoadingState /> : rows.length === 0 ? (
        <EmptyState icon="checkmark-done-outline" title="Nothing here" hint="No recruiters with this status." />
      ) : rows.map(r => (
        <Pressable key={r.user_id} onPress={() => openDetail(r.user_id)} accessibilityRole="button"
          accessibilityLabel={`Review ${r.company_name}`} testID={`admin-recruiter-${r.user_id}`}
          style={({ pressed }) => [styles.row, pressed && { opacity: 0.85 }]}>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={recruiterStyles.strong} numberOfLines={1}>{r.company_name}</Text>
            <Text style={recruiterStyles.muted} numberOfLines={1}>{r.name} · {r.email}</Text>
            <Text style={recruiterStyles.muted}>
              {r.city ? `${r.city} · ` : ''}{r.submitted_at ? `submitted ${formatDate(r.submitted_at)}` : 'not submitted'}
            </Text>
          </View>
          <RecruiterStatusPill status={r.status} testID={`admin-status-${r.user_id}`} />
          <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
        </Pressable>
      ))}

      <Sheet visible={!!detail} onClose={() => setDetail(null)} title={detail?.company_name ?? ''} maxWidth={640}
        footer={detail && detail.actions.length ? (
          <View style={styles.actions}>
            {detail.actions.map(a => (
              <Button key={a} label={ACTIONS[a].label} variant={ACTIONS[a].variant} loading={busy && pending === a}
                onPress={() => { setPending(a); if (!ACTIONS[a].needsReason || reason.trim()) run(a); }}
                style={styles.actionBtn} testID={`admin-action-${a}`} />
            ))}
          </View>
        ) : undefined}>
        {detail ? (
          <View style={{ padding: spacing.lg, gap: spacing.md }}>
            <RecruiterStatusPill status={detail.status} />
            <ErrorBanner message={error} />
            {detail.actions.length ? (
              <FormInput label={pending && ACTIONS[pending].needsReason ? `Reason for “${ACTIONS[pending].label}” *` : 'Reason / note to recruiter'}
                value={reason} onChangeText={setReason} rows={2} multiline maxLength={1000} testID="admin-reason" />
            ) : null}
            {detail.reports ? (
              <Notice tone="danger" title={`${detail.reports} user report${detail.reports === 1 ? '' : 's'} against this recruiter`} />
            ) : null}
            <Card title="Account">
              <Field label="Name" value={detail.account.name} />
              <Field label="Login email" value={`${detail.account.email}${detail.account.email_verified ? ' (verified)' : ''}`} />
              <Field label="Phone" value={detail.account.phone} />
              <Field label="Joined" value={formatDate(detail.account.created_at)} />
            </Card>
            <Card title="Business">
              {DETAIL_FIELDS.map(([k, label]) => <Field key={k} label={label} value={String(detail[k] ?? '')} />)}
              <Field label="Placements" value={detail.placement_types.join(', ')} />
              <Field label="Specialties" value={detail.specialties.join(', ')} />
            </Card>
            <Card title="Documents">
              {detail.documents.length === 0 ? <Text style={recruiterStyles.muted}>None uploaded.</Text> : detail.documents.map(d => (
                <Pressable key={d.id} onPress={() => openDoc(d.id)} style={styles.doc} accessibilityRole="link"
                  accessibilityLabel={`Open ${DOC_LABELS[d.doc_type]}`}>
                  <Ionicons name="document-text-outline" size={18} color={colors.navy} />
                  <Text style={[recruiterStyles.link, { flex: 1 }]}>{DOC_LABELS[d.doc_type]}</Text>
                  <Text style={recruiterStyles.muted}>{formatDate(d.created_at)}</Text>
                </Pressable>
              ))}
            </Card>
            <Card title="Audit trail">
              {detail.events.map((e, i) => (
                <View key={i} style={styles.event}>
                  <Text style={recruiterStyles.strong}>
                    {e.from_status ? `${STATUS_META[e.from_status]?.label} → ` : ''}{STATUS_META[e.to_status]?.label}
                  </Text>
                  <Text style={recruiterStyles.muted}>
                    {formatDate(e.created_at)}{e.actor ? ` · by ${e.actor}` : ''}{e.reason ? ` · ${e.reason}` : ''}
                  </Text>
                </View>
              ))}
            </Card>
          </View>
        ) : null}
      </Sheet>
    </RecruiterScreen>
  );
}

function Field({ label, value }: { label: string; value?: string | null }) {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <Text style={styles.fieldValue} selectable>{value || '—'}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    backgroundColor: colors.white, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border,
    padding: spacing.md, flexDirection: 'row', alignItems: 'center', gap: spacing.md,
  },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  actionBtn: { flexGrow: 1, flexBasis: 140 },
  doc: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, minHeight: 44 },
  event: { paddingVertical: spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.borderLight },
  field: { flexDirection: 'row', gap: spacing.md, paddingVertical: 6, flexWrap: 'wrap' },
  fieldLabel: { ...typography.caption, color: colors.textSecondary, width: 130 },
  fieldValue: { ...typography.body, color: colors.text, flex: 1, minWidth: 160 },
});
