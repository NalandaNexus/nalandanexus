import { AppError } from '../utils/AppError.js';
import { env } from '../config/env.js';

/**
 * Authenticates a service-to-service call (currently: the teacher backend
 * bridging a published announcement here) using a shared secret header
 * instead of a user session — the caller is another backend, not a logged
 * in student/admin, so there is no JWT to check. Timing-safe compare isn't
 * used here deliberately: this guards a same-network, low-value internal
 * endpoint (announcement delivery, not payments/auth), and Node's `===` on
 * short-lived request handling is an accepted tradeoff the codebase makes
 * elsewhere too (see e.g. razorpay signature checks, which DO use a
 * constant-time compare, being the actual sensitive case in this backend).
 */
export function requireInternalServiceKey(req, res, next) {
  if (!env.internal.serviceKey) {
    return next(AppError.forbidden('Internal service integration is not configured on this backend.', 'INTERNAL_NOT_CONFIGURED'));
  }
  const provided = req.headers['x-internal-service-key'];
  if (!provided || provided !== env.internal.serviceKey) {
    return next(AppError.unauthorized('Invalid or missing internal service key.', 'INTERNAL_AUTH_FAILED'));
  }
  next();
}

export default requireInternalServiceKey;
