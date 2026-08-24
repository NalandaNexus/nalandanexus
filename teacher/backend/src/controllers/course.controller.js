import { catchAsync } from '../utils/catchAsync.js';
import { sendSuccess } from '../utils/ApiResponse.js';
import * as courseService from '../services/course.service.js';
import { listAssignedCourses } from '../services/assignedCourse.service.js';

export const listCourses = catchAsync(async (req, res) => {
  const courses = await courseService.listCourses(req.teacher._id);
  sendSuccess(res, { data: courses });
});

export const listAssigned = catchAsync(async (req, res) => {
  const courses = await listAssignedCourses(req.teacher._id);
  sendSuccess(res, { data: courses });
});

export const createCourse = catchAsync(async (req, res) => {
  const course = await courseService.createCourse(req.teacher._id, req.body, req.ip);
  sendSuccess(res, { statusCode: 201, message: 'Course created successfully.', data: course });
});

export const updateCourse = catchAsync(async (req, res) => {
  const course = await courseService.updateCourse(req.teacher._id, req.params.id, req.body, req.ip);
  sendSuccess(res, { message: 'Course updated successfully.', data: course });
});

export const archiveCourse = catchAsync(async (req, res) => {
  const result = await courseService.archiveCourse(req.teacher._id, req.params.id, req.ip);
  sendSuccess(res, { message: 'Course archived successfully.', data: result });
});

export default { listCourses, listAssigned, createCourse, updateCourse, archiveCourse };
