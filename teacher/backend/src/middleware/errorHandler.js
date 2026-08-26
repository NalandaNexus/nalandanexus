import mongoose from 'mongoose';
import { ApiError } from '../utils/ApiError.js';
import { env } from '../config/env.js';

export function notFoundHandler(req, res, next) {
  next(ApiError.notFound(`Route not found: ${req.method} ${req.originalUrl}`, 'ROUTE_NOT_FOUND'));
}

/**
 * Centralized error handler — every error in the app (thrown ApiErrors,
 * Mongoose validation/cast errors, JSON parse errors, anything else) is
 * normalized into the same { success: false, message, error: { code } }
 * envelope. Stack traces are only logged server-side, never sent to the
 * client, and never leaked in production responses.
 */
// eslint-disable-next-line no-unused-vars
export function errorHandler(err, req, res, next) {
  let apiError = err;

  if (!(err instanceof ApiError)) {
    apiError = normalizeError(err);
  }

  if (apiError.statusCode >= 500) {
    console.error(`[error] ${req.method} ${req.originalUrl} ->`, err);
  } else if (env.nodeEnv !== 'production') {
    console.warn(`[warn] ${req.method} ${req.originalUrl} -> ${apiError.statusCode} ${apiError.code}: ${apiError.message}`);
  }

  const body = {
    success: false,
    message: apiError.message,
    error: {
      code: apiError.code,
      ...(apiError.details !== undefined ? { details: apiError.details } : {}),
    },
  };

  res.status(apiError.statusCode).json(body);
}

function normalizeError(err) {
  // Mongoose validation error
  if (err instanceof mongoose.Error.ValidationError) {
    const details = Object.values(err.errors).map((e) => ({ field: e.path, message: e.message }));
    return ApiError.unprocessable('Validation failed.', 'VALIDATION_ERROR', details);
  }

  // Malformed ObjectId in a query/param
  if (err instanceof mongoose.Error.CastError) {
    return ApiError.badRequest(`Invalid value for '${err.path}'.`, 'INVALID_ID');
  }

  // Duplicate key (unique index violation)
  if (err?.code === 11000) {
    const field = Object.keys(err.keyPattern || {}).join(', ') || 'field';
    return ApiError.conflict(`A record with this ${field} already exists.`, 'DUPLICATE_KEY', { field });
  }

  // Malformed JSON body
  if (err?.type === 'entity.parse.failed') {
    return ApiError.badRequest('Malformed JSON in request body.', 'INVALID_JSON');
  }

  // Body over express.json's size cap - a client mistake (413), not a 500.
  if (err?.type === 'entity.too.large') {
    const tooLarge = ApiError.badRequest(
      'That request is too large. Please reduce the amount of data and try again.',
      'PAYLOAD_TOO_LARGE'
    );
    tooLarge.statusCode = 413;
    return tooLarge;
  }

  // Multer upload errors
  if (err?.name === 'MulterError') {
    return ApiError.badRequest(err.message, `UPLOAD_${err.code}`);
  }

  if (err?.name === 'JsonWebTokenError' || err?.name === 'TokenExpiredError') {
    return ApiError.unauthorized('Invalid or expired session.', 'INVALID_TOKEN');
  }

  return ApiError.internal(
    env.nodeEnv === 'production' ? 'Something went wrong. Please try again.' : err.message || 'Internal server error',
    'INTERNAL_ERROR'
  );
}

export default errorHandler;
