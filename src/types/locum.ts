/**
 * The Locum domain, as the client sees it.
 *
 * Kept apart from `types/jobs.ts` on purpose: Locum is its own module with its
 * own lifecycle (a posting fills up; an applicant is interviewed), and sharing
 * the Jobs status unions would mean a change to either module could quietly
 * break the other.
 */

export type LocumRole = 'doctor' | 'nurse' | 'specialist' | 'allied_health' | 'other';
export type LocumShiftType = 'day' | 'night' | 'emergency' | 'weekend' | 'custom';
export type LocumPayType = 'fixed' | 'per_shift' | 'per_hour' | 'negotiable';
export type LocumStatus = 'open' | 'full' | 'closed' | 'expired' | 'cancelled';
export type LocumSort = 'soonest' | 'newest' | 'pay_high';

export type LocumApplicationStatus =
  | 'applied' | 'under_review' | 'contacted' | 'interview_scheduled'
  | 'interview_passed' | 'interview_failed' | 'selected' | 'not_selected' | 'withdrawn';

/** Which "My applications" tab an application sits in. Computed server-side. */
export type LocumBucket = 'applied' | 'interview' | 'selected' | 'completed' | 'closed';

/** The applicant's own view of their application. Never carries hospital notes. */
export interface MyLocumApplication {
  id: string;
  locum_id: string;
  status: LocumApplicationStatus;
  note?: string;
  interview_at?: string | null;
  status_changed_at?: string;
  selected_at?: string | null;
  withdrawn_at?: string | null;
  viewed_at?: string | null;
  created_at: string;
  bucket?: LocumBucket;
  locum?: Locum | null;
}

export interface Locum {
  id: string;
  poster_id: string;
  org_id?: string | null;

  role_required: LocumRole;
  specialty: string;
  openings: number;
  filled_count: number;
  openings_left: number;

  /** YYYY-MM-DD, and HH:MM in IST. An end before the start is overnight. */
  shift_date: string;
  start_time: string;
  end_time: string;
  shift_ends_at: string;
  shift_type: LocumShiftType;

  city: string;
  state?: string;
  address?: string;

  pay_amount: number;
  pay_type: LocumPayType;

  experience_min: number;
  qualifications?: string;
  requirements?: string;
  notes?: string;

  apply_by: string;
  status: LocumStatus;
  applicant_count: number;
  created_at: string;
  updated_at?: string;

  employer_name: string;
  employer_avatar?: string;
  /** Present only for an organisation posting. */
  employer_verified?: boolean;
  employer_type?: string | null;
  poster_role?: string | null;

  my_application?: MyLocumApplication | null;
  can_manage: boolean;
}

export interface LocumsPage {
  items: Locum[];
  total: number;
  has_more: boolean;
}

export interface LocumFilters {
  specialty?: string;
  role_required?: LocumRole;
  city?: string;
  shift_type?: LocumShiftType;
  date_from?: string;
  date_to?: string;
  pay_min?: number;
  verified_only?: boolean;
  sort?: LocumSort;
}

export interface LocumClearance {
  result: 'passed' | 'failed';
  cleared_at?: string | null;
  source_locum_id?: string | null;
  updated_at?: string;
}

/** An application as the hospital sees it. */
export interface ManagedLocumApplication {
  id: string;
  locum_id: string;
  applicant_id: string;
  status: LocumApplicationStatus;
  note?: string;
  interview_at?: string | null;
  interview_notes?: string;
  status_changed_at?: string;
  selected_at?: string | null;
  viewed_at?: string | null;
  created_at: string;
  applicant: {
    id: string;
    name: string;
    avatar?: string;
    role?: string;
    headline?: string;
    professional_role?: string;
    specialty?: string;
    city?: string;
    location?: string;
    years_experience?: number;
    account_verified: boolean;
  } | null;
  clearance: LocumClearance | null;
  interview_cleared: boolean;
  locum?: Pick<Locum, 'id' | 'specialty' | 'role_required' | 'shift_date'
    | 'start_time' | 'end_time' | 'status'>;
}

export interface LocumHistoryEvent {
  id: string;
  from_status: LocumApplicationStatus | null;
  to_status: LocumApplicationStatus;
  created_at: string;
  actor_name: string;
  note?: string;
}

// ── Labels ───────────────────────────────────────────────────────────────────

export const LOCUM_ROLE_LABELS: Record<LocumRole, string> = {
  doctor: 'Doctor',
  nurse: 'Nurse',
  specialist: 'Specialist',
  allied_health: 'Allied health',
  other: 'Other',
};

