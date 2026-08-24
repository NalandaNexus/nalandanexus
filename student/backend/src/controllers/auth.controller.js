import { asyncHandler } from '../utils/asyncHandler.js';
import { sendSuccess } from '../utils/apiResponse.js';
import { AppError } from '../utils/AppError.js';
import { User } from '../models/User.js';
import { StudentProfile } from '../models/StudentProfile.js';
import {
  registerStudent,
  validateCredentials,
  issueTokenPair,
  rotateRefreshToken,
  revokeRefreshToken,
  createPasswordResetToken,
  consumePasswordResetToken,
  createEmailVerificationToken,
  consumeEmailVerificationToken,
  hashPassword,
  accessCookieOptions,
  refreshCookieOptions,
  revokeAllSessionsForUser,
  verifyGoogleIdToken,
  findOrCreateGoogleUser,
} from '../services/auth.service.js';
import { sendEmail, passwordResetEmail, emailVerificationEmail } from '../services/email.service.js';
import { env } from '../config/env.js';

function requestMeta(req) {
  return { userAgent: req.headers['user-agent'] || '', ip: req.ip };
}

function setAuthCookies(res, accessToken, refreshToken) {
  res.cookie('accessToken', accessToken, accessCookieOptions());
  res.cookie('refreshToken', refreshToken, refreshCookieOptions());
}

function clearAuthCookies(res) {
  res.clearCookie('accessToken', { path: '/' });
  res.clearCookie('refreshToken', { path: '/api/auth' });
}

export const register = asyncHandler(async (req, res) => {
  const { name, email, password, grade } = req.body;
  const user = await registerStudent({ name, email, password, grade });

  // No session is issued here anymore - the account exists but login is
  // refused (see validateCredentials's EMAIL_NOT_VERIFIED check) until the
  // student proves ownership of this email via the link below.
  const rawToken = await createEmailVerificationToken(user._id);
  const verifyUrl = `${env.clientUrl}/verify-email?token=${rawToken}`;
  const { subject, html, text } = emailVerificationEmail(verifyUrl);
  const emailResult = await sendEmail({ to: user.email, subject, html, text });

  const data = { user: user.toJSON() };
  if (!emailResult.delivered) {
    // Same honesty contract used for teacher credential delivery elsewhere
    // in this project: when the mail transport isn't configured in this
    // environment, never silently strand the only path to activating the
    // account - surface the real, working link directly in the response.
    data.verificationUrlFallback = verifyUrl;
  }

  return sendSuccess(res, {
    status: 201,
    message: emailResult.delivered
      ? 'Registration successful! Check your email to verify your account before logging in.'
      : 'Registration successful, but the verification email could not be sent — see verificationUrlFallback to activate your account.',
    data,
  });
});

export const verifyEmail = asyncHandler(async (req, res) => {
  const { token } = req.body;
  const userId = await consumeEmailVerificationToken(token);

  const user = await User.findById(userId);
  if (!user) {
    throw AppError.badRequest('This verification link is invalid or has expired.', 'INVALID_VERIFICATION_TOKEN');
  }

  user.isVerified = true;
  user.lastLoginAt = new Date();
  await user.save();

  // Good UX: verifying logs you straight in, rather than sending the
  // student back to a login form immediately after they just proved who
  // they are.
  const { accessToken, refreshToken } = await issueTokenPair(user, requestMeta(req));
  setAuthCookies(res, accessToken, refreshToken);

  return sendSuccess(res, {
    message: 'Email verified! You are now logged in.',
    data: { user: user.toJSON(), accessToken },
  });
});

export const resendVerification = asyncHandler(async (req, res) => {
  const { email } = req.body;
  const user = await User.findOne({ email });

  // Same enumeration-safe shape as forgotPassword: identical response
  // whether or not the account exists, or is already verified.
  if (user && !user.isVerified) {
    const rawToken = await createEmailVerificationToken(user._id);
    const verifyUrl = `${env.clientUrl}/verify-email?token=${rawToken}`;
    const { subject, html, text } = emailVerificationEmail(verifyUrl);
    await sendEmail({ to: user.email, subject, html, text });
  }

  return sendSuccess(res, {
    message: 'If an unverified account exists for that email, a new verification link has been sent.',
  });
});

export const login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;
  const user = await validateCredentials(email, password);

  const { accessToken, refreshToken } = await issueTokenPair(user, requestMeta(req));
  setAuthCookies(res, accessToken, refreshToken);

  user.lastLoginAt = new Date();
  await user.save();

  return sendSuccess(res, {
    message: 'Login successful.',
    data: { user: user.toJSON(), accessToken },
  });
});

export const googleAuth = asyncHandler(async (req, res) => {
  const { idToken } = req.body;
  const identity = await verifyGoogleIdToken(idToken);
  const { user, isNewUser } = await findOrCreateGoogleUser(identity);

  const { accessToken, refreshToken } = await issueTokenPair(user, requestMeta(req));
  setAuthCookies(res, accessToken, refreshToken);

  user.lastLoginAt = new Date();
  await user.save();

  return sendSuccess(res, {
    status: isNewUser ? 201 : 200,
    message: isNewUser ? 'Welcome to Nalanda Nexus!' : 'Login successful.',
    data: { user: user.toJSON(), accessToken, isNewUser },
  });
});

export const me = asyncHandler(async (req, res) => {
  const profile = req.user.role === 'student' ? await StudentProfile.findOne({ userId: req.user._id }) : null;
  return sendSuccess(res, {
    data: { user: req.user.toJSON(), profile },
  });
});

export const refresh = asyncHandler(async (req, res) => {
  const rawRefreshToken = req.cookies?.refreshToken || req.body?.refreshToken;
  if (!rawRefreshToken) {
    throw AppError.unauthorized('No active session to refresh.', 'NO_REFRESH_TOKEN');
  }

  const { user, accessToken, refreshToken } = await rotateRefreshToken(rawRefreshToken, requestMeta(req));
  setAuthCookies(res, accessToken, refreshToken);

  return sendSuccess(res, {
    message: 'Session refreshed.',
    data: { user: user.toJSON(), accessToken },
  });
});

export const logout = asyncHandler(async (req, res) => {
  const rawRefreshToken = req.cookies?.refreshToken || req.body?.refreshToken;
  await revokeRefreshToken(rawRefreshToken);
  clearAuthCookies(res);
  return sendSuccess(res, { message: 'Logged out successfully.' });
});

export const forgotPassword = asyncHandler(async (req, res) => {
  const { email } = req.body;
  const user = await User.findOne({ email });

  // Always return the same response whether or not the account exists -
  // prevents account enumeration (master doc section 13).
  if (user) {
    const rawToken = await createPasswordResetToken(user._id);
    const resetUrl = `${env.clientUrl}/reset-password?token=${rawToken}`;
    const { subject, html, text } = passwordResetEmail(resetUrl);
    await sendEmail({ to: user.email, subject, html, text });
  }

  return sendSuccess(res, {
    message: 'If an account exists for that email, a password reset link has been sent.',
  });
});

export const resetPassword = asyncHandler(async (req, res) => {
  const { token, password } = req.body;
  const userId = await consumePasswordResetToken(token);

  const user = await User.findById(userId);
  if (!user) {
    throw AppError.badRequest('This reset link is invalid or has expired.', 'INVALID_RESET_TOKEN');
  }

  user.passwordHash = await hashPassword(password);
  await user.save();

  // Reset password = force re-login everywhere for safety.
  await revokeAllSessionsForUser(user._id);

  return sendSuccess(res, { message: 'Password reset successfully. Please log in with your new password.' });
});
