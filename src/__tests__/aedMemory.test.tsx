import React from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';

/**
 * AED memory screens: chats are saved by default and listed like any chat
 * assistant's (grouped by date, New chat on top); a member can stop new chats
 * being saved and delete them; answer preferences are style only.
 */

const mockPush = jest.fn();
const mockBack = jest.fn();
const mockNavigate = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush, back: mockBack, replace: jest.fn(), navigate: mockNavigate }),
  useFocusEffect: (cb: () => void) => jest.requireActual('react').useEffect(cb, [cb]),
}));
jest.mock('../context/AuthContext', () => ({ useAuth: () => ({ token: 't', user: { id: 'u1' } }) }));

const mockApi = {
  setHistorySaving: jest.fn(async (_t: string, save: boolean) => ({ saving: save, retention_days: 365 })),
  fetchSavedConversations: jest.fn(),
  deleteSavedConversation: jest.fn(async () => ({})),
  deleteAllSavedConversations: jest.fn(async () => ({ deleted: 1 })),
  fetchPreferences: jest.fn(),
  savePreferences: jest.fn(async (_t: string, p: any) => ({ preferences: p })),
};
jest.mock('../api/aedMemory', () => {
  const actual = jest.requireActual('../api/aedMemory');
  // Resolved at call time: jest.mock runs before mockApi is defined.
  const names = ['setHistorySaving', 'fetchSavedConversations',
    'deleteSavedConversation', 'deleteAllSavedConversations', 'fetchPreferences', 'savePreferences'];
  return { ...actual, ...Object.fromEntries(names.map(k => [k, (...a: any[]) => (mockApi as any)[k](...a)])) };
});

// eslint-disable-next-line import/first
import AedHistoryScreen, { retentionLabel } from '../../app/aed/history';
// eslint-disable-next-line import/first
import { groupByDate } from '../components/aed/AedHistoryList';
// eslint-disable-next-line import/first
import AedPreferencesScreen from '../../app/aed/preferences';

beforeEach(() => {
  jest.clearAllMocks();
});

const iso = (daysAgo: number) => new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000).toISOString();
const chat = (id: string, title: string, daysAgo: number) =>
  ({ id, title, message_count: 2, created_at: iso(daysAgo), last_message_at: iso(daysAgo) });

describe('chat history', () => {
  it('lists chats grouped by date and opens one in AED', async () => {
    mockApi.fetchSavedConversations.mockResolvedValue({ saving: true, retention_days: 365, conversations: [
      chat('aed-u1-1', 'Metformin in CKD', 0), chat('aed-u1-2', 'Apixaban and clarithromycin', 3),
    ] });
    render(<AedHistoryScreen />);
    await waitFor(() => expect(screen.getByText('Metformin in CKD')).toBeTruthy());
    expect(screen.getByText('Today')).toBeTruthy();
    expect(screen.getByText('Previous 7 days')).toBeTruthy();
    fireEvent.press(screen.getByTestId('aed-history-aed-u1-1'));
    expect(mockNavigate).toHaveBeenCalledWith({ pathname: '/aed-chat', params: { c: 'aed-u1-1' } });
  });

  it('starts a new chat from the list', async () => {
    mockApi.fetchSavedConversations.mockResolvedValue({ saving: true, retention_days: 365, conversations: [] });
    render(<AedHistoryScreen />);
    await waitFor(() => expect(screen.getByTestId('aed-history-empty')).toBeTruthy());
    fireEvent.press(screen.getByTestId('aed-history-new-chat'));
    expect(mockNavigate.mock.calls[0][0].params.new).toBeTruthy();
  });

  it('is saved by default for the period ForMeds sets, and can be turned off', async () => {
    mockApi.fetchSavedConversations.mockResolvedValue({ saving: true, retention_days: 365, conversations: [
      chat('aed-u1-1', 'Metformin in CKD', 0)] });
    render(<AedHistoryScreen />);
    await waitFor(() => expect(screen.getByText(/kept for 12 months after your last message/)).toBeTruthy());
    await act(async () => { fireEvent(screen.getByTestId('aed-history-saving'), 'valueChange', false); });
    expect(mockApi.setHistorySaving).toHaveBeenCalledWith('t', false);
    expect(screen.getByText(/New chats are forgotten after 24 hours/)).toBeTruthy();
  });

  it('says when saving new chats is off', async () => {
    mockApi.fetchSavedConversations.mockResolvedValue({ saving: false, retention_days: 365, conversations: [] });
    render(<AedHistoryScreen />);
    await waitFor(() => expect(screen.getByTestId('aed-history-saving-off')).toBeTruthy());
  });

  it('groups by Today, Yesterday, the past week and month, then by month', () => {
    const now = new Date(2026, 9, 3, 12);
    const at = (d: Date) => ({ ...chat('x' + d.getTime(), 't', 0), last_message_at: d.toISOString() });
    const groups = groupByDate([at(new Date(2026, 9, 3, 9)), at(new Date(2026, 9, 2, 20)), at(new Date(2026, 8, 29)),
      at(new Date(2026, 8, 10)), at(new Date(2026, 5, 1))], now);
    expect(groups.map(g => g.label)).toEqual(['Today', 'Yesterday', 'Previous 7 days', 'Previous 30 days', 'June 2026']);
    expect(retentionLabel(365)).toBe('12 months');
    expect(retentionLabel(90)).toBe('3 months');
  });
});

describe('answer preferences', () => {
  it('saves the chosen style', async () => {
    mockApi.fetchPreferences.mockResolvedValue({ available: true, preferences: {
      answer_depth: 'standard', units: 'conventional', drug_naming: 'generic', language: 'en',
      preferred_guidelines: [], notes: '' } });
    render(<AedPreferencesScreen />);
    await waitFor(() => expect(screen.getByTestId('pref-depth-brief')).toBeTruthy());
    fireEvent.press(screen.getByTestId('pref-depth-brief'));
    fireEvent.press(screen.getByTestId('pref-units-si'));
    fireEvent.press(screen.getByTestId('pref-guideline-ICMR'));
    await act(async () => { fireEvent.press(screen.getByTestId('pref-save')); });
    expect(mockApi.savePreferences).toHaveBeenCalledWith('t', expect.objectContaining({
      answer_depth: 'brief', units: 'si', preferred_guidelines: ['ICMR'] }));
  });

  it('shows the server’s refusal when notes contain identifiers', async () => {
    mockApi.fetchPreferences.mockResolvedValue({ available: true, preferences: {
      answer_depth: 'standard', units: 'conventional', drug_naming: 'generic', language: 'en',
      preferred_guidelines: [], notes: '' } });
    mockApi.savePreferences.mockRejectedValueOnce({ message: "Preferences can't include patient or personal identifiers." });
    render(<AedPreferencesScreen />);
    await waitFor(() => expect(screen.getByTestId('pref-notes')).toBeTruthy());
    fireEvent.changeText(screen.getByTestId('pref-notes'), 'UHID 4471');
    await act(async () => { fireEvent.press(screen.getByTestId('pref-save')); });
    expect(screen.getByText("Preferences can't include patient or personal identifiers.")).toBeTruthy();
    expect(mockBack).not.toHaveBeenCalled();
  });
});
