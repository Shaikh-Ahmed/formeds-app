import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { LocumCard } from '../components/locum/LocumCard';
import { LocumNav } from '../components/locum/LocumNav';
import { JobsSegmentedNav } from '../components/jobs/JobsSegmentedNav';
import {
  formatDeadline, formatLocumPay, formatShiftDay, formatShiftHours,
} from '../components/locum/LocumMeta';
import {
  buildLocumPayload, deadlineFor, diffLocumPayload, emptyLocumForm, locumFieldErrors, validateLocumForm,
} from '../components/locum/LocumForm';
import { dateWindow } from '../components/locum/LocumFiltersSheet';
import { buildLocumQuery } from '../api/locum';
import { isLocumNotification, locumNotificationMeta, type Locum } from '../types/locum';

/**
 * Locum on the client: how a shift reads, what the quick form sends, and how
 * the Jobs | Locum switch sits on top of the existing Jobs navigation without
 * changing it.
 */

const mockReplace = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: jest.fn(), replace: mockReplace, back: jest.fn(), canGoBack: () => true }),
  useFocusEffect: jest.fn(),
}));

let mockRole = 'healthcare_professional';
jest.mock('../context/AuthContext', () => ({
  useAuth: () => ({ token: 't', user: { id: 'u1', role: mockRole }, isKycApproved: true }),
}));

const LOCUM: Locum = {
  id: 'l1',
  poster_id: 'h1',
  role_required: 'doctor',
  specialty: 'General Medicine',
  openings: 3,
  filled_count: 1,
  openings_left: 2,
  shift_date: '2026-10-12',
  start_time: '09:00',
  end_time: '17:00',
  shift_ends_at: '2026-10-12T11:30:00+00:00',
  shift_type: 'day',
  city: 'Hyderabad',
  state: 'Telangana',
  pay_amount: 12000,
  pay_type: 'per_shift',
  experience_min: 0,
  apply_by: new Date(Date.now() + 3 * 86400000).toISOString(),
  status: 'open',
  applicant_count: 4,
  created_at: new Date().toISOString(),
  employer_name: 'Care Hospital',
  employer_verified: true,
  my_application: null,
  can_manage: false,
};

const make = (overrides: Partial<Locum> = {}): Locum => ({ ...LOCUM, ...overrides });

// ── How a shift reads ────────────────────────────────────────────────────────

describe('LocumMeta', () => {
  it('writes shift hours the way a rota does, and flags overnight ones', () => {
    expect(formatShiftHours({ start_time: '09:00', end_time: '17:00' })).toBe('9 AM – 5 PM');
    expect(formatShiftHours({ start_time: '20:30', end_time: '08:00' }))
      .toBe('8:30 PM – 8 AM (next day)');
  });

  it('never renders a zero-rupee shift', () => {
    expect(formatLocumPay({ pay_amount: 12000, pay_type: 'per_shift' })).toBe('₹12K per shift');
    expect(formatLocumPay({ pay_amount: 0, pay_type: 'negotiable' })).toBe('Pay negotiable');
    expect(formatLocumPay({ pay_amount: 50000, pay_type: 'fixed' })).toBe('₹50K');
  });

  it('says Today and Tomorrow rather than making people read a date', () => {
    const now = new Date(2026, 9, 11, 10, 0);
    expect(formatShiftDay('2026-10-11', now)).toBe('Today');
    expect(formatShiftDay('2026-10-12', now)).toBe('Tomorrow');
    expect(formatShiftDay('2026-10-17', now)).toBe('Sat, 17 Oct');
  });

  it('counts down the last day before applications close', () => {
    const now = new Date('2026-10-11T10:00:00Z');
    expect(formatDeadline('2026-10-11T15:00:00Z', now)).toBe('Closes in 5h');
    expect(formatDeadline('2026-10-11T09:00:00Z', now)).toBe('Applications closed');
    expect(formatDeadline('2026-10-14T09:00:00Z', now)).toMatch(/^Apply by 14 Oct/);
  });
});

// ── The quick form ───────────────────────────────────────────────────────────

