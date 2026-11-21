import { Router } from 'express';
import * as internalController from '../controllers/internal.controller.js';
import { requireInternalServiceKey } from '../middleware/internalService.js';
import { validate } from '../middleware/validate.js';
import {
  ingestPaymentSchema,
  ingestAssignmentActivitySchema,
  ingestQuizActivitySchema,
  ingestAttendanceSummarySchema,
  ingestTeacherAnnouncementSchema,
  upsertPortalStudentSchema,
  teacherPasswordResetEmailSchema,
  courseVideoChangedSchema,
} from '../validators/internal.validators.js';

// Service-to-service only - authenticated by a shared secret
// (requireInternalServiceKey), never a user session. Mounted at
// /api/internal directly (see app.js), NOT under /api/admin, so it is
// never subject to that group's user-session `authenticate` middleware.
const router = Router();
router.use(requireInternalServiceKey);

router.post('/payments', validate(ingestPaymentSchema), internalController.ingestPayment);
router.post('/academics/assignments', validate(ingestAssignmentActivitySchema), internalController.ingestAssignmentActivity);
router.post('/academics/quizzes', validate(ingestQuizActivitySchema), internalController.ingestQuizActivity);
router.post('/academics/attendance', validate(ingestAttendanceSummarySchema), internalController.ingestAttendanceSummary);
router.post('/teacher-announcements', validate(ingestTeacherAnnouncementSchema), internalController.ingestTeacherAnnouncement);
router.delete('/teacher-announcements/:sourceId', internalController.retractTeacherAnnouncement);
// A portal student's current record, keyed on their student-portal user id.
router.put('/portal-students/:userId', validate(upsertPortalStudentSchema), internalController.upsertPortalStudent);
// A teacher's self-service password-reset link, which the Teacher service asks Admin to email.
// The student service saying a module/lesson video changed; relayed live to signed-in admins.
router.post('/course-videos/events', validate(courseVideoChangedSchema), internalController.relayCourseVideoChange);
router.post('/teacher-emails/password-reset', validate(teacherPasswordResetEmailSchema), internalController.sendTeacherPasswordReset);

export default router;
