import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react-native';
import {
  acceptsRole, appliesForWork, canApplyNow, eligibilityOf, hasLearning, hasLocum, isStudent, studentLine,
} from '../utils/roles';
import { EMPTY_EDUCATION, educationPayload, ordinalYear, validateEducation } from '../components/students/StudentEducationFields';
import { scalarFormFor, SCALAR_FORMS } from '../components/profile/entryForms';
import { OPEN_TO_LABELS } from '../types/profile';
import { ROLE_META, getRoleMeta } from '../theme/roles';
import { JobCard } from '../components/jobs/JobCard';
import { JobWizard } from '../components/jobs/wizard/JobWizard';
import type { Job } from '../types/jobs';

jest.mock('../context/AuthContext', () => ({
  useAuth: () => ({ token: 'test-token', user: { id: 'h1', role: 'hospital' } }),
}));

/**
 * Students on the client. The server enforces every rule independently; these
 * pin what the app SHOWS so a student is never offered something the server
 * would refuse, and an employer can say who a posting is for.
 */

const STUDENT = { role: 'student', verified: false };
const PRO = { role: 'healthcare_professional', verified: true };
const HOSPITAL = { role: 'hospital', verified: true };

describe('role helpers', () => {
  it('has a Student role with its own label', () => {
    expect(getRoleMeta('student')).toBe(ROLE_META.student);
    expect(ROLE_META.student.label).toBe('Student');
  });

  it('lets professionals and students apply, never employers', () => {
    expect(appliesForWork(STUDENT)).toBe(true);
    expect(appliesForWork(PRO)).toBe(true);
    expect(appliesForWork(HOSPITAL)).toBe(false);
    expect(isStudent(STUDENT)).toBe(true);
  });

  it('needs no KYC for a student but does for a professional', () => {
    expect(canApplyNow(STUDENT, false)).toBe(true);
    expect(canApplyNow(PRO, false)).toBe(false);
    expect(canApplyNow(PRO, true)).toBe(true);
    expect(canApplyNow(HOSPITAL, true)).toBe(false);
  });

  it('gives students Learning but never Locum', () => {
    expect(hasLearning(STUDENT)).toBe(true);
    expect(hasLocum(STUDENT)).toBe(false);
    expect(hasLocum(PRO)).toBe(true);
  });

  it('treats a posting with no eligibility as professionals-only', () => {
    expect(eligibilityOf({})).toBe('professionals');
    expect(acceptsRole({}, 'student')).toBe(false);
    expect(acceptsRole({ eligibility: 'both' }, 'student')).toBe(true);
    expect(acceptsRole({ eligibility: 'students' }, 'student')).toBe(true);
    expect(acceptsRole({ eligibility: 'students' }, 'healthcare_professional')).toBe(false);
    expect(acceptsRole({ eligibility: 'both' }, 'hospital')).toBe(false);
  });

  it('describes a student by course and year', () => {
    expect(studentLine({ student_course: 'MBBS', student_year: 3 })).toBe('MBBS · 3rd year');
    expect(studentLine({ student_course: 'BDS', student_year: 1 })).toBe('BDS · 1st year');
    expect(studentLine({})).toBe('');
    expect(ordinalYear(5)).toBe('5th year');
  });
});

describe('student education', () => {
  const year = new Date().getFullYear();
  const valid = { course: 'MBBS', institution: ' ABC Medical College ', university: '', current_year: '3', graduation_year: String(year + 2) };

  it('requires course, college, year and graduation', () => {
    expect(Object.keys(validateEducation(EMPTY_EDUCATION)).sort())
      .toEqual(['course', 'current_year', 'graduation_year', 'institution']);
    expect(validateEducation(valid)).toEqual({});
  });

  it('refuses a graduation year in the past', () => {
    expect(validateEducation({ ...valid, graduation_year: String(year - 1) }).graduation_year).toMatch(/past/);
  });

  it('sends numbers and trimmed text, and leaves out an empty university', () => {
    expect(educationPayload(valid)).toEqual({
      course: 'MBBS', institution: 'ABC Medical College', university: undefined,
      current_year: 3, graduation_year: year + 2,
    });
  });
});

