/** Recruiter module: shapes exactly as the server sends them. */

export type RecruiterStatus =
  | 'PENDING' | 'UNDER_REVIEW' | 'NEEDS_INFORMATION' | 'APPROVED' | 'REJECTED' | 'SUSPENDED';

export type RecruiterDocType =
  | 'business_registration' | 'gst_certificate' | 'pan_card' | 'representative_id'
  | 'authorization_letter' | 'other';

export type PlacementType = 'permanent' | 'contract' | 'locum' | 'temporary' | 'telemedicine';

export interface RecruiterDocument {
  id: string;
  doc_type: RecruiterDocType;
  content_type: string;
  created_at: string;
}

export interface RecruiterAccount {
  user_id: string;
  org_id: string | null;
  status: RecruiterStatus;
  status_reason: string;
  company_name: string;
  legal_name: string;
  business_type: string;
  registration_number: string;
  gstin: string;
  pan: string;
  website: string;
  address: string;
  city: string;
  state: string;
  pincode: string;
  rep_name: string;
  rep_designation: string;
  rep_phone: string;
  rep_email: string;
  about: string;
  categories: string[];
  specialties: string[];
  regions: string[];
  placement_types: PlacementType[];
  submitted_at: string | null;
  reviewed_at: string | null;
  verified: boolean;
  can_submit: boolean;
  can_operate: boolean;
  documents: RecruiterDocument[];
  missing: string[];
  required_documents: RecruiterDocType[];
}

export interface StatusEvent {
  from_status: RecruiterStatus | null;
  to_status: RecruiterStatus;
  reason: string;
  created_at: string;
  actor?: string | null;
}

export interface PersonCard {
  id: string;
  name: string;
  avatar?: string;
  headline?: string;
  professional_role?: string;
  specialty?: string;
  city?: string;
  years_experience?: number | string;
  account_verified?: boolean;
}

export interface RecruiterDashboard {
  status: RecruiterStatus;
  status_reason: string;
  company_name: string;
  counts: {
    active_jobs: number; total_jobs: number; open_locums: number; applicants: number;
    hired: number; invitations_sent: number; invitations_accepted: number;
  };
  pipeline: Record<string, number>;
  invitations: Record<string, number>;
  recent_applications: {
    id: string; job_id: string; job_title: string; status: string; created_at: string;
    applicant: PersonCard | null;
  }[];
  /** Live jobs and open shifts, newest first (at most six). */
  openings?: DashboardOpening[];
  rep_name?: string;
}

export interface DashboardOpening {
  kind: 'job' | 'locum';
  id: string;
  title: string;
  city: string;
  applicants: number;
  created_at: string;
  client_name?: string;
  shift_date?: string;
  start_time?: string;
  end_time?: string;
}

export interface HistoryItem {
  id: string;
  title: string;
  status: 'closed' | 'filled';
  client_name: string;
  client_confidential: boolean;
  city: string;
  created_at: string;
  updated_at: string;
  applicants: number;
  hired: number;
}

export interface Candidate extends PersonCard {
  distance_label: string;
  distance_km: number | null;
  open_to_jobs: boolean;
  available_for_locum: boolean;
}

export interface CandidatePage {
  items: Candidate[];
  total: number;
  page: number;
  has_more: boolean;
}

export type InvitationStatus = 'SENT' | 'VIEWED' | 'ACCEPTED' | 'DECLINED' | 'EXPIRED';

export interface InvitationTarget {
  kind: 'job' | 'locum';
  id: string;
  title: string;
  city: string;
  open: boolean;
  employment_type?: string;
  shift_date?: string;
  start_time?: string;
  end_time?: string;
}

export interface PublicRecruiter {
  user_id: string;
  name: string;
  avatar: string;
  company_name: string;
  city: string;
  state: string;
  website: string;
  about: string;
  specialties: string[];
  regions: string[];
  placement_types: PlacementType[];
  verified: boolean;
  blocked?: boolean;
}

export interface Invitation {
  id: string;
  status: InvitationStatus;
  message: string;
  created_at: string;
  expires_at: string;
  viewed_at: string | null;
  responded_at: string | null;
  target: InvitationTarget;
  professional?: PersonCard | null;
  recruiter?: PublicRecruiter | null;
}

export type LocumRole = 'doctor' | 'nurse' | 'specialist' | 'allied_health' | 'other';

export interface DiscoverySettings {
  open_to_jobs: boolean;
  available_for_locum: boolean;
  recruiter_discovery: boolean;
  locum_alerts: 'immediate' | 'off';
  invitation_alerts: 'immediate' | 'off';
  locum_roles: LocumRole[];
  city: string;
  state: string;
  max_distance_km: number;
  city_known: boolean;
}

export interface AvailabilitySlot {
  id?: string;
  kind: 'weekly' | 'date';
  weekday?: number | null;
  on_date?: string | null;
  start_time: string;
  end_time: string;
  available: boolean;
}

export interface AdminRecruiterRow {
  user_id: string;
  company_name: string;
  city: string;
  status: RecruiterStatus;
  submitted_at: string | null;
  updated_at: string;
  name: string;
  email: string;
}

export interface AdminRecruiterDetail extends RecruiterAccount {
  account: { name: string; email: string; phone: string; email_verified: boolean; created_at: string };
  events: StatusEvent[];
  reports: number;
  actions: AdminAction[];
}

export type AdminAction = 'approve' | 'reject' | 'request_info' | 'suspend' | 'reactivate';

export const STATUS_META: Record<RecruiterStatus, { label: string; tone: 'neutral' | 'warning' | 'success' | 'danger' }> = {
  PENDING: { label: 'Not submitted', tone: 'neutral' },
  UNDER_REVIEW: { label: 'Under review', tone: 'warning' },
  NEEDS_INFORMATION: { label: 'Needs information', tone: 'warning' },
  APPROVED: { label: 'Verified Recruiter', tone: 'success' },
  REJECTED: { label: 'Not approved', tone: 'danger' },
  SUSPENDED: { label: 'Suspended', tone: 'danger' },
};

export const DOC_LABELS: Record<RecruiterDocType, string> = {
  business_registration: 'Business registration certificate',
  gst_certificate: 'GST certificate',
  pan_card: 'Company PAN card',
  representative_id: 'Representative photo ID',
  authorization_letter: 'Authorisation letter',
  other: 'Other supporting document',
};

export const INVITATION_LABELS: Record<InvitationStatus, string> = {
  SENT: 'Sent', VIEWED: 'Viewed', ACCEPTED: 'Applied', DECLINED: 'Declined', EXPIRED: 'Expired',
};

export const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

/** "business_registration" -> "Business registration certificate", "legal_name" -> "Legal name". */
export function missingLabel(key: string): string {
  if (key.startsWith('document:')) return DOC_LABELS[key.slice(9) as RecruiterDocType] ?? key.slice(9);
  const label = key.replace(/^rep_/, 'representative ').replace(/_/g, ' ');
  return label.charAt(0).toUpperCase() + label.slice(1);
}
