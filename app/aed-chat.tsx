import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import {
  AccessibilityInfo, ActivityIndicator, Animated, FlatList, Image, KeyboardAvoidingView, Linking, Platform,
  Pressable, StyleSheet, Text, TextInput, View,
  type NativeSyntheticEvent, type TextInputKeyPressEventData,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import { useDictation } from '../src/hooks/useDictation';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useAuth } from '../src/context/AuthContext';
import { colors, fonts, radius, spacing, typography, useBreakpoint, MIN_TOUCH_TARGET } from '../src/theme';
import { PageColumn } from '../src/components/web';
import { AedMarkdown } from '../src/components/aed/AedMarkdown';
import { AedLogo } from '../src/components/aed/AedLogo';
import { AedHistoryList } from '../src/components/aed/AedHistoryList';
import { Sheet } from '../src/components/Sheet';
import { AedTokenMeter } from '../src/components/subscriptions/AedTokenMeter';
import { UpgradePrompt } from '../src/components/subscriptions/UpgradePrompt';
import { fetchMySubscription, fetchPlans } from '../src/api/subscriptions';
import type { AedWallet, Entitlements, Plan } from '../src/types/subscriptions';
import {
  aedErrorMessage, askAed, askAedWithFile, clearAedHistory, fetchAedHistory,
  type AedAction, type AedSource,
} from '../src/api/aed';
import {
  fetchAedConfig, fetchAgentConversation, runAedWithFile, streamAedRun,
  type AedCitation, type AedConfig, type AedFinal, type AedResource, type AedUrgency,
} from '../src/api/aedStream';
import { FEEDBACK_REASONS, sendFeedback, type FeedbackReason } from '../src/api/aedMemory';

interface Message {
  id: string;
  role: 'user' | 'assistant' | 'error';
  content: string;
  urgent?: boolean;
  sources?: AedSource[];
  /** Agent answers: numbered sources, matching the [n] in the text. */
  citations?: AedCitation[];
  /** While an agent answer is still arriving, and what AED is doing meanwhile. */
  streaming?: boolean;
  status?: string;
  /** The error asks the user to complete KYC verification. */
  verify?: boolean;
  /** Agent answers: the run (for feedback), related ForMeds content, and the member's rating. */
  runId?: string;
  resources?: AedResource[];
  saved?: boolean;
  rating?: 'up' | 'down';
  imageUri?: string;
  fileName?: string;
  /** What to resend when an error bubble's Retry is pressed. */
  retry?: Pending;
  /** The plan that would unlock what was refused. */
  upgrade?: { plan: string | null };
  /** The plan that would have added sources to this answer. */
  limitedPlan?: string | null;
  /** How soon to act, for the badge on emergency and same-day answers. */
  urgency?: AedUrgency | null;
}

interface Pending {
  text: string;
  action: AedAction | null;
  file: PickedFile | null;
  /** Think deeper: the user's explicit choice (charged at the Thinking rate). */
  thinkDeeper?: boolean;
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

/** An agent answer as a chat message. */
function answerFromFinal(id: string, final: AedFinal, runId?: string): Message {
  return {
    id, role: 'assistant', content: final.response, urgent: final.urgent,
    citations: final.sources, limitedPlan: final.limited_by_plan?.required_plan ?? undefined,
    streaming: false, status: undefined, runId, resources: final.resources ?? [], saved: final.saved,
    urgency: final.urgency ?? null,
  };
}

const TITLES = new Set(['dr', 'prof', 'professor', 'mr', 'mrs', 'ms', 'miss', 'mx', 'sr', 'sister', 'nurse', 'sri',
  'shri', 'smt', 'km', 'kumari']);

/** The given name, without a title: "Dr. Priya Sharma" -> "Priya". */
export function givenName(name?: string | null): string {
  return (name || '').replace(/\./g, ' ').split(/\s+/).find(w => w && !TITLES.has(w.toLowerCase())) || '';
}

const rememberedSession = (userId?: string): string | null =>
  userId && lastSession?.userId === userId ? lastSession.sessionId : null;

// The question box grows with its text, up to a limit, then scrolls.
const INPUT_MIN_HEIGHT = 44;
const INPUT_MAX_HEIGHT = 168;

/** An answer as plain text for the clipboard, with its sources listed after it. */
export function answerForClipboard(msg: { content: string; citations?: AedCitation[]; sources?: AedSource[] }): string {
  const sources = msg.citations?.length
    ? msg.citations.map(s => `[${s.n}] ${s.title}${s.year ? ` (${s.year})` : ''} ${s.url}`)
    : (msg.sources ?? []).map((s, i) => `[${i + 1}] ${s.title}${s.year ? ` (${s.year})` : ''} ${s.url}`);
  return sources.length ? `${msg.content.trim()}\n\nSources:\n${sources.join('\n')}` : msg.content.trim();
}

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
  // Opened from the chat list: /aed-chat?c=<conversation id>, or ?new=<nonce> for a new chat.
  const { c: openConversation, new: newParam } = useLocalSearchParams<{ c?: string; new?: string }>();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [action, setAction] = useState<QuickAction | null>(null);
  const [file, setFile] = useState<PickedFile | null>(null);
  const [loading, setLoading] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(() => openConversation || rememberedSession(userId));
  const [feedbackFor, setFeedbackFor] = useState<Message | null>(null);
  const [reasons, setReasons] = useState<FeedbackReason[]>([]);
  const [wallet, setWallet] = useState<AedWallet | null>(null);
  const [entitled, setEntitled] = useState<Entitlements>({});
  const [plans, setPlans] = useState<Plan[]>([]);
  const [attachOpen, setAttachOpen] = useState(false);
  // The AED agent's features, or null when this backend has no agent (the
  // classic endpoints are used then). Undefined until /api/aed/config answers.
  const [agent, setAgent] = useState<AedConfig | null | undefined>(undefined);
  const [thinkDeeper, setThinkDeeper] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  // Which answers have their evidence list open (folded by default).
  const [openEvidence, setOpenEvidence] = useState<Record<string, boolean>>({});
  const toggleEvidence = (id: string) => setOpenEvidence(prev => ({ ...prev, [id]: !prev[id] }));
  // Bumped when a chat is saved, so the sidebar list picks it up.
  const [historyKey, setHistoryKey] = useState(0);
  const { width } = useBreakpoint();
  const listRef = useRef<FlatList>(null);
  const inputRef = useRef<TextInput>(null);
  // Dictated words go straight into the question box, live, after whatever was typed.
  const dictation = useDictation(setInput);

