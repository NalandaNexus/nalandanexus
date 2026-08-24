import { validationResult } from 'express-validator';
import { ApiError } from '../utils/ApiError.js';

/**
 * Runs after a chain of express-validator checks and turns any failures
 * into a single, consistently-shaped 422 ApiError instead of letting each
 * route hand-roll its own validation response.
 */
export function validate(req, res, next) {
  const result = validationResult(req);
  if (result.isEmpty()) return next();

  const details = result.array({ onlyFirstError: true }).map((e) => ({
    field: e.path,
    message: e.msg,
  }));

  next(ApiError.unprocessable('One or more fields are invalid.', 'VALIDATION_ERROR', details));
}

export default validate;
