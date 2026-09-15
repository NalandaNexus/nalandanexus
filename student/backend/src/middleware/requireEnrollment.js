import { AppError } from '../utils/AppError.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { Enrollment } from '../models/Enrollment.js';
import { assertProfileComplete } from '../services/studentProfile.service.js';

/**
 * Object-level authorization gate for paid course content (master doc
 * section 54/74: "student must purchase course before dashboard/course
 * access"). Resolves the target courseId with `resolveCourseId(req)`,
 * then confirms the authenticated user holds an *active* Enrollment for
 * it. Never trusts a client-supplied "isEnrolled" flag.
 */
export function requireEnrollment(resolveCourseId) {
  return asyncHandler(async (req, res, next) => {
    const courseId = await resolveCourseId(req);
    if (!courseId) {
      throw AppError.notFound('Course not found', 'COURSE_NOT_FOUND');
    }

    const enrollment = await Enrollment.findOne({
      userId: req.user._id,
      courseId,
      status: 'active',
    });

    if (!enrollment) {
      throw AppError.forbidden(
        'You need to purchase this course before accessing it.',
        'COURSE_NOT_PURCHASED'
      );
    }

    // Holding the course is not enough on its own: an enrolled student must also
    // have completed the profile a course requires. Checked after the enrolment,
    // so a student who does not own the course still hears only that, and here
    // rather than in each handler, so no content route can skip it.
    await assertProfileComplete(req.user);

    req.enrollment = enrollment;
    req.courseId = courseId;
    next();
  });
}
