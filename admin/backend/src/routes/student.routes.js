import { Router } from 'express';
import * as studentController from '../controllers/student.controller.js';
import { authenticate, requirePermission } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { objectIdParam } from '../validators/common.js';
import { listStudentsQuery, createStudentSchema, updateStudentSchema } from '../validators/student.validator.js';

const router = Router();

router.use(authenticate);

router.get('/', requirePermission('students.read'), validate(listStudentsQuery), studentController.list);
router.get('/:id', requirePermission('students.read'), validate({ params: objectIdParam() }), studentController.getById);
router.post('/', requirePermission('students.create'), validate(createStudentSchema), studentController.create);
router.put('/:id', requirePermission('students.update'), validate({ params: objectIdParam(), ...updateStudentSchema }), studentController.update);
router.delete('/:id', requirePermission('students.delete'), validate({ params: objectIdParam() }), studentController.remove);

export default router;
