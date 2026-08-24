import { verifyAuthToken } from '../utils/tokens.js';
import { ApiError } from '../utils/ApiError.js';
import { catchAsync } from '../utils/catchAsync.js';
import { User } from '../models/User.js';
import { Teacher } from '../models/Teacher.js';
import { env } from '../config/env.js';

/**
 * Authenticates the request: reads the JWT from the httpOnly cookie (the
 * primary transport, matching the frontend's `credentials: 'include'`
 * fetches) or an `Authorization: Bearer` header (kept as a fallback for
 * server-to-server calls / API testing tools like curl or Postman).
 *
 * Loads the User + Teacher documents fresh on every request (rather than
 * trusting the JWT payload for anything beyond identity) so a
 * deactivated/suspended account or a bumped tokenVersion takes effect
 * immediately instead of only after the token naturally expires.
 */
export const authenticate = catchAsync(async (req, res, next) => {
  const cookieToken = req.cookies?.[env.cookieName];
  const headerToken = req.headers.authorization?.startsWith('Bearer ')
    ? req.headers.authorization.slice(7)
    : null;
  const token = cookieToken || headerToken;

  if (!token) {
    throw ApiError.unauthorized('You must be signed in to access this resource.', 'NO_TOKEN');
  }

  let payload;
  try {
    payload = verifyAuthToken(token);
  } catch (err) {
    const code = err.name === 'TokenExpiredError' ? 'TOKEN_EXPIRED' : 'INVALID_TOKEN';
    throw ApiError.unauthorized('Your session is invalid or has expired. Please sign in again.', code);
  }

  const user = await User.findById(payload.sub).select('+tokenVersion');
  if (!user) {
    throw ApiError.unauthorized('Account no longer exists.', 'ACCOUNT_NOT_FOUND');
  }
  if (user.status !== 'active') {
    throw ApiError.forbidden('This account has been deactivated. Contact your administrator.', 'ACCOUNT_INACTIVE');
  }
  if ((payload.tokenVersion ?? 0) !== user.tokenVersion) {
    throw ApiError.unauthorized('Your session has been signed out remotely. Please sign in again.', 'TOKEN_REVOKED');
  }

  // An admin-provisioned temp password must be changed before ANY other
  // part of the portal is reachable - not just a frontend redirect, since
  // that's trivially bypassable. /api/teacher/auth/* stays open throughout
  // (me/change-password/logout) so the reset flow itself still works.
  if (user.mustChangePassword && !req.originalUrl.startsWith('/api/teacher/auth/')) {
    throw ApiError.forbidden('You must set a new password before continuing.', 'PASSWORD_CHANGE_REQUIRED');
  }

  req.user = user;

  if (user.role === 'teacher') {
    const teacher = await Teacher.findOne({ user: user._id });
    if (!teacher) {
      throw ApiError.forbidden('No teacher profile is associated with this account.', 'TEACHER_PROFILE_MISSING');
    }
    if (teacher.accountStatus !== 'active') {
      throw ApiError.forbidden('This faculty account has been deactivated.', 'TEACHER_INACTIVE');
    }
    req.teacher = teacher;
  }

  next();
});

/** Restricts a route to one or more roles, e.g. requireRole('teacher'). */
export function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return next(ApiError.forbidden('You do not have permission to perform this action.', 'ROLE_FORBIDDEN'));
    }
    next();
  };
}

/**
 * Gates Pro-only functionality (advanced/real-time diagnostics) — mirrors
 * the "Advanced analytics & real-time socket updates unlocked" copy already
 * shown in the sidebar so the backend enforces exactly what the UI implies,
 * rather than leaving it as a purely cosmetic frontend badge.
 */
export function requirePro(req, res, next) {
  if (!req.teacher?.isPro) {
    return next(
      ApiError.forbidden(
        'This feature requires a Pro faculty subscription.',
        'PRO_REQUIRED'
      )
    );
  }
  next();
}

export default authenticate;
