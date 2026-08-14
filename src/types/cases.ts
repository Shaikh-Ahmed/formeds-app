/** Wire shapes for the Cases forum (`/api/cases`). Shared by the list, detail
 *  and composer screens so they cannot drift apart. */

export type CaseStatus = 'open' | 'resolved' | 'closed';
export type CaseSort = 'active' | 'newest' | 'top' | 'unanswered';
export type AnswerSort = 'votes' | 'newest' | 'oldest';
/** 1 = up, -1 = down, 0 = no vote. */
export type VoteValue = 1 | 0 | -1;

interface Authored {
  id: string;
  /** null when the post is anonymous or removed. */
  author_id: string | null;
  author_name: string;
  author_role: string;
  is_anonymous: boolean;
  is_deleted: boolean;
  /** True only for the signed-in reader's own posts (survives anonymity). */
  is_mine: boolean;
  vote_score: number;
  upvote_count: number;
  downvote_count: number;
  my_vote: VoteValue;
  image_url?: string;
  edited_at: string | null;
  created_at: string;
}

export interface CaseThread extends Authored {
  title: string;
  body: string;
  specialty: string;
  tags: string[];
  status: CaseStatus;
  accepted_answer_id: string | null;
  answer_count: number;
  view_count: number;
  bookmarked: boolean;
  last_activity_at: string;
}

export interface CaseAnswer extends Authored {
  case_id: string;
  parent_id: string | null;
  /** 0 = answer, 1 = reply to an answer. */
  depth: 0 | 1;
  body: string;
  is_accepted: boolean;
  reply_count: number;
  replies?: CaseAnswer[];
}

export interface CaseTag {
  tag: string;
  count: number;
}

export const CASE_SORTS: { key: CaseSort; label: string }[] = [
  { key: 'active', label: 'Active' },
  { key: 'newest', label: 'Newest' },
  { key: 'top', label: 'Top' },
  { key: 'unanswered', label: 'Unanswered' },
];

export const ANSWER_SORTS: { key: AnswerSort; label: string }[] = [
  { key: 'votes', label: 'Top' },
  { key: 'newest', label: 'Newest' },
  { key: 'oldest', label: 'Oldest' },
];

export const REPORT_REASONS: { key: string; label: string }[] = [
  { key: 'patient_identifiable', label: 'Patient-identifiable information' },
  { key: 'misinformation', label: 'Clinically misleading' },
  { key: 'off_topic', label: 'Off topic' },
  { key: 'spam', label: 'Spam or advertising' },
  { key: 'harassment', label: 'Harassment' },
  { key: 'other', label: 'Something else' },
];
