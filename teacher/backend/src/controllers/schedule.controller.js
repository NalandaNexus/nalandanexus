import { catchAsync } from '../utils/catchAsync.js';
import { sendSuccess } from '../utils/ApiResponse.js';
import * as scheduleService from '../services/schedule.service.js';

export const listSchedule = catchAsync(async (req, res) => {
  const sessions = await scheduleService.getScheduleForDate(req.teacher._id, req.query.date);
  sendSuccess(res, { data: sessions });
});

export const createSession = catchAsync(async (req, res) => {
  const session = await scheduleService.createSession(req.teacher._id, req.body, req.ip);
  sendSuccess(res, { statusCode: 201, message: 'Session scheduled.', data: session });
});

export const getTimetable = catchAsync(async (req, res) => {
  const entries = await scheduleService.getTimetable(req.teacher._id, req.query);
  sendSuccess(res, { data: entries });
});

export const updateSession = catchAsync(async (req, res) => {
  const result = await scheduleService.updateSession(req.teacher._id, req.params.id, req.body, req.ip);
  sendSuccess(res, { message: 'Session updated.', data: result });
});

export const cancelSession = catchAsync(async (req, res) => {
  const result = await scheduleService.cancelSession(req.teacher._id, req.params.id, req.ip);
  sendSuccess(res, { message: 'Session cancelled.', data: result });
});

export const getLiveSession = catchAsync(async (req, res) => {
  const liveState = await scheduleService.getActiveLiveSession(req.teacher._id);
  sendSuccess(res, { data: liveState });
});

export default { listSchedule, getTimetable, createSession, updateSession, cancelSession, getLiveSession };
