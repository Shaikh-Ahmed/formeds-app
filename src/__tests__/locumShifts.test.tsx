import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
const SLOW = { timeout: 8000 };

import { istClock, istDayClock } from '../components/locum/shifts/ShiftBits';
import { ProfessionalShifts } from '../components/locum/shifts/ProfessionalShifts';
import { HospitalShifts } from '../components/locum/shifts/HospitalShifts';
import * as api from '../api/locum';
import type { LocumReliability, LocumShift, ManagedShifts, ProfessionalShifts as ProData } from '../types/locum';

jest.mock('expo-router', () => {
  const { useEffect } = jest.requireActual('react');
  return {
    useRouter: () => ({ push: jest.fn(), replace: jest.fn(), back: jest.fn() }),
    useFocusEffect: (fn: () => void) => useEffect(fn, [fn]),
  };
});
jest.mock('../context/AuthContext', () => ({
  useAuth: () => ({ token: 't', user: { id: 'u1', name: 'Dr. A', role: 'healthcare_professional' } }),
}));
jest.mock('../api/locum', () => ({
  fetchMyShifts: jest.fn(), fetchManagedShifts: jest.fn(),
  markArrival: jest.fn(async () => ({})), cancelShift: jest.fn(async () => ({})), disputeNoShow: jest.fn(),
  acceptRebooking: jest.fn(), rejectRebooking: jest.fn(),
  startUnblockCheckout: jest.fn(async () => ({ payment_id: 'p1', amount: 2500, status: 'pending', currency: 'INR',
    provider: 'demo', demo: true })),
  payUnblock: jest.fn(async () => ({ status: 'succeeded' })),
  approveAttendance: jest.fn(async () => ({})), reportNoShow: jest.fn(async () => ({})),
  reviewShift: jest.fn(async () => ({})), requestAgain: jest.fn(), cancelRebooking: jest.fn(),
}));

const mocked = api as jest.Mocked<typeof api>;

const LOCUM = {
  id: 'l1', poster_id: 'h1', role_required: 'doctor', specialty: 'Emergency Medicine', openings: 1, filled_count: 1,
  openings_left: 0, shift_date: '2026-09-28', start_time: '09:00', end_time: '17:00', shift_ends_at: '',
  shift_type: 'day', city: 'Pune', address: 'Ward 4', pay_amount: 2500, pay_type: 'per_shift', experience_min: 0,
  apply_by: '', status: 'full', applicant_count: 1, created_at: '', employer_name: 'XYZ Hospital', can_manage: false,
  shift_starts_at: '2026-09-28T03:30:00+00:00', shift_pay: 2500,
};

function shift(over: Partial<LocumShift> = {}, app: Record<string, unknown> = {}): LocumShift {
  return {
    application: { id: 'a1', locum_id: 'l1', status: 'selected', created_at: '', attendance_status: 'not_started', ...app },
    locum: LOCUM,
    phase: 'arrival_open',
    arrival_opens_at: '2026-09-28T02:30:00+00:00',
    cancel_deadline: '2026-09-28T00:30:00+00:00',
    no_show_from: '2026-09-28T04:00:00+00:00',
    review: null, strike: null,
    actions: { arrive: true, cancel: false },
    ...over,
  } as unknown as LocumShift;
}

const RELIABILITY: LocumReliability = {
  completed_shifts: 18, no_shows: 1, active_strikes: 1, strike_limit: 3, rating: 4.7, review_count: 14,
  locum_blocked: false, cancellations: 1, block: null, strike_history: [], reviews: [],
};

function pro(over: Partial<ProData> = {}): ProData {
  return { reliability: RELIABILITY, requests: [], upcoming: [shift()], completed: [], cancelled: [], no_show: [], ...over };
}

describe('Shifts helpers', () => {
  it('shows server instants in IST whatever the device zone', () => {
    expect(istClock('2026-09-28T03:22:00+00:00')).toBe('8:52 AM');
    expect(istClock('2026-09-28T08:52:00+05:30')).toBe('8:52 AM');
    expect(istDayClock('2026-09-28T00:30:00+00:00')).toBe('28 Sep, 6:00 AM');
  });
});

