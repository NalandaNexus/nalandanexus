import { catchAsync } from '../utils/catchAsync.js';
import { sendSuccess } from '../utils/ApiResponse.js';
import * as service from '../services/courseAssignments.service.js';

/**
 * Course assignments a teacher may grade.
 *
 * Every action is scoped to the teacher's own roster inside the service, not
 * here - the ownership records live beside the roster query, and doing it there
 * means no route can accidentally skip it.
 */

export const list = catchAsync(async (req, res) => {
  const { items, meta } = await service.listCourseSubmissions(req.teacher._id, {
    ungradedOnly: req.query.ungradedOnly === 'true',
    studentId: req.query.studentId || null,
  });
  return sendSuccess(res, { data: items, meta });
});

export const grade = catchAsync(async (req, res) => {
  const result = await service.gradeCourseSubmission(req.teacher._id, req.params.id, {
    score: Number(req.body.score),
    maxScore: Number(req.body.maxScore),
    feedback: req.body.feedback,
  });
  return sendSuccess(res, { message: 'Grade recorded', data: result });
});

export default { list, grade };