  useEffect(() => {
    if (!token) return;
    fetchAedConfig(token).then(setAgent).catch(() => setAgent(null));
  }, [token]);

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

  // Restore the remembered conversation once, when this screen opens -- and
  // never over messages already on screen (the agent check can finish after
  // the first question was sent).
  const restored = useRef(false);
  useEffect(() => {
    if (restored.current || !token || agent === undefined) return;
    restored.current = true;
    if (agent && (openConversation || newParam)) return;         // the effect below handles these
    const remembered = rememberedSession(userId);
    if (!remembered) return;
    setSessionId(remembered);
    const load = agent
      ? fetchAgentConversation(token, remembered).then(c => c.messages)
      : fetchAedHistory(token, remembered);
    load
      .then(items => setMessages(prev => (prev.length ? prev
        : items.map(m => ({ id: m.id, role: m.role, content: m.content })))))
      .catch(() => { lastSession = null; setSessionId(null); });
  }, [token, userId, agent, openConversation, newParam]);

  // Open a chat from the list (or a link), or start a new one, each time the
  // route asks -- not only when the screen first opens.
  const handledRoute = useRef<string | null>(null);
  useEffect(() => {
    if (!token || !agent) return;
    const key = openConversation ? 'c:' + openConversation : newParam ? 'n:' + newParam : null;
    if (!key || handledRoute.current === key) return;
    handledRoute.current = key;
    if (openConversation) openChat(openConversation);
    else newChat();
    // openChat/newChat read current state; re-running on their identity would reopen the chat.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, agent, openConversation, newParam]);

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
    const answerId = `a-${Date.now()}`;
    const remember = (id: string) => {
      if (userId) lastSession = { userId, sessionId: id };
      setSessionId(id);
    };
    try {
      if (agent) {
        const input = {
          message: text || 'Explain the important findings.', conversation_id: sessionId,
          action: pending.action, mode: pending.thinkDeeper ? 'thinking' as const : 'auto' as const,
        };
        let final: AedFinal;
        let runId: string | undefined;
        if (pending.file) {
          final = await runAedWithFile(token, pending.file, input);
        } else {
          // The card appears at once and grows as the answer arrives.
          const patch = (fn: (m: Message) => Message) =>
            setMessages(prev => prev.map(m => (m.id === answerId ? fn(m) : m)));
          setMessages(prev => [...prev, {
            id: answerId, role: 'assistant', content: '', streaming: true, status: 'Understanding the question',
          }]);
          final = await streamAedRun(token, input, ev => {
            if (ev.type === 'meta') {
              remember(ev.conversation_id); runId = ev.run_id;
              patch(m => ({ ...m, runId, urgency: ev.urgency ?? null }));
            }
            else if (ev.type === 'resources') patch(m => ({ ...m, resources: ev.items }));
            else if (ev.type === 'urgent') patch(m => ({ ...m, urgent: true }));
            else if (ev.type === 'status') patch(m => ({ ...m, status: ev.label }));
            else if (ev.type === 'sources') patch(m => ({ ...m, citations: ev.items }));
            else if (ev.type === 'token') patch(m => ({ ...m, content: m.content + ev.text }));
          });
        }
        remember(final.conversation_id);
        if (final.saved) setHistoryKey(k => k + 1);
        if (final.aed_tokens) setWallet(final.aed_tokens);
        // The checked final answer replaces whatever was streamed.
        const answer = answerFromFinal(answerId, final, runId);
        setMessages(prev => prev.some(m => m.id === answerId)
          ? prev.map(m => (m.id === answerId ? answer : m))
          : [...prev, answer]);
        return;
      }
      const reply = pending.file
        ? await askAedWithFile(token, pending.file, text, sessionId, pending.action)
        : await askAed(token, text, sessionId, pending.action);
      remember(reply.session_id);
      if (reply.aed_tokens) setWallet(reply.aed_tokens);
      setMessages(prev => [...prev, {
        id: answerId, role: 'assistant', content: reply.response,
        urgent: reply.urgent, sources: reply.sources,
        limitedPlan: reply.limited_by_plan?.required_plan,
      }]);
    } catch (e: any) {
      const detail = e?.data?.detail ?? {};
      const upgrade = e?.code === 'aed_tokens_exhausted'
        ? { plan: detail.upgrade_to ?? null }
        : e?.code === 'aed_upgrade_required' ? { plan: detail.required_plan ?? null } : undefined;
      const verify = e?.code === 'aed_verification_required';
      if (e?.code === 'aed_tokens_exhausted') loadPlan();
      setMessages(prev => [...prev.filter(m => m.id !== answerId), {
        id: `e-${Date.now()}`, role: 'error', content: aedErrorMessage(e),
        retry: upgrade || verify ? undefined : pending, upgrade, verify,
      }]);
    } finally {
      setLoading(false);
    }
  }, [token, loading, sessionId, userId, loadPlan, agent]);

