import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator, FlatList, Image, KeyboardAvoidingView, Linking, Platform, Pressable,
  StyleSheet, Text, TextInput, View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import { useRouter } from 'expo-router';
import { useAuth } from '../src/context/AuthContext';
import { colors, fonts, radius, spacing, typography, MIN_TOUCH_TARGET } from '../src/theme';
import { PageColumn } from '../src/components/web';
import { AedMarkdown } from '../src/components/aed/AedMarkdown';
import { AedLogo } from '../src/components/aed/AedLogo';
import { Sheet } from '../src/components/Sheet';
import { AedTokenMeter } from '../src/components/subscriptions/AedTokenMeter';
import { UpgradePrompt } from '../src/components/subscriptions/UpgradePrompt';
import { fetchMySubscription, fetchPlans } from '../src/api/subscriptions';
import type { AedWallet, Entitlements, Plan } from '../src/types/subscriptions';
import {
  aedErrorMessage, askAed, askAedWithFile, clearAedHistory, fetchAedHistory,
  type AedAction, type AedSource,
} from '../src/api/aed';

interface Message {
  id: string;
  role: 'user' | 'assistant' | 'error';
  content: string;
  urgent?: boolean;
  sources?: AedSource[];
  imageUri?: string;
  fileName?: string;
  /** What to resend when an error bubble's Retry is pressed. */
  retry?: Pending;
  /** The plan that would unlock what was refused. */
  upgrade?: { plan: string | null };
  /** The plan that would have added sources to this answer. */
  limitedPlan?: string | null;
}

interface Pending {
  text: string;
  action: AedAction | null;
  file: PickedFile | null;
}

interface PickedFile { uri: string; name?: string | null; mimeType?: string | null; kind: 'image' | 'pdf' }

/** The cheapest plan that includes a feature, from the catalogue -- for locks. */
function planWith(plans: Plan[], feature: string): string | null {
  return plans.find(p => p.entitlements[feature] === true)?.name ?? null;
}

interface QuickAction {
  action: AedAction;
  label: string;
  hint: string;
  icon: keyof typeof Ionicons.glyphMap;
  prefill: string;
}

export const QUICK_ACTIONS: QuickAction[] = [
  { action: 'analyze_case', label: 'Analyze a case', hint: 'Differentials, red flags, work-up', icon: 'clipboard-outline', prefill: 'Case: ' },
  { action: 'lab_report', label: 'Explain a lab report', hint: 'Abnormal values and next steps', icon: 'flask-outline', prefill: 'Explain these results: ' },
  { action: 'medication', label: 'Medication information', hint: 'Mechanism, interactions, monitoring', icon: 'medkit-outline', prefill: 'Tell me about ' },
  { action: 'explain_concept', label: 'Explain a concept', hint: 'Clear, role-appropriate teaching', icon: 'book-outline', prefill: 'Explain ' },
  { action: 'differential', label: 'Find differentials', hint: 'Ranked, with must-not-miss', icon: 'git-branch-outline', prefill: 'Differential diagnosis for ' },
  { action: 'compare_drugs', label: 'Compare two drugs', hint: 'Side-by-side table', icon: 'swap-horizontal-outline', prefill: 'Compare ' },
  { action: 'research', label: 'Summarize research', hint: 'With PubMed sources', icon: 'library-outline', prefill: 'Summarize the evidence on ' },
  { action: 'guideline', label: 'Clinical guidelines', hint: 'What current guidance says', icon: 'document-text-outline', prefill: 'What do current guidelines recommend for ' },
];

// The conversation survives closing and reopening AED within one app session.
// It is never written to device storage: it can hold patient details, and the
// server already forgets it after 24 hours. Keyed by user, so whoever signs in
// next on a shared device starts with a clean slate.
let lastSession: { userId: string; sessionId: string } | null = null;

const rememberedSession = (userId?: string): string | null =>
  userId && lastSession?.userId === userId ? lastSession.sessionId : null;

