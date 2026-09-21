import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react-native';
import { JobCard } from '../components/jobs/JobCard';
import { formatPay, formatShiftDates } from '../components/jobs/JobMeta';
import type { Job } from '../types/jobs';

/**
 * What a job row is allowed to claim.
 *
 * Two of these guard promises rather than pixels: an undisclosed salary must
 * not be reconstructible from the card, and status must never be carried by
 * colour alone.
 */

const JOB: Job = {
  id: 'job-1',
  poster_id: 'user-1',
  posted_as: 'individual',
  employment_type: 'full_time',
  title: 'Senior Consultant Cardiologist',
  specialty: 'Cardiology',
  description: 'A busy interventional service.',
  location: 'Hyderabad, Telangana',
  city: 'Hyderabad',
  state: 'Telangana',
  work_mode: 'onsite',
  pay_min: 350000,
  pay_max: 500000,
  pay_monthly_min: 350000,
  pay_monthly_max: 500000,
  pay_period: 'month',
  pay_currency: 'INR',
  pay_disclosed: true,
  experience_min: 8,
  experience_max: 0,
  vacancies: 1,
  skills: ['Angioplasty', 'Echocardiography'],
  is_urgent: false,
  status: 'active',
  screening_questions: [],
  applicant_count: 0,
  view_count: 0,
  save_count: 0,
  created_at: new Date(Date.now() - 2 * 86400000).toISOString(),
  saved: false,
  has_applied: false,
  can_manage: false,
  employer_name: 'Apollo Hospitals',
};

const make = (overrides: Partial<Job> = {}): Job => ({ ...JOB, ...overrides });

describe('JobCard', () => {
  it('leads with the role, then who is offering it', () => {
    render(<JobCard item={JOB} onPress={jest.fn()} />);
    expect(screen.getByText('Senior Consultant Cardiologist')).toBeTruthy();
    expect(screen.getByText('Apollo Hospitals')).toBeTruthy();
  });

  it('states how long ago in words, not a compact code', () => {
    // "2d" beside a comment author is fine; under a job title it reads as a typo.
    render(<JobCard item={JOB} onPress={jest.fn()} />);
    expect(screen.getByText('Posted 2 days ago')).toBeTruthy();
  });

  it('never reveals a salary the employer chose to withhold', () => {
    render(
      <JobCard item={make({ pay_disclosed: false, pay_min: undefined, pay_max: undefined })}
        onPress={jest.fn()} />,
    );
    expect(screen.getByText('Pay not disclosed')).toBeTruthy();
    expect(screen.queryByText(/₹/)).toBeNull();
  });

  it('spells out urgency instead of only colouring it', () => {
    render(<JobCard item={make({ is_urgent: true })} onPress={jest.fn()} />);
    // The word has to be present: a red pill alone is invisible to a
    // colourblind reader and to a screen reader alike.
    expect(screen.getByText('Urgent')).toBeTruthy();
  });

  it('shows the save control as pressed once saved', () => {
    render(<JobCard item={make({ saved: true })} onPress={jest.fn()} onToggleSave={jest.fn()} />);
    const button = screen.getByTestId('job-save-job-1');
    expect(button.props.accessibilityState.selected).toBe(true);
    expect(button.props.accessibilityLabel).toContain('Remove');
  });

  it('hides the save control entirely when signed out', () => {
    render(<JobCard item={JOB} onPress={jest.fn()} />);
    expect(screen.queryByTestId('job-save-job-1')).toBeNull();
  });

  it('reports having applied rather than inviting a second application', () => {
    render(<JobCard item={make({ has_applied: true })} onPress={jest.fn()} />);
    expect(screen.getByText('Applied')).toBeTruthy();
  });

  it('opens the job when pressed', () => {
    const onPress = jest.fn();
    render(<JobCard item={JOB} onPress={onPress} />);
    fireEvent.press(screen.getByTestId('job-card-job-1'));
    expect(onPress).toHaveBeenCalled();
  });

  it('announces enough for a screen reader to skip the card', () => {
    render(<JobCard item={JOB} onPress={jest.fn()} />);
    const label = screen.getByTestId('job-card-job-1').props.accessibilityLabel;
    expect(label).toContain('Senior Consultant Cardiologist');
    expect(label).toContain('Apollo Hospitals');
    expect(label).toContain('Hyderabad');
  });

  it('never nests the save toggle inside the card button', () => {
    // react-native-web renders accessibilityRole="button" as a literal
    // <button>, and a <button> cannot contain another <button> — the DOM
    // silently un-nests it, breaking the save toggle's own click target and
    // confusing screen readers. The save toggle has to be a sibling of the
    // card's Pressable, not a JSX descendant of it.
    const onPress = jest.fn();
    const onToggleSave = jest.fn();
    render(<JobCard item={JOB} onPress={onPress} onToggleSave={onToggleSave} />);
    const save = screen.getByTestId('job-save-job-1');
    const card = screen.getByTestId('job-card-job-1');
    let node: any = save.parent;
    let isDescendantOfCard = false;
    while (node) {
      if (node === card) { isDescendantOfCard = true; break; }
      node = node.parent;
    }
    expect(isDescendantOfCard).toBe(false);

    fireEvent.press(save);
    expect(onToggleSave).toHaveBeenCalledTimes(1);
    expect(onPress).not.toHaveBeenCalled();
  });
});

describe('pay formatting', () => {
  it('uses Indian numbering, which is what the salary is quoted in', () => {
    expect(formatPay(make({ pay_min: 350000, pay_max: 500000 }))).toBe('₹3.5L – ₹5L per month');
  });

  it('collapses a band with no spread to a single figure', () => {
    expect(formatPay(make({ pay_min: 200000, pay_max: 200000 }))).toBe('₹2L per month');
  });

  it('returns nothing at all when pay is withheld or unset', () => {
    expect(formatPay(make({ pay_disclosed: false }))).toBeNull();
    expect(formatPay(make({ pay_min: 0, pay_max: 0 }))).toBeNull();
  });

  it('keeps the period, so a shift rate is never read as a salary', () => {
    expect(formatPay(make({ pay_min: 15000, pay_max: 15000, pay_period: 'shift' })))
      .toBe('₹15K per shift');
  });
});

describe('shift dates', () => {
  it('collapses a same-month range to one month name', () => {
    const text = formatShiftDates(make({
      employment_type: 'locum',
      shift_start_date: '2026-09-12',
      shift_end_date: '2026-09-15',
    }));
    expect(text).toBe('12–15 September');
  });

  it('says nothing for a role that has no dates', () => {
    expect(formatShiftDates(JOB)).toBeNull();
  });
});
