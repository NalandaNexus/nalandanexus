import bcrypt from 'bcrypt';
import { OAuth2Client } from 'google-auth-library';
import { User } from '../models/User.js';
import { StudentProfile } from '../models/StudentProfile.js';
import { RefreshToken } from '../models/RefreshToken.js';
import { PasswordResetToken } from '../models/PasswordResetToken.js';
import { EmailVerificationToken } from '../models/EmailVerificationToken.js';
import {
  signAccessToken,
  signRefreshToken,
  verifyRefreshToken,
  generateTokenId,
  hashToken,
  generateSecureToken,
} from '../utils/jwt.js';
import { AppError } from '../utils/AppError.js';
import { env } from '../config/env.js';

const SALT_ROUNDS = 12;

export async function hashPassword(password) {
  return bcrypt.hash(password, SALT_ROUNDS);
}

export async function comparePassword(password, hash) {
  return bcrypt.compare(password, hash);
}

export async function registerStudent({ name, email, password, grade }) {
  const existing = await User.findOne({ email });
  if (existing) {
    throw AppError.conflict('An account with this email already exists.', 'EMAIL_TAKEN');
  }

  const passwordHash = await hashPassword(password);
  // Not verified yet - login is refused (see validateCredentials) until the
  // student proves ownership of this email via the token sent by
  // createEmailVerificationToken below. Google sign-in accounts skip this
  // entirely (Google already verified that email) - see findOrCreateGoogleUser.
  const user = await User.create({ name, email, passwordHash, role: 'student', isVerified: false });
  await StudentProfile.create({ userId: user._id, grade: grade || null });

  return user;
}

const googleClient = env.google.clientId ? new OAuth2Client(env.google.clientId) : null;

/**
 * Verifies a Google Identity Services credential (ID token) server-side.
 * We NEVER trust profile data the frontend claims about itself - the token
 * is cryptographically verified against Google's public keys and the
 * configured audience (our GOOGLE_CLIENT_ID), per master doc section 6.
 */
export async function verifyGoogleIdToken(idToken) {
  if (!googleClient) {
    throw AppError.badRequest(
      'Google sign-in is not configured on this server.',
      'GOOGLE_AUTH_NOT_CONFIGURED'
    );
  }

  let ticket;
  try {
    ticket = await googleClient.verifyIdToken({ idToken, audience: env.google.clientId });
  } catch {
    throw AppError.unauthorized('Invalid Google credential.', 'INVALID_GOOGLE_TOKEN');
  }

  const payload = ticket.getPayload();
  if (!payload?.email) {
    throw AppError.unauthorized('Invalid Google credential.', 'INVALID_GOOGLE_TOKEN');
  }
  if (!payload.email_verified) {
    throw AppError.unauthorized('Google account email is not verified.', 'GOOGLE_EMAIL_UNVERIFIED');
  }

  return {
    googleId: payload.sub,
    email: payload.email.toLowerCase(),
    name: payload.name || payload.email.split('@')[0],
    avatar: payload.picture || null,
  };
}

/**
 * Finds the user for a verified Google identity, creating a new student
 * account on first sign-in or linking the Google identity to an existing
 * email/password account (never creates a second, duplicate account for the
 * same email - master doc section 6).
 */
export async function findOrCreateGoogleUser({ googleId, email, name, avatar }) {
  let user = await User.findOne({ googleId });
  if (user) return { user, isNewUser: false };

  user = await User.findOne({ email });
  if (user) {
    // Existing email/password account signing in with Google for the first time - link it.
    user.googleId = googleId;
    user.isVerified = true;
    if (!user.avatar && avatar) user.avatar = avatar;
    await user.save();
    return { user, isNewUser: false };
  }

  user = await User.create({
    name,
    email,
    googleId,
    avatar,
    role: 'student',
    isVerified: true,
  });
  await StudentProfile.create({ userId: user._id });
  return { user, isNewUser: true };
}

export async function validateCredentials(email, password) {
  const user = await User.findOne({ email }).select('+passwordHash');
  // Constant-shape response: don't reveal whether the email exists.
  if (!user) {
    throw AppError.unauthorized('Invalid email or password', 'INVALID_CREDENTIALS');
  }
  if (!user.isActive) {
    throw AppError.unauthorized('This account has been deactivated. Contact support.', 'ACCOUNT_INACTIVE');
  }
  if (!user.isVerified) {
    throw AppError.forbidden('Please verify your email before logging in. Check your inbox for the verification link.', 'EMAIL_NOT_VERIFIED');
  }

  // Google-only accounts (no password ever set) must not be brute-forceable
  // via this endpoint - fail with the same generic message.
  if (!user.passwordHash) {
    throw AppError.unauthorized('Invalid email or password', 'INVALID_CREDENTIALS');
  }

  const isMatch = await comparePassword(password, user.passwordHash);
  if (!isMatch) {
    throw AppError.unauthorized('Invalid email or password', 'INVALID_CREDENTIALS');
  }

  return user;
}

