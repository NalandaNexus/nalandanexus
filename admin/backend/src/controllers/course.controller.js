import { catchAsync } from '../utils/catchAsync.js';
import { sendSuccess } from '../utils/ApiResponse.js';
import { publicUrlFor } from '../middleware/upload.js';
import * as courseService from '../services/course.service.js';

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
  const course = await courseService.createCourse(data, req.admin, req);
  return sendSuccess(res, { statusCode: 201, data: course, message: 'Course submitted for review' });
});

export const update = catchAsync(async (req, res) => {
  const data = { ...req.body };
  if (req.file) data.image = publicUrlFor('courses', req.file.filename);
  const course = await courseService.updateCourse(req.params.id, data, req.admin, req);
  return sendSuccess(res, { data: course, message: 'Course updated successfully' });
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
