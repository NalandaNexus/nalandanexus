import { catchAsync } from '../utils/catchAsync.js';
import { sendSuccess } from '../utils/ApiResponse.js';
import * as courseService from '../services/course.service.js';
import { listAssignedCourses } from '../services/assignedCourse.service.js';
import { listCourseStudents, refreshCourseRoster } from '../services/courseRoster.service.js';
import { assertCourseAccess, listClassesForCourseSlug } from '../services/courseAccess.service.js';

export const listCourses = catchAsync(async (req, res) => {
  const courses = await courseService.listCourses(req.teacher._id);
  sendSuccess(res, { data: courses });
});

export const listAssigned = catchAsync(async (req, res) => {
  const courses = await listAssignedCourses(req.teacher._id);
  sendSuccess(res, { data: courses });
});

/** The students enrolled in one course the teacher has been assigned - read-only, and 404 for any other course. */
export const listAssignedCourseStudents = catchAsync(async (req, res) => {
  const { course, students, meta } = await listCourseStudents(req.teacher._id, req.params.slug, req.query);
  sendSuccess(res, { data: { course, students }, meta });
});

/** Recovery only - the roster keeps itself current. Re-reads one assigned course from the student portal. */
export const refreshAssignedCourseStudents = catchAsync(async (req, res) => {
  const result = await refreshCourseRoster(req.teacher._id, req.params.slug);
  sendSuccess(res, { message: 'Roster refreshed.', data: result });
});

/**
 * Every batch running this assigned course, whoever teaches it - powers the
 * widened class picker on Grading/Attendance/Messages, so choosing a course
 * first and then a class reaches every batch sharing it, not only classes
 * this teacher happens to own.
 */
export const listAssignedCourseClasses = catchAsync(async (req, res) => {
  const slug = await assertCourseAccess(req.teacher._id, req.params.slug);
  const classes = await listClassesForCourseSlug(slug);
  sendSuccess(res, { data: classes });
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

export default {
  listCourses,
  listAssigned,
  listAssignedCourseStudents,
  refreshAssignedCourseStudents,
  listAssignedCourseClasses,
  createCourse,
  updateCourse,
  archiveCourse,
};