/** Issues a fresh access+refresh token pair and persists the refresh token hash. */
export async function issueTokenPair(user, meta = {}) {
  const accessToken = signAccessToken(user);
  const jti = generateTokenId();
  const refreshToken = signRefreshToken(user, jti);

  const decodedExp = Date.now() + parseExpiryMs(env.jwt.refreshExpiresIn);

  await RefreshToken.create({
    userId: user._id,
    tokenHash: hashToken(refreshToken),
    jti,
    expiresAt: new Date(decodedExp),
    userAgent: meta.userAgent || '',
    ip: meta.ip || '',
  });

  return { accessToken, refreshToken, jti };
}

/** Rotates a refresh token: validates it, revokes the old one, issues a new pair. */
export async function rotateRefreshToken(rawRefreshToken, meta = {}) {
  let payload;
  try {
    payload = verifyRefreshToken(rawRefreshToken);
  } catch {
    throw AppError.unauthorized('Invalid or expired refresh session. Please log in again.', 'INVALID_REFRESH_TOKEN');
  }

  const tokenHash = hashToken(rawRefreshToken);
  const stored = await RefreshToken.findOne({ jti: payload.jti, tokenHash });

  if (!stored || stored.revokedAt || stored.expiresAt < new Date()) {
    // Reuse of a revoked/rotated token is a strong signal of theft - revoke
    // the whole session family defensively.
    if (stored) {
      await RefreshToken.updateMany({ userId: stored.userId, revokedAt: null }, { revokedAt: new Date() });
    }
    throw AppError.unauthorized('Session expired or already used. Please log in again.', 'REFRESH_TOKEN_REUSED');
  }

  const user = await User.findById(stored.userId);
  if (!user || !user.isActive) {
    throw AppError.unauthorized('Account not found or deactivated', 'ACCOUNT_INACTIVE');
  }

  stored.revokedAt = new Date();
  const { accessToken, refreshToken, jti: newJti } = await issueTokenPair(user, meta);
  stored.replacedByJti = newJti;
  await stored.save();

  return { user, accessToken, refreshToken };
}

export async function revokeRefreshToken(rawRefreshToken) {
  if (!rawRefreshToken) return;
  const tokenHash = hashToken(rawRefreshToken);
  await RefreshToken.updateOne({ tokenHash }, { revokedAt: new Date() });
}

export async function revokeAllSessionsForUser(userId) {
  await RefreshToken.updateMany({ userId, revokedAt: null }, { revokedAt: new Date() });
}

/** Creates a one-time password reset token, returns the RAW token (only ever shown once, via email). */
export async function createPasswordResetToken(userId) {
  const rawToken = generateSecureToken(32);
  const tokenHash = hashToken(rawToken);
  const expiresAt = new Date(Date.now() + env.passwordReset.expiresMinutes * 60 * 1000);

  // Invalidate any previous outstanding tokens for this user.
  await PasswordResetToken.deleteMany({ userId, usedAt: null });
  await PasswordResetToken.create({ userId, tokenHash, expiresAt });

  return rawToken;
}

export async function consumePasswordResetToken(rawToken) {
  const tokenHash = hashToken(rawToken);
  const record = await PasswordResetToken.findOne({ tokenHash });

  if (!record || record.usedAt || record.expiresAt < new Date()) {
    throw AppError.badRequest('This reset link is invalid or has expired.', 'INVALID_RESET_TOKEN');
  }

  record.usedAt = new Date();
  await record.save();
  return record.userId;
}

/** Creates a one-time email verification token, returns the RAW token (only ever shown once, via email). Mirrors createPasswordResetToken exactly. */
export async function createEmailVerificationToken(userId) {
  const rawToken = generateSecureToken(32);
  const tokenHash = hashToken(rawToken);
  const expiresAt = new Date(Date.now() + env.emailVerification.expiresMinutes * 60 * 1000);

  await EmailVerificationToken.deleteMany({ userId, usedAt: null });
  await EmailVerificationToken.create({ userId, tokenHash, expiresAt });

  return rawToken;
}

export async function consumeEmailVerificationToken(rawToken) {
  const tokenHash = hashToken(rawToken);
  const record = await EmailVerificationToken.findOne({ tokenHash });

  if (!record || record.usedAt || record.expiresAt < new Date()) {
    throw AppError.badRequest('This verification link is invalid or has expired.', 'INVALID_VERIFICATION_TOKEN');
  }

  record.usedAt = new Date();
  await record.save();
  return record.userId;
}

function parseExpiryMs(expr) {
  const match = /^(\d+)([smhd])$/.exec(expr);
  if (!match) return 7 * 24 * 60 * 60 * 1000;
  const value = Number(match[1]);
  const unit = match[2];
  const multipliers = { s: 1000, m: 60 * 1000, h: 60 * 60 * 1000, d: 24 * 60 * 60 * 1000 };
  return value * multipliers[unit];
}

export const cookieOptions = {
  httpOnly: true,
  secure: env.isProd,
  sameSite: env.isProd ? 'strict' : 'lax',
  path: '/',
};

export function accessCookieOptions() {
  return { ...cookieOptions, maxAge: parseExpiryMs(env.jwt.accessExpiresIn) };
}

export function refreshCookieOptions() {
  return { ...cookieOptions, maxAge: parseExpiryMs(env.jwt.refreshExpiresIn), path: '/api/auth' };
}
