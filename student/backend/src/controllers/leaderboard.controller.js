import { asyncHandler } from '../utils/asyncHandler.js';
import { sendSuccess } from '../utils/apiResponse.js';
import { getLeaderboard } from '../services/leaderboard.service.js';
import { Course } from '../models/Course.js';

/** GET /api/leaderboard/:courseSlug - gated by requireEnrollment(resolveCourseIdFromSlugParam) in the route. */
export const getLeaderboardHandler = asyncHandler(async (req, res) => {
  const period = ['thisWeek', 'thisMonth', 'allTime'].includes(req.query.period) ? req.query.period : 'thisWeek';
  // requireEnrollment already resolved+verified the course and set req.courseId (the real ObjectId).
  const result = await getLeaderboard({ courseId: req.courseId, period, limit: 20, requestingUserId: req.user?._id });
  return sendSuccess(res, { data: result });
});

/** Resolves the :courseSlug route param to a real Course _id for requireEnrollment. */
export async function resolveCourseIdFromSlugParam(req) {
  const course = await Course.findOne({ slug: req.params.courseSlug });
  return course?._id || null;
}
