import { AppError } from '../utils/AppError.js';

/**
 * requireRole('student') / requireRole('teacher', 'admin') etc.
 * The role is always read from req.user (DB-backed), never from the
 * request body/query - the backend database determines the actual role.
 */
export function requireRole(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user) {
      return next(AppError.unauthorized());
    }
    if (!allowedRoles.includes(req.user.role)) {
      return next(AppError.forbidden(`This action requires one of the following roles: ${allowedRoles.join(', ')}`));
    }
    next();
  };
}
