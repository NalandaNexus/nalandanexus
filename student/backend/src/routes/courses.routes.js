import { Router } from 'express';
import * as courseController from '../controllers/course.controller.js';
import * as reviewController from '../controllers/review.controller.js';
import { authenticate } from '../middleware/authenticate.js';
import { requireRole } from '../middleware/authorize.js';
import { requireEnrollment } from '../middleware/requireEnrollment.js';
import { validate } from '../middleware/validate.js';
import { createReviewSchema, updateReviewSchema } from '../validators/review.validators.js';
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

// --- Reviews -------------------------------------------------------------
// Every write is behind requireEnrollment, so only a student who actually
// holds an active (paid) enrollment for this course can rate it. That gate is
// the same one protecting the course content itself, and it is enforced
// server-side regardless of what the client claims.
router
  .route('/:slug/review')
  .get(requireEnrollment(resolveCourseIdFromSlugParam), reviewController.getMyReview)
  .post(
    requireEnrollment(resolveCourseIdFromSlugParam),
    validate(createReviewSchema),
    reviewController.createReview
  )
  .patch(
    requireEnrollment(resolveCourseIdFromSlugParam),
    validate(updateReviewSchema),
    reviewController.updateReview
  )
  .delete(requireEnrollment(resolveCourseIdFromSlugParam), reviewController.deleteReview);

export default router;
