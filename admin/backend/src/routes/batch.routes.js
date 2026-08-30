import { Router } from 'express';
import * as batchController from '../controllers/batch.controller.js';
import { authenticate, requirePermission } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { objectIdParam } from '../validators/common.js';
import { listBatchesQuery, createBatchSchema, updateBatchSchema, reassignTeacherSchema } from '../validators/batch.validator.js';

/**
 * Batch administration.
 *
 * Guarded by the same `courses.manage` permission as course governance: a batch
 * is an instance of a course being taught, and anyone trusted to open a course
 * is the same person trusted to open its batches. Introducing a separate
 * permission would leave every existing admin unable to use this page.
 */
const router = Router();

router.use(authenticate);

router.get('/', requirePermission('courses.manage'), validate(listBatchesQuery), batchController.list);
router.post('/', requirePermission('courses.manage'), validate(createBatchSchema), batchController.create);
router.get('/:id', requirePermission('courses.manage'), validate({ params: objectIdParam() }), batchController.getById);
router.patch('/:id', requirePermission('courses.manage'), validate({ params: objectIdParam(), ...updateBatchSchema }), batchController.update);
router.patch(
  '/:id/teacher',
  requirePermission('courses.manage'),
  validate({ params: objectIdParam(), ...reassignTeacherSchema }),
  batchController.reassignTeacher
);
router.get('/:id/students', requirePermission('courses.manage'), validate({ params: objectIdParam() }), batchController.listStudents);

export default router;
