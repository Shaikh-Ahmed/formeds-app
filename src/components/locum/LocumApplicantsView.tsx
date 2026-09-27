import React, { useCallback, useState } from 'react';
import { FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../context/AuthContext';
import { colors, radius, spacing, typography, fonts } from '../../theme';
import { postedAgo } from '../../utils/time';
import { Avatar } from '../Avatar';
import { Button } from '../Button';
import { Sheet } from '../Sheet';
import { EmptyState, ErrorBanner, ErrorState } from '../States';
import { Skeleton } from '../Skeleton';
import { JobBadge } from '../jobs/JobMeta';
import { BADGE_TONE, formatShiftDay, formatShiftHours } from './LocumMeta';
import { LocumInterviewSheet, type InterviewResult } from './LocumInterviewSheet';
import {
  fetchLocumApplicationHistory, moveLocumApplication, recordLocumInterview,
} from '../../api/locum';
import {
  LOCUM_APPLICATION_META, LOCUM_ROLE_LABELS,
  type Locum, type LocumApplicationStatus, type LocumHistoryEvent, type ManagedLocumApplication,
} from '../../types/locum';

type Move = 'under_review' | 'contacted' | 'selected' | 'not_selected';

interface Action {
  key: string;
  label: string;
  primary?: boolean;
  quiet?: boolean;
  run: () => void;
}

/** Stages from which "Contact" also records that the hospital got in touch. */
const MARK_CONTACTED_FROM: LocumApplicationStatus[] = ['applied', 'under_review'];

/**
 * The hospital's applicant list, shared by one locum's page and the
 * all-locums Applicants tab.
 *
 * Every row offers exactly the moves that make sense from where that
 * applicant is -- the same transition table the server enforces -- plus
 * profile and contact, always. Two things are deliberately loud:
 *
 *  - "Interview cleared": this hospital already interviewed and passed this
 *    person on an earlier locum, so Select is offered straight away.
 *  - Select itself, which is the decision the whole screen exists for.
 *
 * Contact goes through the existing ForMeds conversation, never an exposed
 * phone number: the applicant card is public_card, which withholds both.
 */
export function LocumApplicantsView({
  apps,
  setApps,
  loading,
  error,
  refreshing,
  onRefresh,
  onRetry,
  header,
  showLocum = false,
  onLocumUpdate,
  empty,
}: {
  apps: ManagedLocumApplication[];
  setApps: React.Dispatch<React.SetStateAction<ManagedLocumApplication[]>>;
  loading: boolean;
  error: string | null;
  refreshing: boolean;
  onRefresh: () => void;
  onRetry: () => void;
  header?: React.ReactElement;
  /** Show which locum each row is for -- the cross-locum inbox needs it. */
  showLocum?: boolean;
  onLocumUpdate?: (locum: Locum) => void;
  empty: { title: string; hint: string };
}) {
  const { token } = useAuth();
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [interviewFor, setInterviewFor] = useState<{ app: ManagedLocumApplication; result: InterviewResult } | null>(null);
  const [confirm, setConfirm] = useState<{ app: ManagedLocumApplication; move: Move } | null>(null);
  const [history, setHistory] = useState<Record<string, LocumHistoryEvent[] | 'loading'>>({});

  const replace = useCallback((updated: ManagedLocumApplication) => {
    // Mirrors the server: the latest interview result is this hospital's
    // standing verdict, so a pass clears and a fail withdraws the clearance.
    const cleared = (a: ManagedLocumApplication) =>
      updated.status === 'interview_passed' ? true
        : updated.status === 'interview_failed' ? false
        : a.interview_cleared;
    setApps(prev => prev.map(a => (a.id === updated.id
      ? { ...a, ...updated, applicant: a.applicant, clearance: a.clearance,
        interview_cleared: cleared(a), locum: a.locum }
      : a)));
    // A fresh move invalidates any history already shown for that row.
    setHistory(prev => { const next = { ...prev }; delete next[updated.id]; return next; });
  }, [setApps]);

  const move = useCallback(async (app: ManagedLocumApplication, status: Move) => {
    if (!token) return;
    setBusy(app.id);
    setActionError(null);
    try {
      const res = await moveLocumApplication(token, app.id, status);
      replace(res.application);
      onLocumUpdate?.(res.locum);
    } catch (e: any) {
      setActionError(e?.message || 'Could not update this applicant.');
    } finally {
      setBusy(null);
    }
  }, [token, replace, onLocumUpdate]);

  const saveInterview = useCallback(async (data: { result: InterviewResult; interview_at?: string; notes?: string }) => {
    if (!token || !interviewFor) return;
    setBusy(interviewFor.app.id);
    setActionError(null);
    try {
      const res = await recordLocumInterview(token, interviewFor.app.id, data);
      replace(res.application);
      setInterviewFor(null);
    } catch (e: any) {
      setActionError(e?.message || 'Could not save the interview.');
    } finally {
      setBusy(null);
    }
  }, [token, interviewFor, replace]);

  const contact = useCallback((app: ManagedLocumApplication) => {
    router.push(`/conversation?userId=${app.applicant_id}` as any);
    if (MARK_CONTACTED_FROM.includes(app.status)) move(app, 'contacted');
  }, [router, move]);

  const toggleHistory = useCallback(async (app: ManagedLocumApplication) => {
    if (!token) return;
    if (history[app.id]) {
      setHistory(prev => { const next = { ...prev }; delete next[app.id]; return next; });
      return;
    }
    setHistory(prev => ({ ...prev, [app.id]: 'loading' }));
    try {
      const events = await fetchLocumApplicationHistory(token, app.id);
      setHistory(prev => ({ ...prev, [app.id]: events }));
    } catch {
      setHistory(prev => { const next = { ...prev }; delete next[app.id]; return next; });
    }
  }, [token, history]);

  const actionsFor = (app: ManagedLocumApplication): Action[] => {
    const interview = (result: InterviewResult) => () => setInterviewFor({ app, result });
    const select: Action = { key: 'select', label: 'Select', primary: true, run: () => move(app, 'selected') };
    const reject: Action = { key: 'reject', label: 'Not selected', quiet: true,
      run: () => setConfirm({ app, move: 'not_selected' }) };
    switch (app.status) {
      case 'applied':
      case 'under_review':
      case 'contacted':
        return [
          ...(app.interview_cleared ? [select] : []),
          { key: 'interview', label: app.interview_cleared ? 'Interview again' : 'Interview',
            primary: !app.interview_cleared, run: interview('scheduled') },
          ...(app.status === 'applied'
            ? [{ key: 'review', label: 'Mark reviewed', run: () => move(app, 'under_review') }] : []),
          reject,
        ];
      case 'interview_scheduled':
        return [
          { key: 'passed', label: 'Passed', primary: true, run: interview('passed') },
          { key: 'failed', label: 'Not cleared', run: interview('failed') },
          { key: 'reschedule', label: 'Reschedule', run: interview('scheduled') },
          reject,
        ];
      case 'interview_passed':
        return [select, { key: 'again', label: 'Interview again', run: interview('scheduled') }, reject];
      case 'selected':
        return [{ key: 'undo', label: 'Undo selection', quiet: true,
          run: () => setConfirm({ app, move: 'not_selected' }) }];
      default:
        return [];
    }
  };

  return (
    <View style={styles.flex}>
      <View style={styles.notice}><ErrorBanner message={actionError} /></View>
      <FlatList
        data={loading ? [] : apps}
        keyExtractor={item => item.id}
        ListHeaderComponent={header}
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.navy} />}
        renderItem={({ item }) => (
          <ApplicantRow
            app={item}
            busy={busy === item.id}
            showLocum={showLocum}
            actions={actionsFor(item)}
            history={history[item.id]}
            onToggleHistory={() => toggleHistory(item)}
            onOpenProfile={() => router.push(`/profile/${item.applicant_id}` as any)}
            onContact={() => contact(item)}
            onOpenLocum={() => router.push(`/jobs/locum/manage/${item.locum_id}` as any)}
          />
        )}
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
            <ErrorState message={error} onRetry={onRetry} />
          ) : (
            <EmptyState icon="people-outline" title={empty.title} hint={empty.hint} />
          )
        }
      />

      <LocumInterviewSheet
        app={interviewFor?.app ?? null}
        initialResult={interviewFor?.result}
        onClose={() => setInterviewFor(null)}
        onSubmit={saveInterview}
        submitting={!!interviewFor && busy === interviewFor.app.id}
        error={actionError}
      />

      <Sheet
        visible={!!confirm}
        onClose={() => setConfirm(null)}
        title={confirm?.app.status === 'selected' ? 'Undo this selection?' : 'Mark as not selected?'}
        testID="locum-confirm"
        footer={
          <>
            <Button label="Keep" variant="outline" style={styles.flex} onPress={() => setConfirm(null)} />
            <Button label="Confirm" variant="danger" style={styles.flex} testID="locum-confirm-yes"
              onPress={() => { if (confirm) move(confirm.app, confirm.move); setConfirm(null); }} />
          </>
        }
      >
        <View style={styles.sheetBody}>
          <Text style={styles.sheetText}>
            {confirm?.app.status === 'selected'
              ? `${confirm?.app.applicant?.name ?? 'This professional'} will be told they are no longer selected, and the opening becomes available again.`
              : `${confirm?.app.applicant?.name ?? 'This professional'} will be told they were not selected for this locum.`}
          </Text>
        </View>
      </Sheet>
    </View>
  );
}

