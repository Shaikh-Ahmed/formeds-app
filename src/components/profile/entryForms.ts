import {
  CONFERENCE_ROLE_LABELS,
  EMPLOYMENT_TYPE_LABELS,
  EntryKind,
} from '../../types/profile';

/**
 * Field layout per entry kind, as data.
 *
 * `EntrySheet` renders whatever it finds here, so adding a section type is a
 * new entry in this map plus a Pydantic model on the server — not a new form
 * component. Keep the field `key`s identical to the backend payload models in
 * `backend/models/schemas.py`; that pairing is what makes the generic JSONB
 * column safe to write into.
 */

export type FieldType =
  | 'text'
  | 'textarea'
  | 'month'
  | 'year'
  | 'number'
  | 'switch'
  | 'select'
  | 'tags'
  | 'multiselect';

export interface FieldDef {
  key: string;
  label: string;
  type: FieldType;
  required?: boolean;
  placeholder?: string;
  helper?: string;
  options?: { value: string; label: string }[];
  /** Hidden while the named boolean field is true (e.g. end date vs "current"). */
  hiddenWhen?: string;
}

export interface EntryForm {
  /** Sheet title when adding. */
  addTitle: string;
  editTitle: string;
  fields: FieldDef[];
}

const toOptions = (labels: Record<string, string>) =>
  Object.entries(labels).map(([value, label]) => ({ value, label }));

