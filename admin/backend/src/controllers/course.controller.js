import { catchAsync } from '../utils/catchAsync.js';
import { sendSuccess } from '../utils/ApiResponse.js';
import { publicUrlFor } from '../middleware/upload.js';
import * as courseService from '../services/course.service.js';

/**
 * Says what actually happened, in two parts.
 *
 * The course is saved in this database and the teacher is notified through a
 * separate service, and those succeed independently. Reporting only the first
 * let an assignment fail in silence - an admin saw "Course updated
 * successfully" whether or not the teacher would ever see the course. The save
 * is real and is kept; the sentence just stops overstating it, and the reason
 * travels in `meta` so the UI can offer a retry.
 */
function assignmentMessage(base, course, teacherAssignment) {
  if (!course.instructor || !teacherAssignment) return base;
  if (teacherAssignment.assigned) return `${base}. The assigned teacher has been notified.`;
  if (teacherAssignment.reason === 'TEACHER_NOT_FOUND' || teacherAssignment.reason === 'TEACHER_PROFILE_MISSING') {
    return `${base}, but this teacher has no Teacher Portal account yet, so the course was not assigned to them.`;
  }
  return `${base}, but the Teacher Portal could not be reached, so the teacher has not received this course yet. Save again to retry.`;
}

export const list = catchAsync(async (req, res) => {
  const { items, meta } = await courseService.listCourses(req.query);
  return sendSuccess(res, { data: items, meta });
});

export const getById = catchAsync(async (req, res) => {
  const course = await courseService.getCourseById(req.params.id);
  return sendSuccess(res, { data: course });
});

export const create = catchAsync(async (req, res) => {
  const data = { ...req.body };
  if (req.file) data.image = publicUrlFor('courses', req.file.filename);
  const { course, teacherAssignment } = await courseService.createCourse(data, req.admin, req);
  return sendSuccess(res, {
    statusCode: 201,
    data: course,
    message: assignmentMessage('Course submitted for review', course, teacherAssignment),
    meta: teacherAssignment ? { teacherAssignment } : undefined,
  });
});

export const update = catchAsync(async (req, res) => {
  const data = { ...req.body };
  if (req.file) data.image = publicUrlFor('courses', req.file.filename);
  const { course, teacherAssignment } = await courseService.updateCourse(req.params.id, data, req.admin, req);
  return sendSuccess(res, {
    data: course,
    message: assignmentMessage('Course updated successfully', course, teacherAssignment),
    meta: teacherAssignment ? { teacherAssignment } : undefined,
  });
});

export const setStatus = catchAsync(async (req, res) => {
  const { course, catalogSync } = await courseService.setCourseStatus(req.params.id, req.body, req.admin, req);
  const message =
    course.status === 'APPROVED'
      ? catalogSync?.synced
        ? `Course approved and published to the student catalog.`
        : `Course approved, but publishing to the student catalog failed — it will not appear for purchase yet.`
      : `Course marked as ${course.status.toLowerCase()}`;
  return sendSuccess(res, { data: course, message, meta: catalogSync ? { catalogSync } : undefined });
});

export const remove = catchAsync(async (req, res) => {
  await courseService.deleteCourse(req.params.id, req.admin, req);
  return sendSuccess(res, { message: 'Course archived successfully' });
});

export default { list, getById, create, update, setStatus, remove };
