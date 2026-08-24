import Razorpay from 'razorpay';
import crypto from 'node:crypto';
import { env } from '../config/env.js';
import { AppError } from '../utils/AppError.js';
import { logger } from '../utils/logger.js';

let razorpayInstance = null;

function getRazorpayClient() {
  if (env.razorpay.mockMode) return null;
  if (!env.razorpay.keyId || !env.razorpay.keySecret) {
    throw AppError.badRequest(
      'Payments are not configured on the server yet. Set RAZORPAY_KEY_ID / RAZORPAY_KEY_SECRET.',
      'PAYMENTS_NOT_CONFIGURED'
    );
  }
  if (!razorpayInstance) {
    razorpayInstance = new Razorpay({ key_id: env.razorpay.keyId, key_secret: env.razorpay.keySecret });
  }
  return razorpayInstance;
}

/**
 * Creates a Razorpay order for the given amount. In PAYMENTS_MOCK_MODE
 * (local dev / automated tests without real Razorpay keys), a
 * deterministic fake order is returned instead of calling the Razorpay
 * API, so the rest of the purchase flow (order persistence, enrollment
 * gating, signature verification logic) can still be exercised end to end.
 */
export async function createRazorpayOrder({ amountInPaise, currency = 'INR', receipt, notes }) {
  if (env.razorpay.mockMode) {
    const fakeId = `order_MOCK${crypto.randomBytes(8).toString('hex')}`;
    logger.warn(`[Payments] MOCK MODE - simulated Razorpay order ${fakeId}. Set PAYMENTS_MOCK_MODE=false with real keys for production.`);
    return { id: fakeId, amount: amountInPaise, currency, receipt, status: 'created' };
  }

  const client = getRazorpayClient();
  try {
    const order = await client.orders.create({
      amount: amountInPaise,
      currency,
      receipt,
      notes,
    });
    return order;
  } catch (err) {
    logger.error('[Payments] Razorpay order creation failed', err.message);
    throw AppError.badRequest('Unable to initiate payment right now. Please try again.', 'PAYMENT_ORDER_FAILED');
  }
}

/**
 * Verifies the HMAC-SHA256 signature Razorpay returns after checkout.
 * This is pure cryptography (no network call) - the backend NEVER trusts
 * a client-asserted "payment successful" flag (master doc section 30/63).
 */
export function verifyPaymentSignature({ orderId, paymentId, signature }) {
  if (env.razorpay.mockMode) {
    // Deterministic mock signature so integration tests can exercise the
    // full verify path without a real Razorpay checkout.
    const expected = crypto
      .createHmac('sha256', 'mock_secret')
      .update(`${orderId}|${paymentId}`)
      .digest('hex');
    return signature === expected;
  }

  if (!env.razorpay.keySecret) {
    throw AppError.badRequest('Payments are not configured on the server yet.', 'PAYMENTS_NOT_CONFIGURED');
  }

  const expected = crypto
    .createHmac('sha256', env.razorpay.keySecret)
    .update(`${orderId}|${paymentId}`)
    .digest('hex');

  // Constant-time compare to avoid timing attacks.
  const a = Buffer.from(expected, 'hex');
  const b = Buffer.from(signature || '', 'hex');
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

export function verifyWebhookSignature(rawBody, signature) {
  if (!env.razorpay.webhookSecret) return false;
  const expected = crypto.createHmac('sha256', env.razorpay.webhookSecret).update(rawBody).digest('hex');
  try {
    return crypto.timingSafeEqual(Buffer.from(expected, 'hex'), Buffer.from(signature || '', 'hex'));
  } catch {
    return false;
  }
}

export function mockSignatureFor(orderId, paymentId) {
  // Exposed only so the test suite / mock-mode client helper can build a
  // valid signature without needing real Razorpay credentials.
  return crypto.createHmac('sha256', 'mock_secret').update(`${orderId}|${paymentId}`).digest('hex');
}
