import { asyncHandler } from '../utils/asyncHandler.js';
import { sendSuccess } from '../utils/apiResponse.js';
import { LiveClass } from '../models/LiveClass.js';
import { Enrollment } from '../models/Enrollment.js';

/**
 * Only shows a student live classes for courses they're actually enrolled
 * in (plus `courseId: null` general/institution-wide sessions) — a student
 * must never receive a lecture belonging to a course they haven't
 * purchased (master doc §5). `status: 'live'` is included in "upcoming" so
 * a session that just went live doesn't fall out of the list while it's
 * happening; status itself is kept current by
 * jobs/liveClassStatusSweep.job.js, never trusted from a stale write.
 */
export const listLiveClasses = asyncHandler(async (req, res) => {
  const now = new Date();
  const enrollments = await Enrollment.find({ userId: req.user._id, status: 'active' }).select('courseId batchId');

  // Scoped per enrollment, not per course. A course runs several batches, each
  // with its own teacher and timetable, so "enrolled in the course" is not
  // "entitled to every lecture of the course" - a course-only filter showed
  // (and let a student join) another batch's session. Each enrollment admits
  // its own batch's lectures plus the course-wide ones (batchId null).
  const courseFilter = {
    $or: [
      ...enrollments.map((e) => ({
        courseId: e.courseId,
        batchId: { $in: e.batchId ? [null, e.batchId] : [null] },
      })),
      // Institution-wide sessions belong to no course at all.
      { courseId: null },
    ],
  };

  const [upcoming, recorded] = await Promise.all([
    LiveClass.find({
      isPublished: true,
      status: { $in: ['upcoming', 'live'] },
      $and: [{ $or: [{ scheduledAt: { $gte: now } }, { status: 'live' }] }, courseFilter],
    })
      .sort({ scheduledAt: 1 })
      .limit(50),
    LiveClass.find({ isPublished: true, status: 'completed', $and: [courseFilter] }).sort({ scheduledAt: -1 }).limit(50),
  ]);

  return sendSuccess(res, { data: { upcoming, recorded } });
});