describe('LocumForm payload', () => {
  const base = () => ({
    ...emptyLocumForm(null, new Date(2026, 9, 11)),
    specialty: 'Emergency Medicine',
    city: 'Pune',
    pay_amount: '15000',
  });

  it('defaults to tomorrow, a day shift, and closing at the shift start', () => {
    const form = emptyLocumForm(null, new Date(2026, 9, 11));
    expect(form.shift_date).toBe('2026-10-12');
    expect([form.start_time, form.end_time]).toEqual(['09:00', '17:00']);
    expect(deadlineFor(form)).toBeNull();
  });

  it('puts "2 hours before" on the previous evening for an early shift', () => {
    const form = { ...base(), start_time: '01:00', end_time: '09:00', deadline: 'two_hours' as const };
    expect(deadlineFor(form)).toBe('2026-10-11T23:00');
  });

  const NOW = new Date(2026, 9, 11, 10, 0);

  it('asks only for what it must', () => {
    expect(validateLocumForm(base(), NOW)).toBeNull();
    expect(validateLocumForm({ ...base(), specialty: '' }, NOW)).toMatch(/specialty/);
    expect(validateLocumForm({ ...base(), end_time: '09:00' }, NOW)).toMatch(/different/);
    expect(validateLocumForm({ ...base(), pay_amount: '' }, NOW)).toMatch(/pay/);
    expect(validateLocumForm({ ...base(), pay_amount: '', pay_type: 'negotiable' }, NOW)).toBeNull();
  });

  it('puts each problem on its own field, with the business rules', () => {
    const errs = (patch: Partial<ReturnType<typeof base>>) => locumFieldErrors({ ...base(), ...patch }, NOW);
    expect(errs({ shift_date: '2026-10-10' }).shift_date).toBe('Locum date cannot be in the past.');
    expect(errs({ shift_date: '2026-02-30' }).shift_date).toBe('Please choose a valid date.');
    // Same day is fine while the start is still ahead; not once it has passed.
    expect(errs({ shift_date: '2026-10-11', start_time: '14:00', end_time: '20:00' })).toEqual({});
    expect(errs({ shift_date: '2026-10-11', start_time: '08:00' }).start_time).toMatch(/already passed/);
    // Overnight is a shift, not an error.
    expect(errs({ start_time: '20:00', end_time: '08:00' })).toEqual({});
    expect(errs({ pay_amount: '0' }).pay_amount).toBe('Pay must be greater than 0.');
    expect(errs({ experience_min: '75' }).experience_min).toBe('Minimum experience must be at most 60.');
    expect(errs({ deadline: 'custom', customDeadline: '2026-10-13T09:00' }).customDeadline)
      .toBe('Application deadline cannot be after the shift starts.');
    expect(errs({ deadline: 'custom', customDeadline: '2026-10-10T09:00' }).customDeadline)
      .toBe('Application deadline cannot be in the past.');
    expect(errs({ deadline: 'custom', customDeadline: '2026-10-11T20:00' })).toEqual({});
  });

  it('does not re-judge an untouched past date when editing', () => {
    const stored = { ...base(), shift_date: '2026-10-01' };
    expect(locumFieldErrors({ ...stored, notes: 'Bring your own scrubs' }, NOW, stored).shift_date).toBeUndefined();
    expect(locumFieldErrors({ ...stored, shift_date: '2026-10-02' }, NOW, stored).shift_date).toMatch(/past/);
  });

  it('sends negotiable pay as zero, and org_id only when one was chosen', () => {
    const payload = buildLocumPayload({ ...base(), pay_type: 'negotiable' });
    expect(payload.pay_amount).toBe(0);
    expect('org_id' in payload).toBe(false);
    expect(buildLocumPayload({ ...base(), org_id: 'o1' }).org_id).toBe('o1');
  });

  it('edits send only the fields that changed, never org_id or an untouched deadline', () => {
    const before = { ...base(), org_id: 'o1' };
    const after = { ...before, notes: 'Report to casualty' };
    expect(diffLocumPayload(before, after)).toEqual({ notes: 'Report to casualty' });
  });
});

describe('Locum filters', () => {
  it('omits empty values rather than sending blank filters', () => {
    expect(buildLocumQuery({ sort: 'soonest', city: '', verified_only: false })).toBe('sort=soonest');
    expect(buildLocumQuery({ shift_type: 'night', pay_min: 5000, verified_only: true }))
      .toBe('shift_type=night&pay_min=5000&verified_only=true');
  });

  it('turns a date choice into an inclusive range', () => {
    const now = new Date(2026, 9, 11);
    expect(dateWindow('today', now)).toEqual({ date_from: '2026-10-11', date_to: '2026-10-11' });
    expect(dateWindow('week', now)).toEqual({ date_from: '2026-10-11', date_to: '2026-10-17' });
  });
});

