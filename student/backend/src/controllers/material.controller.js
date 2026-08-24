import { asyncHandler } from '../utils/asyncHandler.js';
import { sendSuccess } from '../utils/apiResponse.js';
import { CourseMaterial } from '../models/CourseMaterial.js';
import { Enrollment } from '../models/Enrollment.js';

/** GET /api/student/materials - teacher-uploaded resources for the student's enrolled courses only. */
export const listMyMaterials = asyncHandler(async (req, res) => {
  const enrollments = await Enrollment.find({ userId: req.user._id, status: 'active' }).select('courseId');
  const courseIds = enrollments.map((e) => e.courseId);

  const materials = await CourseMaterial.find({ courseId: { $in: courseIds } }).sort({ createdAt: -1 }).limit(200);
  return sendSuccess(res, { data: materials });
});
