import path from 'node:path';
import { catchAsync } from '../utils/catchAsync.js';
import { sendSuccess } from '../utils/ApiResponse.js';
import { ApiError } from '../utils/ApiError.js';
import * as teacherService from '../services/teacher.service.js';
import { publicUrlFor } from '../middleware/upload.js';

export const getProfile = catchAsync(async (req, res) => {
  const profile = await teacherService.getProfile(req.teacher._id);
  sendSuccess(res, { data: profile });
});

export const updateProfile = catchAsync(async (req, res) => {
  const profile = await teacherService.updateProfile(req.teacher._id, req.body, req.ip);
  sendSuccess(res, { message: 'Profile updated successfully.', data: profile });
});

export const updatePreferences = catchAsync(async (req, res) => {
  const profile = await teacherService.updatePreferences(req.teacher._id, req.body);
  sendSuccess(res, { message: 'Preferences updated.', data: profile });
});

export const uploadAvatar = catchAsync(async (req, res, next) => {
  if (!req.file) {
    return next(ApiError.badRequest('An image file is required.', 'FILE_REQUIRED'));
  }
  const url = publicUrlFor('avatars', path.basename(req.file.path));
  const profile = await teacherService.updateAvatar(req.teacher._id, url);
  sendSuccess(res, { message: 'Avatar updated.', data: profile });
});

export default { getProfile, updateProfile, updatePreferences, uploadAvatar };
