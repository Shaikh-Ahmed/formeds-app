import React, { useCallback, useEffect, useRef, useState } from 'react';
import { AiOrb, GradientFill } from '../src/components/material';
import { newIdempotencyKey } from '../src/hooks/useSubmit';
import {
  ActivityIndicator, Animated, Easing, FlatList, Image, KeyboardAvoidingView, Linking, Platform, Pressable,
  StyleSheet, Text, TextInput, View, useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import { useRouter } from 'expo-router';
import { useAuth } from '../src/context/AuthContext';
import { colors, fonts, radius, spacing, typography, MIN_TOUCH_TARGET, isRefined, isMaterial, isPremium, isTerracotta, materials, elevation, gloss, useBreakpoint } from '../src/theme';
import { useReducedMotion } from '../src/hooks/useReducedMotion';
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
  /**
   * This question's idempotency key. A Retry resends the same question with
   * the same key, so if the first attempt was answered but the reply was lost,
   * the server returns that answer instead of charging tokens twice.
   */
  key?: string;
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

// A student's AED leads with study: concepts first, case analysis last. Same
// actions, same server rules -- only the order and the welcome change.
const STUDENT_ORDER: AedAction[] = [
  'explain_concept', 'medication', 'lab_report', 'differential', 'research', 'guideline', 'compare_drugs', 'analyze_case',
];
export const quickActionsFor = (role?: string | null): QuickAction[] => role === 'student'
  ? STUDENT_ORDER.map(a => QUICK_ACTIONS.find(q => q.action === a)).filter((q): q is QuickAction => !!q)
  : QUICK_ACTIONS;

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
  // Material composer: starts one line tall and grows with the question, up
  // to four lines; focus is shown on the whole pill.
  const [inputHeight, setInputHeight] = useState(COMPOSER_MIN);
  const [inputFocused, setInputFocused] = useState(false);
  // The browser only ever reports a text box growing, never shrinking, so on
  // the web the box is measured at its natural height after each change.
  const fitInput = () => {
    if (Platform.OS !== 'web') return;
    requestAnimationFrame(() => {
      const el = inputRef.current as unknown as HTMLTextAreaElement | null;
      if (!el || !el.style) return;
      const prev = el.style.height;
      el.style.height = 'auto';
      const h = el.scrollHeight;
      el.style.height = prev;
      setInputHeight(Math.max(COMPOSER_MIN, Math.min(COMPOSER_MAX, h)));
    });
  };
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

  const sendingRef = useRef(false);
  const send = useCallback(async (pending: Pending) => {
    // A ref, not just `loading`: Enter and a click in the same frame both see
    // the old `loading`, and each question costs AED tokens.
    if (!token || loading || sendingRef.current) return;
    const text = pending.text.trim();
    if (!text && !pending.file) return;
    sendingRef.current = true;
    const key = pending.key ?? newIdempotencyKey();
    pending = { ...pending, key };
    setMessages(prev => [...prev, {
      id: `u-${Date.now()}`, role: 'user',
      content: text || 'Explain the important findings.',
      imageUri: pending.file?.kind === 'image' ? pending.file.uri : undefined,
      fileName: pending.file?.kind === 'pdf' ? (pending.file.name || 'Document.pdf') : undefined,
    }]);
    setInput(''); setInputHeight(COMPOSER_MIN);
    setAction(null);
    setFile(null);
    setLoading(true);
    try {
      const reply = pending.file
        ? await askAedWithFile(token, pending.file, text, sessionId, pending.action, key)
        : await askAed(token, text, sessionId, pending.action, key);
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
      sendingRef.current = false;
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
    setInput(''); setInputHeight(COMPOSER_MIN);
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
  // Material's panel is only as tall as the window, so the welcome scales
  // its orb down on shorter screens rather than scrolling.
  const { height: windowHeight } = useWindowDimensions();
  const shortWindow = isMaterial && windowHeight < 760;
  const orbSize = shortWindow ? 48 : windowHeight < 900 ? 68 : 80;
  const canSend = !loading && (!!input.trim() || !!file);

  // Opened from a link with nothing behind it, there is no page to go back
  // to: land on Home instead of doing nothing.
  const close = () => (router.canGoBack() ? router.back() : router.replace('/(tabs)/community' as any));

  // Material's floating panel closes on Escape, like any dialog -- unless the
  // attach sheet is open, which handles Escape itself. Caught in the capture
  // phase, because the message box swallows Escape. Two steps while typing:
  // the first Escape leaves the box (the draft is kept), the next closes.
  useEffect(() => {
    if (!isMaterial || Platform.OS !== 'web' || typeof document === 'undefined') return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || attachOpen) return;
      const el = document.activeElement as HTMLElement | null;
      if (el && (el.tagName === 'TEXTAREA' || el.tagName === 'INPUT')) { el.blur(); return; }
      close();
    };
    document.addEventListener('keydown', onKey, true);
    return () => document.removeEventListener('keydown', onKey, true);
  });

  return (
    <SafeAreaView style={[styles.safe, isMaterial && styles.mSafe]}>
      {isMaterial ? (
        // The page behind stays visible, dimmed; a click outside closes AED.
        <Pressable style={styles.mScrim} onPress={close} accessibilityRole="button"
          accessibilityLabel="Close AED" testID="aed-scrim" />
      ) : null}
      <AedFrame>
        <View style={[styles.header, isMaterial && styles.mHeader, isPremium && styles.cHeader]}>
          {/* Premium: AED's header is the navy anchor -- the clinical AI's own surface. */}
          {isPremium ? <GradientFill name="featured" style={StyleSheet.absoluteFill} pointerEvents="none" /> : null}
          <Pressable testID="aed-back-btn" onPress={close} accessibilityRole="button"
            accessibilityLabel="Close AED" style={styles.headerBtn}>
            <Ionicons name="chevron-down" size={24} color={isPremium ? colors.white : colors.text} />
          </Pressable>
          <View style={styles.headerCenter}>
            <AedLogo size={36} />
            <View>
              {/* Premium names it in full, so "AED" is never read as the
                  defibrillator: ForMeds' clinical-support workspace. */}
              <View style={styles.cNameRow}>
                <Text style={[styles.headerName, isPremium && styles.cHeaderName]}>{isRefined ? 'AED Assist' : 'AED'}</Text>
                {isPremium ? (
                  <View style={styles.cLive}>
                    <View style={styles.cLiveDot} />
                    <Text style={styles.cLiveText}>Live</Text>
                  </View>
                ) : null}
              </View>
              <Text style={[styles.headerSub, isPremium && styles.cHeaderSub]}>{isRefined ? 'Clinical support workspace · ForMeds' : 'AI Healthcare Assistant'}</Text>
            </View>
          </View>
          {messages.length ? (
            <Pressable testID="aed-new-chat" onPress={newChat} accessibilityRole="button"
              accessibilityLabel="Start a new conversation" style={styles.headerBtn}>
              <Ionicons name="create-outline" size={22} color={isPremium ? colors.white : colors.text} />
            </Pressable>
          ) : <View style={styles.headerBtnSpacer} />}
        </View>

        {wallet ? (
          <View style={[styles.meter, isMaterial && styles.mMeter]}>
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
              <View style={[styles.welcome, isMaterial && styles.mWelcome]} testID="aed-welcome">
                {/* Material: AED's presence as a soft intelligence orb. */}
                {isMaterial ? <View style={[styles.mOrb, { marginTop: orbSize * 0.35 }]}><AiOrb size={orbSize} /></View> : <AedLogo size={72} />}
                {/* On a short window the welcome tightens to fit: a one-line
                    title, and the actions themselves say what AED covers. */}
                <Text style={[styles.welcomeTitle, isMaterial && styles.mWelcomeTitle]}>
                  {shortWindow ? 'How can I help?' : 'How can I help with your healthcare question?'}
                </Text>
                {shortWindow ? null : <Text style={[styles.welcomeSub, isMaterial && styles.mWelcomeSub]}>
                  {user?.role === 'student'
                    ? 'Concepts, drugs, lab values, research and guidelines — explained for your studies.'
                    : 'Cases, lab reports, medications, research and guidelines — structured for clinical work.'}
                </Text>}
                <View style={[styles.actions, isMaterial && styles.mActions]}>
                  {quickActionsFor(user?.role).map(qa => (
                    <Pressable key={qa.action} testID={`aed-action-${qa.action}`}
                      onPress={() => pickQuickAction(qa)} accessibilityRole="button"
                      accessibilityLabel={`${qa.label}. ${qa.hint}`}
                      style={({ pressed }) => [styles.action, isMaterial && styles.mAction, pressed && styles.pressed]}>
                      <View style={[styles.actionIcon, isMaterial && styles.mActionIcon]}>
                        <Ionicons name={qa.icon} size={isMaterial ? 12 : 18} color={isMaterial ? colors.white : colors.teal} />
                      </View>
                      {isMaterial ? (
                        // Material: a compact pill -- the label alone; the
                        // hint is still announced via the accessibility label.
                        <Text style={styles.mActionLabel} numberOfLines={1}>{qa.label}</Text>
                      ) : (
                        <View style={styles.flex}>
                          <Text style={styles.actionLabel}>{qa.label}</Text>
                          <Text style={styles.actionHint} numberOfLines={1}>{qa.hint}</Text>
                        </View>
                      )}
                    </Pressable>
                  ))}
                </View>
              </View>
            ) : null}
            ListFooterComponent={loading ? (
              <View style={[styles.answerCard, styles.thinking]}>
                {isMaterial ? <AiOrb size={28} thinking /> : (
                  <>
                    <AedLogo size={24} />
                    <ActivityIndicator size="small" color={colors.red} />
                  </>
                )}
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
          <View style={[styles.composer, isMaterial && styles.mComposer]}>
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
            <View style={[styles.inputShell, isMaterial && styles.mInputShell, isMaterial && inputFocused && styles.mInputShellFocus,
              isPremium && styles.cInputShell, isPremium && inputFocused && styles.cInputFocus]}>
              <Pressable testID="aed-attach-btn" onPress={() => setAttachOpen(true)} accessibilityRole="button"
                accessibilityLabel="Attach a report or image" style={[styles.iconBtn, isMaterial && styles.mIconBtn]} disabled={loading}>
                <Ionicons name="attach" size={isMaterial ? 19 : 22} color={colors.textSecondary} />
              </Pressable>
              <TextInput
                ref={inputRef}
                testID="aed-chat-input"
                style={isMaterial ? [styles.input, styles.mInput, { height: inputHeight }] : styles.input}
                onFocus={() => setInputFocused(true)}
                onBlur={() => setInputFocused(false)}
                onContentSizeChange={isMaterial && Platform.OS !== 'web' ? e => {
                  const h = Math.ceil(e.nativeEvent.contentSize.height);
                  setInputHeight(Math.max(COMPOSER_MIN, Math.min(COMPOSER_MAX, h)));
                } : undefined}
                placeholder="Ask AED a healthcare question…"
                placeholderTextColor={colors.textMuted}
                value={input}
                onChangeText={text => { setInput(text); if (isMaterial) fitInput(); }}
                multiline
                // One row to start (a web textarea defaults to two); it grows from there.
                numberOfLines={isMaterial ? 1 : undefined}
                maxLength={8000}
                accessibilityLabel="Your question for AED"
              />
              <Pressable
                testID="aed-send-btn"
                onPress={submit}
                disabled={!canSend}
                accessibilityRole="button"
                accessibilityLabel="Send"
                style={[styles.sendBtn, isMaterial && styles.mSendBtn, !canSend && styles.sendDisabled]}
              >
                <Ionicons name="arrow-up" size={isMaterial ? 18 : 20} color={colors.white} />
              </Pressable>
            </View>
            <Text style={[styles.footnote, isMaterial && styles.mFootnote]}>
              {'AED supports clinical judgment; it doesn’t replace it. Verify before acting.'}
            </Text>
          </View>
        </KeyboardAvoidingView>
      </AedFrame>

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

/** Material composer height: one line, growing to four. */
const COMPOSER_MIN = 36;
const COMPOSER_MAX = 96;

/**
 * Where AED is drawn. Material: a floating glass panel -- bottom-right on wide
 * screens, an inset sheet on phones -- rising softly into place. Every other
 * theme: the original centred page column.
 */
function AedFrame({ children }: { children: React.ReactNode }) {
  const { isMobile } = useBreakpoint();
  const reduced = useReducedMotion();
  const rise = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (!isMaterial) return;
    if (reduced) { rise.setValue(1); return; }
    Animated.timing(rise, { toValue: 1, duration: 220, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
  }, [rise, reduced]);

  if (!isMaterial) return <PageColumn maxWidth={820} testID="aed-column">{children}</PageColumn>;
  return (
    <Animated.View testID="aed-column" accessibilityViewIsModal accessibilityLabel="AED Assist"
      {...({ role: 'dialog', 'aria-modal': true } as object)}
      style={[styles.mPanel, isMobile ? styles.mPanelMobile : styles.mPanelWide, {
        opacity: rise,
        transform: [{ translateY: rise.interpolate({ inputRange: [0, 1], outputRange: [18, 0] }) }],
      }]}>
      {children}
    </Animated.View>
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
  // -- Premium -----------------------------------------------------------------
  cHeader: { overflow: 'hidden', borderBottomWidth: 0 },
  cNameRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  cHeaderName: { color: colors.white },
  cHeaderSub: { color: '#CBD5E1' },
  cLive: {
    flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 8, paddingVertical: 2,
    borderRadius: radius.pill, backgroundColor: 'rgba(16,185,129,0.14)', borderWidth: 1, borderColor: 'rgba(16,185,129,0.32)',
  },
  cLiveDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#34D399' },
  cLiveText: { fontSize: 10.5, fontFamily: fonts.body.bold, color: '#6EE7B7' },
  cInputShell: {
    backgroundColor: colors.bgMuted, borderColor: 'transparent', borderRadius: 24,
    ...(Platform.OS === 'web' ? ({ boxShadow: 'inset 0 1px 2px rgba(15,23,42,0.06)', transition: 'background-color 200ms cubic-bezier(0.2,0,0,1), box-shadow 200ms cubic-bezier(0.2,0,0,1)' } as object) : {}),
  },
  cInputFocus: Platform.OS === 'web'
    ? ({ backgroundColor: colors.white, borderColor: colors.teal, boxShadow: '0 0 0 3px rgba(15,118,110,0.14)' } as object)
    : { backgroundColor: colors.white, borderColor: colors.teal },
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
    backgroundColor: colors.primaryFill, borderRadius: radius.xl, borderBottomRightRadius: 4,
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
    ...typography.small, fontFamily: fonts.body.semibold, color: colors.white, backgroundColor: colors.primaryFill,
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

  // ── ForMeds Material ─────────────────────────────────────────────────────
  mOrb: { marginBottom: spacing.sm },

  // ── Material: the floating panel ─────────────────────────────────────────
  mSafe: { backgroundColor: 'transparent' },
  // A light dim only -- no blur -- so the feed or job behind stays readable.
  mScrim: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(10,25,60,0.12)' },
  mPanel: {
    position: 'absolute', overflow: 'hidden', borderRadius: 22, borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.9)', backgroundColor: isTerracotta ? 'rgba(252,249,244,0.92)' : 'rgba(255,255,255,0.9)',
    ...(Platform.OS === 'web'
      ? ({
        // Frosted, but opaque enough that text on the page behind never
        // ghosts through the conversation.
        backgroundColor: 'rgba(255,255,255,0.94)',
        backdropFilter: 'blur(28px) saturate(180%)', WebkitBackdropFilter: 'blur(28px) saturate(180%)',
        boxShadow: 'inset 0 1px 0 rgba(255,255,255,1), 0 8px 24px -12px rgba(20,40,90,0.28), 0 32px 72px -20px rgba(20,40,90,0.45)',
      } as object)
      : { shadowColor: '#142C63', shadowOpacity: 0.3, shadowRadius: 30, shadowOffset: { width: 0, height: 16 }, elevation: 16 }),
  },
  // Wide screens: a chat panel in the bottom-right corner, below the top bar.
  mPanelWide: { right: spacing.xl, bottom: spacing.xl, top: spacing.lg, width: 380 },
  // Phones: an inset sheet, the page still peeking out above it.
  mPanelMobile: { left: spacing.sm, right: spacing.sm, bottom: spacing.sm, top: 44 },

  // ── Material: glossy header and meter, glass quick-action pills ─────────
  // The header: a pale blue glass band lit along its top, over the sheet.
  mHeader: Platform.OS === 'web'
    ? ({
      backgroundColor: 'transparent', borderBottomColor: colors.borderLight,
      backgroundImage: isTerracotta
        ? 'linear-gradient(180deg, #FCF8F2 0%, #F4EADF 100%)'
        : 'linear-gradient(180deg, #F6F9FE 0%, #EAF0FA 100%)',
      boxShadow: `inset 0 1px 0 rgba(255,255,255,1), 0 6px 16px -10px ${isTerracotta ? 'rgba(90,45,20,0.25)' : 'rgba(20,40,90,0.25)'}`,
    } as object)
    : { backgroundColor: colors.featured, borderBottomColor: colors.borderLight },
  // The meter: a small glass card inset from the edges, not a full-width band.
  // The meter is a small glass pill of its own (see AedTokenMeter); the row
  // only places it.
  mMeter: {
    paddingHorizontal: spacing.lg, paddingTop: spacing.md, paddingBottom: 0,
    backgroundColor: 'transparent', borderBottomWidth: 0, alignItems: 'center',
  },
  mWelcome: { paddingTop: 0, gap: 4 },
  mWelcomeTitle: { ...typography.h3, textAlign: 'center', marginTop: 2, maxWidth: 300 },
  mWelcomeSub: { ...typography.small, maxWidth: 300 },
  mActions: { justifyContent: 'center', marginTop: spacing.md, gap: 6 },
  mAction: {
    flexBasis: 'auto', flexGrow: 0, gap: spacing.sm,
    paddingVertical: 6, paddingLeft: 6, paddingRight: spacing.md, borderRadius: radius.pill,
    borderColor: colors.borderLight, ...gloss.glass,
  },
  // A small glossy disc of the brand blue for the icon.
  mActionIcon: { width: 22, height: 22, borderRadius: 11, backgroundColor: colors.action, ...gloss.fill },
  mActionLabel: { ...typography.small, fontFamily: fonts.body.semibold, color: colors.text },
  // The composer floats: a glass shell lifted off the conversation.
  mComposer: { backgroundColor: 'transparent', borderTopWidth: 0, paddingHorizontal: spacing.md, paddingTop: spacing.xs, paddingBottom: spacing.sm },
  mInputShell: {
    backgroundColor: materials.glass.fill, borderColor: materials.glass.border, borderRadius: 20,
    paddingHorizontal: 4, paddingVertical: 4, alignItems: 'flex-end', ...elevation.featured,
    ...(Platform.OS === 'web' ? ({ backdropFilter: materials.glass.blur, WebkitBackdropFilter: materials.glass.blur } as object) : {}),
  },
  // Focus lives on the whole pill: a brand-blue border and a soft ring. It
  // replaces the browser outline on the bare text field, never removes it.
  mInputShellFocus: Platform.OS === 'web'
    ? ({
      borderColor: colors.action,
      boxShadow: `0 0 0 3px rgba(${materials.tint},0.16), inset 0 1px 0 rgba(255,255,255,0.95), 0 14px 30px -14px rgba(${materials.tint},0.30)`,
    } as object)
    : { borderColor: colors.action },
  mInput: {
    fontSize: 14, lineHeight: 20, paddingVertical: 8, paddingHorizontal: 4,
    maxHeight: COMPOSER_MAX,
    ...(Platform.OS === 'web' ? ({ outlineStyle: 'none', resize: 'none' } as object) : {}),
  },
  mIconBtn: { width: 36, height: 36 },
  mSendBtn: { width: 36, height: 36, borderRadius: 18 },
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
    borderRadius: radius.pill, backgroundColor: colors.tintBg,
  },
  lockText: { ...typography.small, fontFamily: fonts.body.semibold, color: colors.navy },
  footnote: { ...typography.small, color: colors.textMuted, textAlign: 'center' },
  mFootnote: { fontSize: 11, lineHeight: 14 },
});
