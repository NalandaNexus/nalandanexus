import { env } from '../config/env.js';
import { ApiError } from '../utils/ApiError.js';
import { sendError } from '../utils/ApiResponse.js';

export function notFoundHandler(req, res) {
  return sendError(res, {
    statusCode: 404,
    code: 'ROUTE_NOT_FOUND',
    message: `Route not found: ${req.method} ${req.originalUrl}`,
  });
}

// eslint-disable-next-line no-unused-vars
export function errorHandler(err, req, res, next) {
  let error = err;

  if (!(error instanceof ApiError)) {
    if (error.name === 'CastError') {
      error = ApiError.badRequest(`Invalid identifier: ${error.value}`, 'INVALID_ID');
    } else if (error.type === 'entity.parse.failed') {
      // A body express.json() could not parse. Unhandled, this reached the
      // catch-all below and answered 500, so any client could manufacture
      // server errors and bury real ones. A body the caller sent wrong is a
      // bad request.
      error = ApiError.badRequest('Malformed JSON in request body.', 'INVALID_JSON');
    } else if (error.name === 'ValidationError') {
      const details = Object.values(error.errors || {}).map((e) => ({ path: e.path, message: e.message }));
      error = ApiError.unprocessable('Validation failed', 'VALIDATION_ERROR', details);
    } else if (error.code === 11000) {
      const field = Object.keys(error.keyPattern || {})[0] || 'field';
      error = ApiError.conflict(`A record with this ${field} already exists`, 'DUPLICATE_KEY');
    } else if (error.name === 'JsonWebTokenError' || error.name === 'TokenExpiredError') {
      error = ApiError.unauthorized('Invalid or expired session', 'INVALID_TOKEN');
    } else {
      error = ApiError.internal(env.nodeEnv === 'production' ? 'Something went wrong' : error.message);
    }
  }

  if (error.statusCode >= 500) {
    // eslint-disable-next-line no-console
    console.error('[error]', err);
  }

  return sendError(res, {
    statusCode: error.statusCode,
    code: error.code,
    message: error.message,
    details: error.details,
  });
}

export default errorHandler;
