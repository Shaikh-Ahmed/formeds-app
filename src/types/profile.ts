/**
 * The profile wire contract, mirroring `profile_entries` and the profile
 * columns on `users`.
 *
 * Entries are one generic table keyed by `kind` with a JSONB payload, so a new
 * section type is a new member of this union plus a form definition — no
 * migration, no new endpoint. Keep this file in step with the per-kind Pydantic
 * models in `backend/models/schemas.py`; they are the enforcing half.
 */

export type Visibility = 'everyone' | 'verified_professionals' | 'employers' | 'only_me';

export const VISIBILITY_LABELS: Record<Visibility, string> = {
  everyone: 'Everyone on ForMeds',
  verified_professionals: 'Verified healthcare professionals',
  employers: 'Employers and hospitals',
  only_me: 'Only me',
};

/**
 * `unverified` renders as nothing on a public profile — absence, not a grey
 * badge. Never derive this from the account-level KYC flag: an account can be
 * verified while a specific claim on it has never been checked.
 */
export type VerificationStatus = 'unverified' | 'pending' | 'verified' | 'rejected';

export type EntryKind =
  | 'experience'
  | 'education'
  | 'certification'
  | 'award'
  | 'publication'
  | 'conference'
  | 'registration';

/** `YYYY-MM` — the pickers collect month precision, so a full date would invent a day. */
export type MonthString = string;

export interface ExperienceData {
  title: string;
  organization: string;
  employment_type?: EmploymentType;
  department?: string;
  location?: string;
  start_date?: MonthString;
  end_date?: MonthString;
  is_current?: boolean;
  description?: string;
  skills?: string[];
}

export interface EducationData {
  degree: string;
  institution: string;
  field_of_study?: string;
  location?: string;
  start_year?: number;
  end_year?: number;
  grade?: string;
  description?: string;
  /** Residencies and fellowships sit in this section but read differently. */
  is_training?: boolean;
}

export interface CertificationData {
  name: string;
  issuer: string;
  issue_date?: MonthString;
  expiry_date?: MonthString;
  does_not_expire?: boolean;
  credential_id?: string;
  credential_url?: string;
}

export interface AwardData {
  title: string;
  issuer?: string;
  date?: MonthString;
  description?: string;
}

export interface PublicationData {
  title: string;
  journal?: string;
  publication_date?: MonthString;
  doi?: string;
  url?: string;
  authors?: string[];
  abstract?: string;
}

export interface ConferenceData {
  name: string;
  role?: ConferenceRole;
  title?: string;
  location?: string;
  date?: MonthString;
  cme_credits?: number;
  description?: string;
}

export interface RegistrationData {
  council: string;
  registration_number: string;
  registration_type?: 'nmc' | 'rohini' | 'state' | 'other';
  state?: string;
  issue_date?: MonthString;
  expiry_date?: MonthString;
}

export interface EntryDataMap {
  experience: ExperienceData;
  education: EducationData;
  certification: CertificationData;
  award: AwardData;
  publication: PublicationData;
  conference: ConferenceData;
  registration: RegistrationData;
}

interface EntryBase {
  id: string;
  position: number;
  visibility: Visibility;
  verification_status: VerificationStatus;
  created_at?: string;
  updated_at?: string;
}

/** Discriminated on `kind`, so narrowing an entry narrows its payload. */
export type ProfileEntry = {
  [K in EntryKind]: EntryBase & { kind: K; data: EntryDataMap[K] };
}[EntryKind];

export type EntryOfKind<K extends EntryKind> = EntryBase & { kind: K; data: EntryDataMap[K] };

export type EmploymentType =
  | 'full_time'
  | 'part_time'
  | 'locum'
  | 'visiting'
  | 'consultant'
  | 'resident'
  | 'fellow'
  | 'volunteer'
  | 'other';

export const EMPLOYMENT_TYPE_LABELS: Record<EmploymentType, string> = {
  full_time: 'Full-time',
  part_time: 'Part-time',
  locum: 'Locum',
  visiting: 'Visiting',
  consultant: 'Consultant',
  resident: 'Resident',
  fellow: 'Fellow',
  volunteer: 'Volunteer',
  other: 'Other',
};

export type ConferenceRole = 'attendee' | 'speaker' | 'poster' | 'panelist' | 'organizer' | 'faculty';