  const submit = () => {
    if (dictation.listening) dictation.stop();
    dictation.clearError();
    send({ text: input, action: action?.action ?? null, file, thinkDeeper });
  };

  // Web and hardware keyboards: Enter sends, Shift+Enter starts a new line. A
  // word still being composed in an IME is left alone. On a phone's own
  // keyboard the return key keeps adding a line; the send button sends.
  const onKeyPress = (e: NativeSyntheticEvent<TextInputKeyPressEventData>) => {
    if (Platform.OS !== 'web') return;
    const key = e.nativeEvent as TextInputKeyPressEventData & { shiftKey?: boolean; isComposing?: boolean };
    if (key.key !== 'Enter' || key.shiftKey || key.isComposing) return;
    e.preventDefault();
    if (canSend) submit();
  };

  // On web the question box is a <textarea>, which never reports shrinking
  // content: collapse it, then size it to what it holds. Phones grow natively.
  useLayoutEffect(() => {
    if (Platform.OS !== 'web') return;
    const el = inputRef.current as unknown as HTMLTextAreaElement | null;
    if (!el?.style) return;
    el.style.height = '0px';
    el.style.height = `${Math.min(INPUT_MAX_HEIGHT, Math.max(INPUT_MIN_HEIGHT, el.scrollHeight))}px`;
  }, [input]);

  const toggleDictation = () => {
    if (dictation.listening) dictation.stop();
    else dictation.start(input);
  };

  const copyAnswer = async (msg: Message) => {
    try {
      await Clipboard.setStringAsync(answerForClipboard(msg));
      setCopiedId(msg.id);
      setTimeout(() => setCopiedId(id => (id === msg.id ? null : id)), 2000);
    } catch {
      // Copy is a convenience; nothing to recover.
    }
  };

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

  // A new chat leaves the previous one where it is: saved chats stay in the
  // list. Only the classic endpoint, which keeps nothing, is told to forget it.
  const newChat = () => {
    const old = sessionId;
    if (dictation.listening) dictation.stop();
    lastSession = null;
    setSessionId(null);
    setMessages([]);
    setAction(null);
    setFile(null);
    setInput('');
    if (token && old && !agent) clearAedHistory(token, old).catch(() => {});
  };

  const openChat = (id: string) => {
    if (!token || loading) return;
    if (dictation.listening) dictation.stop();
    if (userId) lastSession = { userId, sessionId: id };
    setSessionId(id);
    setAction(null);
    setFile(null);
    setInput('');
    setMessages([]);
    fetchAgentConversation(token, id)
      .then(c => setMessages(c.messages.map(m => ({ id: m.id, role: m.role, content: m.content }))))
      .catch(() => {
        setMessages([{ id: 'e-' + Date.now(), role: 'error', content: 'This chat couldn’t be opened. It may have been deleted.' }]);
      });
  };

