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
  | 'interview_passed' | 'interview_failed' | 'selected' | 'not_selected' | 'withdrawn'
  | 'cancelled';

/** What happened on the day, once selected. A second axis on the application. */
export type LocumAttendanceStatus =
  | 'not_started' | 'arrival_reported' | 'attendance_approved' | 'no_show' | 'completed';

/** Shift fields both sides see on an application once it is a shift. */
export interface LocumAttendanceFields {
  attendance_status?: LocumAttendanceStatus;
  arrived_at?: string | null;
  attendance_approved_at?: string | null;
  no_show_at?: string | null;
  completed_at?: string | null;
  cancelled_at?: string | null;
  cancel_reason?: LocumCancelReason | '';
  cancel_details?: string;
  rebooking_id?: string | null;
}

/** Which "My applications" tab an application sits in. Computed server-side. */
export type LocumBucket = 'applied' | 'interview' | 'selected' | 'completed' | 'closed';

/** The applicant's own view of their application. Never carries hospital notes. */
export interface MyLocumApplication extends LocumAttendanceFields {
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
  /** 'direct' = offered to one professional through Request again. */
  visibility?: 'public' | 'direct';
  direct_professional_id?: string | null;
  /** Present on shift rows: the start instant and the whole shift's pay. */
  shift_starts_at?: string;
  shift_pay?: number;
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
export interface ManagedLocumApplication extends LocumAttendanceFields {
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
  reliability?: LocumReliabilitySummary | null;
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
  cancelled: { label: 'You cancelled', icon: 'close-circle-outline', tone: 'neutral' },
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
  arrival_reported: { label: 'Arrived', icon: 'location-outline', tone: 'teal' },
  attendance_approved: { label: 'Attendance approved', icon: 'checkmark-done-outline', tone: 'teal' },
  no_show: { label: 'No-show', icon: 'alert-circle-outline', tone: 'danger' },
  blocked: { label: 'Locum blocked', icon: 'lock-closed-outline', tone: 'danger' },
  restored: { label: 'Access restored', icon: 'lock-open-outline', tone: 'teal' },
  rebook_request: { label: 'New request', icon: 'repeat-outline', tone: 'navy' },
  rebook_cancelled: { label: 'Request withdrawn', icon: 'arrow-undo-outline', tone: 'neutral' },
  rebook_accepted: { label: 'Request accepted', icon: 'checkmark-circle', tone: 'teal' },
  rebook_rejected: { label: 'Request declined', icon: 'close-circle-outline', tone: 'neutral' },
  professional_cancelled: { label: 'Cancelled by professional', icon: 'close-circle-outline', tone: 'warning' },
  shift_completed: { label: 'Completed', icon: 'flag-outline', tone: 'teal' },
  rating_pending: { label: 'Rate shift', icon: 'star-outline', tone: 'navy' },
  reviewed: { label: 'Rated', icon: 'star', tone: 'teal' },
  dispute_upheld: { label: 'Review decided', icon: 'document-text-outline', tone: 'neutral' },
  strike_removed: { label: 'Strike removed', icon: 'shield-checkmark-outline', tone: 'teal' },
};

/** Notifications about a shift after selection open My shifts / Shifts,
 *  not the locum's public page. */
export const LOCUM_SHIFT_EVENTS = new Set([
  'arrival_reported', 'attendance_approved', 'no_show', 'blocked', 'restored', 'rebook_request',
  'rebook_cancelled', 'rebook_accepted', 'rebook_rejected', 'professional_cancelled',
  'shift_completed', 'rating_pending', 'reviewed', 'dispute_upheld', 'strike_removed',
]);

export const isLocumShiftNotification = (type?: string): boolean =>
  !!type?.startsWith('locum_') && LOCUM_SHIFT_EVENTS.has(type.slice('locum_'.length));

export const isLocumNotification = (type?: string): boolean =>
  !!type && (type === 'locum' || type.startsWith('locum_'));

export const locumNotificationMeta = (type?: string) =>
  type?.startsWith('locum_') ? LOCUM_NOTIFICATION_META[type.slice('locum_'.length)] ?? null : null;

// ── Shifts: attendance, reliability, reviews, rebooking ─────────────────────

export type LocumCancelReason = 'personal_emergency' | 'illness' | 'travel' | 'schedule_conflict' | 'other';

export const LOCUM_CANCEL_REASONS: { value: LocumCancelReason; label: string }[] = [
  { value: 'personal_emergency', label: 'Personal emergency' },
  { value: 'illness', label: 'Illness' },
  { value: 'travel', label: 'Travel issue' },
  { value: 'schedule_conflict', label: 'Scheduling conflict' },
  { value: 'other', label: 'Other' },
];

/** Where a shift stands. Computed by the server from the application, the
 *  locum and the server clock -- never from the device's clock. */
export type LocumShiftPhase =
  | 'confirmed' | 'arrival_open' | 'not_arrived' | 'arrival_reported' | 'attendance_approved'
  | 'in_progress' | 'awaiting_attendance' | 'completed' | 'no_show' | 'cancelled' | 'hospital_cancelled';

export const LOCUM_PHASE_META: Record<LocumShiftPhase, { label: string; icon: string; tone: Tone }> = {
  confirmed: { label: 'Confirmed', icon: 'checkmark-circle', tone: 'teal' },
  arrival_open: { label: 'Arrival open', icon: 'location-outline', tone: 'navy' },
  not_arrived: { label: 'Not arrived', icon: 'time-outline', tone: 'warning' },
  arrival_reported: { label: 'Arrival reported', icon: 'location', tone: 'teal' },
  attendance_approved: { label: 'Attendance approved', icon: 'checkmark-done-outline', tone: 'teal' },
  in_progress: { label: 'Shift in progress', icon: 'pulse-outline', tone: 'teal' },
  awaiting_attendance: { label: 'Attendance not recorded', icon: 'help-circle-outline', tone: 'warning' },
  completed: { label: 'Completed', icon: 'flag-outline', tone: 'navy' },
  no_show: { label: 'No-show', icon: 'alert-circle-outline', tone: 'danger' },
  cancelled: { label: 'Cancelled by professional', icon: 'close-circle-outline', tone: 'neutral' },
  hospital_cancelled: { label: 'Cancelled by hospital', icon: 'ban-outline', tone: 'neutral' },
};

export interface LocumStrike {
  id: string;
  application_id: string;
  locum_id?: string | null;
  strike_number: number;
  pay_amount: number;
  shift_date?: string;
  status: 'active' | 'cleared' | 'removed';
  dispute_status: 'none' | 'open' | 'upheld' | 'overturned';
  dispute_reason?: string;
  disputed_at?: string | null;
  resolution_note?: string;
  resolved_at?: string | null;
  created_at: string;
  employer_name?: string;
  specialty?: string;
  start_time?: string;
  end_time?: string;
}

export interface LocumReview {
  id: string;
  application_id: string;
  overall: number;
  punctuality?: number | null;
  professionalism?: number | null;
  communication?: number | null;
  clinical?: number | null;
  review?: string;
  created_at: string;
  employer_name?: string;
  specialty?: string;
  shift_date?: string;
}

export interface LocumReliabilitySummary {
  completed_shifts: number;
  no_shows: number;
  active_strikes: number;
  strike_limit: number;
  rating: number | null;
  review_count: number;
  locum_blocked: boolean;
}

export interface LocumReliability extends LocumReliabilitySummary {
  cancellations: number;
  block: null | {
    id: string;
    unblock_amount: number;
    currency: string;
    created_at: string;
    strikes: { strike_id: string; pay_amount: number; employer_name: string; specialty: string; shift_date: string }[];
  };
  strike_history: LocumStrike[];
  reviews: LocumReview[];
}

export interface LocumShift {
  application: (MyLocumApplication | ManagedLocumApplication) & LocumAttendanceFields;
  locum: Locum;
  phase: LocumShiftPhase;
  arrival_opens_at: string;
  cancel_deadline: string;
  no_show_from: string;
  review: LocumReview | null;
  strike: LocumStrike | null;
  actions: {
    arrive?: boolean; cancel?: boolean; dispute?: boolean;
    approve_attendance?: boolean; flag_no_show?: boolean; review?: boolean; rebook?: boolean;
  };
  /** Hospital side only. */
  professional?: ManagedLocumApplication['applicant'];
  reliability?: LocumReliabilitySummary | null;
}

export type LocumRebookingStatus = 'sent' | 'viewed' | 'accepted' | 'rejected' | 'expired' | 'cancelled';

export interface LocumRebooking {
  id: string;
  locum_id: string;
  professional_id: string;
  source_application_id: string;
  application_id?: string | null;
  message: string;
  require_interview: boolean;
  shift_starts_at: string;
  shift_ends_at: string;
  expires_at: string;
  status: LocumRebookingStatus;
  viewed_at?: string | null;
  responded_at?: string | null;
  response_note?: string;
  created_at: string;
  locum?: Locum;
  professional?: ManagedLocumApplication['applicant'];
}

export const LOCUM_REBOOKING_META: Record<LocumRebookingStatus, { label: string; icon: string; tone: Tone }> = {
  sent: { label: 'Sent', icon: 'paper-plane-outline', tone: 'navy' },
  viewed: { label: 'Seen', icon: 'eye-outline', tone: 'navy' },
  accepted: { label: 'Accepted', icon: 'checkmark-circle', tone: 'teal' },
  rejected: { label: 'Declined', icon: 'close-circle-outline', tone: 'neutral' },
  expired: { label: 'Expired', icon: 'time-outline', tone: 'neutral' },
  cancelled: { label: 'Withdrawn', icon: 'arrow-undo-outline', tone: 'neutral' },
};

export interface ProfessionalShifts {
  reliability: LocumReliability;
  requests: LocumRebooking[];
  upcoming: LocumShift[];
  completed: LocumShift[];
  cancelled: LocumShift[];
  no_show: LocumShift[];
}

export interface ManagedShifts {
  today: LocumShift[];
  upcoming: LocumShift[];
  completed: LocumShift[];
  issues: LocumShift[];
  requests: LocumRebooking[];
  needs_action: number;
}

export interface UnblockCheckout {
  payment_id: string;
  status: string;
  amount: number;
  currency: string;
  provider: string;
  demo: boolean;
  failure_reason?: string;
}
