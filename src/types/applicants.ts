import type { ApplicationStatusKey } from './jobs';

/**
 * The applicant workspace and screening questions. Shapes mirror the Jobs API
 * (routes/jobs.py, services/applications.py, models/schemas.py).
 */

export type ScreeningType =
  | 'yes_no' | 'single_choice' | 'multiple_choice' | 'short_text' | 'long_text' | 'number' | 'date';

export interface ScreeningQuestion {
  id: string;
  text: string;
  type: ScreeningType;
  required: boolean;
  options: string[];
  /** Employer-only: the answer they would like to see. Never shown to applicants. */
  preferred?: string;
}

/** A question as it was asked, and what the applicant answered. */
export interface ScreeningAnswer extends ScreeningQuestion {
  answer: string | number | string[] | null;
}

export interface ScreeningSummary {
  total: number;
  answered: number;
  preferences: number;
  unmet: number;
}

export const SCREENING_TYPE_LABELS: Record<ScreeningType, string> = {
  yes_no: 'Yes / No',
  single_choice: 'Single choice',
  multiple_choice: 'Multiple choice',
  short_text: 'Short answer',
  long_text: 'Long answer',
  number: 'Number',
  date: 'Date',
};

export interface PersonCard {
  id: string;
  name?: string;
  avatar?: string;
  role?: string;
  headline?: string;
  professional_role?: string;
  specialty?: string;
  specialty_focus?: string;
  city?: string;
  state?: string;
  location?: string;
  years_experience?: number;
  account_verified?: boolean;
}

export interface ApplicantCard {
  id: string;
  status: ApplicationStatusKey;
  created_at: string;
  status_changed_at?: string;
  has_resume: boolean;
  interview_at?: string | null;
  screening: ScreeningSummary | null;
  applicant: PersonCard | null;
}

export type ApplicantSort = 'newest' | 'oldest' | 'updated' | 'experience' | 'name_asc' | 'name_desc';

export interface ApplicantQuery {
  q?: string;
  status?: ApplicationStatusKey;
  verified?: boolean;
  city?: string;
  exp_min?: number;
  has_resume?: boolean;
  screening?: 'meets' | 'unmet';
  sort?: ApplicantSort;
  page?: number;
  limit?: number;
}

export interface ApplicantPage {
  items: ApplicantCard[];
  total: number;
  page: number;
  has_more: boolean;
  counts: Record<ApplicationStatusKey, number>;
  all_total: number;
  cities: string[];
  has_screening: boolean;
}

export type TimelineEvent = {
  event: 'applied' | 'viewed' | 'status_changed' | 'interview_scheduled' | 'resume_viewed' | 'withdrawn';
  from_status?: ApplicationStatusKey | null;
  to_status?: ApplicationStatusKey | null;
  created_at: string;
};

export type InterviewMode = 'in_person' | 'video' | 'phone';

export interface InterviewInfo {
  interview_at: string;
  interview_mode: InterviewMode;
  interview_location: string;
  notes?: string;
}

export interface ProfileEntry {
  id: string;
  kind: string;
  data: Record<string, any>;
  verification_status?: string;
}

export interface ApplicantDetail {
  application: {
    id: string;
    job_id: string;
    status: ApplicationStatusKey;
    created_at: string;
    status_changed_at?: string;
    cover_note: string;
    employer_note: string;
    interview: InterviewInfo | null;
    allowed_moves: ApplicationStatusKey[];
  };
  applicant: PersonCard & {
    about?: string;
    primary_specialization?: string;
    current_organization?: string;
    areas_of_expertise?: string[];
    skills?: Record<string, string[]>;
    availability?: { open_to?: string[]; note?: string };
    entries: Record<string, ProfileEntry[]>;
  };
  screening: { answers: ScreeningAnswer[]; summary: ScreeningSummary } | null;
  resume: { available: boolean; name: string; size: number };
  timeline: TimelineEvent[];
}

export interface MyResume {
  has_resume: boolean;
  name: string;
  size: number;
  uploaded_at?: string | null;
}

export const INTERVIEW_MODE_LABELS: Record<InterviewMode, string> = {
  in_person: 'In person',
  video: 'Video call',
  phone: 'Phone call',
};
