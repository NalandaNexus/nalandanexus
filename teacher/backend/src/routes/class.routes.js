import { Router } from 'express';
import * as classController from '../controllers/class.controller.js';
import { authenticate, requireRole } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { objectIdParam, paginationQuery } from '../validators/common.js';
import { createClassValidator, updateClassValidator } from '../validators/class.validators.js';

const router = Router();
router.use(authenticate, requireRole('teacher'));

router.get('/', classController.listClasses);
router.get('/course-options', classController.getStudentCourseOptions);
router.post('/', createClassValidator, validate, classController.createClass);
router.get('/:id', objectIdParam('id'), validate, classController.getClass);
router.patch('/:id', objectIdParam('id'), updateClassValidator, validate, classController.updateClass);
router.delete('/:id', objectIdParam('id'), validate, classController.archiveClass);
router.get('/:id/students', objectIdParam('id'), paginationQuery, validate, classController.getClassStudents);
router.post('/:id/sync-enrollment', objectIdParam('id'), validate, classController.syncClassEnrollment);
router.get('/:id/leaderboard', objectIdParam('id'), validate, classController.getClassLeaderboard);

export default router;
