import React from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { parseMarkdown, stripLatex } from '../components/aed/AedMarkdown';
import { aedErrorMessage } from '../api/aed';

/**
 * AED on the client: answers render as structured notes, the emergency banner
 * and sources appear only when the server says so, and failures are shown as
 * words with a way to retry -- never as a stack trace or a made-up answer.
 */

const mockPush = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush, replace: jest.fn(), back: jest.fn() }),
  useLocalSearchParams: () => ({}),
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

// The AED agent client. By default the backend "has no agent" (config is
// null), so the classic tests above exercise the legacy endpoints; the agent
// tests below switch it on.
const mockConfig = jest.fn<Promise<any>, any[]>(async () => null);
const mockStream = jest.fn();
const mockFeedback = jest.fn<Promise<any>, any[]>(async () => ({ id: 'f1' }));
jest.mock('../api/aedMemory', () => {
  const actual = jest.requireActual('../api/aedMemory');
  return { ...actual, sendFeedback: (...args: any[]) => mockFeedback(...args) };
});

jest.mock('../api/aedStream', () => {
  const actual = jest.requireActual('../api/aedStream');
  return {
    ...actual,
    fetchAedConfig: (...args: any[]) => mockConfig(...args),
    streamAedRun: (...args: any[]) => mockStream(...args),
    runAedWithFile: jest.fn(),
    fetchAgentConversation: jest.fn(async () => ({ messages: [] })),
    clearAgentConversation: jest.fn(async () => ({})),
  };
});

// eslint-disable-next-line import/first
import AEDChatScreen from '../../app/aed-chat';
// eslint-disable-next-line import/first
import { SSEParser } from '../api/aedStream';

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

    expect(mockAsk).toHaveBeenCalledWith('t', 'Case: 35M fever and cough', null, 'analyze_case');
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

describe('SSEParser', () => {
  it('reassembles events however the network chunks them', () => {
    const raw = 'id: 1\nevent: meta\ndata: {"type":"meta","seq":1}\n\n: ping\n\nid: 2\nevent: token\ndata: {"type":"token","text":"Hi [1]"}\n\n';
    for (const size of [1, 3, 7, raw.length]) {
      const p = new SSEParser();
      const out: any[] = [];
      for (let i = 0; i < raw.length; i += size) out.push(...p.feed(raw.slice(i, i + size)));
      expect(out).toEqual([{ type: 'meta', seq: 1 }, { type: 'token', text: 'Hi [1]' }]);
    }
  });
});

