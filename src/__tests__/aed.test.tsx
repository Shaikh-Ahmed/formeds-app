import React from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { parseMarkdown, stripLatex } from '../components/aed/AedMarkdown';
import { aedErrorMessage } from '../api/aed';

/**
 * AED on the client: answers render as structured notes, the emergency banner
 * and sources appear only when the server says so, and failures are shown as
 * words with a way to retry -- never as a stack trace or a made-up answer.
 */

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: jest.fn(), replace: jest.fn(), back: jest.fn() }),
}));
jest.mock('expo-image-picker', () => ({
  requestMediaLibraryPermissionsAsync: jest.fn(async () => ({ granted: false })),
  launchImageLibraryAsync: jest.fn(),
}));
jest.mock('../context/AuthContext', () => ({
  useAuth: () => ({ token: 't', user: { id: 'u1', role: 'healthcare_professional' } }),
}));

const mockAsk = jest.fn();
jest.mock('../api/aed', () => {
  const actual = jest.requireActual('../api/aed');
  return {
    ...actual,
    askAed: (...args: any[]) => mockAsk(...args),
    askAedWithFile: jest.fn(),
    fetchAedHistory: jest.fn(async () => []),
    clearAedHistory: jest.fn(async () => ({})),
  };
});

// The screen loads the member's plan and balance on mount. Without this mock
// those were real HTTP calls from a unit test -- slow enough under load to push
// the first test past Jest's timeout.
jest.mock('../api/subscriptions', () => ({
  fetchMySubscription: jest.fn(async () => ({
    plan: { code: 'core', name: 'Core', rank: 0, entitlements: { AED_ACCESS: true } },
    aed_tokens: {
      plan_code: 'core', allocated: 100, used: 0, remaining: 100, period_start: '',
      resets_at: '2026-10-01T00:00:00Z', low: false, exhausted: false,
    },
  })),
  fetchPlans: jest.fn(async () => ({ plans: [], features: [], token_costs: [] })),
}));

// eslint-disable-next-line import/first
import AEDChatScreen from '../../app/aed-chat';

describe('parseMarkdown', () => {
  it('reads the structure AED answers use', () => {
    const blocks = parseMarkdown([
      '## Clinical Summary',
      'A 35-year-old with **fever** and cough.',
      '',
      '- Tachycardia',
      '  - HR 118',
      '1. Community-acquired pneumonia',
      '| Test | Result |',
      '|------|--------|',
      '| CRP | 120 |',
      '---',
    ].join('\n'));
    expect(blocks.map(b => b.kind)).toEqual(
      ['heading', 'paragraph', 'bullet', 'bullet', 'number', 'table', 'rule'],
    );
    expect(blocks[3]).toEqual({ kind: 'bullet', depth: 1, text: 'HR 118' });
    expect(blocks[5]).toEqual({ kind: 'table', rows: [['Test', 'Result'], ['CRP', '120']] });
  });
});

describe('aedErrorMessage', () => {
  it('passes through the specific, useful server messages', () => {
    expect(aedErrorMessage({ code: 'aed_daily_limit', message: "You've reached today's limit" }))
      .toBe("You've reached today's limit");
  });
  it('never shows internals for a generic failure', () => {
    expect(aedErrorMessage({ status: 500, message: 'Traceback (most recent call last)...' }))
      .toBe('AED is temporarily unavailable. Please try again in a moment.');
  });
});

