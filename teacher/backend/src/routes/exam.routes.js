import { Router } from 'express';
import * as examController from '../controllers/exam.controller.js';
import { authenticate, requireRole } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { objectIdParam } from '../validators/common.js';
import { createExamValidator, updateExamValidator } from '../validators/exam.validators.js';

const router = Router();
router.use(authenticate, requireRole('teacher'));

router.get('/', examController.listExams);
router.post('/', createExamValidator, validate, examController.createExam);
router.patch('/:id', objectIdParam('id'), updateExamValidator, validate, examController.updateExam);
router.delete('/:id', objectIdParam('id'), validate, examController.deleteExam);

export default router;