describe('AED agent (streamed answers)', () => {
  const CONFIG = {
    contract_version: 1, available: true,
    disclosure: 'AED is an AI assistant for healthcare professionals.', disclosure_version: 'v',
    features: { streaming: true, think_deeper: true, deep_research: false, document_analysis: false, image_analysis: false },
    token_costs: { standard: 1, thinking: 8 },
  };
  const SOURCE = { n: 1, source: 'PubMed', id: '36914068', title: 'SGLT2 inhibitors and outcomes', year: '2023',
                   url: 'https://pubmed.ncbi.nlm.nih.gov/36914068/', evidence_type: 'meta_analysis' };
  const FINAL = {
    response: 'SGLT2 inhibitors reduce admissions [1].', conversation_id: 'aed-u1-abc', intent: 'MEDICAL_RESEARCH',
    mode: 'instant', request_type: 'standard', urgent: false, outcome: 'answered', sources: [SOURCE], cited: [1],
    tokens_charged: 1, answered_locally: false, limited_by_plan: null, missing_information: [],
    aed_tokens: { plan_code: 'core', allocated: 100, used: 1, remaining: 99, period_start: '', resets_at: '', low: false, exhausted: false },
  };

  beforeEach(() => {
    mockConfig.mockResolvedValue(CONFIG);
    mockStream.mockReset();
    mockAsk.mockReset();
  });
  afterAll(() => mockConfig.mockResolvedValue(null));

  async function ask(text: string) {
    await waitFor(() => expect(screen.getByTestId('aed-disclosure')).toBeTruthy());
    fireEvent.changeText(screen.getByTestId('aed-chat-input'), text);
    await act(async () => { fireEvent.press(screen.getByTestId('aed-send-btn')); });
  }

  it('marks same-day answers as urgent, and routine ones not at all', async () => {
    mockStream.mockImplementation(async (_t: string, _input: any, onEvent: (e: any) => void) => {
      onEvent({ type: 'meta', conversation_id: 'aed-u1-abc', run_id: 'r1', mode: 'thinking', request_type: 'standard',
                tokens_charged: 1, urgency: 'same_day' });
      return { ...FINAL, urgency: 'same_day' };
    });
    render(<AEDChatScreen />);
    await ask('58-year-old with chest discomfort, ST depression and a raised troponin. Next step?');
    await waitFor(() => expect(screen.getByTestId('aed-urgency')).toBeTruthy());
    expect(screen.getByText('URGENT · SAME DAY')).toBeTruthy();

    mockStream.mockImplementation(async () => ({ ...FINAL, urgency: 'routine' }));
    fireEvent.changeText(screen.getByTestId('aed-chat-input'), 'What is the mechanism of action of metformin?');
    await act(async () => { fireEvent.press(screen.getByTestId('aed-send-btn')); });
    await waitFor(() => expect(screen.getAllByTestId('aed-answer')).toHaveLength(2));
    expect(screen.getAllByTestId('aed-urgency')).toHaveLength(1);
  });

  it('says plainly when a chat could not be saved', async () => {
    mockConfig.mockResolvedValue({ ...CONFIG, features: { ...CONFIG.features, saved_history: true } });
    mockStream.mockImplementation(async (_t: string, _input: any, onEvent: (e: any) => void) => {
      onEvent({ type: 'meta', conversation_id: 'aed-u1-abc', run_id: 'r1', mode: 'instant', request_type: 'standard', tokens_charged: 1 });
      return { ...FINAL, saved: false };
    });
    render(<AEDChatScreen />);
    await ask('Do SGLT2 inhibitors reduce heart failure admissions?');
    await waitFor(() => expect(screen.getByTestId('aed-not-saved')).toBeTruthy());
  });

  it('starts a new chat without deleting the previous one, which stays saved', async () => {
    const { clearAgentConversation } = jest.requireMock('../api/aedStream');
    mockStream.mockImplementation(async (_t: string, _input: any, onEvent: (e: any) => void) => {
      onEvent({ type: 'meta', conversation_id: 'aed-u1-abc', mode: 'instant', request_type: 'standard', tokens_charged: 1 });
      return { ...FINAL, saved: true };
    });
    render(<AEDChatScreen />);
    await ask('Do SGLT2 inhibitors reduce heart failure admissions?');
    await waitFor(() => expect(screen.getByTestId('aed-answer')).toBeTruthy());
    fireEvent.press(screen.getByTestId('aed-new-chat'));
    await waitFor(() => expect(screen.getByTestId('aed-welcome')).toBeTruthy());
    expect(clearAgentConversation).not.toHaveBeenCalled();
    expect(screen.getByTestId('aed-new-chat')).toBeTruthy();          // always there, even on an empty chat
  });

  it('streams through the agent, then shows the checked answer with numbered sources', async () => {
    mockStream.mockImplementation(async (_t: string, _input: any, onEvent: (e: any) => void) => {
      onEvent({ type: 'meta', conversation_id: 'aed-u1-abc', mode: 'instant', request_type: 'standard', tokens_charged: 1 });
      onEvent({ type: 'status', stage: 'searching', label: 'Searching PubMed' });
      onEvent({ type: 'sources', items: [SOURCE] });
      onEvent({ type: 'token', text: 'SGLT2 inhibitors reduce' });
      return FINAL;
    });
    render(<AEDChatScreen />);
    expect(await screen.findByText(CONFIG.disclosure)).toBeTruthy();
    await ask('Summarize the evidence for SGLT2 inhibitors');

    expect(mockAsk).not.toHaveBeenCalled();
    expect(mockStream.mock.calls[0][1]).toMatchObject({ message: 'Summarize the evidence for SGLT2 inhibitors', mode: 'auto' });
    await waitFor(() => expect(screen.getByTestId('aed-evidence-toggle')).toBeTruthy());
    expect(screen.queryByTestId('aed-source-1')).toBeNull();              // evidence folds away by default
    fireEvent.press(screen.getByTestId('aed-evidence-toggle'));
    expect(screen.getByTestId('aed-source-1')).toBeTruthy();
    expect(screen.getByTestId('aed-cite-1')).toBeTruthy();
    expect(screen.queryByTestId('aed-status')).toBeNull();      // finished: no progress line
  });

  it('sends Think deeper when the member turns it on', async () => {
    mockStream.mockResolvedValue({ ...FINAL, mode: 'thinking', request_type: 'thinking' });
    render(<AEDChatScreen />);
    await waitFor(() => expect(screen.getByTestId('aed-think-deeper')).toBeTruthy());
    fireEvent.press(screen.getByTestId('aed-think-deeper'));
    await ask('Work up this case');
    expect(mockStream.mock.calls[0][1].mode).toBe('thinking');
  });

  it('shows Think deeper as locked on a plan without it', async () => {
    mockConfig.mockResolvedValue({ ...CONFIG, features: { ...CONFIG.features, think_deeper: false } });
    render(<AEDChatScreen />);
    await waitFor(() => expect(screen.getByTestId('aed-think-deeper-locked')).toBeTruthy());
    expect(screen.queryByTestId('aed-think-deeper')).toBeNull();
  });

  it('asks unverified professionals to verify, with no retry', async () => {
    mockStream.mockRejectedValue({
      status: 403, code: 'aed_verification_required',
      message: 'AED is available to verified healthcare professionals. Verify your registration to use it.',
      data: { detail: { code: 'aed_verification_required' } },
    });
    render(<AEDChatScreen />);
    await ask('What is sepsis?');
    await waitFor(() => expect(screen.getByTestId('aed-verify')).toBeTruthy());
    expect(screen.getByTestId('aed-verify-btn')).toBeTruthy();
    expect(screen.queryByTestId('aed-retry')).toBeNull();
  });
});