describe('AED screen', () => {
  // The first render of this screen in a Jest worker transforms React
  // Native's modal, animation and icon internals on demand -- a one-off cost
  // of ~5s that is the test environment warming up, not the screen. Paying it
  // here, with its own allowance, keeps every real test to the normal 5s.
  beforeAll(() => {
    render(<AEDChatScreen />).unmount();
  }, 30000);
  beforeEach(() => mockAsk.mockReset());

  it('offers healthcare quick actions and sends the chosen one', async () => {
    mockAsk.mockResolvedValue({
      response: '## Clinical Summary\nFindings.', session_id: 'aed-u1-x', intent: 'CLINICAL_CASE',
      urgent: false, sources: [], answered_locally: false,
    });
    render(<AEDChatScreen />);
    expect(screen.getByText('How can I help with your healthcare question?')).toBeTruthy();

    fireEvent.press(screen.getByTestId('aed-action-analyze_case'));
    expect(screen.getByTestId('aed-chat-input').props.value).toBe('Case: ');
    fireEvent.changeText(screen.getByTestId('aed-chat-input'), 'Case: 35M fever and cough');
    await act(async () => { fireEvent.press(screen.getByTestId('aed-send-btn')); });

    expect(mockAsk).toHaveBeenCalledWith('t', 'Case: 35M fever and cough', null, 'analyze_case', expect.any(String));
    await waitFor(() => expect(screen.getByText('Clinical Summary')).toBeTruthy());
  });

  it('leads a possible emergency with the escalation banner, and lists real sources', async () => {
    mockAsk.mockResolvedValue({
      response: 'Immediate actions...', session_id: 'aed-u1-x', intent: 'EMERGENCY', urgent: true,
      sources: [{ source: 'PubMed', id: '1', title: 'Chest pain triage', url: 'https://pubmed.ncbi.nlm.nih.gov/1/' }],
      answered_locally: false,
    });
    render(<AEDChatScreen />);
    fireEvent.changeText(screen.getByTestId('aed-chat-input'), 'Crushing chest pain');
    await act(async () => { fireEvent.press(screen.getByTestId('aed-send-btn')); });
    await waitFor(() => expect(screen.getByTestId('aed-urgent')).toBeTruthy());
    expect(screen.getByTestId('aed-sources')).toBeTruthy();
  });

  it('shows no sources section when none were retrieved', async () => {
    mockAsk.mockResolvedValue({
      response: 'Answer', session_id: 's', intent: 'MEDICAL_KNOWLEDGE', urgent: false,
      sources: [], answered_locally: false,
    });
    render(<AEDChatScreen />);
    fireEvent.changeText(screen.getByTestId('aed-chat-input'), 'What is sepsis?');
    await act(async () => { fireEvent.press(screen.getByTestId('aed-send-btn')); });
    await waitFor(() => expect(screen.getByTestId('aed-answer')).toBeTruthy());
    expect(screen.queryByTestId('aed-sources')).toBeNull();
    expect(screen.queryByTestId('aed-urgent')).toBeNull();
  });

  it('turns a failure into a readable message with Retry', async () => {
    mockAsk
      .mockRejectedValueOnce({ status: 503, code: 'aed_unavailable', message: 'x' })
      .mockResolvedValueOnce({
        response: 'Recovered', session_id: 's', intent: 'MEDICAL_KNOWLEDGE', urgent: false,
        sources: [], answered_locally: false,
      });
    render(<AEDChatScreen />);
    fireEvent.changeText(screen.getByTestId('aed-chat-input'), 'What is sepsis?');
    await act(async () => { fireEvent.press(screen.getByTestId('aed-send-btn')); });
    await waitFor(() => expect(screen.getByTestId('aed-error')).toBeTruthy());
    expect(screen.getByText('AED is temporarily unavailable. Please try again in a moment.')).toBeTruthy();

    await act(async () => { fireEvent.press(screen.getByTestId('aed-retry')); });
    await waitFor(() => expect(screen.getByText('Recovered')).toBeTruthy());
    expect(mockAsk).toHaveBeenCalledTimes(2);
  });
});

describe('stripLatex', () => {
  it('turns the clinical LaTeX models write into readable text', () => {
    // String.raw keeps the backslashes exactly as a model sends them.
    expect(stripLatex(String.raw`Indicated based on $\text{CHA}_2\text{DS}_2\text{-VASc}$ score.`))
      .toBe('Indicated based on CHA2DS2-VASc score.');
    expect(stripLatex(String.raw`target $\text{SpO}_2 \ge 90\%$`)).toBe('target SpO2 ≥ 90%');
    expect(stripLatex(String.raw`door-to-ECG $< 10 \text{ min}$`)).toBe('door-to-ECG < 10 min');
  });

  it('leaves ordinary Markdown alone', () => {
    expect(stripLatex('An _italic_ note on snake_case and **bold**')).toBe(
      'An _italic_ note on snake_case and **bold**');
  });
});

describe('AED and the token allowance', () => {
  beforeEach(() => mockAsk.mockReset());

  it('turns an exhausted balance into an upgrade prompt, not a retry', async () => {
    mockAsk.mockRejectedValue({
      status: 402, code: 'aed_tokens_exhausted',
      message: 'Your AED token balance is exhausted for this billing period.',
      data: { detail: { code: 'aed_tokens_exhausted', upgrade_to: 'ProCare', remaining: 0 } },
    });
    render(<AEDChatScreen />);
    fireEvent.changeText(screen.getByTestId('aed-chat-input'), 'What is sepsis?');
    await act(async () => { fireEvent.press(screen.getByTestId('aed-send-btn')); });
    await waitFor(() => expect(screen.getByTestId('aed-upgrade')).toBeTruthy());
    expect(screen.getByText('Available with ProCare')).toBeTruthy();
    expect(screen.queryByTestId('aed-retry')).toBeNull();
  });

  it('notes when the plan, not the question, left an answer without sources', async () => {
    mockAsk.mockResolvedValue({
      response: 'General answer', session_id: 's', intent: 'MEDICAL_RESEARCH', urgent: false,
      sources: [], answered_locally: false,
      limited_by_plan: { feature: 'AED_RESEARCH_SOURCES', required_plan: 'ProCare' },
    });
    render(<AEDChatScreen />);
    fireEvent.changeText(screen.getByTestId('aed-chat-input'), 'Summarize the evidence on statins');
    await act(async () => { fireEvent.press(screen.getByTestId('aed-send-btn')); });
    await waitFor(() => expect(screen.getByTestId('aed-limited')).toBeTruthy());
  });
});
