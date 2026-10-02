/**
 * Organisations: the employer identity behind a posting.
 *
 * The one field worth being careful with is `verification_status`. It is a
 * REVIEWED fact, set only by an admin approving a submitted document, and the
 * UI must never render a tick from anything else — not from the poster's own
 * KYC, not from account type. `verified` is the derived boolean the server
 * sends so no screen has to remember which of the four statuses counts.
 */

export type OrgType =
  | 'hospital' | 'clinic' | 'diagnostic_centre' | 'nursing_home'
  | 'pharma' | 'academic' | 'staffing' | 'ngo' | 'other';

export type OrgRole = 'owner' | 'admin' | 'recruiter';
export type OrgMemberStatus = 'invited' | 'active' | 'removed';
export type OrgVerification = 'unverified' | 'pending' | 'verified' | 'rejected';

export interface Organization {
  id: string;
  slug: string;
  name: string;
  org_type: OrgType;
  headline?: string;
  about?: string;
  logo?: string;
  cover_photo?: string;
  website?: string;
  public_email?: string;
  public_phone?: string;
  address_line?: string;
  city?: string;
  state?: string;
  pincode?: string;
  bed_count?: number;
  founded_year?: number | null;
  specialties?: string[];

  verification_status: OrgVerification;
  verified: boolean;
  verified_at?: string | null;

  job_count: number;
  member_count: number;
  created_at: string;

  /** Present only for a member; absent on the public page. */
  legal_name?: string;
  my_role?: OrgRole | null;
  can_edit?: boolean;
  can_post?: boolean;

  // ── Institutional profile ──────────────────────────────────────────────
  /** The hospital/clinic account this organisation is the public face of. */
  account_user_id?: string | null;
  subtype?: string;
  ownership?: OrgOwnership;
  country?: string;
  services?: string[];
  facilities?: string[];
  accreditations?: string[];
  research_focus?: string[];
  academic_programs?: string[];
  /** Hospital only -- never sent for a clinic. */
  teaching?: boolean;
  emergency_24x7?: boolean;
  emergency_phone?: string;
  ambulance?: boolean;
  open_24x7?: boolean;
  opening_hours?: OrgOpeningHours[];
  photos?: OrgPhoto[];
  links?: OrgLink[];
}

export type OrgOwnership = '' | 'private' | 'government' | 'trust' | 'corporate' | 'other';

export interface OrgOpeningHours { day: number; open: string; close: string }
export interface OrgPhoto { id: string; url: string; caption?: string; created_at?: string }
export interface OrgLink { label: string; url: string }

export interface OrgTeamMember {
  id: string;
  name: string;
  avatar?: string;
  headline?: string;
  professional_role?: string;
  specialty?: string;
  account_verified?: boolean;
  affiliation_id: string;
  title?: string;
  department?: string;
}

export interface OrgAffiliationRequest {
  id: string;
  status: 'requested' | 'approved';
  title?: string;
  department?: string;
  created_at?: string;
  professional: Omit<OrgTeamMember, 'affiliation_id' | 'title' | 'department'> | null;
}

/** Everything the profile page shows, from GET /organizations/{id}/profile. */
export interface OrgProfilePage {
  organization: Organization;
  team: OrgTeamMember[];
  jobs: any[];
  job_total: number;
  locums: any[];
  locum_total: number;
  my_affiliation: { id: string; status: 'requested' | 'approved' } | null;
  is_account: boolean;
}

export const ORG_OWNERSHIP_LABELS: Record<Exclude<OrgOwnership, ''>, string> = {
  private: 'Private', government: 'Government', trust: 'Trust / charitable',
  corporate: 'Corporate', other: 'Other',
};

/** Mon = 0, matching the server. */
export const WEEKDAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

export interface OrgMember {
  id: string;
  user_id: string;
  role: OrgRole;
  status: OrgMemberStatus;
  created_at: string;
  name: string;
  avatar?: string;
  headline?: string;
}

export const ORG_TYPE_LABELS: Record<OrgType, string> = {
  hospital: 'Hospital',
  clinic: 'Clinic',
  diagnostic_centre: 'Diagnostic centre',
  nursing_home: 'Nursing home',
  pharma: 'Pharmaceutical',
  academic: 'Medical college',
  staffing: 'Staffing agency',
  ngo: 'Non-profit',
  other: 'Other',
};

export const ORG_TYPES = Object.keys(ORG_TYPE_LABELS) as OrgType[];

export const ORG_ROLE_LABELS: Record<OrgRole, string> = {
  owner: 'Owner',
  admin: 'Admin',
  recruiter: 'Recruiter',
};

/** What each role may actually do, shown beside the picker when inviting. */
export const ORG_ROLE_HINTS: Record<OrgRole, string> = {
  owner: 'Full control, including verification and removing other owners.',
  admin: 'Can edit the page and manage people, but not owners.',
  recruiter: 'Can post roles and manage applicants.',
};

/**
 * How each verification state is presented.
 *
 * Only `verified` gets a tick. The others are deliberately quiet — an
 * "unverified" badge on every new organisation would be noise, and a loud one
 * would punish employers for a review they are waiting on.
 */
export const ORG_VERIFICATION_META: Record<
  OrgVerification,
  { label: string; icon: string; tone: 'teal' | 'warning' | 'neutral' | 'danger' } | null
> = {
  verified: { label: 'Verified healthcare organisation', icon: 'checkmark-circle', tone: 'teal' },
  pending: { label: 'Verification in review', icon: 'time-outline', tone: 'warning' },
  rejected: { label: 'Verification declined', icon: 'alert-circle-outline', tone: 'danger' },
  unverified: null,
};
