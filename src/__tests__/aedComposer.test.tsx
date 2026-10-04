import React from 'react';
import { Platform } from 'react-native';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';

/**
 * AED's question box: Enter sends on web (Shift+Enter adds a line), dictation
 * fills the box live from the platform's free recogniser, and the mic is
 * hidden where no recogniser exists.
 */

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: jest.fn(), replace: jest.fn(), back: jest.fn() }),
  useLocalSearchParams: () => ({}),
}));
jest.mock('expo-image-picker', () => ({}));
jest.mock('expo-document-picker', () => ({}));
jest.mock('../context/AuthContext', () => ({
  useAuth: () => ({ token: 't', user: { id: 'u1', role: 'healthcare_professional' } }),
}));
const mockAsk = jest.fn();
jest.mock('../api/aed', () => ({
  ...jest.requireActual('../api/aed'),
  askAed: (...args: any[]) => mockAsk(...args),
  fetchAedHistory: jest.fn(async () => []),
  clearAedHistory: jest.fn(async () => ({})),
}));
jest.mock('../api/subscriptions', () => ({
  fetchMySubscription: jest.fn(async () => { throw new Error('offline'); }),
  fetchPlans: jest.fn(async () => ({ plans: [] })),
}));
jest.mock('../api/aedStream', () => ({
  ...jest.requireActual('../api/aedStream'),
  fetchAedConfig: jest.fn(async () => null),
}));
const mockCopy = jest.fn(async (_text: string) => true);
jest.mock('expo-clipboard', () => ({ setStringAsync: (text: string) => mockCopy(text) }));

// A stand-in for the platform recogniser: tests fire its events by hand.
const listeners: Record<string, ((ev: any) => void)[]> = {};
const mockRecognizer = {
  available: true,
  isRecognitionAvailable: () => mockRecognizer.available,
  requestPermissionsAsync: jest.fn(async () => ({ granted: true })),
  start: jest.fn(),
  stop: jest.fn(),
  abort: jest.fn(),
  addListener: (event: string, fn: (ev: any) => void) => {
    (listeners[event] ||= []).push(fn);
    return { remove: () => { listeners[event] = listeners[event].filter(f => f !== fn); } };
  },
};
jest.mock('expo-speech-recognition', () => ({ ExpoSpeechRecognitionModule: mockRecognizer }), { virtual: true });
const fire = (event: string, payload?: any) => act(() => { (listeners[event] || []).forEach(fn => fn(payload)); });

// eslint-disable-next-line import/first
import AEDChatScreen, { answerForClipboard } from '../../app/aed-chat';
// eslint-disable-next-line import/first
import { resetSpeechModule } from '../hooks/useDictation';

const enter = (shiftKey = false) => {
  const preventDefault = jest.fn();
  fireEvent(screen.getByTestId('aed-chat-input'), 'keyPress', { nativeEvent: { key: 'Enter', shiftKey }, preventDefault });
  return preventDefault;
};

beforeEach(() => {
  mockAsk.mockReset().mockResolvedValue({ response: 'An answer.', session_id: 's1', urgent: false, sources: [] });
  mockRecognizer.available = true;
  mockRecognizer.start.mockClear();
  mockRecognizer.stop.mockClear();
  Object.keys(listeners).forEach(k => delete listeners[k]);
  resetSpeechModule();
});

describe('Enter to send', () => {
  afterEach(() => jest.restoreAllMocks());

  it('sends on Enter and adds a line on Shift+Enter, on web', async () => {
    jest.replaceProperty(Platform, 'OS', 'web');
    render(<AEDChatScreen />);
    fireEvent.changeText(screen.getByTestId('aed-chat-input'), 'Dose of amoxicillin in children?');
    expect(enter(true)).not.toHaveBeenCalled();
    expect(mockAsk).not.toHaveBeenCalled();
    expect(enter()).toHaveBeenCalled();
    await waitFor(() => expect(mockAsk).toHaveBeenCalled());
    expect(mockAsk.mock.calls[0][1]).toBe('Dose of amoxicillin in children?');
  });

  it('does not send an empty box', () => {
    jest.replaceProperty(Platform, 'OS', 'web');
    render(<AEDChatScreen />);
    enter();
    expect(mockAsk).not.toHaveBeenCalled();
  });

  it('leaves Enter as a new line on a phone keyboard', () => {
    render(<AEDChatScreen />);
    fireEvent.changeText(screen.getByTestId('aed-chat-input'), 'Line one');
    expect(enter()).not.toHaveBeenCalled();
    expect(mockAsk).not.toHaveBeenCalled();
  });
});

