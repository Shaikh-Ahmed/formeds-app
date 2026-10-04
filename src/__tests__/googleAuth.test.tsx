import React from 'react';
import fs from 'fs';
import path from 'path';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';

const mockRouter = { push: jest.fn(), replace: jest.fn(), back: jest.fn() };
const mockCompleteSignup = jest.fn();
jest.mock('expo-router', () => ({ useRouter: () => mockRouter }));
jest.mock('../context/AuthContext', () => ({
  useAuth: () => ({ completeSignup: mockCompleteSignup, token: null, user: null }),
}));
jest.mock('../utils/api', () => ({ ...jest.requireActual('../utils/api'), apiFetch: jest.fn() }));

import { apiFetch } from '../utils/api';
import { GoogleSignInButton } from '../components/auth/GoogleSignInButton';
import * as flow from '../components/auth/useGoogleSignIn';
import GoogleOnboardingScreen from '../../app/google-onboarding';

const mockedFetch = apiFetch as jest.Mock;

function startOnboarding(extra: Partial<flow.GoogleOnboarding> = {}) {
  // Drive the real router hook so the pending signup is stored the way the
  // sign-in screens store it.
  let route: ReturnType<typeof flow.useGoogleResultRouter> | null = null;
  function Probe() { route = flow.useGoogleResultRouter(); return null; }
  render(<Probe />);
  return route!({
    status: 'onboarding', signup_token: 'signed.ticket.value', email: 'anita@gmail.com', name: 'Anita Rao',
    photo_available: true, phone_required: false, ...extra,
  }, extra.roleHint);
}

beforeEach(() => { jest.clearAllMocks(); flow.clearPendingGoogleSignup(); });

describe('Google onboarding for a new ForMeds user', () => {
  it('asks what describes them, offers only the three normal roles, and sends no more than that', async () => {
    await startOnboarding();
    expect(mockRouter.push).toHaveBeenCalledWith('/google-onboarding');
    render(<GoogleOnboardingScreen />);
    expect(screen.getByTestId('google-onboarding-email')).toHaveTextContent('Signed in as anita@gmail.com');
    expect(screen.queryByTestId('google-role-recruiter')).toBeNull();
    expect(screen.getByTestId('google-role-healthcare_professional')).toBeTruthy();
    expect(screen.getByTestId('google-role-hospital')).toBeTruthy();
    expect(screen.getByTestId('google-role-clinic')).toBeTruthy();

    fireEvent.press(screen.getByTestId('google-onboarding-submit'));
    // The refusal shows beside the role choice, and the button frees up again.
    await waitFor(() => expect(screen.getByText('Choose what best describes you.')).toBeTruthy());
    expect(mockedFetch).not.toHaveBeenCalled();

    fireEvent.press(screen.getByTestId('google-role-healthcare_professional'));
    fireEvent.press(screen.getByTestId('google-profession-Nurse'));
    fireEvent.changeText(screen.getByTestId('google-phone-input'), '9876500001');
    mockedFetch.mockResolvedValueOnce({ status: 'signed_in', token: 't', refresh_token: 'r', user: { id: 'u1' } });
    fireEvent.press(screen.getByTestId('google-onboarding-submit'));
    await waitFor(() => expect(mockCompleteSignup).toHaveBeenCalled());
    const [url, , init] = mockedFetch.mock.calls[0];
    expect(url).toBe('/api/auth/google/complete');
    expect(JSON.parse(init.body)).toEqual({
      signup_token: 'signed.ticket.value', role: 'healthcare_professional', name: 'Anita Rao',
      phone: '9876500001', professional_role: 'Nurse', use_google_photo: true,
    });
    // The healthcare-verification step is stated plainly.
    expect(screen.getByText(/does not verify your professional credentials/)).toBeTruthy();
  });

  it('defaults to the role picked on the register screen', async () => {
    await startOnboarding({ roleHint: 'clinic' });
    render(<GoogleOnboardingScreen />);
    expect(screen.getByTestId('google-role-clinic').props.accessibilityState).toEqual({ selected: true });
  });

  it('with no signup in progress, sends them back to start again', () => {
    render(<GoogleOnboardingScreen />);
    expect(screen.getByText('Let’s start again'.replace('’', "'"))).toBeTruthy();
  });

  it('an account that still owes phone verification resumes at the phone step', async () => {
    let route: ReturnType<typeof flow.useGoogleResultRouter> | null = null;
    function Probe() { route = flow.useGoogleResultRouter(); return null; }
    render(<Probe />);
    await route!({ status: 'verify', verification_token: 'vt', email: 'a@b.c', phone: '+919876500001',
      delivered: true, phone_required: true });
    expect(mockRouter.replace).toHaveBeenCalledWith(expect.objectContaining({
      pathname: '/verify', params: expect.objectContaining({ start: 'phone', verificationToken: 'vt' }),
    }));
  });
});

describe('Google button', () => {
  it('renders nothing where Google sign-in is not set up (and in the native app)', () => {
    render(<GoogleSignInButton onCredential={jest.fn()} divider="above" />);
    expect(screen.queryByTestId('google-signin')).toBeNull();
    expect(screen.queryByText('OR')).toBeNull();
    expect(mockedFetch).not.toHaveBeenCalled();
  });
});

describe('Recruiter authentication is untouched', () => {
  it('the recruiter sign-in and registration screens have no Google option', () => {
    for (const file of ['recruiter-login.tsx', 'recruiter-register.tsx']) {
      const src = fs.readFileSync(path.join(__dirname, '../../app', file), 'utf8');
      expect(src).not.toMatch(/Google/i);
    }
  });
});
