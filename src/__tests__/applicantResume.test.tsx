import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react-native';
import ApplicantsScreen from '../../app/(tabs)/jobs/applicants/[id]';
import { fetchApplicantResume, fetchApplicants, fetchJob } from '../api/jobs';
import { openBlob } from '../utils/download';
import type { Application, Job } from '../types/jobs';

/**
 * The recruiter's view of what an applicant handed over: their resume on
 * request, and any screening-question answers inline on the card.
 */

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: jest.fn(), replace: jest.fn(), back: jest.fn(), canGoBack: () => true }),
  // eslint-disable-next-line @typescript-eslint/no-require-imports -- jest.mock factories can only close over hoisted requires, not the top-level `React` import.
  useFocusEffect: (cb: () => void) => { require('react').useEffect(cb, []); },
  useLocalSearchParams: () => ({ id: 'job-1' }),
}));

jest.mock('../context/AuthContext', () => ({
  useAuth: () => ({ token: 'test-token', user: { id: 'u1', role: 'hospital' } }),
}));

jest.mock('../api/jobs', () => ({
  fetchJob: jest.fn(),
  fetchApplicants: jest.fn(),
  setApplicationStatus: jest.fn(),
  fetchApplicantResume: jest.fn(),
}));

jest.mock('../utils/download', () => ({ openBlob: jest.fn() }));

const job: Job = { id: 'job-1', title: 'Staff Nurse' } as Job;

const applicant: Application = {
  id: 'app-1', job_id: 'job-1', user_id: 'user-1', user_name: 'Priya Shah',
  specialty: 'Nursing', status: 'applied', created_at: new Date().toISOString(),
  screening_answers: [
    { question_id: 'q1', text: 'Do you have an active nursing license?', answer: 'yes' },
  ],
};

describe('ApplicantsScreen: resume and screening answers', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (fetchJob as jest.Mock).mockResolvedValue(job);
    (fetchApplicants as jest.Mock).mockResolvedValue([applicant]);
  });

  it('shows the answer inline on the card', async () => {
    render(<ApplicantsScreen />);
    await waitFor(() => expect(screen.getByText('Priya Shah')).toBeTruthy());

    expect(screen.getByText(/Do you have an active nursing license\?/)).toBeTruthy();
    expect(screen.getByText('Yes')).toBeTruthy();
  });

  it('downloads and opens the resume on request', async () => {
    const blob = new Blob(['%PDF-fake'], { type: 'application/pdf' });
    (fetchApplicantResume as jest.Mock).mockResolvedValue(blob);

    render(<ApplicantsScreen />);
    await waitFor(() => expect(screen.getByText('Priya Shah')).toBeTruthy());

    fireEvent.press(screen.getByTestId('applicant-resume-app-1'));

    await waitFor(() => expect(fetchApplicantResume).toHaveBeenCalledWith('test-token', 'app-1'));
    await waitFor(() => expect(openBlob).toHaveBeenCalledWith(blob, 'Priya-Shah-resume.pdf'));
  });

  it('surfaces a failed resume download as a visible error, not a silent no-op', async () => {
    (fetchApplicantResume as jest.Mock).mockRejectedValue(new Error('Network error.'));

    render(<ApplicantsScreen />);
    await waitFor(() => expect(screen.getByText('Priya Shah')).toBeTruthy());

    fireEvent.press(screen.getByTestId('applicant-resume-app-1'));

    await waitFor(() => expect(screen.getByText('Network error.')).toBeTruthy());
  });
});