/**
 * AED, the healthcare AI assistant.
 *
 * A native ForMeds screen, not a generic chat clone: quick actions shaped for
 * clinical work, answers laid out as structured notes on full-width cards,
 * sources shown only when they were really retrieved, and a possible
 * emergency surfaced before anything else. All AI calls go through the ForMeds
 * backend; no key and no system prompt ever reach this code.
 */
export default function AEDChatScreen() {
  const { token, user } = useAuth();
  const userId = user?.id;
  const router = useRouter();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [action, setAction] = useState<QuickAction | null>(null);
  const [file, setFile] = useState<PickedFile | null>(null);
  const [loading, setLoading] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(() => rememberedSession(userId));
  const [wallet, setWallet] = useState<AedWallet | null>(null);
  const [entitled, setEntitled] = useState<Entitlements>({});
  const [plans, setPlans] = useState<Plan[]>([]);
  const [attachOpen, setAttachOpen] = useState(false);
  const listRef = useRef<FlatList>(null);
  const inputRef = useRef<TextInput>(null);

  // The plan and balance come from the server; the app only displays them.
  const loadPlan = useCallback(async () => {
    if (!token) return;
    try {
      const [mine, catalog] = await Promise.all([fetchMySubscription(token), fetchPlans(token)]);
      setWallet(mine.aed_tokens);
      setEntitled(mine.plan.entitlements);
      setPlans(catalog.plans);
    } catch {
      // The meter is informative; AED still works without it.
    }
  }, [token]);

  useEffect(() => { loadPlan(); }, [loadPlan]);

  useEffect(() => {
    const remembered = rememberedSession(userId);
    if (!token || !remembered) return;
    fetchAedHistory(token, remembered)
      .then(items => setMessages(items.map(m => ({ id: m.id, role: m.role, content: m.content }))))
      .catch(() => { lastSession = null; setSessionId(null); });
  }, [token, userId]);

  const send = useCallback(async (pending: Pending) => {
    if (!token || loading) return;
    const text = pending.text.trim();
    if (!text && !pending.file) return;
    setMessages(prev => [...prev, {
      id: `u-${Date.now()}`, role: 'user',
      content: text || 'Explain the important findings.',
      imageUri: pending.file?.kind === 'image' ? pending.file.uri : undefined,
      fileName: pending.file?.kind === 'pdf' ? (pending.file.name || 'Document.pdf') : undefined,
    }]);
    setInput('');
    setAction(null);
    setFile(null);
    setLoading(true);
    try {
      const reply = pending.file
        ? await askAedWithFile(token, pending.file, text, sessionId, pending.action)
        : await askAed(token, text, sessionId, pending.action);
      if (userId) lastSession = { userId, sessionId: reply.session_id };
      setSessionId(reply.session_id);
      if (reply.aed_tokens) setWallet(reply.aed_tokens);
      setMessages(prev => [...prev, {
        id: `a-${Date.now()}`, role: 'assistant', content: reply.response,
        urgent: reply.urgent, sources: reply.sources,
        limitedPlan: reply.limited_by_plan?.required_plan,
      }]);
    } catch (e: any) {
      const detail = e?.data?.detail ?? {};
      const upgrade = e?.code === 'aed_tokens_exhausted'
        ? { plan: detail.upgrade_to ?? null }
        : e?.code === 'aed_upgrade_required' ? { plan: detail.required_plan ?? null } : undefined;
      if (e?.code === 'aed_tokens_exhausted') loadPlan();
      setMessages(prev => [...prev, {
        id: `e-${Date.now()}`, role: 'error', content: aedErrorMessage(e),
        retry: upgrade ? undefined : pending, upgrade,
      }]);
    } finally {
      setLoading(false);
    }
  }, [token, loading, sessionId, userId, loadPlan]);

  const submit = () => send({ text: input, action: action?.action ?? null, file });

  const retry = (msg: Message) => {
    if (!msg.retry) return;
    setMessages(prev => prev.filter(m => m.id !== msg.id));
    send(msg.retry);
  };

  const pickQuickAction = (qa: QuickAction) => {
    setAction(qa);
    setInput(qa.prefill);
    inputRef.current?.focus();
  };

  const pickImage = async () => {
    setAttachOpen(false);
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) return;
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.8 });
    if (result.canceled || !result.assets?.length) return;
    const asset = result.assets[0];
    setFile({ uri: asset.uri, name: asset.fileName, mimeType: asset.mimeType, kind: 'image' });
  };

  const pickPdf = async () => {
    setAttachOpen(false);
    const result = await DocumentPicker.getDocumentAsync({ type: 'application/pdf', copyToCacheDirectory: true });
    if (result.canceled || !result.assets?.length) return;
    const asset = result.assets[0];
    setFile({ uri: asset.uri, name: asset.name, mimeType: asset.mimeType ?? 'application/pdf', kind: 'pdf' });
  };

  const newChat = async () => {
    const old = sessionId;
    lastSession = null;
    setSessionId(null);
    setMessages([]);
    setAction(null);
    setFile(null);
    setInput('');
    if (token && old) clearAedHistory(token, old).catch(() => {});
  };

  const renderMessage = ({ item }: { item: Message }) => {
    if (item.role === 'user') {
      return (
        <View style={styles.userRow} testID="aed-user-message">
          <View style={styles.userBubble}>
            {item.imageUri ? <Image source={{ uri: item.imageUri }} style={styles.thumb} /> : null}
            {item.fileName ? (
              <View style={styles.fileTag}>
                <Ionicons name="document-text" size={16} color={colors.white} />
                <Text style={styles.fileTagText} numberOfLines={1}>{item.fileName}</Text>
              </View>
            ) : null}
            <Text style={styles.userText}>{item.content}</Text>
          </View>
        </View>
      );
    }
    if (item.role === 'error' && item.upgrade) {
      return (
        <UpgradePrompt compact message={item.content} requiredPlan={item.upgrade.plan}
          title={item.upgrade.plan ? `Available with ${item.upgrade.plan}` : 'Not on your plan'}
          testID="aed-upgrade" />
      );
    }
    if (item.role === 'error') {
      return (
        <View style={styles.errorCard} testID="aed-error">
          <Ionicons name="cloud-offline-outline" size={18} color={colors.warning} />
          <View style={styles.flex}>
            <Text style={styles.errorText}>{item.content}</Text>
            {item.retry ? (
              <Pressable onPress={() => retry(item)} accessibilityRole="button" style={styles.retry}
                testID="aed-retry">
                <Ionicons name="refresh" size={14} color={colors.navy} />
                <Text style={styles.retryText}>Retry</Text>
              </Pressable>
            ) : null}
          </View>
        </View>
      );
    }
    return (
      <View style={styles.answerCard} testID="aed-answer">
        <View style={styles.answerHead}>
          <AedLogo size={24} />
          <Text style={styles.answerName}>AED</Text>
        </View>
        {item.urgent ? (
          <View style={styles.urgent} accessibilityRole="alert" testID="aed-urgent">
            <Ionicons name="warning" size={18} color={colors.white} />
            <View style={styles.flex}>
              <Text style={styles.urgentTitle}>Possible emergency — act first</Text>
              <Text style={styles.urgentText}>
                Call 112 (108 for an ambulance) and move the patient to the nearest emergency department.
              </Text>
            </View>
          </View>
        ) : null}
        <AedMarkdown text={item.content} />
        {item.limitedPlan ? (
          <Pressable onPress={() => router.push('/subscription' as any)} accessibilityRole="link"
            style={styles.limited} testID="aed-limited">
            <Ionicons name="lock-closed-outline" size={14} color={colors.navy} />
            <Text style={styles.limitedText}>
              Answers with PubMed sources are available with {item.limitedPlan}.
            </Text>
          </Pressable>
        ) : null}
        {item.sources?.length ? (
          <View style={styles.sources} testID="aed-sources">
            <Text style={styles.sourcesTitle}>Sources</Text>
            {item.sources.map((s, i) => (
              <Pressable key={s.id} onPress={() => Linking.openURL(s.url)} accessibilityRole="link"
                style={({ pressed }) => [styles.source, pressed && styles.pressed]}>
                <Text style={styles.sourceIndex}>{i + 1}</Text>
                <View style={styles.flex}>
                  <Text style={styles.sourceTitle} numberOfLines={2}>{s.title}</Text>
                  <Text style={styles.sourceMeta}>{s.source}{s.year ? ` · ${s.year}` : ''}</Text>
                </View>
                <Ionicons name="open-outline" size={14} color={colors.textSecondary} />
              </Pressable>
            ))}
          </View>
        ) : null}
      </View>
    );
  };

  const empty = messages.length === 0 && !loading;
  const canSend = !loading && (!!input.trim() || !!file);

  return (
    <SafeAreaView style={styles.safe}>
      <PageColumn maxWidth={820} testID="aed-column">
        <View style={styles.header}>
          <Pressable testID="aed-back-btn" onPress={() => router.back()} accessibilityRole="button"
            accessibilityLabel="Close AED" style={styles.headerBtn}>
            <Ionicons name="chevron-down" size={24} color={colors.text} />
          </Pressable>
          <View style={styles.headerCenter}>
            <AedLogo size={36} />
            <View>
              <Text style={styles.headerName}>AED</Text>
              <Text style={styles.headerSub}>AI Healthcare Assistant</Text>
            </View>
          </View>
          {messages.length ? (
            <Pressable testID="aed-new-chat" onPress={newChat} accessibilityRole="button"
              accessibilityLabel="Start a new conversation" style={styles.headerBtn}>
              <Ionicons name="create-outline" size={22} color={colors.text} />
            </Pressable>
          ) : <View style={styles.headerBtnSpacer} />}
        </View>

        {wallet ? (
          <View style={styles.meter}>
            <AedTokenMeter wallet={wallet} compact onPress={() => router.push('/subscription' as any)}
              testID="aed-token-meter" />
          </View>
        ) : null}

        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.flex}>
          <FlatList
            ref={listRef}
            data={messages}
            renderItem={renderMessage}
            keyExtractor={item => item.id}
            contentContainerStyle={styles.list}
            onContentSizeChange={() => listRef.current?.scrollToEnd()}
            ListHeaderComponent={empty ? (
              <View style={styles.welcome} testID="aed-welcome">
                <AedLogo size={72} />
                <Text style={styles.welcomeTitle}>How can I help with your healthcare question?</Text>
                <Text style={styles.welcomeSub}>
                  Cases, lab reports, medications, research and guidelines — structured for clinical work.
                </Text>
                <View style={styles.actions}>
                  {QUICK_ACTIONS.map(qa => (
                    <Pressable key={qa.action} testID={`aed-action-${qa.action}`}
                      onPress={() => pickQuickAction(qa)} accessibilityRole="button"
                      accessibilityLabel={`${qa.label}. ${qa.hint}`}
                      style={({ pressed }) => [styles.action, pressed && styles.pressed]}>
                      <View style={styles.actionIcon}>
                        <Ionicons name={qa.icon} size={18} color={colors.teal} />
                      </View>
                      <View style={styles.flex}>
                        <Text style={styles.actionLabel}>{qa.label}</Text>
                        <Text style={styles.actionHint} numberOfLines={1}>{qa.hint}</Text>
                      </View>
                    </Pressable>
                  ))}
                </View>
              </View>
            ) : null}
            ListFooterComponent={loading ? (
              <View style={[styles.answerCard, styles.thinking]}>
                <AedLogo size={24} />
                <ActivityIndicator size="small" color={colors.red} />
                <Text style={styles.thinkingText}>AED is analysing…</Text>
              </View>
            ) : null}
          />

          {wallet?.exhausted ? (
            <View style={styles.exhausted}>
              <UpgradePrompt
                title="Your AED tokens have been used for this billing period"
                message="You can still describe an emergency — AED always answers those. Your allowance resets on the date shown above."
                requiredPlan={plans.find(p => p.rank > (plans.find(q => q.code === wallet.plan_code)?.rank ?? 0))?.name ?? null}
                compact
                testID="aed-exhausted"
              />
            </View>
          ) : null}
          <View style={styles.composer}>
            {action || file ? (
              <View style={styles.pendingRow}>
                {action ? (
                  <Pressable onPress={() => setAction(null)} accessibilityRole="button"
                    accessibilityLabel={`Remove ${action.label}`} style={styles.pendingChip}>
                    <Ionicons name={action.icon} size={14} color={colors.teal} />
                    <Text style={styles.pendingText}>{action.label}</Text>
                    <Ionicons name="close" size={14} color={colors.textSecondary} />
                  </Pressable>
                ) : null}
                {file ? (
                  <Pressable onPress={() => setFile(null)} accessibilityRole="button"
                    accessibilityLabel="Remove attached image" style={styles.pendingChip} testID="aed-file-chip">
                    {file.kind === 'image' ? (
                      <Image source={{ uri: file.uri }} style={styles.pendingThumb} />
                    ) : (
                      <Ionicons name="document-text-outline" size={16} color={colors.teal} />
                    )}
                    <Text style={styles.pendingText} numberOfLines={1}>
                      {file.kind === 'pdf' ? (file.name || 'PDF attached') : 'Image attached'}
                    </Text>
                    <Ionicons name="close" size={14} color={colors.textSecondary} />
                  </Pressable>
                ) : null}
              </View>
            ) : null}
            <View style={styles.inputShell}>
              <Pressable testID="aed-attach-btn" onPress={() => setAttachOpen(true)} accessibilityRole="button"
                accessibilityLabel="Attach a report or image" style={styles.iconBtn} disabled={loading}>
                <Ionicons name="attach" size={22} color={colors.textSecondary} />
              </Pressable>
              <TextInput
                ref={inputRef}
                testID="aed-chat-input"
                style={styles.input}
                placeholder="Ask AED a healthcare question…"
                placeholderTextColor={colors.textMuted}
                value={input}
                onChangeText={setInput}
                multiline
                maxLength={8000}
                accessibilityLabel="Your question for AED"
              />
              <Pressable
                testID="aed-send-btn"
                onPress={submit}
                disabled={!canSend}
                accessibilityRole="button"
                accessibilityLabel="Send"
                style={[styles.sendBtn, !canSend && styles.sendDisabled]}
              >
                <Ionicons name="arrow-up" size={20} color={colors.white} />
              </Pressable>
            </View>
            <Text style={styles.footnote}>
              {'AED supports clinical judgment; it doesn’t replace it. Verify before acting.'}
            </Text>
          </View>
        </KeyboardAvoidingView>
      </PageColumn>

      <Sheet visible={attachOpen} onClose={() => setAttachOpen(false)} title="Attach to AED" testID="aed-attach-sheet">
        <View style={styles.attachBody}>
          <AttachOption
            icon="image-outline" label="Image" hint="ECG, lab report photo, scan"
            locked={!entitled.AED_IMAGE_ANALYSIS} plan={planWith(plans, 'AED_IMAGE_ANALYSIS')}
            onPress={pickImage} onLocked={() => { setAttachOpen(false); router.push('/subscription' as any); }}
            testID="attach-image"
          />
          <AttachOption
            icon="document-text-outline" label="PDF document" hint="Report, discharge summary, paper"
            locked={!entitled.AED_DOCUMENT_ANALYSIS} plan={planWith(plans, 'AED_DOCUMENT_ANALYSIS')}
            onPress={pickPdf} onLocked={() => { setAttachOpen(false); router.push('/subscription' as any); }}
            testID="attach-pdf"
          />
        </View>
      </Sheet>
    </SafeAreaView>
  );
}

