import { Router } from 'express';
import * as studentController from '../controllers/student.controller.js';
import * as progressController from '../controllers/studentProgress.controller.js';
import { authenticate, requireRole } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { objectIdParam, paginationQuery } from '../validators/common.js';
import { createStudentValidator, updateStudentValidator, listStudentsValidator } from '../validators/student.validators.js';

const router = Router();
router.use(authenticate, requireRole('teacher'));

// Progression monitoring. Declared before '/:id' so 'progress' is not read as
// a student id.
router.get('/progress', progressController.listStudents);
router.get('/progress/:id', objectIdParam('id'), validate, progressController.getStudentDetail);

router.get('/', listStudentsValidator, paginationQuery, validate, studentController.listStudents);
router.post('/', createStudentValidator, validate, studentController.createStudent);
router.get('/:id', objectIdParam('id'), validate, studentController.getStudent);
router.patch('/:id', objectIdParam('id'), updateStudentValidator, validate, studentController.updateStudent);
router.delete('/:id', objectIdParam('id'), validate, studentController.archiveStudent);

export default router;