// ── The card ─────────────────────────────────────────────────────────────────

describe('LocumCard', () => {
  it('leads with when, then who, and offers Apply', () => {
    const onApply = jest.fn();
    render(<LocumCard item={make()} onPress={jest.fn()} onApply={onApply} />);
    expect(screen.getByText('9 AM – 5 PM')).toBeTruthy();
    expect(screen.getByText('Doctor · General Medicine')).toBeTruthy();
    expect(screen.getByText('2 of 3 still open')).toBeTruthy();
    expect(screen.getByText('Care Hospital')).toBeTruthy();
    fireEvent.press(screen.getByTestId('locum-apply-l1'));
    expect(onApply).toHaveBeenCalled();
  });

  it('shows the viewer their own status in place of Apply', () => {
    render(
      <LocumCard
        item={make({ my_application: { id: 'a1', locum_id: 'l1', status: 'interview_scheduled', created_at: '' } })}
        onPress={jest.fn()}
        onApply={jest.fn()}
      />,
    );
    expect(screen.getByText('Interview scheduled')).toBeTruthy();
    expect(screen.queryByTestId('locum-apply-l1')).toBeNull();
  });

  it('offers Apply again after a withdrawal', () => {
    render(
      <LocumCard
        item={make({ my_application: { id: 'a1', locum_id: 'l1', status: 'withdrawn', created_at: '' } })}
        onPress={jest.fn()}
        onApply={jest.fn()}
      />,
    );
    expect(screen.getByTestId('locum-apply-l1')).toBeTruthy();
  });

  it('marks an emergency shift in words, not only colour', () => {
    render(<LocumCard item={make({ shift_type: 'emergency' })} onPress={jest.fn()} />);
    expect(screen.getByText('Emergency')).toBeTruthy();
  });
});

// ── Navigation ───────────────────────────────────────────────────────────────

describe('Jobs | Locum switch', () => {
  beforeEach(() => mockReplace.mockClear());

  it('sits above the Jobs segments with Jobs selected, leaving the segments as they were', () => {
    render(<JobsSegmentedNav active="discover" />);
    expect(screen.getByTestId('jobs-module-jobs').props.accessibilityState.selected).toBe(true);
    for (const key of ['discover', 'saved', 'applications', 'posted']) {
      expect(screen.getByTestId(`jobs-segment-${key}`)).toBeTruthy();
    }
    fireEvent.press(screen.getByTestId('jobs-module-locum'));
    expect(mockReplace).toHaveBeenCalledWith('/jobs/locum');
  });

  it('shows a professional their applications, and a hospital its applicants', () => {
    mockRole = 'healthcare_professional';
    const { unmount } = render(<LocumNav active="discover" />);
    expect(screen.getByTestId('locum-segment-applications')).toBeTruthy();
    expect(screen.queryByTestId('locum-segment-applicants')).toBeNull();
    unmount();

    mockRole = 'hospital';
    render(<LocumNav active="mine" />);
    expect(screen.getByTestId('locum-segment-applicants')).toBeTruthy();
    expect(screen.queryByTestId('locum-segment-applications')).toBeNull();
    expect(screen.getByTestId('jobs-module-locum').props.accessibilityState.selected).toBe(true);
  });
});


describe('Locum notifications', () => {
  it('reads every workflow step off the notification type as a badge', () => {
    for (const [type, label] of [
      ['locum_applied', 'Applied'],
      ['locum_under_review', 'Under review'],
      ['locum_interview_scheduled', 'Interview scheduled'],
      ['locum_interview_passed', 'Interview passed'],
      ['locum_selected', 'Selected'],
      ['locum_not_selected', 'Not selected'],
      ['locum_cancelled', 'Cancelled'],
      ['locum_new_application', 'New applicant'],
    ]) {
      expect(locumNotificationMeta(type)?.label).toBe(label);
    }
    expect(locumNotificationMeta('application')).toBeNull();
  });

  it('counts old and new locum notifications as Locum, and nothing else', () => {
    expect(isLocumNotification('locum')).toBe(true);
    expect(isLocumNotification('locum_selected')).toBe(true);
    expect(isLocumNotification('application')).toBe(false);
  });
});
