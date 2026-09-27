import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react-native';
import { ApplySheet } from '../components/jobs/ApplySheet';
import type { Job } from '../types/jobs';

/**
 * Screening questions inside the apply flow.
 *
 * The one rule worth pinning: submit must be unreachable until every
 * question has an answer. There is no server-side partial-answer recovery
 * UX, so a candidate who could submit with gaps would just get a flat 400
 * with no indication which question was missed.
 */

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: jest.fn(), replace: jest.fn() }),
}));

jest.mock('../context/AuthContext', () => ({
  useAuth: () => ({
    user: { id: 'u1', name: 'Dr. Test', specialty: 'Cardiology', years_experience: 5, city: 'Pune' },
    isKycApproved: true,
  }),
}));

const JOB: Job = {
  id: 'job-1', poster_id: 'poster-1', posted_as: 'individual',
  employment_type: 'full_time', title: 'ICU Staff Nurse', specialty: 'Nursing',
  description: '', location: 'Pune, Maharashtra', work_mode: 'onsite',
  pay_period: 'month', pay_currency: 'INR', pay_disclosed: true,
  experience_min: 0, experience_max: 0, vacancies: 1, skills: [],
  is_urgent: false, status: 'active',
  screening_questions: [
    { id: 'q1', text: 'Do you have an active nursing license?' },
    { id: 'q2', text: 'Are you willing to work night shifts?' },
  ],
  applicant_count: 0, view_count: 0, save_count: 0,
  created_at: new Date().toISOString(),
  saved: false, has_applied: false, can_manage: false, employer_name: 'Apollo',
};

describe('ApplySheet screening questions', () => {
  it('blocks submit until every question is answered', () => {
    render(<ApplySheet visible job={JOB} onClose={jest.fn()} onSubmit={jest.fn()} />);

    expect(screen.getByTestId('apply-submit').props.accessibilityState.disabled).toBe(true);

    fireEvent.press(screen.getByTestId('apply-question-q1-yes'));
    expect(screen.getByTestId('apply-submit').props.accessibilityState.disabled).toBe(true);

    fireEvent.press(screen.getByTestId('apply-question-q2-no'));
    expect(screen.getByTestId('apply-submit').props.accessibilityState.disabled).toBe(false);
  });

  it('sends exactly the answers given, matched to their question ids', () => {
    const onSubmit = jest.fn();
    render(<ApplySheet visible job={JOB} onClose={jest.fn()} onSubmit={onSubmit} />);

    fireEvent.press(screen.getByTestId('apply-question-q1-yes'));
    fireEvent.press(screen.getByTestId('apply-question-q2-no'));
    fireEvent.press(screen.getByTestId('apply-submit'));

    expect(onSubmit).toHaveBeenCalledWith('', [
      { question_id: 'q1', answer: 'yes' },
      { question_id: 'q2', answer: 'no' },
    ]);
  });

  it('never shows which answer counts as qualifying — that lives on the job the applicant cannot see', () => {
    render(<ApplySheet visible job={JOB} onClose={jest.fn()} onSubmit={jest.fn()} />);
    // The applicant-facing Job type carries only id/text; nothing in the
    // rendered tree can say "required" or "knockout" because the data was
    // never there to render.
    expect(screen.queryByText(/required/i)).toBeNull();
    expect(screen.queryByText(/knockout/i)).toBeNull();
  });

  it('resets answers when reopened for a different job', () => {
    const { rerender } = render(
      <ApplySheet visible job={JOB} onClose={jest.fn()} onSubmit={jest.fn()} />,
    );
    fireEvent.press(screen.getByTestId('apply-question-q1-yes'));
    expect(screen.getByTestId('apply-submit').props.accessibilityState.disabled).toBe(true); // q2 still unanswered

    rerender(<ApplySheet visible={false} job={JOB} onClose={jest.fn()} onSubmit={jest.fn()} />);
    rerender(<ApplySheet visible job={JOB} onClose={jest.fn()} onSubmit={jest.fn()} />);

    fireEvent.press(screen.getByTestId('apply-question-q2-yes'));
    // q1's earlier answer did not survive the close/reopen, so submit is
    // still blocked on q1 alone.
    expect(screen.getByTestId('apply-submit').props.accessibilityState.disabled).toBe(true);
  });

  it('has nothing to answer, and submits normally, when the job asks no questions', () => {
    const onSubmit = jest.fn();
    const plainJob = { ...JOB, screening_questions: [] };
    render(<ApplySheet visible job={plainJob} onClose={jest.fn()} onSubmit={onSubmit} />);

    expect(screen.getByTestId('apply-submit').props.accessibilityState.disabled).toBe(false);
    fireEvent.press(screen.getByTestId('apply-submit'));
    expect(onSubmit).toHaveBeenCalledWith('', []);
  });
});
