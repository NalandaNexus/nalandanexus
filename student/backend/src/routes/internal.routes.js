import { Router } from 'express';
import * as internalController from '../controllers/internal.controller.js';
import { requireInternalServiceKey } from '../middleware/internalService.js';
import { validate } from '../middleware/validate.js';
import {
  createBridgedAnnouncementSchema,
  updateBridgedAnnouncementSchema,
  createBridgedMaterialSchema,
  upsertBridgedTaskSchema,
  createBridgedLiveClassSchema,
  updateBridgedLiveClassSchema,
  enrolledStudentsQuerySchema,
  upsertBridgedQuizSchema,
  deliverTeacherMessageSchema,
  upsertBridgedCourseSchema,
  unpublishBridgedCourseSchema,
  upsertBridgedResourceSchema,
  retractBridgedResourceSchema,
  gradeBridgedTaskSubmissionSchema,
} from '../validators/internal.validators.js';

// Service-to-service only - authenticated by a shared secret
// (requireInternalServiceKey), never a user JWT. Not reachable by any
// student/teacher/admin session, by design.
const router = Router();
router.use(requireInternalServiceKey);

router.post('/announcements', validate(createBridgedAnnouncementSchema), internalController.createBridgedAnnouncement);
router.patch('/announcements/:sourceId', validate(updateBridgedAnnouncementSchema), internalController.updateBridgedAnnouncement);
router.delete('/announcements/:sourceId', internalController.deleteBridgedAnnouncement);

router.post('/materials', validate(createBridgedMaterialSchema), internalController.createBridgedMaterial);
router.delete('/materials/:sourceId', internalController.deleteBridgedMaterial);

router.post('/tasks', validate(upsertBridgedTaskSchema), internalController.upsertBridgedTask);
router.patch('/tasks', validate(upsertBridgedTaskSchema), internalController.upsertBridgedTask);
router.delete('/tasks/:sourceId', internalController.retractBridgedTask);

router.post('/live-classes', validate(createBridgedLiveClassSchema), internalController.createBridgedLiveClass);
router.patch('/live-classes/:sourceId', validate(updateBridgedLiveClassSchema), internalController.updateBridgedLiveClass);
router.delete('/live-classes/:sourceId', internalController.retractBridgedLiveClass);

router.get('/courses/:slug/enrolled-students', validate(enrolledStudentsQuerySchema), internalController.listEnrolledStudents);

router.post('/quizzes', validate(upsertBridgedQuizSchema), internalController.upsertBridgedQuiz);
router.patch('/quizzes', validate(upsertBridgedQuizSchema), internalController.upsertBridgedQuiz);
router.delete('/quizzes/:sourceId', internalController.retractBridgedQuiz);

router.post('/messages', validate(deliverTeacherMessageSchema), internalController.deliverTeacherMessage);

router.post('/courses', validate(upsertBridgedCourseSchema), internalController.upsertBridgedCourse);
router.patch('/courses/:sourceId/unpublish', validate(unpublishBridgedCourseSchema), internalController.unpublishBridgedCourse);

router.post('/resources', validate(upsertBridgedResourceSchema), internalController.upsertBridgedResource);
router.patch('/resources', validate(upsertBridgedResourceSchema), internalController.upsertBridgedResource);
router.delete('/resources/:sourceId', validate(retractBridgedResourceSchema), internalController.retractBridgedResource);

router.patch(
  '/task-submissions/:sourceId/grade',
  validate(gradeBridgedTaskSubmissionSchema),
  internalController.gradeBridgedTaskSubmission
);

export default router;
