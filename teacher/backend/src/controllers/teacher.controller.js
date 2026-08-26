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
  // req.file.filename is the stored identifier: a Cloudinary delivery URL
  // in production, a generated disk filename locally. publicUrlFor handles
  // both. (It used to read basename(req.file.path), which only exists on
  // the disk path and yields the wrong thing for a URL.)
  const url = publicUrlFor('avatars', req.file.filename);
  const profile = await teacherService.updateAvatar(req.teacher._id, url);
  sendSuccess(res, { message: 'Avatar updated.', data: profile });
});

export default { getProfile, updateProfile, updatePreferences, uploadAvatar };
