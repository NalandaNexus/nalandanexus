import { catchAsync } from '../utils/catchAsync.js';
import { sendSuccess } from '../utils/ApiResponse.js';
import * as classService from '../services/class.service.js';
import * as studentService from '../services/student.service.js';
import * as leaderboardService from '../services/leaderboard.service.js';
import { fetchStudentCourseCatalog } from '../services/studentBridge.service.js';

/**
 * The course picker's options. `meta.catalogAvailable` is reported honestly so
 * the UI can say "the catalogue is unreachable, try again" instead of showing
 * an empty dropdown that looks like "no courses exist" - the two states need
 * very different actions from the teacher.
 */
export const getStudentCourseOptions = catchAsync(async (req, res) => {
  const { ok, courses } = await fetchStudentCourseCatalog();
  sendSuccess(res, { data: courses, meta: { catalogAvailable: ok } });
});

export const listClasses = catchAsync(async (req, res) => {
  const classes = await classService.listClasses(req.teacher._id, { status: req.query.status });
  sendSuccess(res, { data: classes });
});

export const getClass = catchAsync(async (req, res) => {
  const cls = await classService.getClassById(req.teacher._id, req.params.id);
  sendSuccess(res, { data: cls });
});

export const createClass = catchAsync(async (req, res) => {
  const cls = await classService.createClass(req.teacher._id, req.body, req.ip);
  sendSuccess(res, { statusCode: 201, message: 'Class created successfully.', data: cls });
});

export const updateClass = catchAsync(async (req, res) => {
  const cls = await classService.updateClass(req.teacher._id, req.params.id, req.body, req.ip);
  sendSuccess(res, { message: 'Class updated successfully.', data: cls });
});

export const archiveClass = catchAsync(async (req, res) => {
  const result = await classService.archiveClass(req.teacher._id, req.params.id, req.ip);
  sendSuccess(res, { message: 'Class archived successfully.', data: result });
});

export const getClassStudents = catchAsync(async (req, res) => {
  await classService.assertClassOwnership(req.teacher._id, req.params.id);
  const { students, meta } = await studentService.listStudents(req.teacher._id, { ...req.query, classId: req.params.id });
  sendSuccess(res, { data: students, meta });
});

/**
 * Mapping success, "we looked and found nobody", and "we linked real students"
 * are three different outcomes and each gets its own sentence. The old message
 * said "Enrollment synced." for a course with zero enrollments, which read as
 * though students had been imported when nothing had happened at all.
 */
const SYNC_MESSAGES = {
  NOT_LINKED: 'This batch is not linked to a course yet, so enrollment cannot be checked.',
  NO_ENROLLMENTS: 'Course link is working - no active enrollments found for it yet.',
  SYNCED: 'Enrollment synced from the student portal.',
};

export const syncClassEnrollment = catchAsync(async (req, res) => {
  const result = await studentService.syncEnrollmentForClass(req.teacher._id, req.params.id);
  sendSuccess(res, { message: SYNC_MESSAGES[result.outcome] || SYNC_MESSAGES.SYNCED, data: result });
});

export const getClassLeaderboard = catchAsync(async (req, res) => {
  const leaderboard = await leaderboardService.getClassLeaderboard(req.teacher._id, req.params.id, req.query);
  sendSuccess(res, { data: leaderboard });
});

export default { listClasses, getClass, createClass, updateClass, archiveClass, getClassStudents, syncClassEnrollment, getClassLeaderboard, getStudentCourseOptions };
