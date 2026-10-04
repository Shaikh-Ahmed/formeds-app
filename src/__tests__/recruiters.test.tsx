import React from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { JobCard } from '../components/jobs/JobCard';
import { RecruiterStatusPill, VerifiedRecruiterBadge } from '../components/recruiters/RecruiterUI';
import { missingLabel } from '../types/recruiters';
import type { Job } from '../types/jobs';

/**
 * Recruiter module on the client. The promises worth guarding: consent and
 * status are stated in words, a confidential client is never named to a
 * candidate, invitations go to a real opening, and an admin cannot reject or
 * suspend without telling the recruiter why.
 */

const mockPush = jest.fn();
jest.mock('expo-router', () => {
  const { useEffect } = require('react');
  return {
    useRouter: () => ({ push: mockPush, replace: jest.fn(), back: jest.fn(), canGoBack: () => true }),
    useLocalSearchParams: () => ({}),
    useFocusEffect: (cb: () => void) => useEffect(() => { cb(); }, [cb]),
  };
});

let mockUser: any = { id: 'u1', role: 'healthcare_professional', is_admin: false };
jest.mock('../context/AuthContext', () => ({
  useAuth: () => ({ token: 't', user: mockUser, isKycApproved: true, refreshUser: jest.fn(async () => {}) }),
}));

const mockApi = {
  fetchDiscovery: jest.fn(), saveDiscovery: jest.fn(), fetchCities: jest.fn(async () => ['Pune', 'Mumbai']),
  searchCandidates: jest.fn(), sendInvitation: jest.fn(),
  adminListRecruiters: jest.fn(), adminRecruiterDetail: jest.fn(), adminRecruiterAction: jest.fn(),
  adminRecruiterDocument: jest.fn(),
};
jest.mock('../api/recruiters', () => new Proxy({}, {
  get: (_t, name: string) => (mockApi as any)[name] ?? jest.fn(async () => []),
}));
jest.mock('../api/jobs', () => ({
  fetchMyPostings: jest.fn(async () => [{ id: 'job-1', title: 'Cardiologist', status: 'active' }]),
}));
jest.mock('../api/locum', () => ({ fetchMyLocums: jest.fn(async () => []) }));

// eslint-disable-next-line import/first
import OpportunitiesScreen from '../../app/opportunities';
// eslint-disable-next-line import/first
import FindTalentScreen from '../../app/recruiter/candidates';
// eslint-disable-next-line import/first
import AdminRecruitersScreen from '../../app/admin/recruiters';

const JOB: Job = {
  id: 'job-9', poster_id: 'r1', posted_as: 'organization', employment_type: 'full_time',
  title: 'Consultant Cardiologist', specialty: 'Cardiology', description: 'x', location: 'Pune', city: 'Pune',
  state: 'Maharashtra', work_mode: 'onsite', pay_min: 0, pay_max: 0, pay_monthly_min: 0, pay_monthly_max: 0,
  pay_period: 'month', pay_currency: 'INR', pay_disclosed: false, experience_min: 0, experience_max: 0,
  vacancies: 1, skills: [], is_urgent: false, status: 'active', applicant_count: 0, view_count: 0, save_count: 0,
  created_at: new Date().toISOString(), saved: false, has_applied: false, can_manage: false,
  employer_name: 'CarePlus Staffing', employer_verified: true, poster_role: 'recruiter',
} as Job;

describe('recruiter presentation', () => {
  beforeAll(() => {
    // The first render of each screen in a worker transforms React Native's
    // modal, switch and icon internals on demand -- a one-off cost of seconds
    // that is the test environment warming up, not the screen. Paid here, with
    // its own allowance, so every real test keeps the normal 5s budget.
    mockApi.fetchDiscovery.mockResolvedValue(null);
    mockApi.searchCandidates.mockResolvedValue({ items: [], total: 0, page: 1, has_more: false });
    mockApi.adminListRecruiters.mockResolvedValue([]);
    render(<RecruiterStatusPill status="PENDING" />).unmount();
    render(<OpportunitiesScreen />).unmount();
    mockUser = { id: 'r1', role: 'recruiter' };
    render(<FindTalentScreen />).unmount();
    mockUser = { id: 'a1', role: 'hospital', is_admin: true };
    render(<AdminRecruitersScreen />).unmount();
  }, 30000);

  it('names missing requirements in plain words', () => {
    expect(missingLabel('document:business_registration')).toBe('Business registration certificate');
    expect(missingLabel('rep_phone')).toBe('Representative phone');
    expect(missingLabel('legal_name')).toBe('Legal name');
  });

  it('states status and verification in words, not colour', () => {
    render(<RecruiterStatusPill status="NEEDS_INFORMATION" />);
    expect(screen.getByLabelText('Status: Needs information')).toBeTruthy();
    render(<VerifiedRecruiterBadge />);
    expect(screen.getByText('Verified Recruiter')).toBeTruthy();
  });

  it('never names a confidential client on a job card', () => {
    const label = () => [].concat(screen.getByTestId('job-client-job-9').props.children).join('');
    const { rerender } = render(<JobCard item={{ ...JOB, posted_by_recruiter: true, client_confidential: true }}
      onPress={jest.fn()} />);
    expect(label()).toContain('Confidential client');
    rerender(<JobCard item={{ ...JOB, posted_by_recruiter: true, client_name: 'Apex Heart Institute' }} onPress={jest.fn()} />);
    expect(label()).toContain('Apex Heart Institute');
    rerender(<JobCard item={{ ...JOB, posted_by_recruiter: true }} onPress={jest.fn()} />);
    expect(label()).toBe('Recruiter posting');
    rerender(<JobCard item={{ ...JOB, poster_role: 'hospital' }} onPress={jest.fn()} />);
    expect(screen.queryByTestId('job-client-job-9')).toBeNull();
  });
});

