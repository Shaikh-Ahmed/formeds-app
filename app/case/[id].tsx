import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View, Text, StyleSheet, FlatList, ScrollView, TouchableOpacity, TextInput, Pressable,
  ActivityIndicator, KeyboardAvoidingView, Platform, RefreshControl, Share, Image, Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useAuth } from '../../src/context/AuthContext';
import { apiFetch } from '../../src/utils/api';
import { timeAgo } from '../../src/utils/time';
import {
  Avatar, RoleBadge, VoteControl, TagChip, KycNotice,
  LoadingState, ErrorState, ErrorBanner, Button,
} from '../../src/components';
import { colors, radius, spacing, typography, MIN_TOUCH_TARGET } from '../../src/theme';
import {
  ANSWER_SORTS, REPORT_REASONS,
  type AnswerSort, type CaseAnswer, type CaseThread, type VoteValue,
} from '../../src/types/cases';
import { PageColumn } from '../../src/components/web';

type ReplyTarget = { id: string; author: string } | null;

/** Local echo of a vote result, so the UI doesn't wait on a refetch. */
function applyVote<T extends { id: string; my_vote: VoteValue; vote_score: number }>(
  list: T[], id: string, result: { my_vote: VoteValue; vote_score: number },
): T[] {
  return list.map(item => (item.id === id ? { ...item, ...result } : item));
}

