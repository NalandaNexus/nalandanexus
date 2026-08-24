import { Router } from 'express';
import * as assignmentController from '../controllers/assignment.controller.js';
import { authenticate, requireRole } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { objectIdParam } from '../validators/common.js';
import { createAssignmentValidator, updateAssignmentValidator } from '../validators/assignment.validators.js';

const router = Router();
router.use(authenticate, requireRole('teacher'));

router.get('/', assignmentController.listAssignments);
router.post('/', createAssignmentValidator, validate, assignmentController.createAssignment);
router.get('/:id', objectIdParam('id'), validate, assignmentController.getAssignment);
router.patch('/:id', objectIdParam('id'), updateAssignmentValidator, validate, assignmentController.updateAssignment);
router.delete('/:id', objectIdParam('id'), validate, assignmentController.archiveAssignment);
router.get('/:id/submissions', objectIdParam('id'), validate, assignmentController.listSubmissions);

export default router;
