import { Router } from 'express';
import * as studentController from '../controllers/student.controller.js';
import * as progressController from '../controllers/studentProgress.controller.js';
import * as enrollmentLookupController from '../controllers/enrollmentLookup.controller.js';
import { authenticate, requireRole } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { objectIdParam, paginationQuery } from '../validators/common.js';
import {
  createStudentValidator,
  updateStudentValidator,
  listStudentsValidator,
  enrollmentNumberParamValidator,
} from '../validators/student.validators.js';

const router = Router();
router.use(authenticate, requireRole('teacher'));

// Progression monitoring. Declared before '/:id' so 'progress' is not read as
// a student id.
router.get('/progress', progressController.listStudents);
router.get('/progress/:id', objectIdParam('id'), validate, progressController.getStudentDetail);

// One of this teacher's students by enrollment number. The teacher's own roster
// is the whole of the authorization, enforced in the service - a student outside
// it answers exactly as a number nobody holds.
router.get(
  '/enrollment-number/:enrollmentNumber',
  enrollmentNumberParamValidator,
  validate,
  enrollmentLookupController.findByEnrollmentNumber
);

router.get('/', listStudentsValidator, paginationQuery, validate, studentController.listStudents);
router.post('/', createStudentValidator, validate, studentController.createStudent);
router.get('/:id', objectIdParam('id'), validate, studentController.getStudent);
router.patch('/:id', objectIdParam('id'), updateStudentValidator, validate, studentController.updateStudent);
router.delete('/:id', objectIdParam('id'), validate, studentController.archiveStudent);

export default router;
