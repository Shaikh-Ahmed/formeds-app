import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import type { PaymentRecord } from '../types/subscriptions';

/**
 * Payment history renders what /subscriptions/history returned: paid, failed
 * and refunded payments with their gateway reference, and a clear empty state.
 */

const mockPush = jest.fn();
jest.mock('expo-router', () => {
  const R = require('react');
  return {
    useRouter: () => ({ push: mockPush, replace: jest.fn(), back: jest.fn() }),
    useFocusEffect: (cb: () => void) => R.useEffect(cb, [cb]),
  };
});
jest.mock('../context/AuthContext', () => ({
  useAuth: () => ({ token: 't', user: { id: 'u1', role: 'healthcare_professional' } }),
}));
const mockHistory = jest.fn();
jest.mock('../api/subscriptions', () => ({
  fetchBillingHistory: (...a: any[]) => mockHistory(...a),
}));
const mockCopy = jest.fn();
jest.mock('../utils/share', () => ({ copyText: (...a: any[]) => mockCopy(...a) }));

// eslint-disable-next-line import/first
import PaymentHistoryScreen, { paidWith } from '../../app/payment-history';

const pay = (over: Partial<PaymentRecord>): PaymentRecord => ({
  id: 'p1', plan: 'ProCare', amount: 299, currency: 'INR', status: 'succeeded', purpose: 'new',
  provider: 'razorpay', billing_cycle: 'monthly', paid_at: '2026-10-02T10:00:00+00:00',
  created_at: '2026-10-02T09:59:00+00:00', reference: 'pay_ABC123', method: 'upi', failure_reason: '',
  test_mode: true, ...over,
});

beforeEach(() => { mockHistory.mockReset(); mockCopy.mockReset(); mockPush.mockReset(); });

it('lists payments with status, total paid and the Razorpay payment ID', async () => {
  mockHistory.mockResolvedValue({
    subscriptions: [],
    payments: [
      pay({ id: 'p2', plan: 'MedElite', amount: 6990, billing_cycle: 'yearly', purpose: 'upgrade', reference: 'pay_XYZ' }),
      pay({ id: 'p1' }),
      pay({ id: 'p0', status: 'failed', provider: 'demo', reference: 'demo_1', failure_reason: 'Card declined', test_mode: false }),
    ],
  });
  render(<PaymentHistoryScreen />);
  await waitFor(() => expect(screen.getByTestId('payment-summary')).toBeTruthy(), { timeout: 8000 });

  expect(screen.getByText('₹7,289')).toBeTruthy(); // failed payments are not counted
  expect(screen.getByText('MedElite · Yearly')).toBeTruthy();
  expect(screen.getAllByText('Paid')).toHaveLength(2);
  expect(screen.getByText('Failed')).toBeTruthy();
  expect(screen.getByText('Card declined')).toBeTruthy();
  expect(screen.getByText('Payment ID pay_ABC123')).toBeTruthy();
  // Demo references are internal; only gateway IDs are shown.
  expect(screen.queryByTestId('payment-ref-p0')).toBeNull();

  mockCopy.mockResolvedValue(true);
  fireEvent.press(screen.getByTestId('payment-ref-p1'));
  expect(mockCopy).toHaveBeenCalledWith('pay_ABC123');
  await waitFor(() => expect(screen.getByText('Payment ID copied')).toBeTruthy(), { timeout: 8000 });
});

it('shows an empty state that leads to the plans', async () => {
  mockHistory.mockResolvedValue({ subscriptions: [], payments: [] });
  render(<PaymentHistoryScreen />);
  await waitFor(() => expect(screen.getByText('No payments yet')).toBeTruthy(), { timeout: 8000 });
  fireEvent.press(screen.getByTestId('payment-history-plans'));
  expect(mockPush).toHaveBeenCalledWith('/subscription');
});

it('shows a retryable error', async () => {
  mockHistory.mockRejectedValueOnce(new Error('Network down'));
  render(<PaymentHistoryScreen />);
  await waitFor(() => expect(screen.getByText('Network down')).toBeTruthy(), { timeout: 8000 });
});

it('describes how a payment was made', () => {
  expect(paidWith(pay({ method: 'card' }))).toBe('Card · Razorpay');
  expect(paidWith(pay({ method: '' }))).toBe('Razorpay');
  expect(paidWith(pay({ provider: 'demo' }))).toBe('Demo payment');
});