/** One attach choice. Locked choices stay visible, with the plan that unlocks them. */
function AttachOption({
  icon, label, hint, locked, plan, onPress, onLocked, testID,
}: {
  icon: keyof typeof Ionicons.glyphMap; label: string; hint: string; locked: boolean;
  plan: string | null; onPress: () => void; onLocked: () => void; testID: string;
}) {
  return (
    <Pressable
      onPress={locked ? onLocked : onPress}
      accessibilityRole="button"
      accessibilityLabel={locked ? `${label}. Available with ${plan}. View plans.` : `Attach ${label}`}
      style={({ pressed }) => [styles.attachRow, pressed && styles.pressed]}
      testID={testID}
    >
      <View style={styles.attachIcon}><Ionicons name={icon} size={20} color={colors.teal} /></View>
      <View style={styles.flex}>
        <Text style={styles.attachLabel}>{label}</Text>
        <Text style={styles.attachHint}>{hint}</Text>
      </View>
      {locked ? (
        <View style={styles.lockPill}>
          <Ionicons name="lock-closed" size={12} color={colors.navy} />
          <Text style={styles.lockText}>{plan}</Text>
        </View>
      ) : <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  flex: { flex: 1 },
  pressed: { opacity: 0.7 },

  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: colors.white, paddingHorizontal: spacing.md, paddingVertical: spacing.sm,
    borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  headerBtn: {
    width: MIN_TOUCH_TARGET, height: MIN_TOUCH_TARGET, borderRadius: radius.lg,
    alignItems: 'center', justifyContent: 'center',
  },
  headerBtnSpacer: { width: MIN_TOUCH_TARGET },
  headerCenter: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm + 2 },
  headerName: { ...typography.h3, color: colors.text },
  headerSub: { ...typography.small, color: colors.textSecondary },

  list: { padding: spacing.lg, paddingBottom: spacing.md, gap: spacing.md },

  welcome: { alignItems: 'center', paddingTop: spacing.xxl, gap: spacing.sm },
  welcomeTitle: { ...typography.h2, color: colors.text, textAlign: 'center', marginTop: spacing.md },
  welcomeSub: { ...typography.caption, color: colors.textSecondary, textAlign: 'center', lineHeight: 20, maxWidth: 440 },
  actions: {
    flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm,
    marginTop: spacing.xl, width: '100%',
  },
  action: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.md,
    padding: spacing.md, borderRadius: radius.xl, borderWidth: 1, borderColor: colors.border,
    backgroundColor: colors.white, flexBasis: 260, flexGrow: 1,
  },
  actionIcon: {
    width: 36, height: 36, borderRadius: radius.lg, backgroundColor: colors.tealBg,
    alignItems: 'center', justifyContent: 'center',
  },
  actionLabel: { ...typography.label, color: colors.text },
  actionHint: { ...typography.small, color: colors.textSecondary },

  userRow: { alignSelf: 'flex-end', maxWidth: '85%' },
  userBubble: {
    backgroundColor: colors.navy, borderRadius: radius.xl, borderBottomRightRadius: 4,
    padding: spacing.md + 2, gap: spacing.sm,
  },
  userText: { ...typography.body, color: colors.white, lineHeight: 22 },
  thumb: { width: 180, height: 130, borderRadius: radius.md },

  answerCard: {
    backgroundColor: colors.white, borderRadius: radius.xl, borderWidth: 1, borderColor: colors.border,
    padding: spacing.lg, gap: spacing.md,
  },
  answerHead: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  answerName: { ...typography.label, color: colors.text },
  thinking: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, alignSelf: 'flex-start' },
  thinkingText: { ...typography.caption, color: colors.textSecondary },

  urgent: {
    flexDirection: 'row', gap: spacing.sm, padding: spacing.md, borderRadius: radius.lg,
    backgroundColor: colors.red, alignItems: 'flex-start',
  },
  urgentTitle: { ...typography.label, color: colors.white },
  urgentText: { ...typography.caption, color: colors.white, lineHeight: 19 },

  sources: { gap: spacing.xs, paddingTop: spacing.md, borderTopWidth: 1, borderTopColor: colors.borderLight },
  sourcesTitle: { ...typography.overline, color: colors.teal, marginBottom: spacing.xs },
  source: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm, padding: spacing.sm,
    borderRadius: radius.md, backgroundColor: colors.bg,
  },
  sourceIndex: {
    ...typography.small, fontFamily: fonts.body.semibold, color: colors.white, backgroundColor: colors.navy,
    width: 20, height: 20, borderRadius: 10, textAlign: 'center', lineHeight: 20, overflow: 'hidden',
  },
  sourceTitle: { ...typography.caption, fontFamily: fonts.body.medium, color: colors.navy, lineHeight: 18 },
  sourceMeta: { ...typography.small, color: colors.textSecondary },

  errorCard: {
    flexDirection: 'row', gap: spacing.sm, padding: spacing.md, borderRadius: radius.xl,
    backgroundColor: colors.warningBg, borderWidth: 1, borderColor: '#FDE68A',
  },
  errorText: { ...typography.caption, color: colors.text, lineHeight: 19 },
  retry: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, marginTop: spacing.sm },
  retryText: { ...typography.small, fontFamily: fonts.body.semibold, color: colors.navy },

  composer: {
    backgroundColor: colors.white, borderTopWidth: 1, borderTopColor: colors.border,
    paddingHorizontal: spacing.md, paddingTop: spacing.sm, paddingBottom: spacing.sm, gap: spacing.xs,
  },
  pendingRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  pendingChip: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.xs, paddingHorizontal: spacing.sm + 2,
    paddingVertical: spacing.xs, borderRadius: radius.pill, backgroundColor: colors.tealBg,
  },
  pendingThumb: { width: 20, height: 20, borderRadius: 4 },
  pendingText: { ...typography.small, fontFamily: fonts.body.medium, color: colors.teal },
  inputShell: {
    flexDirection: 'row', alignItems: 'flex-end', gap: spacing.xs,
    backgroundColor: colors.bg, borderRadius: radius.xl + 6, borderWidth: 1, borderColor: colors.border,
    padding: spacing.xs,
  },
  iconBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  input: {
    ...typography.body, flex: 1, color: colors.text, maxHeight: 140,
    paddingHorizontal: spacing.xs, paddingVertical: 10,
  },
  sendBtn: {
    width: 40, height: 40, borderRadius: 20, backgroundColor: colors.red,
    alignItems: 'center', justifyContent: 'center',
  },
  sendDisabled: { opacity: 0.35 },
  meter: {
    paddingHorizontal: spacing.lg, paddingVertical: spacing.sm + 2,
    backgroundColor: colors.white, borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  exhausted: { paddingHorizontal: spacing.md, paddingTop: spacing.sm },
  limited: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.xs, paddingTop: spacing.sm,
    borderTopWidth: 1, borderTopColor: colors.borderLight,
  },
  limitedText: { ...typography.small, color: colors.navy, flex: 1 },
  fileTag: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, opacity: 0.9 },
  fileTagText: { ...typography.small, color: colors.white, flexShrink: 1 },
  attachBody: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xl, gap: spacing.sm },
  attachRow: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.md,
    borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, minHeight: MIN_TOUCH_TARGET + 12,
  },
  attachIcon: {
    width: 40, height: 40, borderRadius: radius.lg, backgroundColor: colors.tealBg,
    alignItems: 'center', justifyContent: 'center',
  },
  attachLabel: { ...typography.label, color: colors.text },
  attachHint: { ...typography.small, color: colors.textSecondary },
  lockPill: {
    flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: spacing.sm, paddingVertical: 3,
    borderRadius: radius.pill, backgroundColor: '#EFF6FF',
  },
  lockText: { ...typography.small, fontFamily: fonts.body.semibold, color: colors.navy },
  footnote: { ...typography.small, color: colors.textMuted, textAlign: 'center' },
});
