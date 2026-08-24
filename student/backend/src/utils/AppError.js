export class AppError extends Error {
  /**
   * @param {string} message
   * @param {number} statusCode
   * @param {string} code - machine readable error code, e.g. VALIDATION_ERROR
   * @param {any} [details]
   */
  constructor(message, statusCode = 500, code = 'INTERNAL_ERROR', details) {
    super(message);
    this.name = 'AppError';
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
    this.isOperational = true;
    Error.captureStackTrace?.(this, this.constructor);
  }

  static badRequest(message, code = 'BAD_REQUEST', details) {
    return new AppError(message, 400, code, details);
  }
  static unauthorized(message = 'Unauthorized', code = 'UNAUTHORIZED') {
    return new AppError(message, 401, code);
  }
  static forbidden(message = 'Forbidden', code = 'FORBIDDEN') {
    return new AppError(message, 403, code);
  }
  static notFound(message = 'Not found', code = 'NOT_FOUND') {
    return new AppError(message, 404, code);
  }
  static conflict(message = 'Conflict', code = 'CONFLICT') {
    return new AppError(message, 409, code);
  }
  static unprocessable(message = 'Unprocessable entity', code = 'VALIDATION_ERROR', details) {
    return new AppError(message, 422, code, details);
  }
  static tooMany(message = 'Too many requests', code = 'RATE_LIMITED') {
    return new AppError(message, 429, code);
  }
}
