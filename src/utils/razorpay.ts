import { Platform } from 'react-native';
import type { GatewayOrder, GatewayResponse } from '../types/subscriptions';

/**
 * Razorpay Standard Checkout, as one awaitable call.
 *
 * Razorpay's own modal collects the payment -- this app never sees card or
 * UPI details. All this does is load checkout.js, open the modal for an order
 * the server created, and report how it ended:
 *
 *   'paid'      -> the response to send to the server for verification
 *                  (it is NOT proof of payment until the server says so)
 *   'failed'    -> Razorpay reported a failed attempt
 *   'dismissed' -> the member closed the modal
 *
 * Web only: in the native app checkout.js cannot run (that needs Razorpay's
 * native SDK), so callers check `razorpaySupported` first.
 */

const SCRIPT_URL = 'https://checkout.razorpay.com/v1/checkout.js';
const LOAD_TIMEOUT_MS = 15000;

export const razorpaySupported = Platform.OS === 'web' && typeof window !== 'undefined';

export type CheckoutOutcome =
  | { kind: 'paid'; response: GatewayResponse }
  | { kind: 'failed'; reason: string }
  | { kind: 'dismissed' };

let loading: Promise<void> | null = null;

/** Load checkout.js once; a failed load can be retried. */
export function loadRazorpay(): Promise<void> {
  if (!razorpaySupported) return Promise.reject(new Error('Payments open on the ForMeds website.'));
  if ((window as any).Razorpay) return Promise.resolve();
  if (loading) return loading;
  loading = new Promise<void>((resolve, reject) => {
    const script = document.createElement('script');
    script.src = SCRIPT_URL;
    script.async = true;
    const timer = setTimeout(() => fail('The payment window took too long to load.'), LOAD_TIMEOUT_MS);
    function fail(message: string) {
      clearTimeout(timer);
      script.remove();
      loading = null;
      reject(new Error(message));
    }
    script.onload = () => {
      clearTimeout(timer);
      if ((window as any).Razorpay) resolve();
      else fail('The payment window could not start.');
    };
    script.onerror = () => fail('Could not load the payment window. Check your connection and try again.');
    document.body.appendChild(script);
  });
  return loading;
}

/** Open Razorpay Checkout for a server-created order. */
export async function openRazorpay(order: GatewayOrder, themeColor: string): Promise<CheckoutOutcome> {
  await loadRazorpay();
  return new Promise<CheckoutOutcome>(resolve => {
    let settled = false;
    const done = (outcome: CheckoutOutcome) => { if (!settled) { settled = true; resolve(outcome); } };
    const rzp = new (window as any).Razorpay({
      key: order.key_id,
      order_id: order.order_id,
      amount: order.amount,
      currency: order.currency,
      name: order.name,
      description: order.description,
      prefill: order.prefill,
      theme: { color: themeColor },
      // Notes stay on the server-created order; nothing personal is added here.
      handler: (response: GatewayResponse) => done({ kind: 'paid', response }),
      modal: {
        // Razorpay keeps the modal open after a failed attempt so the member
        // can retry; closing it then is reported as the failure, not a cancel.
        ondismiss: () => done(lastFailure ? { kind: 'failed', reason: lastFailure } : { kind: 'dismissed' }),
        escape: true,
        confirm_close: true,
      },
      retry: { enabled: true },
    });
    let lastFailure = '';
    rzp.on('payment.failed', (resp: any) => {
      lastFailure = resp?.error?.description || 'The payment was declined.';
    });
    rzp.open();
  });
}
