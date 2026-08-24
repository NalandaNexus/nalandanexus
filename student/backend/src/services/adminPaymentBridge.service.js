import { env } from '../config/env.js';

/**
 * Pushes a real, signature-verified Razorpay payment event to admin/backend
 * (a separate service/database) so it appears in the institutional payment
 * ledger without admin having to trust a client-asserted status. Mirrors
 * the existing teacher/announcement bridges exactly (shared secret,
 * best-effort, never throws — a failure here must never break the
 * already-completed/verified purchase flow that triggered it).
 */

function isConfigured() {
  return Boolean(env.adminBridge.url && env.adminBridge.serviceKey);
}

async function call(path, options) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);
  try {
    const res = await fetch(`${env.adminBridge.url}${path}`, {
      ...options,
      headers: { 'Content-Type': 'application/json', 'X-Internal-Service-Key': env.adminBridge.serviceKey, ...options.headers },
      signal: controller.signal,
    });
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      throw new Error(`Admin backend returned ${res.status}: ${body.slice(0, 200)}`);
    }
    return res.json();
  } finally {
    clearTimeout(timeout);
  }
}

/** Reports a payment outcome (PAID/FAILED) to admin/backend. Never throws. */
export async function pushPaymentToAdmin({ order, user, course, status }) {
  if (!isConfigured()) return { delivered: false, reason: 'NOT_CONFIGURED' };
  try {
    await call('/api/internal/payments', {
      method: 'POST',
      body: JSON.stringify({
        sourceId: String(order._id),
        studentName: user?.name || null,
        studentEmail: user?.email || null,
        courseTitle: course?.title || null,
        amountInPaise: order.amountInPaise,
        currency: order.currency,
        status,
        razorpayOrderId: order.razorpayOrderId,
        razorpayPaymentId: order.razorpayPaymentId || null,
      }),
    });
    return { delivered: true };
  } catch (err) {
    console.error('[adminPaymentBridge] Failed to report payment to admin:', err.message);
    return { delivered: false, reason: 'REQUEST_FAILED', error: err.message };
  }
}

export default { pushPaymentToAdmin };
