import { catchAsync } from '../utils/catchAsync.js';
import { sendSuccess } from '../utils/ApiResponse.js';
import * as paymentService from '../services/payment.service.js';
import * as academicsService from '../services/academics.service.js';
import * as announcementService from '../services/announcement.service.js';
import * as portalStudentService from '../services/portalStudent.service.js';
import { sendTeacherPasswordResetEmail } from '../services/teacher.service.js';
import { ApiError } from '../utils/ApiError.js';
import { emitEvent } from '../sockets/index.js';

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

/**
 * PUT /api/internal/portal-students/:userId
 *
 * A student's current record from the student portal - sent when they enrol
 * and whenever their profile changes - applied to the Students list here.
 * Idempotent on the user id: the same record twice updates one student.
 */
export const upsertPortalStudent = catchAsync(async (req, res) => {
  if (req.body.userId !== req.params.userId) {
    throw ApiError.badRequest('The student in the body does not match the address.', 'USER_ID_MISMATCH');
  }
  const result = await portalStudentService.upsertPortalStudent(req.body);
  return sendSuccess(res, {
    statusCode: result.outcome === 'created' ? 201 : 200,
    message: `Student record ${result.outcome}.`,
    data: result,
  });
});

/**
 * Emails a teacher's self-service password-reset link for the Teacher service,
 * which has no mail sender of its own (see teacher/backend auth.service.js
 * #requestPasswordReset). Answers 200 with the outcome either way; the link
 * itself is never logged or stored here.
 */
export const sendTeacherPasswordReset = catchAsync(async (req, res) => {
  const result = await sendTeacherPasswordResetEmail(req.body);
  return sendSuccess(res, { message: result.delivered ? 'Reset email sent.' : 'Reset email not sent.', data: result });
});

/**
 * A module or lesson video changed in the student service. Every signed-in
 * administrator is told; the notice names what changed and nothing more.
 */
export const relayCourseVideoChange = catchAsync(async (req, res) => {
  const { slug, courseId, moduleId, lessonId, action, provider, isPublished, version, actor } = req.body;
  emitEvent.courseVideoChanged({
    type: 'course_video.changed',
    slug: slug.toLowerCase(),
    courseId: courseId || null,
    moduleId: moduleId || null,
    lessonId: lessonId || null,
    action,
    provider: provider || null,
    isPublished: isPublished ?? null,
    version: version || null,
    actor: actor ? { portal: actor.portal || 'system', name: actor.name || null } : null,
    at: new Date().toISOString(),
  });
  sendSuccess(res, { message: 'Relayed', data: { relayed: true } });
});

export default {
  relayCourseVideoChange,
  sendTeacherPasswordReset,
  upsertPortalStudent,
  ingestPayment,
  ingestAssignmentActivity,
  ingestQuizActivity,
  ingestAttendanceSummary,
  ingestTeacherAnnouncement,
  retractTeacherAnnouncement,
};