describe('AED agent: related content, feedback and history', () => {
  const CONFIG = {
    contract_version: 1, available: true, disclosure: 'AED is an AI assistant for healthcare professionals.',
    disclosure_version: 'v',
    features: { streaming: true, saved_history: true, think_deeper: false, deep_research: false,
                document_analysis: false, image_analysis: false },
    token_costs: {},
  };
  const FINAL = {
    response: 'Answer [1].', conversation_id: 'aed-u1-abc', intent: 'MEDICATION', mode: 'instant',
    request_type: 'standard', urgent: false, outcome: 'answered', cited: [1], tokens_charged: 1,
    answered_locally: false, limited_by_plan: null, missing_information: [], saved: true,
    sources: [{ n: 1, source: 'openFDA', id: 's', title: 'Metformin label', url: 'https://x', evidence_type: 'drug_label' }],
    resources: [{ kind: 'case', id: 'c1', title: 'Metformin and lactic acidosis', subtitle: '2 answers', path: '/case/c1' }],
  };

  beforeEach(() => {
    mockConfig.mockResolvedValue(CONFIG);
    mockStream.mockReset();
    mockFeedback.mockClear();
    mockPush.mockClear();
    mockStream.mockImplementation(async (_t: string, _i: any, onEvent: (e: any) => void) => {
      onEvent({ type: 'meta', run_id: 'run-1', conversation_id: 'aed-u1-abc', mode: 'instant',
                request_type: 'standard', tokens_charged: 1 });
      return FINAL;
    });
  });
  afterAll(() => mockConfig.mockResolvedValue(null));

  async function answer() {
    render(<AEDChatScreen />);
    await waitFor(() => expect(screen.getByTestId('aed-history-btn')).toBeTruthy());
    fireEvent.changeText(screen.getByTestId('aed-chat-input'), 'Contraindications of metformin?');
    await act(async () => { fireEvent.press(screen.getByTestId('aed-send-btn')); });
    await waitFor(() => expect(screen.getByTestId('aed-feedback')).toBeTruthy());
  }

  it('shows related ForMeds content apart from the cited sources, and opens it', async () => {
    await answer();
    expect(screen.getByTestId('aed-resources')).toBeTruthy();
    fireEvent.press(screen.getByTestId('aed-resource-c1'));
    expect(mockPush).toHaveBeenCalledWith('/case/c1');
    expect(screen.getByText('Saved')).toBeTruthy();
  });

  it('sends a thumbs-up for the run at once', async () => {
    await answer();
    await act(async () => { fireEvent.press(screen.getByTestId('aed-thumb-up')); });
    expect(mockFeedback).toHaveBeenCalledWith('t', { run_id: 'run-1', rating: 'up' });
  });

  it('asks what was wrong before sending a thumbs-down', async () => {
    await answer();
    await act(async () => { fireEvent.press(screen.getByTestId('aed-thumb-down')); });
    expect(mockFeedback).not.toHaveBeenCalled();
    fireEvent.press(screen.getByTestId('aed-reason-outdated'));
    fireEvent.press(screen.getByTestId('aed-reason-not_india_specific'));
    await act(async () => { fireEvent.press(screen.getByTestId('aed-feedback-send')); });
    expect(mockFeedback).toHaveBeenCalledWith('t', { run_id: 'run-1', rating: 'down',
                                                     reasons: ['outdated', 'not_india_specific'] });
  });

  it('opens saved history from the header', async () => {
    render(<AEDChatScreen />);
    await waitFor(() => expect(screen.getByTestId('aed-history-btn')).toBeTruthy());
    fireEvent.press(screen.getByTestId('aed-history-btn'));
    expect(mockPush).toHaveBeenCalledWith('/aed/history');
  });
});
