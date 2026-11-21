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
      exposeDetails: Boolean(err.exposeDetails),
    });
  }

  // Rejected CORS origin - a client error, not a server fault.
  if (err.isCorsError) {
    return sendError(res, {
      status: 403,
      code: 'ORIGIN_NOT_ALLOWED',
      message: 'This origin is not allowed to access the API.',
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

  // A body express.json() could not parse. Unhandled, this fell through to the
  // catch-all below and answered 500 - so any client could manufacture server
  // errors, and real faults were harder to find among them. A body the caller
  // sent wrong is a bad request.
  if (err.type === 'entity.parse.failed') {
    return sendError(res, { status: 400, code: 'INVALID_JSON', message: 'Malformed JSON in request body.' });
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
