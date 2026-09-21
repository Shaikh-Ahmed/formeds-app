import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react-native';
import ApplicantsScreen from '../../app/(tabs)/jobs/applicants/[id]';
import { fetchApplicants, fetchJob, setApplicationStatus } from '../api/jobs';
import type { Application, Job } from '../types/jobs';

/**
 * Bulk moving applicants.
 *
 * Bulk actions only make sense within a single pipeline stage — otherwise the
 * offered next steps would be the union of every stage's transitions, most of
 * which wouldn't apply to most of the selection. So "Select" only appears
 * once a status filter narrows the list to one stage, and the bar offers
 * exactly that stage's next steps (mirroring the single-applicant NEXT_STEPS
 * table this screen already enforces).
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
}));

const job: Job = { id: 'job-1', title: 'Staff Nurse' } as Job;

const applicant = (id: string, status: Application['status']): Application => ({
  id,
  job_id: 'job-1',
  user_id: `user-${id}`,
  user_name: `Applicant ${id}`,
  specialty: 'Nursing',
  status,
  created_at: new Date().toISOString(),
});

describe('ApplicantsScreen bulk actions', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (fetchJob as jest.Mock).mockResolvedValue(job);
  });

  it('offers no "Select" entry point until a single stage is filtered', async () => {
    (fetchApplicants as jest.Mock).mockResolvedValue([applicant('1', 'applied'), applicant('2', 'shortlisted')]);
    render(<ApplicantsScreen />);
    await waitFor(() => expect(screen.getByText('Applicant 1')).toBeTruthy());

    expect(screen.queryByTestId('bulk-select-toggle')).toBeNull();
  });

  it('moves every selected applicant to the chosen stage', async () => {
    (fetchApplicants as jest.Mock).mockResolvedValue([
      applicant('1', 'applied'),
      applicant('2', 'applied'),
      applicant('3', 'shortlisted'),
    ]);
    (setApplicationStatus as jest.Mock).mockResolvedValue({ status: 'reviewing' });

    render(<ApplicantsScreen />);
    await waitFor(() => expect(screen.getByText('Applicant 1')).toBeTruthy());

    // Narrow to "Applied" so bulk actions become available.
    fireEvent.press(screen.getByTestId('applicant-filter-applied'));
    fireEvent.press(screen.getByTestId('bulk-select-toggle'));

    fireEvent.press(screen.getByLabelText('Select Applicant 1'));
    fireEvent.press(screen.getByLabelText('Select Applicant 2'));

    fireEvent.press(screen.getByTestId('bulk-move-reviewing'));

    await waitFor(() => expect(setApplicationStatus).toHaveBeenCalledTimes(2));
    expect(setApplicationStatus).toHaveBeenCalledWith('test-token', '1', 'reviewing');
    expect(setApplicationStatus).toHaveBeenCalledWith('test-token', '2', 'reviewing');

    // Bulk mode exits and the moved applicants leave the "Applied" filter.
    await waitFor(() => expect(screen.queryByTestId('bulk-select-toggle')).toBeNull());
  });

  it('reports partial failures without losing the successes', async () => {
    (fetchApplicants as jest.Mock).mockResolvedValue([
      applicant('1', 'applied'),
      applicant('2', 'applied'),
    ]);
    (setApplicationStatus as jest.Mock).mockImplementation((_token: string, id: string) =>
      id === '1' ? Promise.resolve({ status: 'rejected' }) : Promise.reject(new Error('down')),
    );

    render(<ApplicantsScreen />);
    await waitFor(() => expect(screen.getByText('Applicant 1')).toBeTruthy());

    fireEvent.press(screen.getByTestId('applicant-filter-applied'));
    fireEvent.press(screen.getByTestId('bulk-select-toggle'));
    fireEvent.press(screen.getByLabelText('Select Applicant 1'));
    fireEvent.press(screen.getByLabelText('Select Applicant 2'));
    fireEvent.press(screen.getByTestId('bulk-move-rejected'));

    await waitFor(() =>
      expect(screen.getByText(/Moved 1 to Not selected\. 1 couldn't be updated/)).toBeTruthy(),
    );
  });
});
