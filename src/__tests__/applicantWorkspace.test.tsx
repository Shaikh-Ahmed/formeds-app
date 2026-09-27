import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { ApplySheet } from '../components/jobs/ApplySheet';
import { ScreeningAnswersView, answerErrors, cleanAnswers, questionErrors } from '../components/jobs/Screening';
import { verifiedLabel } from '../components/jobs/applicants/ApplicantList';
import type { Job } from '../types/jobs';
import type { ScreeningQuestion } from '../types/applicants';

jest.mock('expo-router', () => ({ useRouter: () => ({ push: jest.fn(), replace: jest.fn(), back: jest.fn() }) }));
jest.mock('../context/AuthContext', () => ({
  useAuth: () => ({
    token: 't', isKycApproved: true,
    user: { id: 'u1', name: 'Dr. A', role: 'healthcare_professional', specialty: 'Critical Care', city: 'Pune' },
  }),
}));
jest.mock('../api/applicants', () => ({
  fetchMyResume: jest.fn(async () => ({ has_resume: true, name: 'cv.pdf', size: 20480 })),
  uploadResume: jest.fn(), deleteMyResume: jest.fn(), fetchMyResumeUrl: jest.fn(),
}));

const QUESTIONS: ScreeningQuestion[] = [
  { id: 'q1', text: 'Are you willing to work night shifts?', type: 'yes_no', required: true, options: [] },
  { id: 'q2', text: 'Years of ICU experience?', type: 'number', required: true, options: [] },
  { id: 'q3', text: 'Which shifts can you work?', type: 'multiple_choice', required: false, options: ['Morning', 'Night'] },
];
const JOB = {
  id: 'j1', title: 'Senior Staff Nurse, ICU', employer_name: 'City Hospital', location: 'Pune',
  screening_questions: QUESTIONS,
} as unknown as Job;

describe('applying with screening questions', () => {
  it('walks profile → questions → review, enforcing required answers, and submits them with the resume', async () => {
    const onSubmit = jest.fn();
    render(<ApplySheet visible job={JOB} onClose={jest.fn()} onSubmit={onSubmit} />);
    await waitFor(() => screen.getByTestId('resume-name'));
    expect(screen.getByTestId('resume-name').props.children).toContain('cv.pdf');

    fireEvent.press(screen.getByTestId('apply-next'));
    fireEvent.press(screen.getByTestId('apply-next'));
    expect(screen.getAllByText('Please answer this question.')).toHaveLength(2);
    expect(screen.queryByTestId('apply-review')).toBeNull();

    fireEvent.press(screen.getByTestId('answer-0-yes'));
    fireEvent.changeText(screen.getByTestId('answer-1'), '4y');
    fireEvent.press(screen.getByTestId('answer-2-Night'));
    fireEvent.press(screen.getByTestId('apply-next'));

    const review = screen.getByTestId('apply-review');
    expect(review).toBeTruthy();
    expect(screen.getByText('3 of 3 answered')).toBeTruthy();
    fireEvent.press(screen.getByTestId('apply-submit'));
    expect(onSubmit).toHaveBeenCalledWith('', { answers: { q1: 'yes', q2: 4, q3: ['Night'] }, include_resume: true });
  });

  it('skips the questions step when the job has none', async () => {
    render(<ApplySheet visible job={{ ...JOB, screening_questions: [] } as Job} onClose={jest.fn()} onSubmit={jest.fn()} />);
    await waitFor(() => screen.getByTestId('resume-name'));
    fireEvent.press(screen.getByTestId('apply-next'));
    expect(screen.getByTestId('apply-review')).toBeTruthy();
    expect(screen.queryByText(/Screening questions/)).toBeNull();
  });
});

describe('screening rules', () => {
  it('refuses half-built questions', () => {
    expect(questionErrors([{ ...QUESTIONS[0], text: 'Hi' }])[0]).toMatch(/at least 5/);
    expect(questionErrors([{ ...QUESTIONS[2], options: ['Night', ''] }])[0]).toMatch(/two options/);
    expect(questionErrors([QUESTIONS[0], { ...QUESTIONS[0], text: 'are you willing to work NIGHT shifts?' }])[1])
      .toMatch(/asked twice/);
  });

  it('checks answers by type and sends numbers as numbers', () => {
    expect(answerErrors(QUESTIONS, { q1: 'yes', q2: '-1' }).q2).toMatch(/between 0/);
    expect(answerErrors(QUESTIONS, { q1: 'yes', q2: '3' })).toEqual({});
    expect(cleanAnswers(QUESTIONS, { q1: 'no', q2: '3', q3: [] })).toEqual({ q1: 'no', q2: 3 });
  });

  it('shows the employer each question with its answer and whether a preference was met', () => {
    render(<ScreeningAnswersView
      answers={[
        { ...QUESTIONS[0], preferred: 'yes', answer: 'no' },
        { ...QUESTIONS[1], preferred: '3', answer: 4 },
        { ...QUESTIONS[2], answer: null },
      ]}
      summary={{ total: 3, answered: 2, preferences: 2, unmet: 1 }} />);
    expect(screen.getByText('2/3 answered · 1 preference not met')).toBeTruthy();
    expect(screen.getByText('Preferred: Yes')).toBeTruthy();
    expect(screen.getByText('Preferred')).toBeTruthy();
    expect(screen.getByText('Not answered')).toBeTruthy();
  });
});

describe('verification label', () => {
  it('only says verified when the platform verified the account', () => {
    expect(verifiedLabel({ account_verified: true, professional_role: 'Nurse' })).toBe('Verified nurse');
    expect(verifiedLabel({ account_verified: false, professional_role: 'Doctor' })).toBeNull();
  });
});
