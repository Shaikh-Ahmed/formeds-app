/**
 * The AED agent (/api/aed): streamed answers with numbered sources.
 *
 * One run is a stream of events -- meta, status ("Searching PubMed..."),
 * urgent, sources, token, ask, then exactly one done or error. `done.final` is
 * the complete, checked answer: the screen replaces the streamed text with it,
 * so a citation the server removed is never what the user ends up reading.
 *
 * Streaming uses `expo/fetch` (a real ReadableStream on iOS/Android, the
 * browser's fetch on web). If the backend has no agent (404 on /config), the
 * screen keeps using the classic endpoints in ./aed.
 */

import { Platform } from 'react-native';
import { API_URL, ApiError, apiFetch, detailToMessage, refreshAfterUnauthorized } from '../utils/api';
import { appendFile } from '../utils/upload';
import type { AedWallet } from '../types/subscriptions';
import type { AedAction } from './aed';

/** Longer than the server's own run deadline, so the server always answers first. */
const AED_RUN_TIMEOUT_MS = 180_000;

export interface AedCitation {
  n: number;
  source: string;
  id: string;
  title: string;
  authors?: string | null;
  year?: string | null;
  url: string;
  evidence_type: string;
}

export type AedUrgency = 'emergency' | 'same_day' | 'prompt' | 'routine';

export interface AedFinal {
  response: string;
  conversation_id: string;
  intent: string;
  mode: 'instant' | 'thinking' | null;
  request_type: string;
  urgent: boolean;
  outcome: 'answered' | 'asked' | 'deferred' | 'declined' | 'local' | 'denied' | 'error' | 'cancelled';
  sources: AedCitation[];
  cited: number[];
  tokens_charged: number;
  answered_locally: boolean;
  limited_by_plan?: { feature: string; required_plan: string | null } | null;
  missing_information: string[];
  /** How soon to act: emergency | same_day | prompt | routine. */
  urgency?: AedUrgency | null;
  /** Kept in the member's saved history (only with their consent). */
  saved?: boolean;
  /** Related ForMeds cases and CME -- shown beside the answer, never cited as evidence. */
  resources?: AedResource[];
  aed_tokens?: AedWallet | null;
}

export interface AedResource {
  kind: 'case' | 'cme';
  id: string;
  title: string;
  subtitle: string;
  /** The app route to open. */
  path: string;
}

export type AedEvent =
  | { type: 'meta'; run_id: string; conversation_id: string; mode: string; request_type: string; tokens_charged: number; urgency?: AedUrgency }
  | { type: 'resources'; items: AedResource[] }
  | { type: 'status'; stage: string; label: string; source?: string }
  | { type: 'urgent'; text: string; numbers: string[] }
  | { type: 'sources'; items: AedCitation[] }
  | { type: 'token'; text: string }
  | { type: 'ask'; questions: string[] }
  | { type: 'done'; outcome: string; final: AedFinal }
  | { type: 'error'; code: string; status: number; message: string; extra: Record<string, any> };

export interface AedConfig {
  contract_version: number;
  available: boolean;
  disclosure: string;
  disclosure_version: string;
  features: { streaming: boolean; saved_history: boolean; think_deeper: boolean; deep_research: boolean;
              document_analysis: boolean; image_analysis: boolean };
  token_costs: Record<string, number>;
}

export interface AedRunInput {
  message: string;
  conversation_id?: string | null;
  action?: AedAction | null;
  mode?: 'auto' | 'thinking';
  client_msg_id?: string;
}

/** The agent's features for this user -- or null when the backend has no agent. */
export async function fetchAedConfig(token: string): Promise<AedConfig | null> {
  try {
    return await apiFetch('/api/aed/config', token);
  } catch (e) {
    if (e instanceof ApiError && e.status === 404) return null;
    throw e;
  }
}

/**
 * Incremental Server-Sent Events parser: feed it decoded text in whatever
 * chunks the network delivers; it returns each complete event's data.
 */
export class SSEParser {
  private buffer = '';

  feed(text: string): AedEvent[] {
    this.buffer += text.replace(/\r\n/g, '\n');
    const events: AedEvent[] = [];
    let end = this.buffer.indexOf('\n\n');
    while (end >= 0) {
      const block = this.buffer.slice(0, end);
      this.buffer = this.buffer.slice(end + 2);
      const data = block.split('\n').filter(l => l.startsWith('data:')).map(l => l.slice(5).replace(/^ /, ''));
      if (data.length) {
        try {
          events.push(JSON.parse(data.join('\n')));
        } catch {
          // A malformed frame is skipped, never fatal.
        }
      }
      end = this.buffer.indexOf('\n\n');
    }
    return events;
  }
}