export const ENTRY_FORMS: Record<EntryKind, EntryForm> = {
  experience: {
    addTitle: 'Add experience',
    editTitle: 'Edit experience',
    fields: [
      { key: 'title', label: 'Job title', type: 'text', required: true, placeholder: 'Senior Consultant Cardiologist' },
      { key: 'organization', label: 'Organization', type: 'text', required: true, placeholder: 'Apollo Hospitals' },
      { key: 'employment_type', label: 'Employment type', type: 'select', options: toOptions(EMPLOYMENT_TYPE_LABELS) },
      { key: 'department', label: 'Department', type: 'text', placeholder: 'Cardiology' },
      { key: 'location', label: 'Location', type: 'text', placeholder: 'Hyderabad, Telangana' },
      { key: 'is_current', label: 'I currently work here', type: 'switch' },
      { key: 'start_date', label: 'Start date', type: 'month' },
      { key: 'end_date', label: 'End date', type: 'month', hiddenWhen: 'is_current' },
      {
        key: 'description',
        label: 'Responsibilities and achievements',
        type: 'textarea',
        placeholder: 'One per line — they render as bullets.',
        helper: 'Each line becomes a bullet point.',
      },
      { key: 'skills', label: 'Clinical specialties', type: 'tags', placeholder: 'Interventional cardiology' },
    ],
  },

  education: {
    addTitle: 'Add education',
    editTitle: 'Edit education',
    fields: [
      { key: 'degree', label: 'Degree', type: 'text', required: true, placeholder: 'MD, MBBS, DNB, BSc Nursing…' },
      { key: 'institution', label: 'Institution', type: 'text', required: true, placeholder: 'AIIMS, New Delhi' },
      { key: 'field_of_study', label: 'Specialization', type: 'text', placeholder: 'Internal Medicine' },
      { key: 'location', label: 'Location', type: 'text' },
      {
        key: 'is_training',
        label: 'This is a residency or fellowship',
        type: 'switch',
        helper: 'Training posts are labelled separately from academic degrees.',
      },
      { key: 'start_year', label: 'Start year', type: 'year' },
      { key: 'end_year', label: 'End year', type: 'year' },
      { key: 'grade', label: 'Grade or score', type: 'text' },
      { key: 'description', label: 'Description', type: 'textarea' },
    ],
  },

  certification: {
    addTitle: 'Add certification',
    editTitle: 'Edit certification',
    fields: [
      { key: 'name', label: 'Certification', type: 'text', required: true, placeholder: 'ACLS, BLS, PALS…' },
      { key: 'issuer', label: 'Issuing organization', type: 'text', required: true, placeholder: 'American Heart Association' },
      { key: 'issue_date', label: 'Issued', type: 'month' },
      { key: 'does_not_expire', label: 'This credential does not expire', type: 'switch' },
      { key: 'expiry_date', label: 'Expires', type: 'month', hiddenWhen: 'does_not_expire' },
      { key: 'credential_id', label: 'Credential ID', type: 'text' },
      { key: 'credential_url', label: 'Credential URL', type: 'text', placeholder: 'https://…' },
    ],
  },

  award: {
    addTitle: 'Add award',
    editTitle: 'Edit award',
    fields: [
      { key: 'title', label: 'Award', type: 'text', required: true, placeholder: 'Best Resident Award' },
      { key: 'issuer', label: 'Awarded by', type: 'text', placeholder: 'AIIMS' },
      { key: 'date', label: 'Date', type: 'month' },
      { key: 'description', label: 'Description', type: 'textarea' },
    ],
  },

  publication: {
    addTitle: 'Add publication',
    editTitle: 'Edit publication',
    fields: [
      { key: 'title', label: 'Title', type: 'text', required: true },
      { key: 'journal', label: 'Journal', type: 'text', placeholder: 'Indian Heart Journal' },
      { key: 'publication_date', label: 'Published', type: 'month' },
      { key: 'authors', label: 'Authors', type: 'tags', placeholder: 'Sharma R' },
      { key: 'doi', label: 'DOI', type: 'text', placeholder: '10.1016/j.ihj.2024.01.001' },
      { key: 'url', label: 'Link', type: 'text', placeholder: 'https://…' },
      { key: 'abstract', label: 'Abstract', type: 'textarea' },
    ],
  },

  conference: {
    addTitle: 'Add conference or CME',
    editTitle: 'Edit conference or CME',
    fields: [
      { key: 'name', label: 'Event or course', type: 'text', required: true, placeholder: 'CSI Annual Conference' },
      { key: 'role', label: 'Your role', type: 'select', options: toOptions(CONFERENCE_ROLE_LABELS) },
      { key: 'title', label: 'Presentation title', type: 'text' },
      { key: 'location', label: 'Location', type: 'text' },
      { key: 'date', label: 'Date', type: 'month' },
      { key: 'cme_credits', label: 'CME credits', type: 'number' },
      { key: 'description', label: 'Notes', type: 'textarea' },
    ],
  },

  registration: {
    addTitle: 'Add medical registration',
    editTitle: 'Edit medical registration',
    fields: [
      { key: 'council', label: 'Medical council', type: 'text', required: true, placeholder: 'Telangana State Medical Council' },
      {
        key: 'registration_number',
        label: 'Registration number',
        type: 'text',
        required: true,
        helper: 'Shown masked by default. Use the section privacy control to choose who can see it.',
      },
      {
        key: 'registration_type',
        label: 'Type',
        type: 'select',
        options: [
          { value: 'nmc', label: 'National Medical Commission' },
          { value: 'state', label: 'State council' },
          { value: 'rohini', label: 'ROHINI (facility)' },
          { value: 'other', label: 'Other' },
        ],
      },
      { key: 'state', label: 'State or country', type: 'text' },
      { key: 'issue_date', label: 'Registered', type: 'month' },
      { key: 'expiry_date', label: 'Expires', type: 'month' },
    ],
  },
};

/** Strips blanks so the server stores absent rather than empty strings. */
export function pruneEmpty(values: Record<string, any>): Record<string, any> {
  const out: Record<string, any> = {};
  Object.entries(values).forEach(([key, value]) => {
    if (value === '' || value === null || value === undefined) return;
    if (Array.isArray(value) && value.length === 0) return;
    out[key] = value;
  });
  return out;
}

/**
 * Scalar profile fields, grouped into the sheets that edit them.
 *
 * Keyed by the section a user taps, so "Add skills" opens a sheet containing
 * only the skill categories rather than one giant profile form — the brief is
 * explicit that a single monolithic edit form is what this redesign replaces.
 */
export type ScalarFormKey =
  | 'identity'
  | 'about'
  | 'specializations'
  | 'skills'
  | 'interests'
  | 'availability'
  | 'mentorship'
  | 'links';

