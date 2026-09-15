import { Router } from 'express';
import * as taskController from '../controllers/task.controller.js';
import { resolveCourseIdFromTaskParam } from '../controllers/task.controller.js';
import { authenticate } from '../middleware/authenticate.js';
import { requireRole } from '../middleware/authorize.js';
import { requireEnrollment } from '../middleware/requireEnrollment.js';
import { requireCompleteProfile } from '../middleware/requireCompleteProfile.js';
import { validate } from '../middleware/validate.js';
import { submitTaskSchema } from '../validators/task.validators.js';

const router = Router();

router.use(authenticate, requireRole('student'));

router.get('/', requireCompleteProfile, taskController.listMyTasks);
router.get('/:taskId', requireEnrollment(resolveCourseIdFromTaskParam), taskController.getTaskDetail);
router.post(
  '/:taskId/submit',
  requireEnrollment(resolveCourseIdFromTaskParam),
  validate(submitTaskSchema),
  taskController.submitTask
);

export default router;
