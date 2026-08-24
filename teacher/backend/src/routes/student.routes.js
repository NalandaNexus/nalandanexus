import { Router } from 'express';
import * as studentController from '../controllers/student.controller.js';
import { authenticate, requireRole } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { objectIdParam, paginationQuery } from '../validators/common.js';
import { createStudentValidator, updateStudentValidator, listStudentsValidator } from '../validators/student.validators.js';

const router = Router();
router.use(authenticate, requireRole('teacher'));

router.get('/', listStudentsValidator, paginationQuery, validate, studentController.listStudents);
router.post('/', createStudentValidator, validate, studentController.createStudent);
router.get('/:id', objectIdParam('id'), validate, studentController.getStudent);
router.patch('/:id', objectIdParam('id'), updateStudentValidator, validate, studentController.updateStudent);
router.delete('/:id', objectIdParam('id'), validate, studentController.archiveStudent);

export default router;
