import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';

/**
 * Signs an access token for a teacher session.
 * `remember=true` issues a long-lived token (matches the frontend's
 * "Remember on this workstation" checkbox); otherwise a short school-day
 * length session is used.
 */
export function signAuthToken({ userId, teacherId, role, tokenVersion }, remember = false) {
  const expiresIn = remember ? env.jwtRememberExpiresIn : env.jwtExpiresIn;
  return jwt.sign(
    { sub: String(userId), teacherId: teacherId ? String(teacherId) : undefined, role, tokenVersion },
    env.jwtSecret,
    { expiresIn }
  );
}

export function verifyAuthToken(token) {
  return jwt.verify(token, env.jwtSecret);
}

/**
 * Cookie options shared by the "set" and "clear" calls so they always match
 * (mismatched options are the #1 reason `res.clearCookie` silently fails).
 */
export function authCookieOptions(remember = false) {
  const maxAgeMs = remember ? 30 * 24 * 60 * 60 * 1000 : 8 * 60 * 60 * 1000;
  return {
    httpOnly: true,
    secure: env.nodeEnv === 'production',
    sameSite: env.nodeEnv === 'production' ? 'none' : 'lax',
    maxAge: maxAgeMs,
    path: '/',
  };
}

export default { signAuthToken, verifyAuthToken, authCookieOptions };
