/**
 * AED memory and feedback: chat history, answer preferences, structured
 * feedback. Chats are saved by default, for as long as ForMeds keeps them;
 * a member can stop new chats being saved and delete any or all of them.
 */

import { apiFetch } from '../utils/api';

export interface SavedConversation {
  id: string;
  title: string;
  message_count: number;
  created_at: string;
  last_message_at: string;
}

export interface AedPreferences {
  answer_depth: 'brief' | 'standard' | 'detailed';
  units: 'conventional' | 'si';
  drug_naming: 'generic' | 'brand_and_generic';
  language: string;
  preferred_guidelines: string[];
  notes: string;
  /** Saving new chats: on unless the member turned it off (set from history, not here). */
  save_history?: boolean;
}

export interface SavedConversations {
  /** Whether new chats are being saved. */
  saving: boolean;
  /** How long ForMeds keeps a chat after its last message. */
  retention_days?: number;
  conversations: SavedConversation[];
}

export type FeedbackReason =
  | 'inaccurate' | 'outdated' | 'unsafe' | 'missing_info' | 'bad_citation' | 'not_relevant'
  | 'not_india_specific' | 'too_long' | 'too_short' | 'other';

export const FEEDBACK_REASONS: { value: FeedbackReason; label: string }[] = [
  { value: 'inaccurate', label: 'Inaccurate' },
  { value: 'outdated', label: 'Outdated' },
  { value: 'unsafe', label: 'Unsafe' },
  { value: 'missing_info', label: 'Missed something important' },
  { value: 'bad_citation', label: 'Source doesn’t support it' },
  { value: 'not_india_specific', label: 'Not right for India' },
  { value: 'not_relevant', label: 'Not relevant' },
  { value: 'too_long', label: 'Too long' },
  { value: 'too_short', label: 'Too short' },
  { value: 'other', label: 'Other' },
];

export const fetchSavedConversations = (token: string): Promise<SavedConversations> =>
  apiFetch('/api/aed/conversations', token);

export const setHistorySaving = (token: string, save: boolean): Promise<{ saving: boolean; retention_days: number }> =>
  apiFetch('/api/aed/history', token, { method: 'PUT', body: JSON.stringify({ save }) });

export const deleteSavedConversation = (token: string, id: string) =>
  apiFetch(`/api/aed/conversations/${encodeURIComponent(id)}`, token, { method: 'DELETE' });

export const deleteAllSavedConversations = (token: string): Promise<{ deleted: number }> =>
  apiFetch('/api/aed/conversations', token, { method: 'DELETE' });

export const fetchPreferences = (token: string): Promise<{ available: boolean; preferences: AedPreferences }> =>
  apiFetch('/api/aed/preferences', token);

// The history switch is left out, so a preferences save can never turn saving back on.
export const savePreferences = (token: string, prefs: AedPreferences): Promise<{ preferences: AedPreferences }> => {
  const { save_history: _ignored, ...rest } = prefs;
  return apiFetch('/api/aed/preferences', token, { method: 'PUT', body: JSON.stringify(rest) });
};

export const sendFeedback = (
  token: string, body: { run_id?: string | null; rating: 'up' | 'down'; reasons?: FeedbackReason[]; comment?: string },
) => apiFetch('/api/aed/feedback', token, { method: 'POST', body: JSON.stringify(body) });