describe('My shifts (professional)', () => {
  beforeEach(() => jest.clearAllMocks());

  it("shows today's shift with I've arrived and the reliability numbers", async () => {
    mocked.fetchMyShifts.mockResolvedValue(pro());
    render(<ProfessionalShifts />);
    await waitFor(() => screen.getByTestId('arrive-a1'), SLOW);
    expect(screen.getByText('Today’s locum')).toBeTruthy();
    expect(screen.getByTestId('rel-strikes')).toHaveTextContent('1 / 3Strikes');
    expect(screen.getByTestId('rel-rating')).toHaveTextContent('4.7 ★Rating');
    fireEvent.press(screen.getByTestId('arrive-a1'));
    await waitFor(() => expect(mocked.markArrival).toHaveBeenCalledWith('t', 'a1'));
  });

  it('after arrival, says so and waits for the hospital', async () => {
    mocked.fetchMyShifts.mockResolvedValue(pro({
      upcoming: [shift({ phase: 'arrival_reported', actions: {} }, { attendance_status: 'arrival_reported',
        arrived_at: '2026-09-28T03:22:00+00:00' })],
    }));
    render(<ProfessionalShifts />);
    await waitFor(() => screen.getByText('Arrival reported · 8:52 AM'), SLOW);
    expect(screen.getByText('Waiting for hospital confirmation.')).toBeTruthy();
    expect(screen.queryByTestId('arrive-a1')).toBeNull();
  });

  it('cancelling needs a reason, and "Other" needs words', async () => {
    mocked.fetchMyShifts.mockResolvedValue(pro({
      upcoming: [shift({ phase: 'confirmed', actions: { cancel: true } })],
    }));
    render(<ProfessionalShifts />);
    await waitFor(() => screen.getByTestId('cancel-a1'), SLOW);
    fireEvent.press(screen.getByTestId('cancel-a1'));
    fireEvent.press(screen.getByTestId('cancel-shift-confirm'));
    expect(screen.getByText('Choose a reason.')).toBeTruthy();
    fireEvent.press(screen.getByTestId('cancel-reason-other'));
    fireEvent.press(screen.getByTestId('cancel-shift-confirm'));
    expect(screen.getByText('Tell the hospital briefly why you are cancelling.')).toBeTruthy();
    fireEvent.changeText(screen.getByTestId('cancel-details'), 'Family emergency out of town');
    fireEvent.press(screen.getByTestId('cancel-shift-confirm'));
    await waitFor(() => expect(mocked.cancelShift).toHaveBeenCalledWith('t', 'a1', 'other', 'Family emergency out of town'));
  });

  it('a blocked professional sees why, the strikes and the exact unblock amount', async () => {
    mocked.fetchMyShifts.mockResolvedValue(pro({
      reliability: {
        ...RELIABILITY, active_strikes: 3, locum_blocked: true,
        block: { id: 'b1', unblock_amount: 2500, currency: 'INR', created_at: '', strikes: [
          { strike_id: 's1', pay_amount: 1500, employer_name: 'A', specialty: 'ICU', shift_date: '2026-08-15' },
          { strike_id: 's2', pay_amount: 2500, employer_name: 'B', specialty: 'ED', shift_date: '2026-09-01' },
          { strike_id: 's3', pay_amount: 1800, employer_name: 'C', specialty: 'ED', shift_date: '2026-09-28' },
        ] },
      },
      requests: [{ id: 'r1', locum_id: 'l1', professional_id: 'u1', source_application_id: 'a0', message: 'Again?',
        require_interview: false, shift_starts_at: '', shift_ends_at: '', expires_at: '2026-10-01T00:00:00+00:00',
        status: 'viewed', created_at: '', locum: LOCUM as any }],
    }));
    render(<ProfessionalShifts />);
    await waitFor(() => screen.getByTestId('locum-blocked'), SLOW);
    expect(screen.getByText('Your Locum access is currently blocked.')).toBeTruthy();
    expect(screen.getByText('Current strikes: 3 / 3')).toBeTruthy();
    expect(screen.getByText(/pay ₹2,500 — the highest pay/)).toBeTruthy();
    expect(screen.getByText(/cannot accept this request because your Locum access is currently blocked/)).toBeTruthy();
    expect(screen.getByTestId('request-accept-r1')).toBeDisabled();

    fireEvent.press(screen.getByTestId('unblock-open'));
    await waitFor(() => screen.getByTestId('unblock-amount'), SLOW);
    expect(screen.getByTestId('unblock-amount')).toHaveTextContent('₹2,500');
    fireEvent.press(screen.getByTestId('unblock-pay'));
    await waitFor(() => expect(mocked.payUnblock).toHaveBeenCalledWith('t', 'p1', 'success', 'upi', expect.any(String)));
  });
});