export const LOCUM_SHIFT_LABELS: Record<LocumShiftType, string> = {
  day: 'Day',
  night: 'Night',
  emergency: 'Emergency',
  weekend: 'Weekend',
  custom: 'Custom',
};

export const LOCUM_PAY_LABELS: Record<LocumPayType, string> = {
  fixed: 'fixed',
  per_shift: 'per shift',
  per_hour: 'per hour',
  negotiable: 'Negotiable',
};

export const LOCUM_SORT_LABELS: Record<LocumSort, string> = {
  soonest: 'Starting soonest',
  newest: 'Recently posted',
  pay_high: 'Highest pay',
};

type Tone = 'neutral' | 'teal' | 'navy' | 'warning' | 'danger';

/**
 * Status presentation. Icon and words always, never colour alone -- "Selected"
 * and "Not selected" are the two a clinician most needs to tell apart.
 */
export const LOCUM_APPLICATION_META: Record<
  LocumApplicationStatus, { label: string; icon: string; tone: Tone }
> = {
  applied: { label: 'Applied', icon: 'paper-plane-outline', tone: 'navy' },
  under_review: { label: 'Under review', icon: 'eye-outline', tone: 'warning' },
  contacted: { label: 'Contacted', icon: 'call-outline', tone: 'warning' },
  interview_scheduled: { label: 'Interview scheduled', icon: 'calendar-outline', tone: 'teal' },
  interview_passed: { label: 'Interview passed', icon: 'checkmark-done-outline', tone: 'teal' },
  interview_failed: { label: 'Interview not cleared', icon: 'close-circle-outline', tone: 'danger' },
  selected: { label: 'Selected', icon: 'checkmark-circle', tone: 'teal' },
  not_selected: { label: 'Not selected', icon: 'close-circle-outline', tone: 'danger' },
  withdrawn: { label: 'Withdrawn', icon: 'arrow-undo-outline', tone: 'neutral' },
};

export const LOCUM_STATUS_META: Record<LocumStatus, { label: string; icon: string; tone: Tone }> = {
  open: { label: 'Open', icon: 'radio-button-on-outline', tone: 'teal' },
  full: { label: 'Filled', icon: 'people', tone: 'navy' },
  closed: { label: 'Closed', icon: 'lock-closed-outline', tone: 'neutral' },
  expired: { label: 'Expired', icon: 'time-outline', tone: 'neutral' },
  cancelled: { label: 'Cancelled', icon: 'ban-outline', tone: 'danger' },
};

/** Stages where an applicant can still take their application back. */
export const LOCUM_WITHDRAWABLE: LocumApplicationStatus[] = [
  'applied', 'under_review', 'contacted', 'interview_scheduled', 'interview_passed',
];

/**
 * The workflow step a Locum notification reports. The server writes it into
 * the notification type as `locum_<event>`; the notifications list shows it
 * as a badge so each alert says where things stand at a glance.
 */
export const LOCUM_NOTIFICATION_META: Record<string, { label: string; icon: string; tone: Tone }> = {
  applied: LOCUM_APPLICATION_META.applied,
  under_review: LOCUM_APPLICATION_META.under_review,
  contacted: LOCUM_APPLICATION_META.contacted,
  interview_scheduled: LOCUM_APPLICATION_META.interview_scheduled,
  interview_passed: LOCUM_APPLICATION_META.interview_passed,
  interview_failed: LOCUM_APPLICATION_META.interview_failed,
  selected: LOCUM_APPLICATION_META.selected,
  not_selected: LOCUM_APPLICATION_META.not_selected,
  selection_withdrawn: { label: 'Selection withdrawn', icon: 'arrow-undo-outline', tone: 'danger' },
  withdrawn: LOCUM_APPLICATION_META.withdrawn,
  new_application: { label: 'New applicant', icon: 'person-add-outline', tone: 'navy' },
  filled: { label: 'Filled', icon: 'people', tone: 'neutral' },
  cancelled: { label: 'Cancelled', icon: 'ban-outline', tone: 'danger' },
  updated: { label: 'Updated', icon: 'create-outline', tone: 'warning' },
};

export const isLocumNotification = (type?: string): boolean =>
  !!type && (type === 'locum' || type.startsWith('locum_'));

export const locumNotificationMeta = (type?: string) =>
  type?.startsWith('locum_') ? LOCUM_NOTIFICATION_META[type.slice('locum_'.length)] ?? null : null;