  const openCitation = (citations: AedCitation[] | undefined) => (n: number) => {
    const source = citations?.find(c => c.n === n);
    if (source) Linking.openURL(source.url);
  };

  // Feedback: a thumbs-up is sent at once; a thumbs-down asks what was wrong.
  const rate = (msg: Message, rating: 'up' | 'down') => {
    if (!token || !msg.runId) return;
    setMessages(prev => prev.map(m => (m.id === msg.id ? { ...m, rating } : m)));
    if (rating === 'up') {
      sendFeedback(token, { run_id: msg.runId, rating: 'up' }).catch(() => {});
    } else {
      setReasons([]);
      setFeedbackFor(msg);
    }
  };
  const submitDown = () => {
    if (token && feedbackFor?.runId) {
      sendFeedback(token, { run_id: feedbackFor.runId, rating: 'down', reasons }).catch(() => {});
    }
    setFeedbackFor(null);
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
    if (item.role === 'error' && item.verify) {
      return (
        <View style={styles.errorCard} testID="aed-verify">
          <Ionicons name="shield-checkmark-outline" size={18} color={colors.navy} />
          <View style={styles.flex}>
            <Text style={styles.errorText}>{item.content}</Text>
            <Pressable onPress={() => router.push('/kyc' as any)} accessibilityRole="button" style={styles.retry}
              testID="aed-verify-btn">
              <Ionicons name="arrow-forward" size={14} color={colors.navy} />
              <Text style={styles.retryText}>Verify my registration</Text>
            </Pressable>
          </View>
        </View>
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
          {item.urgency === 'emergency' || item.urgency === 'same_day' ? (
            // Only when acting now matters: an important but routine issue gets no badge.
            <View style={[styles.urgencyBadge, item.urgency === 'emergency' ? styles.urgencyEmergency : styles.urgencyUrgent]}
              testID="aed-urgency" accessibilityLabel={item.urgency === 'emergency' ? 'Emergency' : 'Urgent: same day'}>
              <Text style={[styles.urgencyText, item.urgency === 'emergency' ? styles.urgencyTextEmergency : styles.urgencyTextUrgent]}>
                {item.urgency === 'emergency' ? 'EMERGENCY' : 'URGENT · SAME DAY'}
              </Text>
            </View>
          ) : null}
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
        {item.content ? <AedMarkdown text={item.content} onCite={openCitation(item.citations)} /> : null}
        {item.streaming ? (
          <View style={styles.statusRow} testID="aed-status" accessibilityLiveRegion="polite">
            <ActivityIndicator size="small" color={colors.red} />
            <Text style={styles.thinkingText}>{item.status ?? 'AED is analysing'}…</Text>
          </View>
        ) : null}
        {item.limitedPlan && !item.streaming ? (
          <Pressable onPress={() => router.push('/subscription' as any)} accessibilityRole="link"
            style={styles.limited} testID="aed-limited">
            <Ionicons name="lock-closed-outline" size={14} color={colors.navy} />
            <Text style={styles.limitedText}>
              {item.citations
                ? `Deep research across Europe PMC and ClinicalTrials.gov is available with ${item.limitedPlan}.`
                : `Answers with PubMed sources are available with ${item.limitedPlan}.`}
            </Text>
          </Pressable>
        ) : null}
        {item.citations?.length ? (
          <View style={styles.sources} testID="aed-sources">
            <Pressable onPress={() => toggleEvidence(item.id)} accessibilityRole="button"
              accessibilityState={{ expanded: !!openEvidence[item.id] }} style={styles.sourcesToggle}
              testID="aed-evidence-toggle">
              <Text style={[styles.sourcesTitle, styles.sourcesTitleInline]}>Evidence ({item.citations.length})</Text>
              <Text style={styles.sourcesToggleText}>{openEvidence[item.id] ? 'Hide' : 'Show'}</Text>
              <Ionicons name={openEvidence[item.id] ? 'chevron-up' : 'chevron-down'} size={14} color={colors.teal} />
            </Pressable>
            {openEvidence[item.id] ? item.citations.map(s => (
              <Pressable key={`${s.n}-${s.id}`} onPress={() => Linking.openURL(s.url)} accessibilityRole="link"
                style={({ pressed }) => [styles.source, pressed && styles.pressed]} testID={`aed-source-${s.n}`}>
                <Text style={styles.sourceIndex}>{s.n}</Text>
                <View style={styles.flex}>
                  <Text style={styles.sourceTitle} numberOfLines={2}>{s.title}</Text>
                  <Text style={styles.sourceMeta}>
                    {s.source}{s.year ? ` · ${s.year}` : ''}{s.evidence_type !== 'other' ? ` · ${s.evidence_type.replace(/_/g, ' ')}` : ''}
                  </Text>
                </View>
                <Ionicons name="open-outline" size={14} color={colors.textSecondary} />
              </Pressable>
            )) : null}
          </View>
        ) : item.sources?.length ? (
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
        {item.resources?.length && !item.streaming ? (
          <View style={styles.sources} testID="aed-resources">
            <Text style={styles.sourcesTitle}>On ForMeds</Text>
            {item.resources.map(r => (
              <Pressable key={r.kind + '-' + r.id} onPress={() => router.push(r.path as any)} accessibilityRole="link"
                style={({ pressed }) => [styles.source, pressed && styles.pressed]} testID={'aed-resource-' + r.id}>
                <Ionicons name={r.kind === 'cme' ? 'school-outline' : 'people-outline'} size={16} color={colors.teal} />
                <View style={styles.flex}>
                  <Text style={styles.sourceTitle} numberOfLines={2}>{r.title}</Text>
                  <Text style={styles.sourceMeta}>{r.kind === 'cme' ? '' : 'Case discussion · '}{r.subtitle}</Text>
                </View>
                <Ionicons name="chevron-forward" size={14} color={colors.textSecondary} />
              </Pressable>
            ))}
          </View>
        ) : null}
        {item.content && !item.streaming ? (
          <View style={styles.feedbackRow} testID={item.runId ? 'aed-feedback' : 'aed-answer-actions'}>
            {item.saved ? (
              <View style={styles.savedTag}>
                <Ionicons name="bookmark" size={12} color={colors.teal} />
                <Text style={styles.savedText}>Saved</Text>
              </View>
            ) : item.runId && item.saved === false && agent?.features.saved_history ? (
              // Said plainly, so a chat missing from the list later is no surprise.
              <View style={styles.savedTag} testID="aed-not-saved">
                <Ionicons name="bookmark-outline" size={12} color={colors.textSecondary} />
                <Text style={styles.notSavedText}>Not saved</Text>
              </View>
            ) : <View />}
            <View style={styles.thumbs}>
              <Pressable onPress={() => copyAnswer(item)} accessibilityRole="button"
                accessibilityLabel={copiedId === item.id ? 'Copied' : 'Copy answer with sources'}
                style={({ pressed }) => [styles.actionBtn, pressed && styles.actionBtnPressed]} testID="aed-copy">
                <Ionicons name={copiedId === item.id ? 'checkmark' : 'copy-outline'} size={18}
                  color={copiedId === item.id ? colors.teal : colors.textSecondary} />
              </Pressable>
              {item.runId ? <>
              <Pressable onPress={() => rate(item, 'up')} accessibilityRole="button" accessibilityLabel="Helpful"
                accessibilityState={{ selected: item.rating === 'up' }}
                style={({ pressed }) => [styles.actionBtn, pressed && styles.actionBtnPressed]} testID="aed-thumb-up">
                <Ionicons name={item.rating === 'up' ? 'thumbs-up' : 'thumbs-up-outline'} size={18}
                  color={item.rating === 'up' ? colors.teal : colors.textSecondary} />
              </Pressable>
              <Pressable onPress={() => rate(item, 'down')} accessibilityRole="button" accessibilityLabel="Not helpful"
                accessibilityState={{ selected: item.rating === 'down' }}
                style={({ pressed }) => [styles.actionBtn, pressed && styles.actionBtnPressed]} testID="aed-thumb-down">
                <Ionicons name={item.rating === 'down' ? 'thumbs-down' : 'thumbs-down-outline'} size={18}
                  color={item.rating === 'down' ? colors.navy : colors.textSecondary} />
              </Pressable>
              </> : null}
            </View>
          </View>
        ) : null}
      </View>
    );
  };

  const empty = messages.length === 0 && !loading;
  const canSend = !loading && (!!input.trim() || !!file);
  // A streaming answer shows its own progress; the generic footer is for the rest.
  const answering = loading && !messages.some(m => m.streaming);
  const thinkingPlan = planWith(plans, 'AED_THINKING_MODE');
  // Wide screens get the chat list beside the conversation, as in other assistants.
  const sidebar = !!agent?.features.saved_history && width >= 1024;
  const firstName = givenName(user?.name);

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.shell}>
      {sidebar ? (
        <View style={styles.sidebar} testID="aed-sidebar">
          <AedHistoryList token={token} variant="sidebar" activeId={sessionId} refreshKey={historyKey}
            onOpen={openChat} onNewChat={newChat}
            onDeleted={id => { if (id === sessionId) newChat(); }} />
          <Pressable onPress={() => router.push('/aed/history' as any)} accessibilityRole="link"
            style={({ pressed }) => [styles.sidebarLink, pressed && styles.pressed]} testID="aed-sidebar-manage">
            <Ionicons name="settings-outline" size={16} color={colors.textSecondary} />
            <Text style={styles.sidebarLinkText}>Chat settings</Text>
          </Pressable>
        </View>
      ) : null}
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
          <View style={styles.headerRight}>
            {agent && !sidebar ? (
              <Pressable testID="aed-history-btn" onPress={() => router.push('/aed/history' as any)}
                accessibilityRole="button" accessibilityLabel="Your chats and preferences"
                style={styles.headerBtn}>
                <Ionicons name="time-outline" size={22} color={colors.text} />
              </Pressable>
            ) : null}
            {agent || messages.length ? (
              <Pressable testID="aed-new-chat" onPress={newChat} accessibilityRole="button"
                accessibilityLabel="Start a new conversation" style={styles.headerBtn}>
                <Ionicons name="create-outline" size={22} color={colors.text} />
              </Pressable>
            ) : !agent ? <View style={styles.headerBtnSpacer} /> : null}
          </View>
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
                <Text style={styles.welcomeTitle}>
                  {firstName ? 'How can I help, ' + firstName + '?' : 'How can I help with your healthcare question?'}
                </Text>
                <Text style={styles.welcomeSub}>
                  Cases, lab reports, medications, research and guidelines — structured for clinical work.
                </Text>
                {agent ? (
                  <View style={styles.disclosure} testID="aed-disclosure">
                    <Ionicons name="shield-checkmark-outline" size={16} color={colors.teal} />
                    <Text style={styles.disclosureText}>
                      {agent.disclosure}
                      {agent.features.saved_history ? ' Your chats are saved to your account so you can come back to them.' : ''}
                    </Text>
                  </View>
                ) : null}
                {agent ? (
                  <Pressable onPress={() => router.push('/aed/calculators' as any)} accessibilityRole="link"
                    style={({ pressed }) => [styles.modeChip, styles.calcLink, pressed && styles.pressed]}
                    testID="aed-open-calculators">
                    <Ionicons name="calculator-outline" size={14} color={colors.teal} />
                    <Text style={styles.modeText}>Clinical calculators</Text>
                  </Pressable>
                ) : null}
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
            ListFooterComponent={answering ? (
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
            <View style={[styles.inputShell, dictation.listening && styles.inputShellListening]}>
              <TextInput
                ref={inputRef}
                testID="aed-chat-input"
                style={styles.input}
                placeholder={dictation.listening ? 'Listening… speak your question' : 'Ask AED a healthcare question…'}
                placeholderTextColor={colors.textMuted}
                value={input}
                onChangeText={setInput}
                onKeyPress={onKeyPress}
                multiline
                maxLength={8000}
                accessibilityLabel="Your question for AED"
                accessibilityHint={Platform.OS === 'web' ? 'Enter sends. Shift and Enter adds a new line.' : undefined}
              />
              <View style={styles.toolbar}>
                <Pressable testID="aed-attach-btn" onPress={() => setAttachOpen(true)} accessibilityRole="button"
                  accessibilityLabel="Attach a report or image" disabled={loading}
                  style={({ pressed }) => [styles.iconBtn, pressed && styles.actionBtnPressed]}>
                  <Ionicons name="attach" size={22} color={colors.textSecondary} />
                </Pressable>
                {agent ? (agent.features.think_deeper ? (
                  <Pressable onPress={() => setThinkDeeper(v => !v)} accessibilityRole="switch"
                    accessibilityState={{ checked: thinkDeeper }}
                    accessibilityLabel="Think deeper: more evidence and careful reasoning"
                    hitSlop={6} style={[styles.modeChip, thinkDeeper && styles.modeChipOn]} testID="aed-think-deeper">
                    <Ionicons name="bulb-outline" size={14} color={thinkDeeper ? colors.white : colors.teal} />
                    <Text style={[styles.modeText, thinkDeeper && styles.modeTextOn]}>
                      Think deeper{agent.token_costs.thinking ? ` · ${agent.token_costs.thinking} tokens` : ''}
                    </Text>
                  </Pressable>
                ) : (
                  <Pressable onPress={() => router.push('/subscription' as any)} accessibilityRole="button"
                    accessibilityLabel={`Think deeper is available with ${thinkingPlan ?? 'a higher plan'}. View plans.`}
                    hitSlop={6} style={styles.modeChip} testID="aed-think-deeper-locked">
                    <Ionicons name="lock-closed-outline" size={14} color={colors.navy} />
                    <Text style={styles.modeText}>Think deeper{thinkingPlan ? ` · ${thinkingPlan}` : ''}</Text>
                  </Pressable>
                )) : null}
                <View style={styles.flex} />
                {dictation.available ? (
                  <Pressable testID="aed-mic-btn" onPress={toggleDictation} disabled={loading || dictation.state === 'starting'}
                    accessibilityRole="button"
                    accessibilityLabel={dictation.listening ? 'Stop dictation' : 'Dictate your question'}
                    accessibilityState={{ busy: dictation.state === 'starting' }}
                    style={({ pressed }) => [styles.micBtn, dictation.listening && styles.micBtnOn,
                      pressed && styles.actionBtnPressed]}>
                    <Ionicons name={dictation.listening ? 'stop' : 'mic-outline'} size={dictation.listening ? 18 : 22}
                      color={dictation.listening ? colors.white : colors.textSecondary} />
                  </Pressable>
                ) : null}
                <Pressable
                  testID="aed-send-btn"
                  onPress={submit}
                  disabled={!canSend}
                  accessibilityRole="button"
                  accessibilityLabel="Send"
                  accessibilityState={{ disabled: !canSend }}
                  style={({ pressed }) => [styles.sendBtn, !canSend && styles.sendDisabled, pressed && canSend && styles.sendPressed]}
                >
                  <Ionicons name="arrow-up" size={20} color={canSend ? colors.white : colors.textMuted} />
                </Pressable>
              </View>
            </View>
            {dictation.listening ? (
              <ListeningHint />
            ) : dictation.error ? (
              <Text style={styles.dictationError} accessibilityRole="alert" testID="aed-dictation-error">
                {dictation.error}
              </Text>
            ) : (
              <Text style={styles.footnote}>
                {Platform.OS === 'web' && input
                  ? 'Enter to send · Shift + Enter for a new line'
                  : 'AED supports clinical judgment; it doesn’t replace it. Verify before acting.'}
              </Text>
            )}
          </View>
        </KeyboardAvoidingView>
      </PageColumn>
      </View>

      <Sheet visible={!!feedbackFor} onClose={() => setFeedbackFor(null)} title="What wasn’t right?" testID="aed-feedback-sheet">
        <View style={styles.attachBody}>
          <View style={styles.reasons}>
            {FEEDBACK_REASONS.map(r => {
              const on = reasons.includes(r.value);
              return (
                <Pressable key={r.value} onPress={() => setReasons(prev => (on ? prev.filter(x => x !== r.value) : [...prev, r.value]))}
                  accessibilityRole="checkbox" accessibilityState={{ checked: on }} testID={'aed-reason-' + r.value}
                  style={[styles.modeChip, on && styles.modeChipOn]}>
                  <Text style={[styles.modeText, on && styles.modeTextOn]}>{r.label}</Text>
                </Pressable>
              );
            })}
          </View>
          <Pressable onPress={submitDown} accessibilityRole="button" style={styles.sendFeedback} testID="aed-feedback-send">
            <Text style={styles.sendFeedbackText}>Send feedback</Text>
          </Pressable>
          <Text style={styles.footnote}>Clinicians on the ForMeds team review feedback to improve AED. Please don’t include patient details.</Text>
        </View>
      </Sheet>

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

/** Shown while dictating: a pulsing dot (steady when the system asks for reduced motion). */
function ListeningHint() {
  const pulse = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    let loop: Animated.CompositeAnimation | null = null;
    let cancelled = false;
    AccessibilityInfo.isReduceMotionEnabled().catch(() => false).then(reduce => {
      if (reduce || cancelled) return;
      loop = Animated.loop(Animated.sequence([
        Animated.timing(pulse, { toValue: 0.3, duration: 600, useNativeDriver: Platform.OS !== 'web' }),
        Animated.timing(pulse, { toValue: 1, duration: 600, useNativeDriver: Platform.OS !== 'web' }),
      ]));
      loop.start();
    });
    return () => { cancelled = true; loop?.stop(); };
  }, [pulse]);
  return (
    <View style={styles.listening} accessibilityLiveRegion="polite" testID="aed-listening">
      <Animated.View style={[styles.listeningDot, { opacity: pulse }]} />
      <Text style={styles.listeningText}>Listening — tap stop when you’re done</Text>
    </View>
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
  shell: { flex: 1, flexDirection: 'row' },
  sidebar: { width: 280, borderRightWidth: 1, borderRightColor: colors.border, backgroundColor: colors.bg },
  sidebarLink: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm, minHeight: MIN_TOUCH_TARGET,
    paddingHorizontal: spacing.lg, borderTopWidth: 1, borderTopColor: colors.border,
  },
  sidebarLinkText: { ...typography.small, color: colors.textSecondary },
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
  urgencyBadge: { marginLeft: 'auto', paddingHorizontal: spacing.sm, paddingVertical: 2, borderRadius: radius.pill },
  urgencyEmergency: { backgroundColor: colors.redBg },
  urgencyUrgent: { backgroundColor: colors.warningBg },
  urgencyText: { ...typography.small, fontFamily: fonts.body.semibold, letterSpacing: 0.4 },
  urgencyTextEmergency: { color: colors.redText },
  urgencyTextUrgent: { color: colors.warning },
  sourcesToggle: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, minHeight: 32 },
  sourcesTitleInline: { marginBottom: 0 },
  sourcesToggleText: { ...typography.small, color: colors.teal, marginLeft: 'auto' },
  thinking: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, alignSelf: 'flex-start' },
  thinkingText: { ...typography.caption, color: colors.textSecondary },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  headerRight: { flexDirection: 'row', alignItems: 'center' },
  calcLink: { marginTop: spacing.sm },
  // The 44pt buttons carry their own padding: pull the row into the card's.
  feedbackRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    marginTop: -spacing.xs, marginBottom: -spacing.sm,
  },
  thumbs: { flexDirection: 'row', gap: spacing.xs, marginRight: -spacing.sm },
  // 44pt targets around 18pt icons; pressing tints the background, never moves the layout.
  actionBtn: {
    width: MIN_TOUCH_TARGET, height: MIN_TOUCH_TARGET, borderRadius: radius.lg,
    alignItems: 'center', justifyContent: 'center',
  },
  actionBtnPressed: { backgroundColor: colors.bgMuted },
  savedTag: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  savedText: { ...typography.small, color: colors.teal },
  notSavedText: { ...typography.small, color: colors.textSecondary },
  reasons: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  sendFeedback: {
    alignItems: 'center', paddingVertical: spacing.md, borderRadius: radius.lg, backgroundColor: colors.navy,
  },
  sendFeedbackText: { ...typography.label, color: colors.white },
  disclosure: {
    flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm, marginTop: spacing.md, maxWidth: 520,
    padding: spacing.md, borderRadius: radius.lg, backgroundColor: colors.tealBg,
  },
  disclosureText: { ...typography.small, color: colors.text, lineHeight: 18, flex: 1 },
  modeChip: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.xs, paddingHorizontal: spacing.sm + 4,
    minHeight: 32, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.border,
    backgroundColor: colors.white,
  },
  modeChipOn: { backgroundColor: colors.teal, borderColor: colors.teal },
  modeText: { ...typography.small, fontFamily: fonts.body.medium, color: colors.navy },
  modeTextOn: { color: colors.white },

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
  // The question box sits above its toolbar, so long questions get the full width.
  inputShell: {
    backgroundColor: colors.bg, borderRadius: radius.xl + 6, borderWidth: 1, borderColor: colors.border,
    paddingHorizontal: spacing.xs, paddingTop: spacing.xs, paddingBottom: spacing.xs,
  },
  inputShellListening: { borderColor: colors.red, backgroundColor: colors.white },
  input: {
    ...typography.body, color: colors.text, minHeight: INPUT_MIN_HEIGHT, maxHeight: INPUT_MAX_HEIGHT,
    paddingHorizontal: spacing.sm, paddingVertical: 10, lineHeight: 22,
    ...(Platform.OS === 'web' ? ({ outlineStyle: 'none', resize: 'none' } as object) : null),
  },
  toolbar: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  iconBtn: {
    width: MIN_TOUCH_TARGET, height: MIN_TOUCH_TARGET, borderRadius: MIN_TOUCH_TARGET / 2,
    alignItems: 'center', justifyContent: 'center',
  },
  micBtn: {
    width: MIN_TOUCH_TARGET, height: MIN_TOUCH_TARGET, borderRadius: MIN_TOUCH_TARGET / 2,
    alignItems: 'center', justifyContent: 'center',
  },
  micBtnOn: { backgroundColor: colors.red },
  sendBtn: {
    width: MIN_TOUCH_TARGET, height: MIN_TOUCH_TARGET, borderRadius: MIN_TOUCH_TARGET / 2,
    backgroundColor: colors.red, alignItems: 'center', justifyContent: 'center',
  },
  // Disabled reads as disabled (neutral, not a faded brand colour).
  sendDisabled: { backgroundColor: colors.bgMuted },
  sendPressed: { backgroundColor: colors.redHover },
  listening: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm, minHeight: 18,
  },
  listeningDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.red },
  listeningText: { ...typography.small, color: colors.redText },
  dictationError: { ...typography.small, color: colors.redText, textAlign: 'center' },
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
