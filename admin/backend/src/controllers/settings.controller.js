import { catchAsync } from '../utils/catchAsync.js';
import { sendSuccess } from '../utils/ApiResponse.js';
import * as settingsService from '../services/settings.service.js';
import { env } from '../config/env.js';

export const get = catchAsync(async (req, res) => {
  const settings = await settingsService.getSettings();
  // Derived from real env state, not a persisted preference — lets the
  // frontend show an honest email-delivery status instead of a hardcoded
  // "dev mode" label written before real email integration existed.
  const smtpStatus = env.email.sendgridApiKey ? 'CONFIGURED' : 'NOT_CONFIGURED';
  return sendSuccess(res, { data: { ...settings.toObject(), smtpStatus } });
});

export const update = catchAsync(async (req, res) => {
  const settings = await settingsService.updateSettings(req.body, req.admin, req);
  return sendSuccess(res, { data: settings, message: 'Settings updated successfully' });
});

export default { get, update };
