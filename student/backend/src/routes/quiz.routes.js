import { Router } from 'express';
import * as quizController from '../controllers/quiz.controller.js';
import { resolveCourseIdFromQuizParam } from '../controllers/quiz.controller.js';
import { authenticate } from '../middleware/authenticate.js';
import { requireRole } from '../middleware/authorize.js';
import { requireEnrollment } from '../middleware/requireEnrollment.js';
import { requireCompleteProfile } from '../middleware/requireCompleteProfile.js';
import { validate } from '../middleware/validate.js';
import { submitQuizSchema } from '../validators/quiz.validators.js';

const router = Router();

router.use(authenticate, requireRole('student'));

router.get('/', requireCompleteProfile, quizController.listMyQuizzes);
router.get('/:quizId', requireEnrollment(resolveCourseIdFromQuizParam), quizController.getQuiz);
router.post('/:quizId/start', requireEnrollment(resolveCourseIdFromQuizParam), quizController.startQuiz);
router.post(
  '/:quizId/submit',
  requireEnrollment(resolveCourseIdFromQuizParam),
  validate(submitQuizSchema),
  quizController.submitQuiz
);

export default router;
