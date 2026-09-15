import { Enrollment } from '../models/Enrollment.js';
import { assertStageAccessible, enrollmentWindow } from './progression/access.service.js';
import { Notification } from '../models/Notification.js';
import { Counter } from '../models/Counter.js';
import { requestBatchPlacement } from './teacherBridge.service.js';
import { User } from '../models/User.js';
import { ensureEnrollmentNumber } from './studentProfile.service.js';
import { logger } from '../utils/logger.js';

export async function getActiveEnrollment(userId, courseId) {
  return Enrollment.findOne({ userId, courseId, status: 'active' });
}

/**
 * Issues the next business enrollment identifier, e.g. ENR-2026-000123.
 *
 * Year-scoped and zero-padded so the sequence reads naturally and sorts
 * correctly. The counter is incremented atomically (see models/Counter.js), so
 * two simultaneous checkouts can never be handed the same number.
 */
export async function nextEnrollmentId(now = new Date()) {
  const year = now.getUTCFullYear();
  const seq = await Counter.next(`enrollment:${year}`);
  return `ENR-${year}-${String(seq).padStart(6, '0')}`;
}

/**
 * Places an enrollment into one of its course's batches.
 *
 * The batches, their capacity and their teachers all live in the teacher
 * portal's database, so it is the only service that can answer "which batch has
 * room" - this asks it, and records the answer here, where the
 * student-to-course relationship is authoritative.
 *
 * Best-effort by design. If the teacher portal is unreachable, or the course has
 * no batch with room, the enrollment stays unplaced (batchId null) and the
 * purchase still completes. Placement is retried later rather than failing a
 * transaction the student has already paid for; an unplaced enrollment is a real,
 * visible state, not a silent error.
 */
export async function assignEnrollmentToBatch(enrollment, courseSlug, { studentName = null } = {}) {
  if (enrollment.batchId) return enrollment;

  const placement = await requestBatchPlacement({
    courseSlug,
    enrollmentId: enrollment.enrollmentId,
    // The student's real name, supplied by the caller. This used to read
    // `enrollment.studentName`, a field Enrollment does not have, so every
    // placement reached the teacher portal as "Enrolled student" and the roster
    // showed that until a later sync happened to overwrite it.
    studentName,
  });
  if (!placement?.batchId) return enrollment;

  enrollment.batchId = placement.batchId;
  enrollment.batchCode = placement.batchCode || null;
  enrollment.batchAssignedAt = new Date();
  await enrollment.save();
  return enrollment;
}

/**
 * Gives a student their enrollment number with their first course place.
 *
 * Every way of gaining a course - a paid order, its webhook, a coupon, a free
 * course - comes through createEnrollment, so issuing here covers all of them.
 * A student who already has a number keeps it; a second course never produces a
 * second number (see studentProfile.service.js#ensureEnrollmentNumber).
 *
 * It never fails the enrolment. A student who has paid must not lose their
 * course over a number, and one that could not be issued now is issued the
 * next time the student's profile is read.
 */
async function issueEnrollmentNumber(userId) {
  try {
    await ensureEnrollmentNumber(userId);
  } catch (err) {
    logger.error(`[Enrollment] Enrollment number not issued for ${userId}; it will be issued on the next profile read.`, err.message);
  }
}

export async function createEnrollment({ userId, courseId, orderId = null, course }) {
  // The one gate every enrolment passes through, whatever created it - a paid
  // order, a coupon, or anything added later. Putting it here rather than at
  // each call site is what makes "a new way to enrol" safe by default instead
  // of safe only if somebody remembered.
  //
  // Ordinary courses are unaffected; only the staged journey has a prior-stage
  // requirement, and only beyond its first stage.
  if (course) await assertStageAccessible(userId, course);

  const student = await User.findById(userId).select('name').lean();
  const placement = { studentName: student?.name || null };

  const existing = await Enrollment.findOne({ userId, courseId });
  if (existing) {
    if (existing.status !== 'active') {
      existing.status = 'active';
      existing.orderId = orderId || existing.orderId;
      // A re-activated enrollment predating this field still needs an identity,
      // but an existing one is never reissued - it has already been quoted.
      if (!existing.enrollmentId) {
        existing.enrollmentId = await nextEnrollmentId();
        existing.$locals.allowEnrollmentIdBackfill = true;
      }
      await existing.save();
    }
    if (course?.slug && !existing.batchId) {
      await assignEnrollmentToBatch(existing, course.slug, placement).catch(() => existing);
    }
    // A retried purchase or a replayed webhook lands here. The number is issued
    // if an earlier attempt did not get that far, and otherwise left alone.
    await issueEnrollmentNumber(userId);
    return existing;
  }

  const firstModule = course?.modules?.[0];
  const firstLesson = firstModule?.lessons?.[0];

  // Fixed at enrolment, not derived on read: changing a course's duration later
  // must not move the end date of everyone already enrolled under the old one.
  const { startsAt, endsAt } = enrollmentWindow(course);

  let enrollment;
  try {
    enrollment = await Enrollment.create({
      userId,
      courseId,
      orderId,
      startsAt,
      endsAt,
      enrollmentId: await nextEnrollmentId(),
      currentModuleId: firstModule?.moduleId || null,
      currentLessonId: firstLesson?.lessonId || null,
    });
  } catch (err) {
    // Two deliveries of the same purchase at once - the verify call and its
    // webhook, or a webhook Razorpay retried - both found no enrolment and both
    // tried to create one. The unique { userId, courseId } index let exactly one
    // through; the other returns that one instead of failing a paid request.
    if (err?.code !== 11000) throw err;
    const winner = await Enrollment.findOne({ userId, courseId });
    if (!winner) throw err;
    await issueEnrollmentNumber(userId);
    return winner;
  }

  await issueEnrollmentNumber(userId);

  // Placement is attempted immediately but never blocks the enrollment itself
  // (see assignEnrollmentToBatch).
  if (course?.slug) {
    await assignEnrollmentToBatch(enrollment, course.slug, placement).catch(() => enrollment);
  }

  await Notification.create({
    userId,
    title: `Welcome to ${course?.title || 'your course'}!`,
    description: 'Your enrollment is active. Start your first lesson now.',
    type: 'course',
    link: '/student/dashboard',
  });

  return enrollment;
}