export default function CaseDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { token, isKycApproved } = useAuth();
  const router = useRouter();

  const [thread, setThread] = useState<CaseThread | null>(null);
  const [answers, setAnswers] = useState<CaseAnswer[]>([]);
  const [sort, setSort] = useState<AnswerSort>('votes');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const [draft, setDraft] = useState('');
  const [anonymous, setAnonymous] = useState(false);
  const [replyTo, setReplyTo] = useState<ReplyTarget>(null);
  const [submitting, setSubmitting] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [reportTarget, setReportTarget] = useState<{ type: 'case' | 'answer'; id: string } | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const [caseData, answerData] = await Promise.all([
        apiFetch(`/api/cases/${id}`, token),
        apiFetch(`/api/cases/${id}/answers?sort=${sort}&limit=50`, token),
      ]);
      setThread(caseData);
      setAnswers(answerData);
    } catch (e: any) {
      setError(e?.message || 'Could not load this case.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [id, token, sort]);

  useEffect(() => { load(); }, [load]);

  const refresh = () => { setRefreshing(true); load(); };

  // ── Voting ────────────────────────────────────────────────────────────────

  const voteCase = async (value: 1 | -1) => {
    if (!thread) return;
    setActionError(null);
    try {
      const result = await apiFetch(`/api/cases/${thread.id}/vote`, token, {
        method: 'POST', body: JSON.stringify({ value }),
      });
      setThread({ ...thread, ...result });
    } catch (e: any) { setActionError(e?.message || 'Could not register your vote.'); }
  };

  const voteAnswer = async (answerId: string, value: 1 | -1, isReply: boolean, parentId?: string) => {
    setActionError(null);
    try {
      const result = await apiFetch(`/api/cases/answers/${answerId}/vote`, token, {
        method: 'POST', body: JSON.stringify({ value }),
      });
      setAnswers(prev =>
        isReply
          ? prev.map(a => (a.id === parentId ? { ...a, replies: applyVote(a.replies ?? [], answerId, result) } : a))
          : applyVote(prev, answerId, result));
    } catch (e: any) { setActionError(e?.message || 'Could not register your vote.'); }
  };

  // ── Writing ───────────────────────────────────────────────────────────────

  const submit = async () => {
    if (!draft.trim()) return;
    setSubmitting(true);
    setActionError(null);
    try {
      await apiFetch(`/api/cases/${id}/answers`, token, {
        method: 'POST',
        body: JSON.stringify({
          body: draft.trim(),
          is_anonymous: anonymous,
          ...(replyTo ? { parent_id: replyTo.id } : {}),
        }),
      });
      setDraft('');
      setReplyTo(null);
      await load();
    } catch (e: any) {
      setActionError(e?.message || 'Could not post that.');
    } finally {
      setSubmitting(false);
    }
  };

  const accept = async (answerId: string) => {
    setActionError(null);
    try {
      await apiFetch(`/api/cases/${id}/answers/${answerId}/accept`, token, { method: 'POST' });
      await load();
    } catch (e: any) { setActionError(e?.message || 'Could not accept that answer.'); }
  };

  const removeAnswer = async (answerId: string) => {
    setActionError(null);
    try {
      await apiFetch(`/api/cases/answers/${answerId}`, token, { method: 'DELETE' });
      await load();
    } catch (e: any) { setActionError(e?.message || 'Could not remove that.'); }
  };

  const toggleBookmark = async () => {
    if (!thread) return;
    try {
      const result = await apiFetch(`/api/cases/${thread.id}/bookmark`, token, { method: 'POST' });
      setThread({ ...thread, bookmarked: result.bookmarked });
    } catch (e: any) { setActionError(e?.message || 'Could not save this case.'); }
  };

  const runCaseAction = async (action: 'close' | 'reopen' | 'delete') => {
    setMenuOpen(false);
    setActionError(null);
    try {
      if (action === 'delete') {
        await apiFetch(`/api/cases/${id}`, token, { method: 'DELETE' });
        router.back();
        return;
      }
      await apiFetch(`/api/cases/${id}/${action}`, token, { method: 'POST' });
      await load();
    } catch (e: any) { setActionError(e?.message || 'That did not work.'); }
  };

  const sendReport = async (reason: string) => {
    if (!reportTarget) return;
    const target = reportTarget;
    setReportTarget(null);
    try {
      const url = target.type === 'case'
        ? `/api/cases/${target.id}/report`
        : `/api/cases/answers/${target.id}/report`;
      const result = await apiFetch(url, token, { method: 'POST', body: JSON.stringify({ reason }) });
      setActionError(result.message);
    } catch (e: any) { setActionError(e?.message || 'Could not send that report.'); }
  };

  const share = async () => {
    if (!thread) return;
    try {
      await Share.share({ message: `${thread.title}\n\n${thread.body}\n\n— via ForMeds Cases` });
    } catch { /* user dismissed the sheet */ }
  };

  const locked = thread?.status === 'closed';
  const answerLabel = useMemo(() => {
    const n = thread?.answer_count ?? 0;
    return `${n} ${n === 1 ? 'Answer' : 'Answers'}`;
  }, [thread?.answer_count]);

  // ── Rendering ─────────────────────────────────────────────────────────────

  const AuthorRow = ({ post, size = 32 }: { post: CaseAnswer | CaseThread; size?: number }) => (
    <View style={styles.authorRow}>
      <Avatar name={post.author_name} role={post.author_role} size={size} />
      <View style={styles.authorText}>
        <View style={styles.authorLine}>
          <Text style={styles.authorName} numberOfLines={1}>{post.author_name}</Text>
          {post.is_anonymous ? <Ionicons name="eye-off-outline" size={13} color={colors.textMuted} /> : null}
        </View>
        <View style={styles.authorLine}>
          <RoleBadge role={post.author_role} />
          <Text style={styles.meta}>{timeAgo(post.created_at)}{post.edited_at ? ' · edited' : ''}</Text>
        </View>
      </View>
    </View>
  );

  const PostActions = ({ post, isAnswer, parentId }: { post: CaseAnswer; isAnswer: boolean; parentId?: string }) => (
    <View style={styles.postActions}>
      <VoteControl
        testID={`answer-vote-${post.id}`}
        orientation="row"
        score={post.vote_score}
        myVote={post.my_vote}
        disabled={post.is_mine || post.is_deleted}
        onVote={v => voteAnswer(post.id, v, !isAnswer, parentId)}
      />
      {isAnswer && !post.is_deleted && !locked ? (
        <TouchableOpacity
          testID={`reply-btn-${post.id}`}
          style={styles.textAction}
          onPress={() => setReplyTo({ id: post.id, author: post.author_name })}
          accessibilityRole="button"
        >
          <Ionicons name="return-down-forward-outline" size={15} color={colors.textSecondary} />
          <Text style={styles.textActionLabel}>Reply</Text>
        </TouchableOpacity>
      ) : null}
      {thread?.is_mine && isAnswer && !post.is_deleted ? (
        <TouchableOpacity
          testID={`accept-btn-${post.id}`}
          style={styles.textAction}
          onPress={() => accept(post.id)}
          accessibilityRole="button"
          accessibilityLabel={post.is_accepted ? 'Unaccept this answer' : 'Accept this answer'}
        >
          <Ionicons
            name={post.is_accepted ? 'checkmark-circle' : 'checkmark-circle-outline'}
            size={16}
            color={post.is_accepted ? colors.teal : colors.textSecondary}
          />
          <Text style={[styles.textActionLabel, post.is_accepted && { color: colors.teal }]}>
            {post.is_accepted ? 'Accepted' : 'Accept'}
          </Text>
        </TouchableOpacity>
      ) : null}
      {post.is_mine && !post.is_deleted ? (
        <TouchableOpacity style={styles.textAction} onPress={() => removeAnswer(post.id)} accessibilityRole="button">
          <Ionicons name="trash-outline" size={15} color={colors.textMuted} />
        </TouchableOpacity>
      ) : null}
      {!post.is_mine && !post.is_deleted ? (
        <TouchableOpacity
          style={styles.textAction}
          onPress={() => setReportTarget({ type: 'answer', id: post.id })}
          accessibilityRole="button"
          accessibilityLabel="Report this post"
        >
          <Ionicons name="flag-outline" size={15} color={colors.textMuted} />
        </TouchableOpacity>
      ) : null}
    </View>
  );

  const renderAnswer = ({ item }: { item: CaseAnswer }) => (
    <View style={[styles.answerCard, item.is_accepted && styles.answerAccepted]}>
      {item.is_accepted ? (
        <View style={styles.acceptedBanner}>
          <Ionicons name="checkmark-circle" size={15} color={colors.teal} />
          <Text style={styles.acceptedText}>Accepted answer</Text>
        </View>
      ) : null}

      <AuthorRow post={item} />
      <Text style={[styles.body, item.is_deleted && styles.removed]}>{item.body}</Text>
      {item.image_url ? <Image source={{ uri: item.image_url }} style={styles.image} resizeMode="cover" /> : null}
      <PostActions post={item} isAnswer />

      {item.replies?.length ? (
        <View style={styles.replies}>
          {item.replies.map(reply => (
            <View key={reply.id} style={styles.replyCard}>
              <AuthorRow post={reply} size={24} />
              <Text style={[styles.replyBody, reply.is_deleted && styles.removed]}>{reply.body}</Text>
              <PostActions post={reply} isAnswer={false} parentId={item.id} />
            </View>
          ))}
        </View>
      ) : null}
    </View>
  );

  const header = () => {
    if (!thread) return null;
    return (
      <View>
        <View style={styles.caseCard}>
          <Text style={styles.title}>{thread.title}</Text>

          <View style={styles.statusRow}>
            {thread.status !== 'open' ? (
              <View style={[styles.pill, thread.status === 'resolved' ? styles.pillResolved : styles.pillClosed]}>
                <Ionicons
                  name={thread.status === 'resolved' ? 'checkmark-circle' : 'lock-closed'}
                  size={12}
                  color={thread.status === 'resolved' ? colors.teal : colors.textSecondary}
                />
                <Text style={[styles.pillText, thread.status === 'resolved' && { color: colors.teal }]}>
                  {thread.status === 'resolved' ? 'Resolved' : 'Closed'}
                </Text>
              </View>
            ) : null}
            {thread.specialty ? <Text style={styles.meta}>{thread.specialty}</Text> : null}
            <Text style={styles.meta}>{thread.view_count} views</Text>
          </View>

          <View style={styles.caseBody}>
            <VoteControl
              testID="case-vote"
              score={thread.vote_score}
              myVote={thread.my_vote}
              disabled={thread.is_mine}
              onVote={voteCase}
            />
            <View style={styles.caseText}>
              <Text style={styles.body}>{thread.body}</Text>
              {thread.image_url ? (
                <Image source={{ uri: thread.image_url }} style={styles.image} resizeMode="cover" />
              ) : null}
            </View>
          </View>

          {thread.tags?.length ? (
            <View style={styles.tags}>
              {thread.tags.map(tag => <TagChip key={tag} label={tag} />)}
            </View>
          ) : null}

          <View style={styles.caseFooter}>
            <AuthorRow post={thread} />
            <TouchableOpacity
              testID="bookmark-btn"
              onPress={toggleBookmark}
              style={styles.iconAction}
              accessibilityRole="button"
              accessibilityLabel={thread.bookmarked ? 'Remove from saved' : 'Save this case'}
              accessibilityState={{ selected: thread.bookmarked }}
            >
              <Ionicons name={thread.bookmarked ? 'bookmark' : 'bookmark-outline'} size={20} color={colors.navy} />
            </TouchableOpacity>
            <TouchableOpacity onPress={share} style={styles.iconAction} accessibilityRole="button" accessibilityLabel="Share">
              <Ionicons name="share-social-outline" size={20} color={colors.navy} />
            </TouchableOpacity>
          </View>
        </View>

        <ErrorBanner message={actionError} />

        <View style={styles.answersHeader}>
          <Text style={styles.answersTitle}>{answerLabel}</Text>
          <View style={styles.sortRow}>
            {ANSWER_SORTS.map(option => (
              <TouchableOpacity
                key={option.key}
                testID={`answer-sort-${option.key}`}
                onPress={() => setSort(option.key)}
                style={[styles.sortChip, sort === option.key && styles.sortChipActive]}
                accessibilityRole="tab"
                accessibilityState={{ selected: sort === option.key }}
              >
                <Text style={[styles.sortText, sort === option.key && styles.sortTextActive]}>{option.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <PageColumn testID="case-column">
      <View style={styles.header}>
        <TouchableOpacity
          testID="case-back-btn"
          style={styles.headerBtn}
          onPress={() => router.back()}
          accessibilityRole="button"
          accessibilityLabel="Go back"
        >
          <Ionicons name="arrow-back" size={24} color={colors.navy} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Case</Text>
        <TouchableOpacity
          testID="case-menu-btn"
          style={styles.headerBtn}
          onPress={() => (thread?.is_mine ? setMenuOpen(true) : setReportTarget({ type: 'case', id: String(id) }))}
          accessibilityRole="button"
          accessibilityLabel={thread?.is_mine ? 'Case options' : 'Report this case'}
        >
          <Ionicons name={thread?.is_mine ? 'ellipsis-horizontal' : 'flag-outline'} size={22} color={colors.navy} />
        </TouchableOpacity>
      </View>

      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.flex}>
        {loading ? (
          <LoadingState label="Loading case…" />
        ) : error && !thread ? (
          <ErrorState message={error} onRetry={load} />
        ) : (
          <FlatList
            data={answers}
            keyExtractor={item => item.id}
            renderItem={renderAnswer}
            ListHeaderComponent={header}
            contentContainerStyle={styles.list}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={colors.navy} />}
            ListEmptyComponent={
              <View style={styles.emptyAnswers}>
                <Ionicons name="chatbubble-ellipses-outline" size={36} color={colors.border} />
                <Text style={styles.emptyText}>No answers yet</Text>
                <Text style={styles.emptyHint}>If you have seen this presentation, say what you did.</Text>
              </View>
            }
          />
        )}

        {locked ? (
          <View style={styles.lockedBar}>
            <Ionicons name="lock-closed" size={16} color={colors.textSecondary} />
            <Text style={styles.lockedText}>This case is closed to new answers.</Text>
          </View>
        ) : (
          <View style={styles.composer}>
            {replyTo ? (
              <View style={styles.replyBanner}>
                <Text style={styles.replyBannerText} numberOfLines={1}>Replying to {replyTo.author}</Text>
                <TouchableOpacity onPress={() => setReplyTo(null)} accessibilityRole="button" accessibilityLabel="Cancel reply">
                  <Ionicons name="close" size={16} color={colors.textSecondary} />
                </TouchableOpacity>
              </View>
            ) : null}

            <KycNotice action="answer cases" />

            <View style={styles.composerRow}>
              <TextInput
                testID="answer-input"
                style={styles.composerInput}
                placeholder={replyTo ? 'Write a reply…' : 'Write an answer…'}
                placeholderTextColor={colors.textMuted}
                value={draft}
                onChangeText={setDraft}
                editable={isKycApproved}
                multiline
              />
              <TouchableOpacity
                testID="submit-answer-btn"
                style={[styles.sendBtn, (!isKycApproved || !draft.trim()) && styles.sendBtnDisabled]}
                onPress={submit}
                disabled={submitting || !isKycApproved || !draft.trim()}
                accessibilityRole="button"
                accessibilityLabel={replyTo ? 'Post reply' : 'Post answer'}
              >
                {submitting ? <ActivityIndicator size="small" color={colors.white} />
                            : <Ionicons name="send" size={18} color={colors.white} />}
              </TouchableOpacity>
            </View>

            <TouchableOpacity
              testID="answer-anonymous-toggle"
              style={styles.anonRow}
              onPress={() => setAnonymous(v => !v)}
              disabled={!isKycApproved}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: anonymous }}
              accessibilityLabel="Post anonymously"
            >
              <Ionicons
                name={anonymous ? 'checkbox' : 'square-outline'}
                size={17}
                color={anonymous ? colors.navy : colors.textMuted}
              />
              <Text style={styles.anonText}>Post anonymously</Text>
            </TouchableOpacity>
          </View>
        )}
      </KeyboardAvoidingView>

      {/* Author's own-case menu. The dismiss target is a sibling of the sheet,
          not its parent — as a parent it would also swallow taps that land on
          the sheet's own non-interactive areas and close the menu. */}
      <Modal visible={menuOpen} transparent animationType="fade" onRequestClose={() => setMenuOpen(false)}>
        <View style={styles.backdrop}>
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={() => setMenuOpen(false)}
            accessibilityRole="button"
            accessibilityLabel="Dismiss menu"
          />
          <View style={styles.sheet}>
            <Text style={styles.sheetTitle}>Case options</Text>
            <TouchableOpacity
              style={styles.sheetItem}
              onPress={() => { setMenuOpen(false); router.push({ pathname: '/case/new', params: { id: String(id) } } as any); }}
            >
              <Ionicons name="create-outline" size={20} color={colors.navy} />
              <Text style={styles.sheetLabel}>Edit case</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.sheetItem} onPress={() => runCaseAction(locked ? 'reopen' : 'close')}>
              <Ionicons name={locked ? 'lock-open-outline' : 'lock-closed-outline'} size={20} color={colors.navy} />
              <Text style={styles.sheetLabel}>{locked ? 'Reopen for answers' : 'Close to new answers'}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.sheetItem} onPress={() => runCaseAction('delete')}>
              <Ionicons name="trash-outline" size={20} color={colors.red} />
              <Text style={[styles.sheetLabel, { color: colors.red }]}>Delete case</Text>
            </TouchableOpacity>
            <Button label="Cancel" variant="outline" onPress={() => setMenuOpen(false)} style={styles.sheetCancel} />
          </View>
        </View>
      </Modal>

      {/* Report reason picker */}
      <Modal visible={!!reportTarget} transparent animationType="fade" onRequestClose={() => setReportTarget(null)}>
        <View style={styles.backdrop}>
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={() => setReportTarget(null)}
            accessibilityRole="button"
            accessibilityLabel="Dismiss report options"
          />
          <View style={styles.sheet}>
            <Text style={styles.sheetTitle}>Report this post</Text>
            <ScrollView>
              {REPORT_REASONS.map(reason => (
                <TouchableOpacity key={reason.key} style={styles.sheetItem} onPress={() => sendReport(reason.key)}>
                  <Ionicons name="flag-outline" size={18} color={colors.textSecondary} />
                  <Text style={styles.sheetLabel}>{reason.label}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
            <Button label="Cancel" variant="outline" onPress={() => setReportTarget(null)} style={styles.sheetCancel} />
          </View>
        </View>
      </Modal>
      </PageColumn>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  flex: { flex: 1 },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: spacing.lg, paddingVertical: spacing.md,
    backgroundColor: colors.white, borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  headerBtn: {
    width: MIN_TOUCH_TARGET, height: MIN_TOUCH_TARGET, borderRadius: radius.lg,
    backgroundColor: colors.bgMuted, alignItems: 'center', justifyContent: 'center',
  },
  headerTitle: { ...typography.h3, color: colors.text },
  list: { padding: spacing.lg, paddingBottom: spacing.xxl },

  caseCard: {
    backgroundColor: colors.card, borderRadius: radius.xl + 2, borderWidth: 1,
    borderColor: colors.border, padding: spacing.lg,
  },
  title: { ...typography.h2, color: colors.text, lineHeight: 29 },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginTop: spacing.sm, flexWrap: 'wrap' },
  pill: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, borderRadius: radius.sm, paddingHorizontal: spacing.sm, paddingVertical: 2 },
  pillResolved: { backgroundColor: colors.successBg },
  pillClosed: { backgroundColor: colors.bgMuted },
  pillText: { fontSize: 11, fontWeight: '700', color: colors.textSecondary },
  caseBody: { flexDirection: 'row', gap: spacing.md, marginTop: spacing.lg },
  caseText: { flex: 1 },
  body: { ...typography.body, color: colors.textSecondary, lineHeight: 23 },
  removed: { fontStyle: 'italic', color: colors.textMuted },
  image: { width: '100%', height: 220, borderRadius: radius.lg, marginTop: spacing.md },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs, marginTop: spacing.lg },
  caseFooter: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: spacing.lg,
    paddingTop: spacing.md, borderTopWidth: 1, borderTopColor: colors.borderLight,
  },
  iconAction: { width: MIN_TOUCH_TARGET, height: MIN_TOUCH_TARGET, alignItems: 'center', justifyContent: 'center' },

  authorRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, flex: 1 },
  authorText: { flex: 1, gap: 2 },
  authorLine: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  authorName: { ...typography.small, fontWeight: '700', color: colors.text, flexShrink: 1 },
  meta: { ...typography.small, color: colors.textMuted },

  answersHeader: { marginTop: spacing.xl, marginBottom: spacing.md, gap: spacing.sm },
  answersTitle: { ...typography.h3, color: colors.text },
  sortRow: { flexDirection: 'row', gap: spacing.sm },
  sortChip: { backgroundColor: colors.bgMuted, borderRadius: radius.pill, paddingHorizontal: spacing.md, paddingVertical: spacing.xs + 2 },
  sortChipActive: { backgroundColor: colors.navy },
  sortText: { ...typography.small, fontWeight: '600', color: colors.textSecondary },
  sortTextActive: { color: colors.white },

  answerCard: {
    backgroundColor: colors.card, borderRadius: radius.xl, borderWidth: 1,
    borderColor: colors.border, padding: spacing.lg, marginBottom: spacing.md,
  },
  answerAccepted: { borderColor: colors.teal, borderWidth: 1.5 },
  acceptedBanner: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, marginBottom: spacing.sm },
  acceptedText: { ...typography.small, fontWeight: '700', color: colors.teal },
  postActions: { flexDirection: 'row', alignItems: 'center', gap: spacing.lg, marginTop: spacing.md, flexWrap: 'wrap' },
  textAction: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, minHeight: 30 },
  textActionLabel: { ...typography.small, fontWeight: '600', color: colors.textSecondary },

  replies: {
    marginTop: spacing.md, paddingLeft: spacing.md,
    borderLeftWidth: 2, borderLeftColor: colors.border, gap: spacing.md,
  },
  replyCard: { gap: spacing.sm },
  replyBody: { ...typography.caption, color: colors.textSecondary, lineHeight: 20 },

  emptyAnswers: { alignItems: 'center', paddingVertical: spacing.xxxl, gap: spacing.xs },
  emptyText: { ...typography.bodyStrong, color: colors.textSecondary, marginTop: spacing.sm },
  emptyHint: { ...typography.caption, color: colors.textMuted, textAlign: 'center' },

  composer: {
    backgroundColor: colors.white, borderTopWidth: 1, borderTopColor: colors.border,
    padding: spacing.md, paddingBottom: Platform.OS === 'ios' ? spacing.xxl : spacing.md,
  },
  replyBanner: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: colors.bgMuted, borderRadius: radius.sm,
    paddingHorizontal: spacing.md, paddingVertical: spacing.sm, marginBottom: spacing.sm,
  },
  replyBannerText: { ...typography.small, color: colors.textSecondary, flex: 1 },
  composerRow: { flexDirection: 'row', alignItems: 'flex-end', gap: spacing.sm },
  composerInput: {
    flex: 1, backgroundColor: colors.bg, borderRadius: radius.xl, borderWidth: 1, borderColor: colors.border,
    paddingHorizontal: spacing.lg, paddingVertical: spacing.md, ...typography.body, color: colors.text, maxHeight: 120,
  },
  sendBtn: {
    width: MIN_TOUCH_TARGET, height: MIN_TOUCH_TARGET, borderRadius: MIN_TOUCH_TARGET / 2,
    backgroundColor: colors.navy, alignItems: 'center', justifyContent: 'center',
  },
  sendBtnDisabled: { opacity: 0.5 },
  anonRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: spacing.sm, minHeight: 30 },
  anonText: { ...typography.small, color: colors.textSecondary },
  lockedBar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm,
    backgroundColor: colors.bgMuted, borderTopWidth: 1, borderTopColor: colors.border, padding: spacing.lg,
  },
  lockedText: { ...typography.caption, color: colors.textSecondary },

  backdrop: { flex: 1, backgroundColor: 'rgba(15,23,42,0.45)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: colors.white, borderTopLeftRadius: radius.xl + 6, borderTopRightRadius: radius.xl + 6,
    padding: spacing.xl, paddingBottom: spacing.xxxl, maxHeight: '75%',
  },
  sheetTitle: { ...typography.h3, color: colors.text, marginBottom: spacing.md },
  sheetItem: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, minHeight: MIN_TOUCH_TARGET + 4 },
  sheetLabel: { ...typography.body, color: colors.text },
  sheetCancel: { marginTop: spacing.md },
});
