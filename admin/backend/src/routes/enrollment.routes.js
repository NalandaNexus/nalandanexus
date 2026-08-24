import { Router } from 'express';
import * as enrollmentController from '../controllers/enrollment.controller.js';
import { authenticate, requirePermission } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { objectIdParam } from '../validators/common.js';
import { listEnrollmentsQuery, createEnrollmentSchema, updateEnrollmentSchema } from '../validators/enrollment.validator.js';

const router = Router();

router.use(authenticate);

router.get('/', requirePermission('courses.manage'), validate(listEnrollmentsQuery), enrollmentController.list);
router.post('/', requirePermission('courses.manage'), validate(createEnrollmentSchema), enrollmentController.create);
router.put('/:id', requirePermission('courses.manage'), validate({ params: objectIdParam(), ...updateEnrollmentSchema }), enrollmentController.update);

export default router;
