/**
 * Subscriptions client. The app sends a plan code and a billing cycle -- never
 * a price, a user or a token amount. The server prices everything.
 */

import { apiFetch } from '../utils/api';
import type {
  AedWallet, BillingCycle, BillingHistory, Catalog, Checkout, GatewayOrder, GatewayResponse, SubscriptionView, TokenTransaction,
} from '../types/subscriptions';

export const fetchPlans = (token: string | null): Promise<Catalog> =>
  apiFetch('/api/subscriptions/plans', token);

export const fetchMySubscription = (token: string): Promise<SubscriptionView> =>
  apiFetch('/api/subscriptions/me', token);

export const fetchAedTokens = (
  token: string,
): Promise<AedWallet & { recent: TokenTransaction[] }> =>
  apiFetch('/api/subscriptions/aed-tokens', token);

/** Your settled subscription payments (paid, failed, refunded), newest first. */
export const fetchBillingHistory = (token: string): Promise<BillingHistory> =>
  apiFetch('/api/subscriptions/history', token);

export const startCheckout = (
  token: string, planCode: string, cycle: BillingCycle, idempotencyKey?: string,
): Promise<Checkout> =>
  apiFetch('/api/subscriptions/checkout', token, {
    method: 'POST', body: JSON.stringify({ plan_code: planCode, billing_cycle: cycle }), idempotencyKey,
  });

export const fetchCheckout = (token: string, paymentId: string): Promise<Checkout> =>
  apiFetch(`/api/subscriptions/checkout/${encodeURIComponent(paymentId)}`, token);

/**
 * The Razorpay order for a checkout. The server creates it once (repeat calls
 * return the same order) at the amount it priced; nothing is sent from here.
 */
export const createPaymentOrder = (token: string, paymentId: string, idempotencyKey?: string): Promise<GatewayOrder> =>
  apiFetch(`/api/subscriptions/checkout/${encodeURIComponent(paymentId)}/order`, token, {
    method: 'POST', idempotencyKey,
  });

/**
 * Hand Razorpay's success response to the server, which verifies the
 * signature and the payment before activating anything. Safe to repeat.
 */
export const verifyPayment = (
  token: string, paymentId: string, response: GatewayResponse,
): Promise<{ status: string; already_processed: boolean; checkout: Checkout; subscription: SubscriptionView }> =>
  apiFetch(`/api/subscriptions/checkout/${encodeURIComponent(paymentId)}/verify`, token, {
    method: 'POST', body: JSON.stringify(response),
  });

/** Note a failed attempt for support. Changes nothing; the checkout stays open. */
export const reportPaymentFailure = (token: string, paymentId: string, reason: string): Promise<Checkout> =>
  apiFetch(`/api/subscriptions/checkout/${encodeURIComponent(paymentId)}/failed`, token, {
    method: 'POST', body: JSON.stringify({ reason: reason.slice(0, 250) }),
  });

/** DEMO ONLY (development without Razorpay keys): no money moves. */
export const payDemo = (
  token: string, paymentId: string, outcome: 'success' | 'failure',
  method: 'card' | 'upi' | 'netbanking',
  idempotencyKey?: string,
): Promise<{ status: string; already_processed: boolean; subscription: SubscriptionView }> =>
  apiFetch(`/api/subscriptions/checkout/${encodeURIComponent(paymentId)}/demo-pay`, token, {
    method: 'POST', body: JSON.stringify({ outcome, method }), idempotencyKey,
  });

export const scheduleDowngrade = (token: string, planCode: string): Promise<SubscriptionView> =>
  apiFetch('/api/subscriptions/downgrade', token, {
    method: 'POST', body: JSON.stringify({ plan_code: planCode }),
  });

export const cancelSubscription = (token: string): Promise<SubscriptionView> =>
  apiFetch('/api/subscriptions/cancel', token, { method: 'POST' });

export const resumeSubscription = (token: string): Promise<SubscriptionView> =>
  apiFetch('/api/subscriptions/resume', token, { method: 'POST' });
