import React from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { planHighlights, planPrice } from '../components/subscriptions/PlanCard';
import { PlanCompare } from '../components/subscriptions/PlanCompare';
import { AedTokenMeter } from '../components/subscriptions/AedTokenMeter';
import { daysUntil, formatRupees, type AedWallet, type Plan, type PlanFeature } from '../types/subscriptions';

/**
 * Plans on the client. The important promise is negative: nothing here knows
 * a price, an allowance or a feature list -- it renders what the server sent.
 */

const mockReplace = jest.fn();
const mockPush = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush, replace: mockReplace, back: jest.fn(), setParams: jest.fn() }),
  useLocalSearchParams: () => ({ payment: 'pay-1' }),
}));
jest.mock('../context/AuthContext', () => ({
  useAuth: () => ({ token: 't', user: { id: 'u1', role: 'healthcare_professional' } }),
}));

const mockFetchCheckout = jest.fn();
const mockPayDemo = jest.fn();
jest.mock('../api/subscriptions', () => ({
  fetchCheckout: (...a: any[]) => mockFetchCheckout(...a),
  payDemo: (...a: any[]) => mockPayDemo(...a),
  startCheckout: jest.fn(),
}));

// eslint-disable-next-line import/first
import CheckoutScreen from '../../app/checkout';

const FEATURES: PlanFeature[] = [
  { code: 'JOBS', label: 'Jobs', description: '', value_type: 'bool' },
  { code: 'AED_MONTHLY_TOKENS', label: 'AED tokens per month', description: '', value_type: 'int' },
  { code: 'AED_DOCUMENT_ANALYSIS', label: 'AED medical document analysis', description: '', value_type: 'bool' },
  { code: 'AED_IMAGE_ANALYSIS', label: 'AED medical image analysis', description: '', value_type: 'bool' },
];

const plan = (code: string, rank: number, m: number, y: number, e: Record<string, any>): Plan => ({
  code, name: code === 'core' ? 'Core' : code === 'procare' ? 'ProCare' : 'MedElite',
  tagline: '', description: '', rank, price_monthly: m, price_yearly: y, currency: 'INR', entitlements: e,
});
const CORE = plan('core', 0, 0, 0, { JOBS: true, AED_MONTHLY_TOKENS: 100, AED_DOCUMENT_ANALYSIS: false, AED_IMAGE_ANALYSIS: false });
const PRO = plan('procare', 1, 299, 2990, { JOBS: true, AED_MONTHLY_TOKENS: 1000, AED_DOCUMENT_ANALYSIS: true, AED_IMAGE_ANALYSIS: false });
const ELITE = plan('medelite', 2, 699, 6990, { JOBS: true, AED_MONTHLY_TOKENS: 3000, AED_DOCUMENT_ANALYSIS: true, AED_IMAGE_ANALYSIS: true });

const wallet = (over: Partial<AedWallet> = {}): AedWallet => ({
  plan_code: 'procare', allocated: 1000, used: 280, remaining: 720, period_start: '',
  resets_at: new Date(Date.now() + 8 * 86400000).toISOString(), low: false, exhausted: false, ...over,
});

describe('plan presentation', () => {
  it('prices from the plan row, in rupees with Indian grouping', () => {
    expect(planPrice(PRO, 'monthly')).toEqual({ amount: '₹299', period: '/ month' });
    expect(planPrice(ELITE, 'yearly')).toEqual({ amount: '₹6,990', period: '/ year' });
    expect(planPrice(CORE, 'monthly').amount).toBe('Free');
    expect(formatRupees(299000)).toBe('₹2,99,000');
  });

  it('lists only what each tier adds over the one below', () => {
    expect(planHighlights(PRO, CORE, FEATURES)).toEqual(['Everything in Core', 'AED medical document analysis']);
    expect(planHighlights(ELITE, PRO, FEATURES)).toEqual(['Everything in ProCare', 'AED medical image analysis']);
  });

  it('compares plans from the catalogue, with words for screen readers', () => {
    render(<PlanCompare plans={[CORE, PRO, ELITE]} features={FEATURES} />);
    expect(screen.getByText('3,000')).toBeTruthy();
    expect(screen.getByLabelText('AED medical image analysis: not in ProCare')).toBeTruthy();
  });

  it('says when a reset is due in plain words', () => {
    const now = new Date('2026-09-23T10:00:00Z');
    expect(daysUntil('2026-10-01T00:00:00Z', now)).toBe('in 8 days');
    expect(daysUntil('2026-09-24T09:00:00Z', now)).toBe('tomorrow');
  });
});

describe('AedTokenMeter', () => {
  it('shows the balance, calmly when low, and plainly when spent', () => {
    const { rerender } = render(<AedTokenMeter wallet={wallet()} />);
    expect(screen.getByText('720 / 1,000 tokens remaining')).toBeTruthy();
    rerender(<AedTokenMeter wallet={wallet({ remaining: 180, used: 820, low: true })} />);
    expect(screen.getByText('180 AED tokens remaining.')).toBeTruthy();
    rerender(<AedTokenMeter wallet={wallet({ remaining: 0, used: 1000, low: true, exhausted: true })} />);
    expect(screen.getByText('Your AED tokens have been used for this billing period.')).toBeTruthy();
  });
});

describe('Demo checkout', () => {
  const CHECKOUT = {
    payment_id: 'pay-1', status: 'pending', plan: { code: 'procare', name: 'ProCare', tagline: 'Professional' },
    billing_cycle: 'monthly', purpose: 'new', amount: 299, currency: 'INR', provider: 'demo', demo: true,
    failure_reason: '',
  };

  beforeEach(() => { mockFetchCheckout.mockReset(); mockPayDemo.mockReset(); mockReplace.mockReset(); });

  it('says it is a demo and shows the server-priced amount', async () => {
    mockFetchCheckout.mockResolvedValue(CHECKOUT);
    render(<CheckoutScreen />);
    await waitFor(() => expect(screen.getByText('Pay ₹299 (Demo)')).toBeTruthy());
    expect(screen.getByText('Demo payment — no real money will be charged.')).toBeTruthy();
  });

  it('activates on a successful demo payment and shows the new allowance', async () => {
    mockFetchCheckout.mockResolvedValue(CHECKOUT);
    mockPayDemo.mockResolvedValue({ status: 'succeeded', already_processed: false,
      subscription: { aed_tokens: wallet({ remaining: 1000, used: 0 }) } });
    render(<CheckoutScreen />);
    await waitFor(() => screen.getByTestId('pay-success'));
    await act(async () => { fireEvent.press(screen.getByTestId('pay-success')); });
    await waitFor(() => expect(screen.getByTestId('checkout-success')).toBeTruthy());
    expect(mockPayDemo).toHaveBeenCalledWith('t', 'pay-1', 'success', 'card');
    expect(screen.getByText('1,000 AED tokens allocated for this month.')).toBeTruthy();
  });

  it('leaves the plan alone when the demo payment fails', async () => {
    mockFetchCheckout.mockResolvedValue(CHECKOUT);
    mockPayDemo.mockRejectedValue({ code: 'payment_failed', status: 402 });
    render(<CheckoutScreen />);
    await waitFor(() => screen.getByTestId('pay-failure'));
    await act(async () => { fireEvent.press(screen.getByTestId('pay-failure')); });
    await waitFor(() => expect(screen.getByTestId('checkout-failed')).toBeTruthy());
    expect(screen.getByText('Demo payment failed. Your subscription has not been changed.')).toBeTruthy();
  });
});
