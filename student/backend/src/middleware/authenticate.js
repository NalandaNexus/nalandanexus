import { verifyAccessToken } from '../utils/jwt.js';
import { AppError } from '../utils/AppError.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { User } from '../models/User.js';

/**
 * Requires a valid access token (Authorization: Bearer <token>, or the
 * `accessToken` httpOnly cookie as a fallback for same-site browser flows).
 * Populates req.user with a fresh DB-backed user (never trusts the token's
 * embedded role blindly for authorization decisions elsewhere).
 */
export const authenticate = asyncHandler(async (req, res, next) => {
  const header = req.headers.authorization || '';
  const bearerToken = header.startsWith('Bearer ') ? header.slice(7) : null;
  const token = bearerToken || req.cookies?.accessToken;

  if (!token) {
    throw AppError.unauthorized('Authentication required', 'NO_TOKEN');
  }

  let payload;
  try {
    payload = verifyAccessToken(token);
  } catch (err) {
    const code = err.name === 'TokenExpiredError' ? 'TOKEN_EXPIRED' : 'INVALID_TOKEN';
    throw AppError.unauthorized('Invalid or expired session', code);
  }

  const user = await User.findById(payload.sub);
  if (!user || !user.isActive) {
    throw AppError.unauthorized('Account not found or deactivated', 'ACCOUNT_INACTIVE');
  }

  req.user = user;
  next();
});

/** Attaches req.user if a valid token is present, but never blocks the request. */
export const attachUserIfPresent = asyncHandler(async (req, res, next) => {
  const header = req.headers.authorization || '';
  const bearerToken = header.startsWith('Bearer ') ? header.slice(7) : null;
  const token = bearerToken || req.cookies?.accessToken;
  if (!token) return next();

  try {
    const payload = verifyAccessToken(token);
    const user = await User.findById(payload.sub);
    if (user && user.isActive) req.user = user;
  } catch {
    // silently ignore - this endpoint works for anonymous users too
  }
  next();
});
