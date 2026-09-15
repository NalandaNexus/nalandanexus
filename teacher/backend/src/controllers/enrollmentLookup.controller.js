import { catchAsync } from '../utils/catchAsync.js';
import { sendSuccess } from '../utils/ApiResponse.js';
import { findStudentForTeacher } from '../services/enrollmentLookup.service.js';

/**
 * GET /api/teacher/students/enrollment-number/:enrollmentNumber
 *
 * One of this teacher's own students, by enrollment number. The authorization is
 * in the service, beside the roster query it depends on, so no route can
 * accidentally skip it.
 */
export const findByEnrollmentNumber = catchAsync(async (req, res) => {
  const data = await findStudentForTeacher(req.teacher._id, req.params.enrollmentNumber);
  return sendSuccess(res, { data });
});

export default { findByEnrollmentNumber };
