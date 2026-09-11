import { catchAsync } from '../utils/catchAsync.js';
import { sendSuccess } from '../utils/ApiResponse.js';
import * as service from '../services/studentProgress.service.js';

/**
 * Progression monitoring for the students a teacher actually teaches.
 *
 * Every handler takes the teacher from `req.teacher`, never from the request
 * body or a query parameter. Ownership is enforced inside the service by
 * scoping the roster query, so an id belonging to another teacher's student
 * matches nothing rather than being filtered out afterwards.
 *
 * Read-only throughout. There is no route here that writes XP, a rank, a skill
 * score or an eligibility verdict - teachers record attendance and grade work,
 * and the engine turns that into progression.
 */

export const listStudents = catchAsync(async (req, res) => {
  const { items, meta } = await service.listStudentsWithProgress(req.teacher._id, {
    classId: req.query.classId || null,
    page: Number(req.query.page) || 1,
    limit: Math.min(100, Number(req.query.limit) || 25),
    filter: req.query.filter || null,
  });
  return sendSuccess(res, { data: items, meta });
});

export const getStudentDetail = catchAsync(async (req, res) => {
  const detail = await service.getStudentProgressDetail(req.teacher._id, req.params.id, {
    limit: Math.min(200, Number(req.query.limit) || 50),
  });
  return sendSuccess(res, { data: detail });
});

export default { listStudents, getStudentDetail };
