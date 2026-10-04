import React from 'react';
import { render, screen, waitFor } from '@testing-library/react-native';
import { FeedRail } from '../components/web/FeedRail';
import { KycNotice } from '../components/KycNotice';
import { kycCopy, resetKycStatusCache } from '../hooks/useKycStatus';
import { apiFetch } from '../utils/api';

jest.mock('expo-router', () => ({ useRouter: () => ({ push: jest.fn(), replace: jest.fn(), back: jest.fn() }) }));
jest.mock('../context/AuthContext', () => ({
  useAuth: () => ({
    token: 't', isKycApproved: false, refreshUser: jest.fn(),
    user: { id: 'u1', name: 'Dr. A', role: 'healthcare_professional' },
  }),
}));
jest.mock('../utils/api', () => ({ ...jest.requireActual('../utils/api'), apiFetch: jest.fn() }));

const mockedFetch = apiFetch as jest.Mock;
const status = (s: string) => ({ verified: false, status: s, reject_reason: null, submitted_at: null, registration_type: 'nmc' });

const KYC = '/api/kyc/status';
// Only the verification status is under test; the rail's other sections get
// empty lists, which is what they render nothing for.
const answer = (kyc: unknown) => mockedFetch.mockImplementation(async (url: string) => (url.startsWith(KYC) ? kyc : []));
const kycCalls = () => mockedFetch.mock.calls.filter(([url]) => String(url).startsWith(KYC)).length;

beforeEach(() => { resetKycStatusCache(); mockedFetch.mockReset(); });

describe('verification wording follows the real status', () => {
  it('never asks someone under review to complete verification', async () => {
    answer(status('pending'));
    render(<><FeedRail /><KycNotice action="apply" /></>);
    // The rail card and the banner both say it.
    await waitFor(() => expect(screen.getAllByText('Verification under review')).toHaveLength(2), { timeout: 10000 });
    expect(screen.getByText('View status')).toBeTruthy();
    expect(screen.getByText('You can apply once your documents are approved. We will notify you.')).toBeTruthy();
    expect(screen.queryByText('Complete verification')).toBeNull();
    // Two readers, one request.
    expect(kycCalls()).toBe(1);
  }, 20000);

  it('asks a member who has not submitted to complete verification', async () => {
    answer(status('not_submitted'));
    render(<FeedRail />);
    await waitFor(() => screen.getByText('Verification pending'), { timeout: 10000 });
    expect(screen.getByText('Complete verification')).toBeTruthy();
  });

  it('tells a rejected member to resubmit', () => {
    expect(kycCopy('rejected')).toMatchObject({ title: 'Verification not approved', cta: 'Resubmit documents' });
  });
});