describe('profile availability', () => {
  const values = (role?: string) =>
    scalarFormFor('availability', role).fields.find(f => f.key === 'open_to')!.options!.map(o => o.value);

  it('never offers a student locum, but offers internships', () => {
    expect(values('student')).not.toContain('locum');
    expect(values('student')).toContain('internship');
    expect(values('healthcare_professional')).toContain('locum');
    expect(scalarFormFor('identity', 'student')).toBe(SCALAR_FORMS.identity);
  });

  it('has a label for every open-to option the server accepts', () => {
    for (const v of values('healthcare_professional')) expect(OPEN_TO_LABELS[v as keyof typeof OPEN_TO_LABELS]).toBeTruthy();
  });
});

const JOB: Job = {
  id: 'job-1', poster_id: 'user-1', posted_as: 'individual', employment_type: 'internship',
  title: 'Clinical Research Intern', specialty: 'Research', description: 'Trial coordination.',
  location: 'Bengaluru, Karnataka', city: 'Bengaluru', state: 'Karnataka', work_mode: 'onsite',
  pay_min: 0, pay_max: 0, pay_monthly_min: 0, pay_monthly_max: 0, pay_period: 'month', pay_currency: 'INR',
  pay_disclosed: false, experience_min: 0, experience_max: 0, vacancies: 1, skills: [], is_urgent: false,
  status: 'active', applicant_count: 0, view_count: 0, save_count: 0, created_at: new Date().toISOString(),
  saved: false, has_applied: false, can_manage: false, employer_name: 'Demo Hospital',
} as Job;

describe('JobCard eligibility badge', () => {
  it('says when a posting is open to students', () => {
    render(<JobCard item={{ ...JOB, eligibility: 'both' }} onPress={jest.fn()} />);
    expect(screen.getByText('Open to students')).toBeTruthy();
  });

  it('says when it is for students only', () => {
    render(<JobCard item={{ ...JOB, eligibility: 'students' }} onPress={jest.fn()} />);
    expect(screen.getByText('Students only')).toBeTruthy();
  });

  it('shows nothing extra on a professionals-only posting', () => {
    render(<JobCard item={{ ...JOB, eligibility: 'professionals' }} onPress={jest.fn()} />);
    expect(screen.queryByText('Open to students')).toBeNull();
    expect(screen.queryByText('Students only')).toBeNull();
  });
});

describe('JobWizard: who can apply', () => {
  const finish = (onSubmit: jest.Mock) => {
    fireEvent.changeText(screen.getByTestId('wizard-title'), 'Clinical Research Intern');
    fireEvent.press(screen.getByTestId('wizard-next'));
    fireEvent.press(screen.getByTestId('wizard-mode-remote'));
    fireEvent.press(screen.getByTestId('wizard-next'));
    fireEvent.press(screen.getByTestId('wizard-next'));
    fireEvent.press(screen.getByTestId('wizard-next'));
    fireEvent.changeText(screen.getByTestId('wizard-description'),
      'Support trial coordination, data entry and literature reviews for our research unit.');
    fireEvent.press(screen.getByTestId('wizard-draft'));
    return onSubmit.mock.calls[0][0];
  };

  it('defaults to professionals, and an internship opens to students too', () => {
    const onSubmit = jest.fn();
    render(<JobWizard onSubmit={onSubmit} />);
    expect(screen.getByTestId('wizard-eligibility-professionals')).toBeTruthy();
    fireEvent.press(screen.getByTestId('wizard-type-internship'));
    expect(finish(onSubmit).eligibility).toBe('both');
  });

  it('lets the employer choose students only', () => {
    const onSubmit = jest.fn();
    render(<JobWizard onSubmit={onSubmit} />);
    fireEvent.press(screen.getByTestId('wizard-eligibility-students'));
    expect(finish(onSubmit).eligibility).toBe('students');
  });

  it('keeps shift cover professionals-only and hides the choice', () => {
    render(<JobWizard onSubmit={jest.fn()} />);
    fireEvent.press(screen.getByTestId('wizard-eligibility-both'));
    fireEvent.press(screen.getByTestId('wizard-type-temporary'));
    expect(screen.queryByTestId('wizard-eligibility-both')).toBeNull();
  });
});