describe('Shifts board (hospital)', () => {
  beforeEach(() => jest.clearAllMocks());

  const board = (over: Partial<ManagedShifts> = {}): ManagedShifts => ({
    today: [], upcoming: [], completed: [], issues: [], requests: [], needs_action: 0, ...over,
  });
  const hospitalShift = (over: Partial<LocumShift>, app: Record<string, unknown> = {}) => shift({
    professional: { id: 'u1', name: 'Dr. Ahmed Khan', account_verified: true },
    reliability: { ...RELIABILITY }, ...over,
  }, app);

  it('approves a reported arrival in one tap', async () => {
    mocked.fetchManagedShifts.mockResolvedValue(board({
      needs_action: 1,
      today: [hospitalShift({ phase: 'arrival_reported', actions: { approve_attendance: true, flag_no_show: false } },
        { arrived_at: '2026-09-28T03:22:00+00:00', attendance_status: 'arrival_reported' })],
    }));
    render(<HospitalShifts />);
    await waitFor(() => screen.getByTestId('approve-a1'), SLOW);
    expect(screen.getByTestId('arrival-a1')).toHaveTextContent('Arrival8:52 AM');
    expect(screen.getByTestId('needs-action')).toBeTruthy();
    fireEvent.press(screen.getByTestId('approve-a1'));
    await waitFor(() => expect(mocked.approveAttendance).toHaveBeenCalledWith('t', 'a1'));
  });

  it('a no-show must be explicitly confirmed', async () => {
    mocked.fetchManagedShifts.mockResolvedValue(board({
      today: [hospitalShift({ phase: 'not_arrived', actions: { approve_attendance: true, flag_no_show: true } })],
    }));
    render(<HospitalShifts />);
    await waitFor(() => screen.getByTestId('flag-a1'), SLOW);
    fireEvent.press(screen.getByTestId('flag-a1'));
    expect(mocked.reportNoShow).not.toHaveBeenCalled();
    expect(screen.getByText(/may add a strike to the professional’s Locum reliability record/)).toBeTruthy();
    fireEvent.press(screen.getByTestId('no-show-confirm'));
    await waitFor(() => expect(mocked.reportNoShow).toHaveBeenCalledWith('t', 'a1'));
  });

  it('a completed shift offers Rate and Request again, and a rating needs stars', async () => {
    mocked.fetchManagedShifts.mockResolvedValue(board({
      completed: [hospitalShift({ phase: 'completed', actions: { review: true, rebook: true } },
        { attendance_status: 'completed' })],
    }));
    render(<HospitalShifts />);
    fireEvent.press(await screen.findByTestId('hospital-shift-tab-completed', {}, SLOW));
    await waitFor(() => screen.getByTestId('rate-a1'), SLOW);
    expect(screen.getByTestId('rebook-a1')).toBeTruthy();
    fireEvent.press(screen.getByTestId('rate-a1'));
    fireEvent.press(screen.getByTestId('review-submit'));
    expect(screen.getByText('Choose an overall rating.')).toBeTruthy();
    fireEvent.press(screen.getByTestId('review-overall-5'));
    fireEvent.press(screen.getByTestId('review-punctuality-4'));
    fireEvent.press(screen.getByTestId('review-submit'));
    await waitFor(() => expect(mocked.reviewShift).toHaveBeenCalledWith('t', 'a1', { overall: 5, punctuality: 4, review: '' }, expect.any(String)));
  });
});
