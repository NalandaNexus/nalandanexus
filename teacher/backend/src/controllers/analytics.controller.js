import { catchAsync } from '../utils/catchAsync.js';
import { sendSuccess } from '../utils/ApiResponse.js';
import * as analyticsService from '../services/analytics.service.js';

export const getAvgScoreBreakdown = catchAsync(async (req, res) => {
  const data = await analyticsService.getAvgScoreBreakdown(req.teacher._id);
  sendSuccess(res, { data });
});

export const getConceptPerformance = catchAsync(async (req, res) => {
  const data = await analyticsService.getConceptPerformance(req.teacher._id);
  sendSuccess(res, { data });
});

export const getPerformanceTrend = catchAsync(async (req, res) => {
  const { range, classId } = req.query;
  const studentIds = typeof req.query.studentIds === 'string' ? req.query.studentIds.split(',').filter(Boolean) : [];
  const data = await analyticsService.getPerformanceTrend(req.teacher._id, { range, classId, studentIds });
  sendSuccess(res, { data });
});

export const getGradebook = catchAsync(async (req, res) => {
  const data = await analyticsService.getGradebook(req.teacher._id, req.query.classId);
  sendSuccess(res, { data });
});

export default { getAvgScoreBreakdown, getConceptPerformance, getPerformanceTrend, getGradebook };
