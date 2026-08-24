import { catchAsync } from '../utils/catchAsync.js';
import { sendSuccess } from '../utils/ApiResponse.js';
import * as authService from '../services/auth.service.js';

export const login = catchAsync(async (req, res) => {
  const { token, admin } = await authService.login(req.body, req);
  return sendSuccess(res, { data: { token, admin }, message: 'Login successful' });
});

export const logout = catchAsync(async (req, res) => {
  await authService.logout(req.admin, req);
  return sendSuccess(res, { message: 'Logged out successfully' });
});

export const me = catchAsync(async (req, res) => {
  const admin = await authService.getSelf(req.admin);
  return sendSuccess(res, { data: admin });
});

export const changePassword = catchAsync(async (req, res) => {
  const { token } = await authService.changePassword(req.admin, req.body, req);
  return sendSuccess(res, { data: { token }, message: 'Password changed successfully' });
});

export default { login, logout, me, changePassword };
