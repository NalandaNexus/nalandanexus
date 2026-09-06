import crypto from 'node:crypto';
import { AppError } from '../utils/AppError.js';
import { env } from '../config/env.js';

/**
 * Authenticates a service-to-service call using a shared secret header instead
 * of a user session - the caller is another backend, not a logged in
 * student/admin, so there is no JWT to check.
 *
 * This used to compare with `===`, justified by the router only carrying
 * announcement delivery: same-network, low value, nothing worth timing. That
 * justification expired when the admin portal's coupon and roster
 * administration moved onto this same router. The listing now returns live,
 * unredeemed coupon codes - each one a free seat in a paid course - alongside
 * the names, emails and enrollment IDs of the students who redeemed them.
 * Whoever holds this key can also mint more coupons and deactivate existing
 * ones. That is worth a constant-time compare.
 */
function keyMatches(provided) {
  const expected = env.internal.serviceKey;
  const a = Buffer.from(String(provided));
  const b = Buffer.from(expected);
  // timingSafeEqual throws on a length mismatch, which would leak the length by
  // way of the exception path, so the lengths are folded into the result instead.
  if (a.length !== b.length) {
    crypto.timingSafeEqual(b, b);
    return false;
  }
  return crypto.timingSafeEqual(a, b);
}

export function requireInternalServiceKey(req, res, next) {
  if (!env.internal.serviceKey) {
    return next(AppError.forbidden('Internal service integration is not configured on this backend.', 'INTERNAL_NOT_CONFIGURED'));
  }
  const provided = req.headers['x-internal-service-key'];
  if (!provided || !keyMatches(provided)) {
    return next(AppError.unauthorized('Invalid or missing internal service key.', 'INTERNAL_AUTH_FAILED'));
  }
  next();
}

export default requireInternalServiceKey;
