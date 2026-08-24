import { AppError } from '../utils/AppError.js';

/**
 * Validates req.{body,query,params} against a zod schema shaped like
 * z.object({ body: ..., query: ..., params: ... }).
 * Never trust frontend validation alone (see master doc section 11).
 */
export function validate(schema) {
  return (req, res, next) => {
    const result = schema.safeParse({
      body: req.body,
      query: req.query,
      params: req.params,
    });

    if (!result.success) {
      const details = result.error.issues.map((issue) => ({
        path: issue.path.join('.'),
        message: issue.message,
      }));
      return next(AppError.unprocessable('Invalid request data', 'VALIDATION_ERROR', details));
    }

    if (result.data.body) req.body = result.data.body;
    if (result.data.query) req.query = result.data.query;
    if (result.data.params) req.params = result.data.params;
    next();
  };
}
