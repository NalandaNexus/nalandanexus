import { catchAsync } from '../utils/catchAsync.js';
import { sendSuccess } from '../utils/ApiResponse.js';
import * as authService from '../services/auth.service.js';
import { setSessionCookie, clearSessionCookie } from '../utils/sessionCookie.js';

export const login = catchAsync(async (req, res) => {
  const { token, admin } = await authService.login(req.body, req);
  // The browser client authenticates from this httpOnly cookie and never
  // stores the token itself. `token` stays in the body for non-browser
  // callers using the Bearer path, which middleware/auth.js still accepts.
  setSessionCookie(req, res, token, { remember: Boolean(req.body?.rememberMe) });
  return sendSuccess(res, { data: { token, admin }, message: 'Login successful' });
});

export const logout = catchAsync(async (req, res) => {
  await authService.logout(req.admin, req);
  clearSessionCookie(req, res);
  return sendSuccess(res, { message: 'Logged out successfully' });
});

export const me = catchAsync(async (req, res) => {
  const admin = await authService.getSelf(req.admin);
  return sendSuccess(res, { data: admin });
});

export const changePassword = catchAsync(async (req, res) => {
  // Changing the password bumps tokenVersion, invalidating every existing
  // session - including the cookie this request arrived with. Re-issue it,
  // or the admin is silently logged out by their own password change.
  const { token } = await authService.changePassword(req.admin, req.body, req);
  setSessionCookie(req, res, token);
  return sendSuccess(res, { data: { token }, message: 'Password changed successfully' });
});

export default { login, logout, me, changePassword };
