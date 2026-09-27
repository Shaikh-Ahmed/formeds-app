/**
 * Subscriptions client. The app sends a plan code and a billing cycle -- never
 * a price, a user or a token amount. The server prices everything.
 */

import { apiFetch } from '../utils/api';
import type {
  AedWallet, BillingCycle, Catalog, Checkout, SubscriptionView, TokenTransaction,
} from '../types/subscriptions';

export const fetchPlans = (token: string | null): Promise<Catalog> =>
  apiFetch('/api/subscriptions/plans', token);

export const fetchMySubscription = (token: string): Promise<SubscriptionView> =>
  apiFetch('/api/subscriptions/me', token);

export const fetchAedTokens = (
  token: string,
): Promise<AedWallet & { recent: TokenTransaction[] }> =>
  apiFetch('/api/subscriptions/aed-tokens', token);

export const startCheckout = (
  token: string, planCode: string, cycle: BillingCycle,
): Promise<Checkout> =>
  apiFetch('/api/subscriptions/checkout', token, {
    method: 'POST', body: JSON.stringify({ plan_code: planCode, billing_cycle: cycle }),
  });

export const fetchCheckout = (token: string, paymentId: string): Promise<Checkout> =>
  apiFetch(`/api/subscriptions/checkout/${encodeURIComponent(paymentId)}`, token);

/** DEMO ONLY: no money moves; `outcome` picks which path to exercise. */
export const payDemo = (
  token: string, paymentId: string, outcome: 'success' | 'failure',
  method: 'card' | 'upi' | 'netbanking',
): Promise<{ status: string; already_processed: boolean; subscription: SubscriptionView }> =>
  apiFetch(`/api/subscriptions/checkout/${encodeURIComponent(paymentId)}/demo-pay`, token, {
    method: 'POST', body: JSON.stringify({ outcome, method }),
  });

export const scheduleDowngrade = (token: string, planCode: string): Promise<SubscriptionView> =>
  apiFetch('/api/subscriptions/downgrade', token, {
    method: 'POST', body: JSON.stringify({ plan_code: planCode }),
  });

export const cancelSubscription = (token: string): Promise<SubscriptionView> =>
  apiFetch('/api/subscriptions/cancel', token, { method: 'POST' });

export const resumeSubscription = (token: string): Promise<SubscriptionView> =>
  apiFetch('/api/subscriptions/resume', token, { method: 'POST' });
