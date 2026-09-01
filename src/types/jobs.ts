/**
 * The jobs domain, as the client sees it.
 *
 * The label maps live here rather than beside each screen because the same
 * vocabulary appears on the card, in the filter sheet, on the detail page and
 * in the posting form. When those drifted apart in the old screen a job could
 * read "full-time" in the list and "Full Time" in the form, which looks like
 * two different things to someone scanning quickly.
 */

export type EmploymentType =
  | 'full_time' | 'part_time' | 'contract' | 'locum' | 'temporary' | 'telemedicine'
  | 'fellowship' | 'residency' | 'research' | 'academic' | 'internship';

export type WorkMode = 'onsite' | 'hybrid' | 'remote';
export type PayPeriod = 'hour' | 'shift' | 'day' | 'month' | 'year';
export type JobStatus = 'draft' | 'active' | 'paused' | 'closed' | 'filled' | 'expired';
export type JobSort = 'newest' | 'pay_high' | 'closing_soon' | 'urgent';

export type ApplicationStatusKey =
  | 'applied' | 'reviewing' | 'shortlisted' | 'interviewing'
  | 'offered' | 'hired' | 'rejected' | 'withdrawn';

export interface Job {
  id: string;
  poster_id: string;
  org_id?: string | null;
  posted_as: 'individual' | 'organization';

  employment_type: EmploymentType;
  title: string;
  specialty: string;
  department?: string;
  description: string;
  responsibilities?: string;
  requirements?: string;

  city?: string;
  state?: string;
  location: string;
  work_mode: WorkMode;

  /** Absent entirely when the employer chose not to disclose pay. */
  pay_min?: number;
  pay_max?: number;
  pay_monthly_min?: number;
  pay_monthly_max?: number;
  pay_period: PayPeriod;
  pay_currency: string;
  pay_disclosed: boolean;

  experience_min: number;
  experience_max: number;
  vacancies: number;
  skills: string[];

  shift_start_date?: string | null;
  shift_end_date?: string | null;
  shift_time?: string;
  shift_duration?: string;
  is_urgent: boolean;

  status: JobStatus;
  expires_at?: string | null;
  published_at?: string | null;

  applicant_count: number;
  view_count: number;
  save_count: number;
  created_at: string;
  updated_at?: string;

  // Attached per request by the API, never stored on the row.
  saved: boolean;
  has_applied: boolean;
  can_manage: boolean;
  employer_name: string;
  employer_avatar?: string;
  /** Present only for an organisation posting; undefined for an individual. */
  employer_verified?: boolean;
  employer_type?: string | null;
  poster_role?: string | null;
}

export interface JobsPage {
  items: Job[];
  total: number;
  total_capped: boolean;
  has_more: boolean;
}

export interface JobFilters {
  q?: string;
  specialty?: string;
  city?: string;
  state?: string;
  employment_type?: EmploymentType[];
  work_mode?: WorkMode;
  pay_min?: number;
  pay_max?: number;
  experience_max?: number;
  urgent_only?: boolean;
  posted_within_days?: number;
  org_id?: string;
  sort?: JobSort;
}

export interface Application {
  id: string;
  job_id: string;
  user_id: string;
  user_name: string;
  specialty: string;
  status: ApplicationStatusKey;
  cover_note?: string;
  employer_note?: string;
  created_at: string;
  status_changed_at?: string;
  job_title?: string;
  job_location?: string;
  employment_type?: EmploymentType;
  employer_name?: string;
}

// ── Labels ───────────────────────────────────────────────────────────────────

export const EMPLOYMENT_TYPE_LABELS: Record<EmploymentType, string> = {
  full_time: 'Full-time',
  part_time: 'Part-time',
  contract: 'Contract',
  locum: 'Locum',
  temporary: 'Temporary',
  telemedicine: 'Telemedicine',
  fellowship: 'Fellowship',
  residency: 'Residency',
  research: 'Research',
  academic: 'Academic',
  internship: 'Internship',
};

/** Order the filter sheet and the posting form both present them in. */
export const EMPLOYMENT_TYPES = Object.keys(EMPLOYMENT_TYPE_LABELS) as EmploymentType[];

export const WORK_MODE_LABELS: Record<WorkMode, string> = {
  onsite: 'On-site',
  hybrid: 'Hybrid',
  remote: 'Remote',
};

export const PAY_PERIOD_LABELS: Record<PayPeriod, string> = {
  hour: 'per hour',
  shift: 'per shift',
  day: 'per day',
  month: 'per month',
  year: 'per year',
};

export const SORT_LABELS: Record<JobSort, string> = {
  newest: 'Most recent',
  pay_high: 'Highest pay',
  closing_soon: 'Starting soonest',
  urgent: 'Urgent first',
};

/**
 * Status presentation. Every entry carries an icon as well as a tone, because
 * a pipeline stage must never be communicated by colour alone — and because
 * "Rejected" and "Offered" are the two a user most needs to tell apart at a
 * glance.
 */
export const APPLICATION_STATUS_META: Record<
  ApplicationStatusKey,
  { label: string; icon: string; tone: 'neutral' | 'teal' | 'navy' | 'warning' | 'danger' }
> = {
  applied: { label: 'Applied', icon: 'paper-plane-outline', tone: 'navy' },
  reviewing: { label: 'Under review', icon: 'eye-outline', tone: 'warning' },
  shortlisted: { label: 'Shortlisted', icon: 'star-outline', tone: 'teal' },
  interviewing: { label: 'Interviewing', icon: 'chatbubbles-outline', tone: 'teal' },
  offered: { label: 'Offered', icon: 'ribbon-outline', tone: 'teal' },
  hired: { label: 'Hired', icon: 'checkmark-circle-outline', tone: 'teal' },
  rejected: { label: 'Not selected', icon: 'close-circle-outline', tone: 'danger' },
  withdrawn: { label: 'Withdrawn', icon: 'arrow-undo-outline', tone: 'neutral' },
};

/** Employment types that carry dates rather than a standing vacancy. */
export const SHIFT_TYPES: EmploymentType[] = ['locum', 'temporary'];

export const isShiftRole = (t?: EmploymentType | null): boolean =>
  !!t && SHIFT_TYPES.includes(t);
