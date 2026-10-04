/**
 * Plans, subscriptions and the AED token wallet, as the server sends them.
 *
 * Nothing here -- no price, no allowance, no feature list -- is defined in the
 * app. It all arrives from /api/subscriptions, so a plan change is a database
 * change, not a release.
 */

export type BillingCycle = 'monthly' | 'yearly';

export type Entitlements = Record<string, boolean | number | string>;

export interface Plan {
  code: string;
  name: string;
  tagline: string;
  description: string;
  rank: number;
  price_monthly: number;
  price_yearly: number;
  currency: string;
  entitlements: Entitlements;
}

export interface PlanFeature {
  code: string;
  label: string;
  description: string;
  value_type: 'bool' | 'int' | 'text';
}

export interface TokenCost {
  request_type: string;
  tokens: number;
  label: string;
}

export interface Catalog {
  plans: Plan[];
  features: PlanFeature[];
  token_costs: TokenCost[];
  current_plan: string | null;
  can_subscribe: boolean;
}

export interface AedWallet {
  plan_code: string;
  allocated: number;
  used: number;
  remaining: number;
  period_start: string;
  resets_at: string;
  low: boolean;
  exhausted: boolean;
}

export interface TokenTransaction {
  id: string;
  type: 'allocation' | 'debit' | 'refund' | 'adjustment';
  amount: number;
  balance_after: number;
  request_type: string;
  description: string;
  created_at: string;
}

export interface SubscriptionView {
  plan: Plan;
  can_subscribe: boolean;
  subscription: null | {
    id: string;
    status: string;
    billing_cycle: BillingCycle;
    started_at: string;
    current_period_start: string;
    current_period_end: string;
    cancel_at_period_end: boolean;
    scheduled_plan: { code: string; name: string } | null;
    /** False for a period paid once (Razorpay): it ends unless renewed. */
    auto_renews?: boolean;
  };
  aed_tokens: AedWallet;
}

export interface Checkout {
  payment_id: string;
  status: 'pending' | 'processing' | 'succeeded' | 'failed' | 'expired';
  plan: { code: string; name: string; tagline: string };
  billing_cycle: BillingCycle;
  purpose: 'new' | 'upgrade' | 'renewal';
  amount: number;
  currency: string;
  provider: string;
  demo: boolean;
  /** Razorpay test keys: no real money moves. */
  test_mode?: boolean;
  failure_reason: string;
  paid_at?: string | null;
}

/** A settled subscription payment, newest first, from /history. */
export interface PaymentRecord {
  id: string;
  plan: string;
  amount: number;
  currency: string;
  status: 'succeeded' | 'failed' | 'refunded';
  purpose: 'new' | 'upgrade' | 'renewal';
  provider: string;
  billing_cycle: BillingCycle;
  paid_at?: string | null;
  created_at?: string | null;
  /** The gateway's payment id (pay_...), for support and bank statements. */
  reference: string;
  method: string;
  failure_reason: string;
  test_mode: boolean;
}

export interface BillingHistory {
  payments: PaymentRecord[];
  subscriptions: {
    id: string; plan: string; status: string; billing_cycle: BillingCycle;
    started_at?: string | null; ended_at?: string | null; current_period_end: string;
  }[];
}

/** What Razorpay Checkout needs to open, from the server. Never a secret. */
export interface GatewayOrder {
  key_id: string;
  test_mode: boolean;
  payment_id: string;
  order_id: string;
  /** Integer paise. */
  amount: number;
  currency: string;
  name: string;
  description: string;
  prefill: { name?: string; email?: string; contact?: string };
}

/** What Razorpay Checkout returns on success; verified by the server. */
export interface GatewayResponse {
  razorpay_payment_id: string;
  razorpay_order_id: string;
  razorpay_signature: string;
}

/** "₹2,990" -- Indian digit grouping, whole rupees. */
export function formatRupees(amount: number): string {
  return `₹${amount.toLocaleString('en-IN')}`;
}

/** "1 Oct 2026". */
export function formatDay(iso?: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? ''
    : d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

/** "in 8 days" / "tomorrow" / "today". */
export function daysUntil(iso?: string | null, now: Date = new Date()): string {
  if (!iso) return '';
  const days = Math.ceil((new Date(iso).getTime() - now.getTime()) / 86400000);
  if (days <= 0) return 'today';
  if (days === 1) return 'tomorrow';
  return `in ${days} days`;
}
