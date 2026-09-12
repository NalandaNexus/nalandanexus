import { env } from '../config/env.js';
import { catchAsync } from '../utils/catchAsync.js';
import { sendSuccess } from '../utils/ApiResponse.js';
import * as authService from '../services/auth.service.js';

/**
 * Session cookie attributes.
 *
 * httpOnly keeps the token out of reach of any script on the page, which is the
 * whole point of moving off localStorage: an XSS anywhere in the admin bundle
 * could previously read the SUPER_ADMIN token and exfiltrate it. Secure is
 * required whenever SameSite is None, and both are needed because the admin
 * frontend and this API sit on different registrable domains.
 */
function cookieOptions() {
  return {
    httpOnly: true,
    secure: env.nodeEnv === 'production' || env.cookieSameSite === 'none',
    sameSite: env.cookieSameSite,
    path: '/',
    maxAge: 1000 * 60 * 60 * 12,
  };
}

export const login = catchAsync(async (req, res) => {
  const { token, admin } = await authService.login(req.body, req);
  res.cookie(env.cookieName, token, cookieOptions());
  // The token is NOT returned in the body. It was, during the migration to
  // cookies, so that an already-deployed frontend authenticating with it would
  // not be signed out in the window between the two deploys - both are now
  // live on the cookie, which was the condition for dropping it.
  //
  // Returning it undid most of the reason for the move: httpOnly exists so a
  // SUPER_ADMIN token is out of reach of any script on the page, and a token
  // handed to JavaScript on every login is reachable by anything that hooks
  // fetch, including a compromised dependency.
  return sendSuccess(res, { data: { admin }, message: 'Login successful' });
});

export const logout = catchAsync(async (req, res) => {
  await authService.logout(req.admin, req);
  // Same attributes as when it was set, or the browser keeps the old cookie.
  res.clearCookie(env.cookieName, cookieOptions());
  return sendSuccess(res, { message: 'Logged out successfully' });
});

export const me = catchAsync(async (req, res) => {
  const admin = await authService.getSelf(req.admin);
  return sendSuccess(res, { data: admin });
});

export const changePassword = catchAsync(async (req, res) => {
  const { token } = await authService.changePassword(req.admin, req.body, req);
  // Changing the password bumps tokenVersion, invalidating every existing
  // session including this browser's cookie - so it must be replaced here or
  // the admin is signed out by their own password change.
  res.cookie(env.cookieName, token, cookieOptions());
  // Same reasoning as login: the new session travels in the httpOnly cookie set
  // above, and nothing needs a copy of it in reach of the page.
  return sendSuccess(res, { message: 'Password changed successfully' });
});

export default { login, logout, me, changePassword };
