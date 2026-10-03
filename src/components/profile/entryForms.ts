import {
  CONFERENCE_ROLE_LABELS,
  EMPLOYMENT_TYPE_LABELS,
  EntryKind,
} from '../../types/profile';
import { STATE_NAMES, citiesForState } from '../../data/indiaLocations';

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
  | 'lookup'
  | 'textarea'
  | 'month'
  | 'year'
  | 'number'
  | 'switch'
  | 'select'
  | 'tags'
  | 'multiselect';

/**
 * Config for a `lookup` field — the searchable single-select.
 *
 * `select` renders its options as chips, which is right for the five or six an
 * employment type has and useless at the ~900 of an Indian city list. A lookup
 * puts the same choice behind `SelectField` instead.
 */
export interface LookupConfig {
  /** A fixed list, or one derived from the rest of the draft (city ← state). */
  options: string[] | ((draft: Record<string, any>) => string[]);
  /** Appends OTHER_OPTION; choosing it reveals a free-text box. */
  allowOther?: boolean;
  /** This field is disabled until the named field has a value, and is cleared
   *  whenever that field changes — how a city stays inside its state. */
  clearedBy?: string;
  /** Shown in place of the placeholder while `clearedBy` is still empty. */
  requiresHint?: string;
  searchPlaceholder?: string;
}

/** The free-text escape in a lookup; same string as OTHER_CITY/OTHER_SPECIALTY. */
export const OTHER_OPTION = 'Other';

export interface FieldDef {
  key: string;
  label: string;
  type: FieldType;
  required?: boolean;
  placeholder?: string;
  helper?: string;
  options?: { value: string; label: string }[];
  /** Required when `type` is 'lookup'. */
  lookup?: LookupConfig;
  /** Hidden while the named boolean field is true (e.g. end date vs "current"). */
  hiddenWhen?: string;
  /** A month/year that has already happened (the current one counts). */
  notFuture?: boolean;
  /** Must be on or after the named field (end after start, expiry after issue). */
  onOrAfter?: string;
  /** An https link; optionally only to these hosts (LinkedIn, ORCID...). */
  url?: boolean;
  hosts?: string[];
  /** Numbers: upper bound, and whether decimals are allowed. */
  max?: number;
  decimals?: boolean;
  /** Text: the server's length cap, enforced while typing. */
  maxLength?: number;
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
      { key: 'title', label: 'Job title', type: 'text', required: true, placeholder: 'Senior Consultant Cardiologist', maxLength: 120 },
      { key: 'organization', label: 'Organization', type: 'text', required: true, placeholder: 'Apollo Hospitals', maxLength: 160 },
      { key: 'employment_type', label: 'Employment type', type: 'select', options: toOptions(EMPLOYMENT_TYPE_LABELS) },
      { key: 'department', label: 'Department', type: 'text', placeholder: 'Cardiology' },
      { key: 'location', label: 'Location', type: 'text', placeholder: 'Hyderabad, Telangana' },
      { key: 'is_current', label: 'I currently work here', type: 'switch' },
      { key: 'start_date', label: 'Start date', type: 'month', notFuture: true },
      { key: 'end_date', label: 'End date', type: 'month', hiddenWhen: 'is_current', onOrAfter: 'start_date' },
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
      { key: 'start_year', label: 'Start year', type: 'year', max: new Date().getFullYear() + 1 },
      { key: 'end_year', label: 'End year (or expected)', type: 'year', onOrAfter: 'start_year' },
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
      { key: 'issue_date', label: 'Issued', type: 'month', notFuture: true },
      { key: 'does_not_expire', label: 'This credential does not expire', type: 'switch' },
      { key: 'expiry_date', label: 'Expires', type: 'month', hiddenWhen: 'does_not_expire', onOrAfter: 'issue_date' },
      { key: 'credential_id', label: 'Credential ID', type: 'text', maxLength: 80 },
      { key: 'credential_url', label: 'Credential URL', type: 'text', placeholder: 'https://…', url: true },
    ],
  },

  award: {
    addTitle: 'Add award',
    editTitle: 'Edit award',
    fields: [
      { key: 'title', label: 'Award', type: 'text', required: true, placeholder: 'Best Resident Award' },
      { key: 'issuer', label: 'Awarded by', type: 'text', placeholder: 'AIIMS' },
      { key: 'date', label: 'Date', type: 'month', notFuture: true },
      { key: 'description', label: 'Description', type: 'textarea', maxLength: 1000 },
    ],
  },

  publication: {
    addTitle: 'Add publication',
    editTitle: 'Edit publication',
    fields: [
      { key: 'title', label: 'Title', type: 'text', required: true },
      { key: 'journal', label: 'Journal', type: 'text', placeholder: 'Indian Heart Journal' },
      { key: 'publication_date', label: 'Published', type: 'month', notFuture: true },
      { key: 'authors', label: 'Authors', type: 'tags', placeholder: 'Sharma R' },
      { key: 'doi', label: 'DOI', type: 'text', placeholder: '10.1016/j.ihj.2024.01.001' },
      { key: 'url', label: 'Link', type: 'text', placeholder: 'https://…', url: true },
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
      { key: 'cme_credits', label: 'CME credits', type: 'number', max: 500, decimals: true },
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
      { key: 'issue_date', label: 'Registered', type: 'month', notFuture: true },
      { key: 'expiry_date', label: 'Expires', type: 'month', onOrAfter: 'issue_date' },
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
      { key: 'name', label: 'Full name', type: 'text', required: true, maxLength: 120 },
      {
        key: 'headline',
        label: 'Professional headline',
        type: 'text',
        placeholder: 'Cardiologist | Interventional Cardiology | 8+ Years',
        helper: 'The one line that appears under your name.',
      },
      { key: 'current_organization', label: 'Current organization', type: 'text', placeholder: 'Apollo Hospitals' },
      // State before city: it is what narrows the city list, and a city picker
      // with nothing in it reads as broken.
      {
        key: 'state',
        label: 'State',
        type: 'lookup',
        placeholder: 'Select your state',
        lookup: { options: STATE_NAMES, searchPlaceholder: 'Search states…' },
      },
      {
        key: 'city',
        label: 'City',
        type: 'lookup',
        placeholder: 'Select your city',
        lookup: {
          options: (draft) => citiesForState(draft.state),
          allowOther: true,
          clearedBy: 'state',
          requiresHint: 'Choose a state first',
          searchPlaceholder: 'Search cities…',
        },
      },
      { key: 'preferred_location', label: 'Preferred location', type: 'text' },
      { key: 'years_experience', label: 'Years of experience', type: 'number', max: 80 },
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
          { value: 'internship', label: 'Internships' },
          { value: 'fellowship', label: 'Fellowships' },
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
      { key: 'linkedin', label: 'LinkedIn', type: 'text', placeholder: 'https://linkedin.com/in/…', url: true, hosts: ['linkedin.com'] },
      { key: 'orcid', label: 'ORCID', type: 'text', placeholder: 'https://orcid.org/0000-…', url: true, hosts: ['orcid.org'] },
      { key: 'researchgate', label: 'ResearchGate', type: 'text', placeholder: 'https://researchgate.net/profile/…', url: true, hosts: ['researchgate.net'] },
      { key: 'google_scholar', label: 'Google Scholar', type: 'text', placeholder: 'https://scholar.google.com/…', url: true, hosts: ['scholar.google.com', 'google.com'] },
      { key: 'website', label: 'Website', type: 'text', placeholder: 'https://…', url: true },
      { key: 'portfolio', label: 'Portfolio', type: 'text', placeholder: 'https://…', url: true },
    ],
  },
};

