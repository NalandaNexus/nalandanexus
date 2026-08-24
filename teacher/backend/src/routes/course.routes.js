import { Router } from 'express';
import * as courseController from '../controllers/course.controller.js';
import { authenticate, requireRole } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { objectIdParam } from '../validators/common.js';
import { createCourseValidator, updateCourseValidator } from '../validators/course.validators.js';

const router = Router();
router.use(authenticate, requireRole('teacher'));

router.get('/', courseController.listCourses);
router.get('/assigned', courseController.listAssigned);
router.post('/', createCourseValidator, validate, courseController.createCourse);
router.patch('/:id', objectIdParam('id'), updateCourseValidator, validate, courseController.updateCourse);
router.delete('/:id', objectIdParam('id'), validate, courseController.archiveCourse);

export default router;
