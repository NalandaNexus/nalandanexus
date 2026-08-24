import mongoose from 'mongoose';
import { param, query } from 'express-validator';

/** Validates a route param is a well-formed Mongo ObjectId (guards against IDOR-by-malformed-id and cast-error 500s). */
export function objectIdParam(name = 'id') {
  return param(name).custom((value) => {
    if (!mongoose.Types.ObjectId.isValid(value)) {
      throw new Error(`'${name}' must be a valid identifier.`);
    }
    return true;
  });
}

export const paginationQuery = [
  query('page').optional().isInt({ min: 1 }).withMessage('page must be a positive integer').toInt(),
  query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('limit must be between 1 and 100').toInt(),
];

export const isNonEmptyString = (field, opts = {}) =>
  field.trim().notEmpty().withMessage('This field is required').isLength({ max: opts.max || 500 });

export default { objectIdParam, paginationQuery };
