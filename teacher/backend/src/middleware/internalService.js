import { ApiError } from '../utils/ApiError.js';
import { env } from '../config/env.js';

/**
 * Authenticates a service-to-service call from the student backend (a
 * student sending a message to their assigned teacher) using a shared
 * secret header instead of a user session — mirrors student/backend's
 * identical middleware (src/middleware/internalService.js). Uses the same
 * `STUDENT_BACKEND_SERVICE_KEY` this backend already sends when calling
 * *out* to the student backend, since the relationship is symmetric.
 */
export function requireInternalServiceKey(req, res, next) {
  if (!env.studentBridge.serviceKey) {
    return next(ApiError.forbidden('Internal service integration is not configured on this backend.', 'INTERNAL_NOT_CONFIGURED'));
  }
  const provided = req.headers['x-internal-service-key'];
  if (!provided || provided !== env.studentBridge.serviceKey) {
    return next(ApiError.unauthorized('Invalid or missing internal service key.', 'INTERNAL_AUTH_FAILED'));
  }
  next();
}

export default requireInternalServiceKey;
