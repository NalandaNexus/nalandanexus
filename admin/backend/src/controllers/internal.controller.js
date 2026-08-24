import { catchAsync } from '../utils/catchAsync.js';
import { sendSuccess } from '../utils/ApiResponse.js';
import * as paymentService from '../services/payment.service.js';
import * as academicsService from '../services/academics.service.js';
import * as announcementService from '../services/announcement.service.js';

/**
 * Receives a real, signature-verified Razorpay payment event from
 * student/backend (see student/backend/src/services/adminPaymentBridge.service.js).
 * Service-to-service only - authenticated by requireInternalServiceKey,
 * never a user session.
 */
export const ingestPayment = catchAsync(async (req, res) => {
  const payment = await paymentService.ingestBridgedPayment(req.body);
  return sendSuccess(res, { statusCode: 201, message: 'Payment recorded.', data: payment });
});

/** Receives live assignment/submission activity from teacher/backend (see teacher/backend/src/services/adminBridge.service.js). */
export const ingestAssignmentActivity = catchAsync(async (req, res) => {
  const row = await academicsService.ingestAssignmentActivity(req.body);
  return sendSuccess(res, { statusCode: 201, message: 'Assignment activity recorded.', data: row });
});

/** Receives live exam/quiz activity from teacher/backend. */
export const ingestQuizActivity = catchAsync(async (req, res) => {
  const row = await academicsService.ingestQuizActivity(req.body);
  return sendSuccess(res, { statusCode: 201, message: 'Quiz activity recorded.', data: row });
});

/** Receives a daily per-class attendance tally from teacher/backend. */
export const ingestAttendanceSummary = catchAsync(async (req, res) => {
  const row = await academicsService.ingestAttendanceSummary(req.body);
  return sendSuccess(res, { statusCode: 201, message: 'Attendance summary recorded.', data: row });
});

/** Receives a real, published announcement from teacher/backend. Idempotent on sourceId. */
export const ingestTeacherAnnouncement = catchAsync(async (req, res) => {
  const announcement = await announcementService.ingestTeacherAnnouncement(req.body);
  return sendSuccess(res, { statusCode: 201, message: 'Teacher announcement recorded.', data: announcement });
});

/** Retracts a previously-bridged teacher announcement — used when the teacher archives/deletes the source. Idempotent. */
export const retractTeacherAnnouncement = catchAsync(async (req, res) => {
  await announcementService.retractTeacherAnnouncement(req.params.sourceId);
  return sendSuccess(res, { message: 'Removed.', data: { sourceId: req.params.sourceId } });
});

export default {
  ingestPayment,
  ingestAssignmentActivity,
  ingestQuizActivity,
  ingestAttendanceSummary,
  ingestTeacherAnnouncement,
  retractTeacherAnnouncement,
};
