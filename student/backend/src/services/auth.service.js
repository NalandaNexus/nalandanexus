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
  if (!payload?.email || !payload?.sub) {
    throw AppError.unauthorized('Invalid Google credential.', 'INVALID_GOOGLE_TOKEN');
  }
  if (!payload.email_verified) {
    throw AppError.unauthorized('Google account email is not verified.', 'GOOGLE_EMAIL_UNVERIFIED');
  }

  return googleIdentityFromPayload(payload);
}

/**
 * The identity a verified Google ID token vouches for.
 *
 * `sub` is the only stable key. An email address can be changed at Google, and a
 * name changes whenever its owner edits it.
 *
 * The name is Google's own `name` claim. Given and family name are used only if
 * `name` is absent, and the email's local part only if Google supplies no name
 * at all - never in preference to a real one.
 */
export function googleIdentityFromPayload(payload) {
  const clean = (value) => String(value ?? '').replace(/\s+/g, ' ').trim();
  const name =
    clean(payload.name) ||
    clean([payload.given_name, payload.family_name].filter(Boolean).join(' ')) ||
    payload.email.split('@')[0];

  return {
    googleId: payload.sub,
    email: payload.email.toLowerCase(),
    // User.name is capped at 120 characters; a longer Google name would fail
    // validation and turn a legitimate sign-in into an error.
    name: name.slice(0, 120),
    avatar: payload.picture || null,
  };
}

/**
 * Links a verified Google identity to an account that already holds its email.
 *
 * Whose name the account keeps depends on whether anybody had proven they own
 * the address.
 *
 * A VERIFIED account's name was chosen by the person who owns this inbox, and it
 * is kept - an official name a student entered is not replaced by whatever
 * their Google profile says.
 *
 * An UNVERIFIED account was registered by somebody who never proved the address
 * was theirs; anyone can type a student's email into the signup form under any
 * name. Linking used to keep that name, which is how a student signing in with
 * Google was greeted as somebody else - and it also marked the account verified,
 * which would have let that stranger's password open the real student's
 * account. Google has now proven who owns the address, so the account becomes
 * theirs: Google's name, and the unproven password discarded along with any
 * outstanding verification link.
 *
 * An address already linked to a DIFFERENT Google account is refused rather
 * than silently re-pointed.
 */
async function linkGoogleToExistingAccount(user, { googleId, name, avatar }) {
  if (user.googleId && user.googleId !== googleId) {
    throw AppError.conflict(
      'This email address is already linked to a different Google account. Sign in with that Google account instead.',
      'GOOGLE_ACCOUNT_MISMATCH'
    );
  }
  if (!user.isVerified) {
    user.name = name;
    user.passwordHash = null;
    await EmailVerificationToken.deleteMany({ userId: user._id, usedAt: null });
  }
  user.googleId = googleId;
  user.isVerified = true;
  if (!user.avatar && avatar) user.avatar = avatar;
  await user.save();
  return user;
}

/**
 * Finds the user for a verified Google identity, linking it to an existing
 * account holding the same email, or creating a new student on first sign-in.
 *
 * The stable identity comes first and decides on its own. Once linked, a Google
 * account resolves to its user by `sub` alone - never by name, and never by an
 * email that may since have changed at Google - and that user's profile is left
 * exactly as it is. A later sign-in is not an edit.
 */
export async function findOrCreateGoogleUser({ googleId, email, name, avatar }) {
  const linked = await User.findOne({ googleId });
  if (linked) return { user: linked, isNewUser: false };

  const existing = await User.findOne({ email });
  if (existing) {
    return { user: await linkGoogleToExistingAccount(existing, { googleId, name, avatar }), isNewUser: false };
  }

  try {
    const user = await User.create({ name, email, googleId, avatar, role: 'student', isVerified: true });
    await StudentProfile.create({ userId: user._id });
    return { user, isNewUser: true };
  } catch (err) {
    // Two first sign-ins racing (a double click, two tabs). The unique indexes
    // on email and googleId let one create through; the other resolves to the
    // account that won instead of failing or creating a second one.
    if (err?.code !== 11000) throw err;
    const winner = (await User.findOne({ googleId })) || (await User.findOne({ email }));
    if (!winner) throw err;
    if (winner.googleId === googleId) return { user: winner, isNewUser: false };
    return { user: await linkGoogleToExistingAccount(winner, { googleId, name, avatar }), isNewUser: false };
  }
}

export async function validateCredentials(email, password) {
  const user = await User.findOne({ email }).select('+passwordHash');
  // Constant-shape response: don't reveal whether the email exists.
  if (!user) {
    throw AppError.unauthorized('Invalid email or password', 'INVALID_CREDENTIALS');
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

  // Account-state checks run only AFTER the password is proven correct.
  // Checking them earlier leaked account existence: submitting any wrong
  // password to a registered-but-unverified address returned 403
  // EMAIL_NOT_VERIFIED while an unregistered address returned 401
  // INVALID_CREDENTIALS, so an attacker could enumerate which emails have
  // accounts without knowing a single password (confirmed live). Now only
  // someone who already knows the correct password can distinguish these,
  // which is exactly who needs the actionable message.
  if (!user.isActive) {
    throw AppError.unauthorized('This account has been deactivated. Contact support.', 'ACCOUNT_INACTIVE');
  }
  if (!user.isVerified) {
    throw AppError.forbidden('Please verify your email before logging in. Check your inbox for the verification link.', 'EMAIL_NOT_VERIFIED');
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

// SameSite comes from config (env.cookieSameSite) rather than being hardcoded
// to 'strict': the frontend and backend are deployed on different registrable
// domains, so 'strict' meant the browser never sent the refresh cookie back
// and session persistence was dead in production. See config/env.js.
// SameSite=None is only honoured on Secure cookies, so force Secure whenever
// 'none' is in effect (it is already true in production anyway).
export const cookieOptions = {
  httpOnly: true,
  secure: env.isProd || env.cookieSameSite === 'none',
  sameSite: env.cookieSameSite,
  path: '/',
};

export function accessCookieOptions() {
  return { ...cookieOptions, maxAge: parseExpiryMs(env.jwt.accessExpiresIn) };
}

export function refreshCookieOptions() {
  return { ...cookieOptions, maxAge: parseExpiryMs(env.jwt.refreshExpiresIn), path: '/api/auth' };
}