describe('Opportunities (professional)', () => {
  beforeEach(() => {
    mockUser = { id: 'u1', role: 'healthcare_professional' };
    mockApi.fetchDiscovery.mockResolvedValue({
      open_to_jobs: false, available_for_locum: false, recruiter_discovery: false, locum_alerts: 'immediate',
      invitation_alerts: 'immediate', locum_roles: [], city: 'Pune', state: '', max_distance_km: 25, city_known: true,
    });
    mockApi.saveDiscovery.mockImplementation(async (_t: string, body: any) => ({ ...body, city_known: true }));
  });

  it('starts with everything off and saves only what the user turned on', async () => {
    render(<OpportunitiesScreen />);
    await waitFor(() => screen.getByTestId('toggle-discovery'));
    expect(screen.getByTestId('toggle-discovery').props.value).toBe(false);
    fireEvent(screen.getByTestId('toggle-discovery'), 'valueChange', true);
    await act(async () => { fireEvent.press(screen.getByTestId('discovery-save')); });
    const body = mockApi.saveDiscovery.mock.calls[0][1];
    expect(body.recruiter_discovery).toBe(true);
    expect(body.open_to_jobs).toBe(false);
    expect(body).not.toHaveProperty('city_known');
    await waitFor(() => expect(screen.getByText('Preferences saved')).toBeTruthy());
  });

  it('is not offered to other account types', () => {
    mockUser = { id: 'h1', role: 'hospital' };
    render(<OpportunitiesScreen />);
    expect(screen.getByText('For healthcare professionals')).toBeTruthy();
  });
});

describe('Find talent (recruiter)', () => {
  beforeEach(() => {
    mockUser = { id: 'r1', role: 'recruiter', verified: true };
    mockApi.searchCandidates.mockResolvedValue({
      items: [{
        id: 'p1', name: 'Dr. Meera Rao', specialty: 'Cardiology', city: 'Mumbai', distance_label: '≈ 120 km',
        distance_km: 120, open_to_jobs: true, available_for_locum: false, account_verified: true,
      }],
      total: 1, page: 1, has_more: false,
    });
    mockApi.sendInvitation.mockResolvedValue({ id: 'i1', status: 'SENT' });
  });

  it('shows an approximate distance and invites to a real opening', async () => {
    render(<FindTalentScreen />);
    await waitFor(() => screen.getByText('Dr. Meera Rao'));
    expect(screen.getByText(/≈ 120 km/)).toBeTruthy();
    expect(screen.getByText('Open to jobs')).toBeTruthy();

    await waitFor(() => expect(screen.getByTestId('candidate-invite-p1').props.accessibilityState?.disabled).toBeFalsy());
    fireEvent.press(screen.getByTestId('candidate-invite-p1'));
    fireEvent.changeText(screen.getByTestId('invite-message'), 'Strong fit for our client');
    await act(async () => { fireEvent.press(screen.getByTestId('invite-send')); });
    expect(mockApi.sendInvitation).toHaveBeenCalledWith('t', {
      professional_id: 'p1', job_id: 'job-1', locum_id: undefined, message: 'Strong fit for our client',
    }, expect.any(String));
  });
});

describe('Admin recruiter review', () => {
  beforeEach(() => {
    mockUser = { id: 'a1', role: 'hospital', is_admin: true };
    mockApi.adminListRecruiters.mockResolvedValue([{
      user_id: 'r1', company_name: 'CarePlus Staffing', city: 'Pune', status: 'UNDER_REVIEW',
      submitted_at: '2026-09-20T00:00:00Z', updated_at: '', name: 'Riya', email: 'riya@careplus.in',
    }]);
    const detail = {
      user_id: 'r1', company_name: 'CarePlus Staffing', status: 'UNDER_REVIEW', documents: [], events: [],
      placement_types: [], specialties: [], reports: 0, actions: ['approve', 'reject', 'request_info'],
      account: { name: 'Riya', email: 'riya@careplus.in', phone: '98', email_verified: true, created_at: '' },
    };
    mockApi.adminRecruiterDetail.mockResolvedValue(detail);
    mockApi.adminRecruiterAction.mockResolvedValue({ ...detail, status: 'REJECTED', actions: ['approve'] });
  });

  it('requires a reason before rejecting, then sends it', async () => {
    render(<AdminRecruitersScreen />);
    await waitFor(() => screen.getByTestId('admin-recruiter-r1'));
    await act(async () => { fireEvent.press(screen.getByTestId('admin-recruiter-r1')); });
    await waitFor(() => screen.getByTestId('admin-action-reject'));

    await act(async () => { fireEvent.press(screen.getByTestId('admin-action-reject')); });
    expect(mockApi.adminRecruiterAction).not.toHaveBeenCalled();

    fireEvent.changeText(screen.getByTestId('admin-reason'), 'Registration number does not match certificate');
    await act(async () => { fireEvent.press(screen.getByTestId('admin-action-reject')); });
    expect(mockApi.adminRecruiterAction).toHaveBeenCalledWith(
      't', 'r1', 'reject', 'Registration number does not match certificate');
  });
});
