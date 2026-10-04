import React, { useCallback, useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../src/context/AuthContext';
import { Button, EmptyState, ErrorBanner, FormInput, LoadingState, Sheet } from '../../src/components';
import { ChoiceChips } from '../../src/components/locum/ChoiceChips';
import { colors, fonts, radius, spacing, typography } from '../../src/theme';
import { Card, Notice, RecruiterScreen, formatDate, recruiterStyles } from '../../src/components/recruiters/RecruiterUI';
import { apiFetch } from '../../src/utils/api';
import { studentLine } from '../../src/utils/roles';
import { APPLICATION_STATUS_META } from '../../src/types/jobs';

type AccountStatus = 'active' | 'suspended';

interface StudentRow {
  id: string; name: string; email: string; city?: string; state?: string;
  student_course?: string | null; student_institution?: string | null; student_university?: string | null;
  student_year?: number | null; graduation_year?: number | null;
  email_verified: boolean; account_status: AccountStatus; account_status_reason?: string;
  created_at?: string; application_count: number;
}
interface StudentDetail extends StudentRow {
  applications: { id: string; job_id: string; status: string; title: string; employment_type?: string; created_at?: string }[];
}

const FILTERS: { value: AccountStatus | 'all'; label: string }[] = [
  { value: 'all', label: 'All' }, { value: 'active', label: 'Active' }, { value: 'suspended', label: 'Suspended' },
];

/** Admin: find student accounts, see what they've applied to, suspend or reactivate. */
export default function AdminStudentsScreen() {
  const { token, user } = useAuth();
  const [filter, setFilter] = useState<AccountStatus | 'all'>('all');
  const [q, setQ] = useState('');
  const [query, setQuery] = useState('');
  const [rows, setRows] = useState<StudentRow[] | null>(null);
  const [total, setTotal] = useState(0);
  const [detail, setDetail] = useState<StudentDetail | null>(null);
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Search as the admin types, without a request per keystroke.
  useEffect(() => {
    const t = setTimeout(() => setQuery(q.trim()), 300);
    return () => clearTimeout(t);
  }, [q]);

  const load = useCallback(async () => {
    if (!token || !user?.is_admin) return;
    const params = new URLSearchParams();
    if (query) params.set('q', query);
    if (filter !== 'all') params.set('status', filter);
    try {
      const res = await apiFetch(`/api/admin/students${params.toString() ? `?${params}` : ''}`, token);
      setRows(res.items); setTotal(res.total); setError(null);
    } catch (e: any) { setError(e?.message); setRows([]); }
  }, [token, user?.is_admin, query, filter]);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  if (!user?.is_admin) {
    return <RecruiterScreen title="Student accounts"><Notice tone="danger" title="Admins only" /></RecruiterScreen>;
  }

  const openDetail = async (id: string) => {
    if (!token) return;
    setReason(''); setError(null);
    try { setDetail(await apiFetch(`/api/admin/students/${id}`, token)); } catch (e: any) { setError(e?.message); }
  };

  const setStatus = async (action: 'suspend' | 'reactivate') => {
    if (!token || !detail) return;
    if (action === 'suspend' && !reason.trim()) { setError('Add a reason for the suspension — it is kept for audit.'); return; }
    setBusy(true); setError(null);
    try {
      const row: StudentRow = await apiFetch(`/api/admin/students/${detail.id}/status`, token, {
        method: 'POST', body: JSON.stringify({ action, reason: reason.trim() }),
      });
      setDetail({ ...detail, ...row, applications: detail.applications });
      setReason('');
      load();
    } catch (e: any) { setError(e?.message || 'Action failed.'); } finally { setBusy(false); }
  };

  const suspended = detail?.account_status === 'suspended';

  return (
    <RecruiterScreen title="Student accounts" testID="admin-students">
      <FormInput label="Search" icon="search-outline" value={q} onChangeText={setQ}
        placeholder="Name, email, course, college or city" maxLength={80} testID="admin-students-search" />
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <ChoiceChips value={filter} onChange={v => v && setFilter(v)} choices={FILTERS} testID="admin-students-filter" />
      </ScrollView>
      {!detail ? <ErrorBanner message={error} /> : null}
      {rows && rows.length ? (
        <Text style={recruiterStyles.muted} testID="admin-students-total">{total} student{total === 1 ? '' : 's'}</Text>
      ) : null}
      {!rows ? <LoadingState /> : rows.length === 0 ? (
        <EmptyState icon="school-outline" title="No students found"
          hint={query || filter !== 'all' ? 'Try a different search or filter.' : 'No student accounts yet.'} />
      ) : rows.map(r => (
        <Pressable key={r.id} onPress={() => openDetail(r.id)} accessibilityRole="button"
          accessibilityLabel={`Open ${r.name}`} testID={`admin-student-${r.id}`}
          style={({ pressed }) => [styles.row, pressed && { opacity: 0.85 }]}>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={recruiterStyles.strong} numberOfLines={1}>{r.name}</Text>
            <Text style={recruiterStyles.muted} numberOfLines={1}>{r.email}</Text>
            <Text style={recruiterStyles.muted} numberOfLines={1}>
              {[studentLine(r), r.student_institution].filter(Boolean).join(' · ') || 'Education not set'}
            </Text>
          </View>
          <StatusPill status={r.account_status} />
          <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
        </Pressable>
      ))}

      <Sheet visible={!!detail} onClose={() => setDetail(null)} title={detail?.name ?? ''} maxWidth={640}
        footer={detail ? (
          <View style={styles.actions}>
            {suspended ? (
              <Button label="Reactivate" variant="secondary" loading={busy} onPress={() => setStatus('reactivate')}
                style={styles.actionBtn} testID="admin-student-reactivate" />
            ) : (
              <Button label="Suspend" variant="danger" loading={busy} onPress={() => setStatus('suspend')}
                style={styles.actionBtn} testID="admin-student-suspend" />
            )}
          </View>
        ) : undefined}>
        {detail ? (
          <View style={{ padding: spacing.lg, gap: spacing.md }}>
            <StatusPill status={detail.account_status} />
            <ErrorBanner message={error} />
            {suspended && detail.account_status_reason ? (
              <Notice tone="danger" title="Suspended" body={detail.account_status_reason} />
            ) : null}
            <FormInput label={suspended ? 'Note (optional)' : 'Reason for suspension *'} value={reason}
              onChangeText={setReason} rows={2} multiline maxLength={500} testID="admin-student-reason" />
            <Card title="Account">
              <Field label="Email" value={`${detail.email}${detail.email_verified ? ' (verified)' : ' (not verified)'}`} />
              <Field label="Location" value={[detail.city, detail.state].filter(Boolean).join(', ')} />
              <Field label="Joined" value={detail.created_at ? formatDate(detail.created_at) : ''} />
            </Card>
            <Card title="Education">
              <Field label="Course" value={detail.student_course} />
              <Field label="Year" value={studentLine(detail).split(' · ')[1]} />
              <Field label="College" value={detail.student_institution} />
              <Field label="University" value={detail.student_university} />
              <Field label="Graduating" value={detail.graduation_year ? String(detail.graduation_year) : ''} />
            </Card>
            <Card title={`Applications (${detail.applications.length})`}>
              {detail.applications.length === 0 ? <Text style={recruiterStyles.muted}>None yet.</Text>
                : detail.applications.map(a => (
                  <View key={a.id} style={styles.event}>
                    <Text style={recruiterStyles.strong} numberOfLines={1}>{a.title || 'Removed posting'}</Text>
                    <Text style={recruiterStyles.muted}>
                      {(APPLICATION_STATUS_META as any)[a.status]?.label ?? a.status}
                      {a.created_at ? ` · ${formatDate(a.created_at)}` : ''}
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

function StatusPill({ status }: { status: AccountStatus }) {
  const off = status === 'suspended';
  return (
    <View style={[styles.pill, off ? styles.pillOff : styles.pillOn]}>
      <Ionicons name={off ? 'ban-outline' : 'checkmark-circle-outline'} size={13} color={off ? colors.redText : colors.teal} />
      <Text style={[styles.pillText, { color: off ? colors.redText : colors.teal }]}>{off ? 'Suspended' : 'Active'}</Text>
    </View>
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
  pill: {
    flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'flex-start',
    paddingHorizontal: spacing.sm, paddingVertical: 3, borderRadius: radius.pill,
  },
  pillOn: { backgroundColor: colors.tealBg },
  pillOff: { backgroundColor: colors.redBg },
  pillText: { ...typography.small, fontFamily: fonts.body.semibold },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  actionBtn: { flexGrow: 1, flexBasis: 140 },
  event: { paddingVertical: spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.borderLight },
  field: { flexDirection: 'row', gap: spacing.md, paddingVertical: 6, flexWrap: 'wrap' },
  fieldLabel: { ...typography.caption, color: colors.textSecondary, width: 130 },
  fieldValue: { ...typography.body, color: colors.text, flex: 1, minWidth: 160 },
});