function ApplicantRow({
  app, busy, showLocum, actions, history, onToggleHistory, onOpenProfile, onContact, onOpenLocum,
}: {
  app: ManagedLocumApplication;
  busy: boolean;
  showLocum: boolean;
  actions: Action[];
  history?: LocumHistoryEvent[] | 'loading';
  onToggleHistory: () => void;
  onOpenProfile: () => void;
  onContact: () => void;
  onOpenLocum: () => void;
}) {
  const card = app.applicant;
  const meta = LOCUM_APPLICATION_META[app.status] ?? LOCUM_APPLICATION_META.applied;
  const name = card?.name || 'Professional';
  const line = [
    card?.professional_role, card?.specialty,
    card?.years_experience ? `${card.years_experience} yrs experience` : null,
  ].filter(Boolean).join(' · ');

  return (
    <View style={styles.card} testID={`locum-applicant-${app.id}`}>
      {showLocum && app.locum ? (
        <Pressable onPress={onOpenLocum} accessibilityRole="link" style={styles.locumLine}>
          <Ionicons name="flash-outline" size={14} color={colors.teal} />
          <Text style={styles.locumText} numberOfLines={1}>
            {app.locum.specialty || LOCUM_ROLE_LABELS[app.locum.role_required]} ·{' '}
            {formatShiftDay(app.locum.shift_date)}, {formatShiftHours(app.locum)}
          </Text>
        </Pressable>
      ) : null}

      <Pressable onPress={onOpenProfile} accessibilityRole="button"
        accessibilityLabel={`View the profile of ${name}`}
        style={({ pressed }) => [styles.identity, pressed && styles.pressed]}>
        <Avatar name={name} uri={card?.avatar} role={card?.role} size={44} />
        <View style={styles.identityText}>
          <View style={styles.nameRow}>
            <Text style={styles.name} numberOfLines={1}>{name}</Text>
            {card?.account_verified ? (
              <Ionicons name="checkmark-circle" size={14} color={colors.teal}
                accessibilityLabel="Verified healthcare professional" />
            ) : null}
          </View>
          {line ? <Text style={styles.meta} numberOfLines={1}>{line}</Text> : null}
          <Text style={styles.meta} numberOfLines={1}>
            {[card?.account_verified ? 'Verified' : 'Not yet verified', card?.city || card?.location]
              .filter(Boolean).join(' · ')}
          </Text>
        </View>
      </Pressable>

      <View style={styles.badges}>
        <JobBadge label={meta.label} icon={meta.icon as any} tone={BADGE_TONE[meta.tone]} />
        {app.interview_cleared && app.status !== 'interview_passed' && app.status !== 'selected' ? (
          <JobBadge label="Interview cleared" icon="shield-checkmark-outline" tone="teal" />
        ) : null}
        <Text style={styles.applied}>{postedAgo(app.created_at).replace('Posted', 'Applied')}</Text>
      </View>

      {app.interview_cleared && app.clearance?.cleared_at && app.status !== 'selected' ? (
        <Text style={styles.cleared}>
          Previously interviewed and cleared by your hospital · {postedAgo(app.clearance.cleared_at).replace('Posted ', '')}
        </Text>
      ) : null}

      {app.status === 'interview_scheduled' && app.interview_at ? (
        <Text style={styles.meta}>
          Interview {new Date(app.interview_at).toLocaleString(undefined, {
            weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit',
          })}
        </Text>
      ) : null}

      {app.note ? <Text style={styles.note} numberOfLines={3}>“{app.note}”</Text> : null}
      {app.interview_notes ? (
        <Text style={styles.privateNote} numberOfLines={3}>
          <Text style={styles.privateLabel}>Your notes: </Text>{app.interview_notes}
        </Text>
      ) : null}

      <View style={styles.actions}>
        {actions.map(action => (
          <Pressable
            key={action.key}
            testID={`locum-action-${app.id}-${action.key}`}
            onPress={action.run}
            disabled={busy}
            accessibilityRole="button"
            accessibilityLabel={`${action.label}: ${name}`}
            style={({ pressed }) => [
              styles.action, action.primary && styles.actionPrimary, action.quiet && styles.actionQuiet,
              (pressed || busy) && styles.pressed,
            ]}
          >
            <Text style={[styles.actionText, action.primary && styles.actionTextPrimary,
              action.quiet && styles.actionTextQuiet]}>
              {action.label}
            </Text>
          </Pressable>
        ))}
        <Pressable onPress={onContact} accessibilityRole="button" accessibilityLabel={`Contact ${name}`}
          testID={`locum-contact-${app.id}`}
          style={({ pressed }) => [styles.action, styles.actionQuiet, pressed && styles.pressed]}>
          <Ionicons name="chatbubble-outline" size={14} color={colors.textSecondary} />
          <Text style={styles.actionTextQuiet}>Contact</Text>
        </Pressable>
        <Pressable onPress={onToggleHistory} accessibilityRole="button"
          accessibilityState={{ expanded: !!history }}
          style={({ pressed }) => [styles.action, styles.actionQuiet, pressed && styles.pressed]}>
          <Ionicons name="time-outline" size={14} color={colors.textSecondary} />
          <Text style={styles.actionTextQuiet}>History</Text>
        </Pressable>
      </View>

      {history === 'loading' ? (
        <Skeleton height={11} width="60%" />
      ) : history ? (
        <View style={styles.timeline}>
          {history.map(event => (
            <Text key={event.id} style={styles.timelineRow}>
              {LOCUM_APPLICATION_META[event.to_status]?.label ?? event.to_status}
              {event.actor_name ? ` · ${event.actor_name}` : ''}
              {' · '}{new Date(event.created_at).toLocaleString(undefined, {
                day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit',
              })}
              {event.note ? ` — ${event.note}` : ''}
            </Text>
          ))}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  notice: { paddingHorizontal: spacing.lg },
  list: { padding: spacing.lg, paddingBottom: spacing.xxxl * 2, gap: spacing.md },
  pad: { gap: spacing.md },
  card: {
    backgroundColor: colors.card,
    borderRadius: radius.xl + 2,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    gap: spacing.md,
  },
  locumLine: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  locumText: { ...typography.small, fontFamily: fonts.body.semibold, color: colors.teal, flexShrink: 1 },
  identity: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  identityText: { flex: 1, gap: 2 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  name: { ...typography.bodyStrong, color: colors.text, flexShrink: 1 },
  meta: { ...typography.small, color: colors.textSecondary },
  badges: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, flexWrap: 'wrap' },
  applied: { ...typography.small, color: colors.textSecondary },
  cleared: { ...typography.small, color: colors.teal },
  note: {
    ...typography.caption, color: colors.textSecondary, lineHeight: 19,
    paddingLeft: spacing.md, borderLeftWidth: 2, borderLeftColor: colors.border,
  },
  privateNote: { ...typography.small, color: colors.textSecondary, lineHeight: 18 },
  privateLabel: { fontFamily: fonts.body.semibold },
  actions: {
    flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm,
    paddingTop: spacing.md, borderTopWidth: 1, borderTopColor: colors.borderLight,
  },
  action: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.xs,
    paddingHorizontal: spacing.md, minHeight: 36, borderRadius: radius.md,
    borderWidth: 1, borderColor: colors.navy, backgroundColor: colors.white, justifyContent: 'center',
  },
  actionPrimary: { backgroundColor: colors.navy },
  actionQuiet: { borderColor: colors.border },
  actionText: { ...typography.small, fontFamily: fonts.body.semibold, color: colors.navy },
  actionTextPrimary: { color: colors.white },
  actionTextQuiet: { ...typography.small, color: colors.textSecondary },
  pressed: { opacity: 0.65 },
  timeline: { gap: spacing.xs, paddingLeft: spacing.md, borderLeftWidth: 2, borderLeftColor: colors.tealBg },
  timelineRow: { ...typography.small, color: colors.textSecondary },
  sheetBody: { padding: spacing.xl, paddingTop: spacing.md },
  sheetText: { ...typography.body, color: colors.text, lineHeight: 22 },
});
