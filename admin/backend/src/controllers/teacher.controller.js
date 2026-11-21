import { catchAsync } from '../utils/catchAsync.js';
import { sendSuccess } from '../utils/ApiResponse.js';
import { ApiError } from '../utils/ApiError.js';
import * as teacherService from '../services/teacher.service.js';
import { storeTeacherPhoto } from '../services/fileStorage.service.js';

/** The password hash is never part of an API response, even where Mongoose would have included it. */
function safe(teacher) {
  const { passwordHash, ...rest } = teacher.toObject ? teacher.toObject() : teacher;
  return rest;
}

export const list = catchAsync(async (req, res) => {
  const { items, meta } = await teacherService.listTeachers(req.query);
  return sendSuccess(res, { data: items, meta });
});

export const getById = catchAsync(async (req, res) => {
  const teacher = await teacherService.getTeacherById(req.params.id);
  // Courses an administrator authored and made this teacher instructor of are a
  // different thing from the catalogue courses assigned to them; the profile
  // shows both.
  const authoredCourses = await teacherService.getTeacherAuthoredCourses(teacher._id);
  return sendSuccess(res, { data: { ...safe(teacher), authoredCourses } });
});

export const create = catchAsync(async (req, res) => {
  const { teacher, warnings, restored, relinked } = await teacherService.createTeacher(req.body, req.admin, req);
  const verb = restored ? 'Teacher restored' : 'Teacher created';
  const message = warnings.length
    ? `${verb}, but needs attention — see warnings.`
    : `${verb}. Their sign-in details (email, Teacher ID and a temporary password) have been emailed to them.`;
  return sendSuccess(res, {
    statusCode: 201,
    // The temporary password is never part of a response: it exists only in the
    // email the teacher receives. "Resend login details" issues a new one.
    data: safe(teacher),
    message,
    meta: { warnings, restored: Boolean(restored), relinked: Boolean(relinked) },
  });
});

export const update = catchAsync(async (req, res) => {
  const teacher = await teacherService.updateTeacher(req.params.id, req.body, req.admin, req);
  return sendSuccess(res, { data: safe(teacher), message: 'Teacher updated successfully' });
});

export const setCourses = catchAsync(async (req, res) => {
  const { teacher, warnings } = await teacherService.setTeacherCourses(req.params.id, req.body.courseSlugs, req.admin, req);
  const message = warnings.length
    ? 'Courses saved, but the Teacher Portal has not received them — see warnings.'
    : 'Courses assigned. Their enrolled students are now visible to the teacher.';
  return sendSuccess(res, { data: safe(teacher), message, meta: { warnings } });
});

/** Stores the teacher's profile photo durably and points the record, the Teacher Portal and the public profile at it. */
export const uploadPhoto = catchAsync(async (req, res) => {
  if (!req.file) throw ApiError.badRequest('Choose an image to upload.', 'FILE_REQUIRED');
  const teacher = await teacherService.getTeacherById(req.params.id);
  const url = await storeTeacherPhoto({ ownerId: teacher._id, file: req.file });
  const updated = await teacherService.updateTeacher(req.params.id, { avatar: url }, req.admin, req);
  return sendSuccess(res, { data: safe(updated), message: 'Photo updated' });
});

export const remove = catchAsync(async (req, res) => {
  await teacherService.deleteTeacher(req.params.id, req.admin, req);
  return sendSuccess(res, { message: 'Teacher removed successfully' });
});

export const resendInvite = catchAsync(async (req, res) => {
  await teacherService.resendInvite(req.params.id, req.admin, req);
  return sendSuccess(res, { message: 'Invitation resent' });
});

/** Issues and emails a new temporary password. Every earlier one stops working. */
export const resendCredentials = catchAsync(async (req, res) => {
  const { teacher, warnings } = await teacherService.resendCredentials(req.params.id, req.admin, req);
  const message = warnings.length
    ? 'New sign-in details could not be fully sent — see warnings.'
    : 'New sign-in details have been emailed. Any earlier temporary password no longer works.';
  return sendSuccess(res, { data: safe(teacher), message, meta: { warnings } });
});

export const revokeInvite = catchAsync(async (req, res) => {
  await teacherService.revokeInvite(req.params.id, req.admin, req);
  return sendSuccess(res, { message: 'Invitation revoked' });
});

export const suspend = catchAsync(async (req, res) => {
  const teacher = await teacherService.suspendTeacher(req.params.id, req.body.reason, req.admin, req);
  return sendSuccess(res, { data: safe(teacher), message: 'Teacher suspended' });
});

export const reactivate = catchAsync(async (req, res) => {
  const teacher = await teacherService.reactivateTeacher(req.params.id, req.admin, req);
  return sendSuccess(res, { data: safe(teacher), message: 'Teacher reactivated' });
});

export const verifyInvite = catchAsync(async (req, res) => {
  const data = await teacherService.verifyInviteToken(req.params.token);
  return sendSuccess(res, { data });
});

export const activate = catchAsync(async (req, res) => {
  const data = await teacherService.activateTeacherAccount(req.body);
  return sendSuccess(res, { data, message: 'Account activated successfully' });
});

export default { list, getById, create, update, setCourses, uploadPhoto, remove, resendInvite, resendCredentials, revokeInvite, suspend, reactivate, verifyInvite, activate };
