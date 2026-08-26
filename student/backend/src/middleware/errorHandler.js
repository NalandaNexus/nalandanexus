import { AppError } from '../utils/AppError.js';
import { sendError } from '../utils/apiResponse.js';
import { logger } from '../utils/logger.js';

export function notFoundHandler(req, res) {
  return sendError(res, {
    status: 404,
    code: 'ROUTE_NOT_FOUND',
    message: `No route matches ${req.method} ${req.originalUrl}`,
  });
}

// eslint-disable-next-line no-unused-vars
export function globalErrorHandler(err, req, res, next) {
  if (err instanceof AppError) {
    if (!err.statusCode || err.statusCode >= 500) {
      logger.error(err.message, { stack: err.stack });
    }
    return sendError(res, {
      status: err.statusCode,
      code: err.code,
      message: err.message,
      details: err.details,
    });
  }

  // body-parser rejections. These are ordinary client mistakes (a body over
  // express.json's 1mb cap, or malformed JSON), but without a branch here
  // they fall through to the catch-all below and surface as a 500 -
  // misreporting the caller's error as a server fault, and polluting error
  // logs with traffic that is working exactly as designed.
  if (err.type === 'entity.too.large') {
    return sendError(res, {
      status: 413,
      code: 'PAYLOAD_TOO_LARGE',
      message: 'That request is too large. Please reduce the amount of data and try again.',
    });
  }
  if (err.type === 'entity.parse.failed' || (err instanceof SyntaxError && 'body' in err)) {
    return sendError(res, {
      status: 400,
      code: 'MALFORMED_JSON',
      message: 'The request body could not be parsed as JSON.',
    });
  }

  // Rejected by the CORS origin allowlist in app.js. cors() surfaces this as
  // a plain Error, which would otherwise be reported as a 500 - an origin
  // that simply isn't on the allowlist is a 403, not a server failure.
  if (err.message === 'Not allowed by CORS') {
    return sendError(res, {
      status: 403,
      code: 'CORS_ORIGIN_NOT_ALLOWED',
      message: 'This origin is not permitted to call the API.',
    });
  }

  // Mongoose duplicate key
  if (err.code === 11000) {
    const field = Object.keys(err.keyPattern || {})[0] || 'field';
    return sendError(res, {
      status: 409,
      code: 'DUPLICATE_KEY',
      message: `A record with this ${field} already exists.`,
    });
  }

  // Mongoose validation error
  if (err.name === 'ValidationError') {
    return sendError(res, {
      status: 422,
      code: 'VALIDATION_ERROR',
      message: 'Invalid data submitted.',
      details: Object.values(err.errors || {}).map((e) => e.message),
    });
  }

  if (err.name === 'CastError') {
    return sendError(res, { status: 400, code: 'INVALID_ID', message: 'Invalid identifier supplied.' });
  }

  // Multer upload errors (unsupported file type, file too large, etc.)
  if (err.name === 'MulterError') {
    return sendError(res, { status: 400, code: `UPLOAD_${err.code}`, message: err.message });
  }

  // Unknown/unexpected error - never leak internals in production.
  logger.error('Unhandled error', err);
  return sendError(res, {
    status: 500,
    code: 'INTERNAL_ERROR',
    message: process.env.NODE_ENV === 'production' ? 'Something went wrong.' : err.message,
    details: process.env.NODE_ENV === 'production' ? undefined : err.stack,
  });
}