describe('Dictation', () => {
  it('fills the box live after what was typed, then stops on demand', async () => {
    render(<AEDChatScreen />);
    fireEvent.changeText(screen.getByTestId('aed-chat-input'), 'Case:');
    fireEvent.press(screen.getByTestId('aed-mic-btn'));
    await waitFor(() => expect(mockRecognizer.start).toHaveBeenCalled());
    expect(mockRecognizer.start.mock.calls[0][0]).toMatchObject({ lang: 'en-IN', interimResults: true, continuous: true });
    fire('start');
    expect(screen.getByTestId('aed-listening')).toBeTruthy();
    expect(screen.getByLabelText('Stop dictation')).toBeTruthy();

    fire('result', { isFinal: false, results: [{ transcript: '45 year old' }] });
    expect(screen.getByTestId('aed-chat-input').props.value).toBe('Case: 45 year old');
    fire('result', { isFinal: true, results: [{ transcript: '45 year old with chest pain' }] });
    fire('result', { isFinal: false, results: [{ transcript: 'for two hours' }] });
    expect(screen.getByTestId('aed-chat-input').props.value).toBe('Case: 45 year old with chest pain for two hours');

    fireEvent.press(screen.getByTestId('aed-mic-btn'));
    expect(mockRecognizer.stop).toHaveBeenCalled();
    fire('end');
    expect(screen.queryByTestId('aed-listening')).toBeNull();
  });

  it('stops listening when the question is sent', async () => {
    render(<AEDChatScreen />);
    fireEvent.press(screen.getByTestId('aed-mic-btn'));
    await waitFor(() => expect(mockRecognizer.start).toHaveBeenCalled());
    fire('start');
    fire('result', { isFinal: true, results: [{ transcript: 'What is the dose of ceftriaxone' }] });
    fireEvent.press(screen.getByTestId('aed-send-btn'));
    expect(mockRecognizer.stop).toHaveBeenCalled();
    await waitFor(() => expect(mockAsk).toHaveBeenCalled());
    expect(mockAsk.mock.calls[0][1]).toBe('What is the dose of ceftriaxone');
  });

  it('handles recognisers that repeat the whole session in every result (iOS)', async () => {
    render(<AEDChatScreen />);
    fireEvent.press(screen.getByTestId('aed-mic-btn'));
    await waitFor(() => expect(mockRecognizer.start).toHaveBeenCalled());
    fire('start');
    fire('result', { isFinal: true, results: [{ transcript: 'Fever for three days' }] });
    fire('result', { isFinal: false, results: [{ transcript: 'Fever for three days with rash' }] });
    expect(screen.getByTestId('aed-chat-input').props.value).toBe('Fever for three days with rash');
    fire('result', { isFinal: true, results: [{ transcript: 'Fever for three days with rash on the trunk' }] });
    expect(screen.getByTestId('aed-chat-input').props.value).toBe('Fever for three days with rash on the trunk');
  });

  it('explains a refused microphone instead of failing silently', async () => {
    mockRecognizer.requestPermissionsAsync.mockResolvedValueOnce({ granted: false });
    render(<AEDChatScreen />);
    fireEvent.press(screen.getByTestId('aed-mic-btn'));
    await waitFor(() => expect(screen.getByTestId('aed-dictation-error')).toBeTruthy());
    expect(mockRecognizer.start).not.toHaveBeenCalled();
  });

  it('hides the mic where there is no recogniser (Expo Go, Firefox)', () => {
    mockRecognizer.available = false;
    render(<AEDChatScreen />);
    expect(screen.queryByTestId('aed-mic-btn')).toBeNull();
  });
});

describe('Copy', () => {
  it('copies the answer with its sources listed', async () => {
    render(<AEDChatScreen />);
    fireEvent.changeText(screen.getByTestId('aed-chat-input'), 'Explain the anion gap');
    fireEvent.press(screen.getByTestId('aed-send-btn'));
    await waitFor(() => expect(screen.getByTestId('aed-copy')).toBeTruthy());
    fireEvent.press(screen.getByTestId('aed-copy'));
    await waitFor(() => expect(mockCopy).toHaveBeenCalledWith('An answer.'));
    expect(screen.getByLabelText('Copied')).toBeTruthy();
  });

  it('formats numbered sources after the text', () => {
    const text = answerForClipboard({
      content: 'Use X [1].\n',
      citations: [{ n: 1, id: 'p', title: 'A trial', year: '2024', url: 'https://pubmed.ncbi.nlm.nih.gov/1/' } as any],
    });
    expect(text).toBe('Use X [1].\n\nSources:\n[1] A trial (2024) https://pubmed.ncbi.nlm.nih.gov/1/');
  });
});

describe('greeting by name', () => {
  it('uses the given name, not a title', () => {
    const { givenName } = jest.requireActual('../../app/aed-chat');
    expect(givenName('Dr. Demo Sharma')).toBe('Demo');
    expect(givenName('Nurse Demo Iyer')).toBe('Demo');
    expect(givenName(undefined)).toBe('');
  });
});
