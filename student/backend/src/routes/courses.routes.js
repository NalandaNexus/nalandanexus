import { Router } from 'express';
import * as courseController from '../controllers/course.controller.js';
import { authenticate } from '../middleware/authenticate.js';
import { requireRole } from '../middleware/authorize.js';
import { requireEnrollment } from '../middleware/requireEnrollment.js';
import {
  resolveCourseIdFromSlugParam,
  resolveCourseIdFromLessonParam,
} from '../controllers/course.controller.js';

const router = Router();

router.use(authenticate, requireRole('student'));

router.get('/', courseController.getMyCourses);

router.get(
  '/:slug/content',
  requireEnrollment(resolveCourseIdFromSlugParam),
  courseController.getEnrolledCourseContent
);

router.post(
  '/lessons/:lessonId/progress',
  requireEnrollment(resolveCourseIdFromLessonParam),
  courseController.markLessonComplete
);

export default router;
