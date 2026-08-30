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
  // The token is still returned in the body during the migration to cookies:
  // an already-deployed admin frontend authenticates with it, and frontend and
  // backend deploy independently, so removing it here would sign everyone out
  // in the window between the two deploys. The updated frontend ignores this
  // field and relies on the httpOnly cookie above. Drop it once both are live.
  return sendSuccess(res, { data: { token, admin }, message: 'Login successful' });
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
  return sendSuccess(res, { data: { token }, message: 'Password changed successfully' });
});

export default { login, logout, me, changePassword };
