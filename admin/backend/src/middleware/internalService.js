import { ApiError } from '../utils/ApiError.js';
import { env } from '../config/env.js';

/**
 * Authenticates a service-to-service call (student/backend pushing a real
 * payment event, teacher/backend pushing academic activity) using a shared
 * secret header instead of a user session - mirrors student/backend's and
 * teacher/backend's identical middleware. Reuses the same
 * STUDENT_BACKEND_SERVICE_KEY value already configured for admin's
 * *outbound* announcement/course bridge, since every internal caller in
 * this system shares one secret regardless of direction.
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
