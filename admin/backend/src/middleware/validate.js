import { ApiError } from '../utils/ApiError.js';

/**
 * Validates req.body / req.query / req.params against Zod schemas and
 * replaces them with the parsed (coerced + defaulted) values. This is also
 * the project's guard against NoSQL-operator injection in query params:
 * every field is validated against an explicit shape, so a client can never
 * smuggle `{ $gt: '' }`-style operators into a filter that reaches Mongoose.
 */
export function validate(schemas = {}) {
  return (req, res, next) => {
    try {
      if (schemas.body) req.body = schemas.body.parse(req.body);
      if (schemas.query) req.query = schemas.query.parse(req.query);
      if (schemas.params) req.params = schemas.params.parse(req.params);
      return next();
    } catch (err) {
      const details = err.errors?.map((e) => ({ path: e.path.join('.'), message: e.message })) || undefined;
      return next(ApiError.unprocessable('Validation failed', 'VALIDATION_ERROR', details));
    }
  };
}

export default validate;
