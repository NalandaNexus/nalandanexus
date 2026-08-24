import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { Admin } from '../models/Admin.js';
import { ApiError } from '../utils/ApiError.js';
import { catchAsync } from '../utils/catchAsync.js';

/**
 * Requires a valid session for every route it guards. Re-loads the Admin
 * document from the database on every request (never trusts the JWT payload
 * alone) so a suspended account or a bumped `tokenVersion` (logout-everywhere)
 * takes effect immediately, matching the pattern used in teacher/backend and
 * student/backend. There is no dev-mode bypass header — this replaces the
 * previous `x-admin-token` backdoor entirely.
 */
export const authenticate = catchAsync(async (req, res, next) => {
  let token;
  const authHeader = req.headers.authorization;
  if (authHeader?.startsWith('Bearer ')) {
    token = authHeader.slice(7);
  } else if (req.cookies?.[env.cookieName]) {
    token = req.cookies[env.cookieName];
  }

  if (!token) {
    throw ApiError.unauthorized('Authentication required', 'NO_TOKEN');
  }

  let payload;
  try {
    payload = jwt.verify(token, env.jwtSecret);
  } catch {
    throw ApiError.unauthorized('Invalid or expired session', 'INVALID_TOKEN');
  }

  const admin = await Admin.findById(payload.id).select('+tokenVersion');
  if (!admin) throw ApiError.unauthorized('Account no longer exists', 'ACCOUNT_NOT_FOUND');
  if (admin.status !== 'ACTIVE' || !admin.isActive) throw ApiError.forbidden('Account is suspended', 'ACCOUNT_SUSPENDED');
  if ((payload.tokenVersion ?? 0) !== admin.tokenVersion) {
    throw ApiError.unauthorized('Session has been invalidated, please log in again', 'TOKEN_REVOKED');
  }

  req.admin = admin;
  return next();
});

export function requireRole(...allowedRoles) {
  return (req, res, next) => {
    if (!req.admin) return next(ApiError.unauthorized());
    if (!allowedRoles.includes(req.admin.role)) {
      return next(ApiError.forbidden('You do not have the required role for this action', 'ROLE_FORBIDDEN'));
    }
    return next();
  };
}

export function requirePermission(permission) {
  return (req, res, next) => {
    if (!req.admin) return next(ApiError.unauthorized());
    if (!req.admin.hasPermission(permission)) {
      return next(ApiError.forbidden(`Missing permission: ${permission}`, 'PERMISSION_DENIED'));
    }
    return next();
  };
}

export default { authenticate, requireRole, requirePermission };