export const SCALAR_FORMS: Record<ScalarFormKey, EntryForm> = {
  identity: {
    addTitle: 'Edit profile',
    editTitle: 'Edit profile',
    fields: [
      { key: 'name', label: 'Full name', type: 'text', required: true },
      {
        key: 'headline',
        label: 'Professional headline',
        type: 'text',
        placeholder: 'Cardiologist | Interventional Cardiology | 8+ Years',
        helper: 'The one line that appears under your name.',
      },
      { key: 'current_organization', label: 'Current organization', type: 'text', placeholder: 'Apollo Hospitals' },
      { key: 'city', label: 'City', type: 'text' },
      { key: 'state', label: 'State', type: 'text' },
      { key: 'preferred_location', label: 'Preferred location', type: 'text' },
      { key: 'years_experience', label: 'Years of experience', type: 'number' },
    ],
  },
  about: {
    addTitle: 'Add professional summary',
    editTitle: 'Edit professional summary',
    fields: [
      {
        key: 'about',
        label: 'Professional summary',
        type: 'textarea',
        placeholder: 'Cardiologist with 8+ years of clinical experience specializing in…',
        helper: 'Two or three sentences. Long summaries collapse behind a "more" link.',
      },
    ],
  },
  specializations: {
    addTitle: 'Add specializations',
    editTitle: 'Edit specializations',
    fields: [
      { key: 'primary_specialization', label: 'Primary specialization', type: 'text', placeholder: 'Cardiology' },
      { key: 'areas_of_expertise', label: 'Areas of expertise', type: 'tags', placeholder: 'Interventional cardiology' },
    ],
  },
  skills: {
    addTitle: 'Add skills',
    editTitle: 'Edit skills',
    fields: [
      { key: 'clinical', label: 'Clinical skills', type: 'tags', placeholder: 'ECG interpretation' },
      { key: 'technical', label: 'Technical & procedural', type: 'tags', placeholder: 'Echocardiography' },
      { key: 'professional', label: 'Professional skills', type: 'tags', placeholder: 'Patient management' },
      { key: 'research', label: 'Research skills', type: 'tags', placeholder: 'Clinical research' },
    ],
  },
  interests: {
    addTitle: 'Add professional interests',
    editTitle: 'Edit professional interests',
    fields: [
      { key: 'professional_interests', label: 'Interests', type: 'tags', placeholder: 'Healthcare AI' },
    ],
  },
  availability: {
    addTitle: 'Set availability',
    editTitle: 'Edit availability',
    fields: [
      {
        key: 'open_to',
        label: 'Open to',
        type: 'multiselect',
        options: [
          { value: 'full_time', label: 'Full-time roles' },
          { value: 'part_time', label: 'Part-time roles' },
          { value: 'locum', label: 'Locum opportunities' },
          { value: 'telemedicine', label: 'Telemedicine' },
          { value: 'consulting', label: 'Consulting' },
          { value: 'teaching', label: 'Teaching' },
          { value: 'research', label: 'Research' },
          { value: 'mentorship', label: 'Mentorship' },
        ],
        helper: 'Visible to hospitals and clinics by default, not to other professionals.',
      },
      { key: 'note', label: 'Note', type: 'text', placeholder: 'Available weekends' },
    ],
  },
  mentorship: {
    addTitle: 'Set mentorship',
    editTitle: 'Edit mentorship',
    fields: [
      { key: 'available_as_mentor', label: 'Available as a mentor', type: 'switch' },
      { key: 'looking_for_mentor', label: 'Looking for a mentor', type: 'switch' },
      { key: 'topics', label: 'Topics', type: 'tags', placeholder: 'Career guidance' },
    ],
  },
  links: {
    addTitle: 'Add professional links',
    editTitle: 'Edit professional links',
    fields: [
      { key: 'linkedin', label: 'LinkedIn', type: 'text', placeholder: 'https://linkedin.com/in/…' },
      { key: 'orcid', label: 'ORCID', type: 'text', placeholder: 'https://orcid.org/0000-…' },
      { key: 'researchgate', label: 'ResearchGate', type: 'text', placeholder: 'https://researchgate.net/profile/…' },
      { key: 'google_scholar', label: 'Google Scholar', type: 'text', placeholder: 'https://scholar.google.com/…' },
      { key: 'website', label: 'Website', type: 'text', placeholder: 'https://…' },
      { key: 'portfolio', label: 'Portfolio', type: 'text', placeholder: 'https://…' },
    ],
  },
};