/**
 * Everything wrong with an entry, keyed by field: the same rules the server
 * applies (models/schemas.py), so a problem is shown on the field it belongs
 * to before a round trip. Hidden fields are skipped.
 */
export function entryFieldErrors(form: EntryForm, values: Record<string, any>, now: Date = new Date()): Record<string, string> {
  const out: Record<string, string> = {};
  const thisMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  for (const f of form.fields) {
    if (f.hiddenWhen && values[f.hiddenWhen]) continue;
    const v = values[f.key];
    const blank = v === undefined || v === null || String(v).trim() === '';
    if (f.required && blank) { out[f.key] = `${f.label} is required.`; continue; }
    if (blank) continue;
    if (f.type === 'month' && f.notFuture && String(v) > thisMonth) out[f.key] = `${f.label} cannot be in the future.`;
    if (f.type === 'year' && f.max && Number(v) > f.max) out[f.key] = `${f.label} is too far in the future.`;
    if (f.type === 'number') {
      const n = Number(v);
      if (!Number.isFinite(n) || n < 0) out[f.key] = `${f.label} must be a positive number.`;
      else if (f.max !== undefined && n > f.max) out[f.key] = `${f.label} must be at most ${f.max}.`;
      else if (!f.decimals && !Number.isInteger(n)) out[f.key] = `${f.label} must be a whole number.`;
    }
    if (f.url) {
      const raw = String(v).trim();
      const withScheme = /^[a-z][a-z0-9+.-]*:\/\//i.test(raw) ? raw : `https://${raw}`;
      try {
        const u = new URL(withScheme);
        const host = u.hostname.toLowerCase();
        if (u.protocol !== 'https:' || !host.includes('.')) throw new Error();
        if (f.hosts && !f.hosts.some(h => host === h || host.endsWith(`.${h}`))) {
          out[f.key] = `${f.label} must be a link to ${f.hosts[0]}.`;
        }
      } catch {
        out[f.key] = `Please enter a valid link, e.g. https://example.com.`;
      }
    }
    if (f.onOrAfter) {
      const other = values[f.onOrAfter];
      const before = form.fields.find(x => x.key === f.onOrAfter);
      if (other !== undefined && other !== null && String(other) !== '' && String(v) < String(other)) {
        out[f.key] = `${f.label.replace(/ \(.*\)$/, '')} cannot be earlier than ${(before?.label ?? 'the start').toLowerCase()}.`;
      }
    }
  }
  return out;
}

/** Links are stored as the full https URL the user meant. */
export function normalizeEntryValues(form: EntryForm, values: Record<string, any>): Record<string, any> {
  const out = { ...values };
  for (const f of form.fields) {
    const v = out[f.key];
    if (f.url && typeof v === 'string' && v.trim() && !/^[a-z][a-z0-9+.-]*:\/\//i.test(v.trim())) {
      out[f.key] = `https://${v.trim()}`;
    }
    if (f.type === 'number' && typeof v === 'string' && v !== '') out[f.key] = Number(v);
  }
  return out;
}

/**
 * A scalar form as this account type sees it. A student is never offered
 * locum (the server refuses it too).
 */
export function scalarFormFor(key: ScalarFormKey, role?: string | null): EntryForm {
  const form = SCALAR_FORMS[key];
  if (key !== 'availability' || role !== 'student') return form;
  return {
    ...form,
    fields: form.fields.map(f => f.key === 'open_to' && f.options
      ? { ...f, options: f.options.filter(o => o.value !== 'locum') }
      : f),
  };
}