/** An error event (or error response) as the ApiError the screen already handles. */
function asApiError(status: number, detail: Record<string, any>): ApiError {
  return new ApiError(detailToMessage({ detail }, 'AED is temporarily unavailable.'), status, { detail });
}

function newMessageId(): string {
  return `m-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

/** A fetch whose response body can be read as it arrives. Loaded on first use:
 *  `expo/fetch` is a native module (React Native's own fetch can't stream). */
function streamingFetch(): (url: string, init: any) => Promise<any> {
  if (Platform.OS === 'web') return globalThis.fetch.bind(globalThis);
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  return require('expo/fetch').fetch;
}

async function post(token: string, body: AedRunInput, signal: AbortSignal) {
  return streamingFetch()(`${API_URL}/api/aed/runs`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'text/event-stream', Authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
    signal,
  });
}

/**
 * Run one question, calling `onEvent` for every event as it arrives.
 * Resolves with the final answer; rejects with an ApiError carrying the same
 * codes as the classic endpoints (aed_tokens_exhausted, aed_upgrade_required, ...).
 */
export async function streamAedRun(
  token: string, input: AedRunInput, onEvent: (e: AedEvent) => void, outer?: AbortSignal,
): Promise<AedFinal> {
  const body = { ...input, client_msg_id: input.client_msg_id ?? newMessageId() };
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), AED_RUN_TIMEOUT_MS);
  outer?.addEventListener('abort', () => controller.abort());
  try {
    let res: any;
    try {
      res = await post(token, body, controller.signal);
      if (res.status === 401) {
        const fresh = await refreshAfterUnauthorized();
        if (fresh) res = await post(fresh, { ...body, client_msg_id: newMessageId() }, controller.signal);
      }
    } catch (e: any) {
      throw new ApiError(e?.name === 'AbortError' ? 'AED took too long to answer. Please try again.'
        : 'Network error. Check your connection and try again.', 0);
    }
    if (!res.ok) {
      let data: any = null;
      try { data = await res.json(); } catch { /* not JSON */ }
      throw asApiError(res.status, data?.detail && typeof data.detail === 'object' ? data.detail : { message: detailToMessage(data, `Request failed (${res.status})`) });
    }

    const parser = new SSEParser();
    const decoder = new TextDecoder();
    const reader = res.body?.getReader();
    if (!reader) throw new ApiError('Streaming is not available on this device.', 0);
    let final: AedFinal | null = null;
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      for (const ev of parser.feed(decoder.decode(value, { stream: true }))) {
        if (ev.type === 'error') {
          throw asApiError(ev.status, { code: ev.code, message: ev.message, ...ev.extra });
        }
        onEvent(ev);
        if (ev.type === 'done') final = ev.final;
      }
    }
    if (!final) throw new ApiError('AED stopped before finishing. Please try again.', 0);
    return final;
  } finally {
    clearTimeout(timer);
  }
}

/** A question about an image or PDF: answered in one response (not streamed). */
export async function runAedWithFile(
  token: string,
  file: { uri: string; name?: string | null; mimeType?: string | null },
  input: AedRunInput,
): Promise<AedFinal> {
  const form = new FormData();
  await appendFile(form, 'file', file);
  form.append('message', input.message);
  if (input.conversation_id) form.append('conversation_id', input.conversation_id);
  if (input.action) form.append('action', input.action);
  if (input.mode) form.append('mode', input.mode);
  form.append('client_msg_id', input.client_msg_id ?? newMessageId());
  return apiFetch('/api/aed/runs/upload', token, { method: 'POST', body: form as any, timeoutMs: AED_RUN_TIMEOUT_MS });
}

export const fetchAgentConversation = (token: string, id: string) =>
  apiFetch(`/api/aed/conversations/${encodeURIComponent(id)}`, token) as Promise<{
    conversation_id: string; messages: { id: string; role: 'user' | 'assistant'; content: string }[];
  }>;

export const clearAgentConversation = (token: string, id: string) =>
  apiFetch(`/api/aed/conversations/${encodeURIComponent(id)}`, token, { method: 'DELETE' });
