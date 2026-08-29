/**
 * Standardized application error.
 * Thrown anywhere in services/controllers and caught by the centralized
 * error handler middleware (middleware/errorHandler.js).
 */
export class ApiError extends Error {
  /**
   * @param {number} statusCode HTTP status code
   * @param {string} message Human-readable message (safe to show to the client)
   * @param {string} code Machine-readable error code, e.g. 'NOT_FOUND'
   * @param {any} [details] Optional extra details (e.g. validation errors)
   */
  constructor(statusCode, message, code = 'ERROR', details = undefined) {
    super(message);
    this.name = 'ApiError';
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
    this.isApiError = true;
    Error.captureStackTrace(this, this.constructor);
  }

  static badRequest(message = 'Bad request', code = 'BAD_REQUEST', details) {
    return new ApiError(400, message, code, details);
  }

  static unauthorized(message = 'Authentication required', code = 'UNAUTHORIZED', details) {
    return new ApiError(401, message, code, details);
  }

  static forbidden(message = 'You do not have permission to perform this action', code = 'FORBIDDEN', details) {
    return new ApiError(403, message, code, details);
  }

  static notFound(message = 'Resource not found', code = 'NOT_FOUND', details) {
    return new ApiError(404, message, code, details);
  }

  static conflict(message = 'Resource conflict', code = 'CONFLICT', details) {
    return new ApiError(409, message, code, details);
  }

  static unprocessable(message = 'Validation failed', code = 'VALIDATION_ERROR', details) {
    return new ApiError(422, message, code, details);
  }

  static tooMany(message = 'Too many requests', code = 'RATE_LIMITED', details) {
    return new ApiError(429, message, code, details);
  }

  static internal(message = 'Internal server error', code = 'INTERNAL_ERROR', details) {
    return new ApiError(500, message, code, details);
  }

  /** A dependency this request needed (e.g. the student-portal bridge) was unreachable — the caller should retry, nothing was written. */
  static serviceUnavailable(message = 'Service temporarily unavailable', code = 'SERVICE_UNAVAILABLE', details) {
    return new ApiError(503, message, code, details);
  }
}

export default ApiError;
