import { catchAsync } from '../utils/catchAsync.js';
import { sendSuccess } from '../utils/ApiResponse.js';
import * as teacherService from '../services/teacher.service.js';

export const list = catchAsync(async (req, res) => {
  const { items, meta } = await teacherService.listTeachers(req.query);
  return sendSuccess(res, { data: items, meta });
});

export const getById = catchAsync(async (req, res) => {
  const teacher = await teacherService.getTeacherById(req.params.id);
  return sendSuccess(res, { data: teacher });
});

export const create = catchAsync(async (req, res) => {
  const { teacher, warnings, tempPasswordFallback } = await teacherService.createTeacher(req.body, req.admin, req);
  const message = warnings.length
    ? 'Teacher created, but needs attention — see warnings.'
    : 'Teacher created and Teacher Portal access provisioned successfully.';
  // `select: false` on Teacher.passwordHash only affects query projections,
  // not a document just returned from `.create()` — strip it explicitly so
  // the hash never reaches the response.
  const { passwordHash, ...safeTeacher } = teacher.toObject();
  return sendSuccess(res, {
    statusCode: 201,
    data: { ...safeTeacher, tempPasswordFallback },
    message,
    meta: { warnings },
  });
});

export const update = catchAsync(async (req, res) => {
  const teacher = await teacherService.updateTeacher(req.params.id, req.body, req.admin, req);
  return sendSuccess(res, { data: teacher, message: 'Teacher updated successfully' });
});

export const remove = catchAsync(async (req, res) => {
  await teacherService.deleteTeacher(req.params.id, req.admin, req);
  return sendSuccess(res, { message: 'Teacher removed successfully' });
});

export const resendInvite = catchAsync(async (req, res) => {
  await teacherService.resendInvite(req.params.id, req.admin, req);
  return sendSuccess(res, { message: 'Invitation resent' });
});

export const resendCredentials = catchAsync(async (req, res) => {
  const { teacher, warnings, tempPasswordFallback } = await teacherService.resendCredentials(req.params.id, req.admin, req);
  const message = warnings.length
    ? 'Credentials resent, but needs attention — see warnings.'
    : 'New credentials generated and emailed successfully.';
  const { passwordHash, ...safeTeacher } = teacher.toObject();
  return sendSuccess(res, { data: { ...safeTeacher, tempPasswordFallback }, message, meta: { warnings } });
});

export const revokeInvite = catchAsync(async (req, res) => {
  await teacherService.revokeInvite(req.params.id, req.admin, req);
  return sendSuccess(res, { message: 'Invitation revoked' });
});

export const suspend = catchAsync(async (req, res) => {
  const teacher = await teacherService.suspendTeacher(req.params.id, req.body.reason, req.admin, req);
  return sendSuccess(res, { data: teacher, message: 'Teacher suspended' });
});

export const reactivate = catchAsync(async (req, res) => {
  const teacher = await teacherService.reactivateTeacher(req.params.id, req.admin, req);
  return sendSuccess(res, { data: teacher, message: 'Teacher reactivated' });
});

export const resetPassword = catchAsync(async (req, res) => {
  await teacherService.requestPasswordReset(req.params.id, req.admin, req);
  return sendSuccess(res, { message: 'Password reset email sent' });
});

export const verifyInvite = catchAsync(async (req, res) => {
  const data = await teacherService.verifyInviteToken(req.params.token);
  return sendSuccess(res, { data });
});

export const activate = catchAsync(async (req, res) => {
  const data = await teacherService.activateTeacherAccount(req.body);
  return sendSuccess(res, { data, message: 'Account activated successfully' });
});

export default { list, getById, create, update, remove, resendInvite, resendCredentials, revokeInvite, suspend, reactivate, resetPassword, verifyInvite, activate };