export const CONFERENCE_ROLE_LABELS: Record<ConferenceRole, string> = {
  attendee: 'Attendee',
  speaker: 'Speaker',
  poster: 'Poster presentation',
  panelist: 'Panelist',
  organizer: 'Organizer',
  faculty: 'Faculty',
};

export type SkillCategory = 'clinical' | 'technical' | 'professional' | 'research';

export const SKILL_CATEGORY_LABELS: Record<SkillCategory, string> = {
  clinical: 'Clinical',
  technical: 'Technical & procedural',
  professional: 'Professional',
  research: 'Research',
};

export type Skills = Partial<Record<SkillCategory, string[]>>;

export type OpenToOption =
  | 'full_time'
  | 'part_time'
  | 'locum'
  | 'telemedicine'
  | 'consulting'
  | 'teaching'
  | 'research'
  | 'mentorship';

export const OPEN_TO_LABELS: Record<OpenToOption, string> = {
  full_time: 'Full-time roles',
  part_time: 'Part-time roles',
  locum: 'Locum opportunities',
  telemedicine: 'Telemedicine',
  consulting: 'Consulting',
  teaching: 'Teaching',
  research: 'Research',
  mentorship: 'Mentorship',
};

export interface Availability {
  open_to?: OpenToOption[];
  note?: string;
}

export interface Mentorship {
  available_as_mentor?: boolean;
  looking_for_mentor?: boolean;
  topics?: string[];
}

export type LinkKey = 'linkedin' | 'orcid' | 'researchgate' | 'google_scholar' | 'website' | 'portfolio';

export const LINK_META: Record<LinkKey, { label: string; icon: string; placeholder: string }> = {
  linkedin: { label: 'LinkedIn', icon: 'logo-linkedin', placeholder: 'https://linkedin.com/in/…' },
  orcid: { label: 'ORCID', icon: 'finger-print-outline', placeholder: 'https://orcid.org/0000-…' },
  researchgate: { label: 'ResearchGate', icon: 'flask-outline', placeholder: 'https://researchgate.net/profile/…' },
  google_scholar: { label: 'Google Scholar', icon: 'school-outline', placeholder: 'https://scholar.google.com/…' },
  website: { label: 'Website', icon: 'globe-outline', placeholder: 'https://…' },
  portfolio: { label: 'Portfolio', icon: 'briefcase-outline', placeholder: 'https://…' },
};

export type ProfessionalLinks = Partial<Record<LinkKey, string>>;

/** Sections that carry an independent visibility setting. */
export type SectionKey =
  | 'about'
  | 'expertise'
  | 'skills'
  | 'interests'
  | 'links'
  | 'organization'
  | 'mentorship'
  | 'availability'
  | EntryKind;

export type SectionVisibility = Partial<Record<SectionKey, Visibility>>;

/** Scalar profile fields — the identity half, stored as columns on `users`. */
export interface ProfileScalars {
  name?: string;
  headline?: string;
  about?: string;
  avatar?: string;
  cover_photo?: string;
  role?: string;
  professional_role?: string;
  /** Legacy free-text specialty, still returned by the server. */
  specialty?: string;
  specialty_focus?: string;
  primary_specialization?: string;
  areas_of_expertise?: string[];
  professional_interests?: string[];
  skills?: Skills;
  current_organization?: string;
  city?: string;
  state?: string;
  preferred_location?: string;
  years_experience?: number;
  open_to_work?: boolean;
  availability?: Availability;
  mentorship?: Mentorship;
  professional_links?: ProfessionalLinks;
  section_visibility?: SectionVisibility;
}

/** One suggestion in the completion nudge — `key` scrolls to that section. */
export interface CompletionSuggestion {
  key: SectionKey | 'avatar' | 'headline';
  label: string;
}

export interface ProfileCompletionInfo {
  percent: number;
  suggestions: CompletionSuggestion[];
}

/** The full payload from `GET /api/profile/me` or `/api/profile/{id}`. */
export interface Profile extends ProfileScalars {
  id: string;
  /** Account-level KYC. Never render a per-entry check from this. */
  account_verified?: boolean;
  entries: Partial<Record<EntryKind, ProfileEntry[]>>;
  completion?: ProfileCompletionInfo;
  /** True when the viewer is looking at their own profile. */
  is_self?: boolean;
}

export const ENTRY_KINDS: EntryKind[] = [
  'experience',
  'education',
  'certification',
  'award',
  'publication',
  'conference',
  'registration',
];
