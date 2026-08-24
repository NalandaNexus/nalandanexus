import { Router } from 'express';
import * as teacherController from '../controllers/teacher.controller.js';
import { authenticate, requirePermission } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { objectIdParam } from '../validators/common.js';
import {
  listTeachersQuery,
  createTeacherSchema,
  updateTeacherSchema,
  suspendTeacherSchema,
  activateTeacherSchema,
} from '../validators/teacher.validator.js';

const router = Router();

// Public — part of the invitation-activation flow, reached before the
// invitee has any credentials at all.
router.get('/invite/:token', teacherController.verifyInvite);
router.post('/activate', validate(activateTeacherSchema), teacherController.activate);

router.use(authenticate);

router.get('/', requirePermission('teachers.read'), validate(listTeachersQuery), teacherController.list);
router.get('/:id', requirePermission('teachers.read'), validate({ params: objectIdParam() }), teacherController.getById);
router.post('/', requirePermission('teachers.create'), validate(createTeacherSchema), teacherController.create);
router.put('/:id', requirePermission('teachers.update'), validate({ params: objectIdParam(), ...updateTeacherSchema }), teacherController.update);
router.delete('/:id', requirePermission('teachers.delete'), validate({ params: objectIdParam() }), teacherController.remove);

router.post('/:id/resend-invite', requirePermission('teachers.update'), validate({ params: objectIdParam() }), teacherController.resendInvite);
router.post('/:id/resend-credentials', requirePermission('teachers.update'), validate({ params: objectIdParam() }), teacherController.resendCredentials);
router.post('/:id/revoke-invite', requirePermission('teachers.delete'), validate({ params: objectIdParam() }), teacherController.revokeInvite);
router.post('/:id/suspend', requirePermission('teachers.update'), validate({ params: objectIdParam(), ...suspendTeacherSchema }), teacherController.suspend);
router.post('/:id/reactivate', requirePermission('teachers.update'), validate({ params: objectIdParam() }), teacherController.reactivate);
router.post('/:id/reset-password', requirePermission('teachers.update'), validate({ params: objectIdParam() }), teacherController.resetPassword);

export default router;
