import { asyncHandler } from '../utils/asyncHandler.js';
import { assertProfileComplete } from '../services/studentProfile.service.js';

/**
 * Refuses course content to an enrolled student whose profile is incomplete.
 *
 * For the routes that list content across every course a student holds - tasks,
 * quizzes, materials, live classes. A student with no enrolment is let through:
 * those lists are empty for them, and the requirement comes with course access,
 * not with having an account.
 *
 * Routes about one course get the same check inside requireEnrollment, after
 * the enrolment itself is confirmed.
 */
export const requireCompleteProfile = asyncHandler(async (req, res, next) => {
  await assertProfileComplete(req.user, { onlyIfEnrolled: true });
  next();
});

export default requireCompleteProfile;
