/**
 * AED client. Talks only to the ForMeds backend -- the Claude key, model and
 * system prompt all live server-side and nothing here can reach them.
 */

import { apiFetch } from '../utils/api';
import { appendFile } from '../utils/upload';

/**
 * An AED answer can take a while: the model reasons before replying. Longer
 * than the server's own 60s provider timeout, so the server always answers
 * first -- with the answer, or with a clear timeout message.
 */
const AED_TIMEOUT_MS = 120_000;

export type AedAction =
  | 'explain_concept' | 'analyze_case' | 'differential' | 'lab_report' | 'medication'
  | 'compare_drugs' | 'research' | 'guideline' | 'study_notes';

export interface AedSource {
  source: string;
  id: string;
  title: string;
  authors?: string;
  year?: string;
  url: string;
}

export interface AedReply {
  response: string;
  session_id: string;
  intent: string;
  /** A possible emergency: the UI leads with the escalation banner. */
  urgent: boolean;
  /** Only sources that were actually retrieved for this answer. */
  sources: AedSource[];
  answered_locally: boolean;
  /** Tokens this answer cost; 0 for local answers and emergencies. */
  tokens_charged?: number;
  /** The balance after this request -- the server's number, never computed here. */
  aed_tokens?: import('../types/subscriptions').AedWallet;
  /** Set when the plan (not the question) limited the answer, e.g. no sources. */
  limited_by_plan?: { feature: string; required_plan: string | null } | null;
}

export interface AedHistoryItem {
  id: string;
  role: 'user' | 'assistant';
  content: string;
}

export const askAed = (
  token: string, message: string, sessionId?: string | null, action?: AedAction | null,
): Promise<AedReply> =>
  apiFetch('/api/chat/message', token, {
    method: 'POST',
    body: JSON.stringify({
      message, ...(sessionId ? { session_id: sessionId } : {}), ...(action ? { action } : {}),
    }),
    timeoutMs: AED_TIMEOUT_MS,
  });

export async function askAedWithFile(
  token: string,
  file: { uri: string; name?: string | null; mimeType?: string | null },
  message: string,
  sessionId?: string | null,
  action?: AedAction | null,
): Promise<AedReply> {
  const form = new FormData();
  await appendFile(form, 'file', file);
  form.append('message', message);
  if (sessionId) form.append('session_id', sessionId);
  if (action) form.append('action', action);
  return apiFetch('/api/chat/attachment', token, {
    method: 'POST', body: form as any, timeoutMs: AED_TIMEOUT_MS,
  });
}

export const fetchAedHistory = (token: string, sessionId: string): Promise<AedHistoryItem[]> =>
  apiFetch(`/api/chat/history/${encodeURIComponent(sessionId)}`, token);

export const clearAedHistory = (token: string, sessionId: string): Promise<{ message: string }> =>
  apiFetch(`/api/chat/history/${encodeURIComponent(sessionId)}`, token, { method: 'DELETE' });

/** User-facing words for the failures the server reports by code. */
export function aedErrorMessage(e: any): string {
  switch (e?.code) {
    case 'aed_daily_limit':
    case 'aed_busy':
    case 'aed_timeout':
    case 'aed_unsupported_file':
    case 'aed_attachments_disabled':
    case 'aed_attachments_unsupported':
    case 'aed_file_too_large':
    case 'aed_tokens_exhausted':
    case 'aed_upgrade_required':
    case 'aed_verification_required':
    case 'aed_run_in_progress':
    case 'aed_duplicate_request':
    case 'aed_wallet_busy':
    case 'not_your_session':
      return e.message;
    case 'aed_empty':
    case 'aed_unavailable':
      return 'AED is temporarily unavailable. Please try again in a moment.';
    default:
      if (e?.status === 0) return e.message; // network or timeout, already worded
      if (e?.status === 400 && e?.message) return e.message; // e.g. a rejected file
      return 'AED is temporarily unavailable. Please try again in a moment.';
  }
}
