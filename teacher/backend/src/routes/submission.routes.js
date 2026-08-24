import { Router } from 'express';
import * as submissionController from '../controllers/submission.controller.js';
import { authenticate, requireRole } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { objectIdParam } from '../validators/common.js';
import { gradeSubmissionValidator } from '../validators/submission.validators.js';

const router = Router();
router.use(authenticate, requireRole('teacher'));

router.get('/:id', objectIdParam('id'), validate, submissionController.getSubmission);
router.patch('/:id/record', objectIdParam('id'), validate, submissionController.recordSubmission);
router.patch('/:id/grade', objectIdParam('id'), gradeSubmissionValidator, validate, submissionController.gradeSubmission);

export default router;
