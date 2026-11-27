import { Student } from '../models/Student.js';
import { ApiError } from '../utils/ApiError.js';
import { fetchCourseSubmissions, pushGradeToStudent } from './studentBridge.service.js';
import { getAccessibleClassIds } from './courseAccess.service.js';

/**
 * Course assignments, and grading them.
 *
 * The teacher portal has always been able to grade assignments it authored
 * itself: those are pushed to the student portal as tasks and the submission
 * comes back. Assignments that are part of the course content - the GARUD and
 * YODDHA curriculum - were never pushed from here, so although the student
 * could submit them, no teacher had any route to find the submission. The
 * student portal's own comment said as much: a non-bridged task had no grading
 * mechanism at all.
 *
 * This closes that, without inventing a second grading model. The submission
 * still lives where it was made, grading still goes through the same endpoint
 * that grades a bridged submission, and the student's task average is still
 * recalculated by the service that owns it.
 *
 * Authorization is enforced here, where the records live. The roster query
 * covers every class this teacher may act on - their own, union any class
 * whose course they hold CourseAccess for (see courseAccess.service.js) -
 * and only the linked user ids that survive it are ever sent across the
 * bridge, so a teacher cannot see a submission from a student outside that
 * set, whatever they ask for.
 */

async function ownedUserIds(teacherId, { studentId = null } = {}) {
  const accessibleClassIds = await getAccessibleClassIds(teacherId);
  const query = { class: { $in: accessibleClassIds }, linkedUserId: { $ne: null } };
  if (studentId) query._id = studentId;

  const students = await Student.find(query).select('name email linkedUserId').lean();
  return {
    ids: students.map((s) => String(s.linkedUserId)),
    byUserId: new Map(students.map((s) => [String(s.linkedUserId), s])),
  };
}

/** Course-assignment submissions from every student this teacher may act on. */
export async function listCourseSubmissions(teacherId, { ungradedOnly = false, studentId = null } = {}) {
  const { ids, byUserId } = await ownedUserIds(teacherId, { studentId });
  if (!ids.length) return { items: [], meta: { available: true, students: 0 } };

  const { ok, submissions } = await fetchCourseSubmissions(ids, { ungradedOnly });
  if (!ok) {
    // Says plainly that the column is missing rather than letting an
    // unreachable peer look like a teacher with nothing to grade.
    return { items: [], meta: { available: false, students: ids.length } };
  }

  return {
    items: submissions.map((s) => ({
      ...s,
      // The teacher portal's own record of this student, so the roster name is
      // what a teacher sees rather than whatever the other portal holds.
      studentId: String(byUserId.get(s.userId)?._id || ''),
      studentName: byUserId.get(s.userId)?.name || s.studentName,
    })),
    meta: { available: true, students: ids.length },
  };
}

/**
 * Records a grade against a course-assignment submission.
 *
 * Ownership is re-checked against the roster rather than trusted from the
 * request: a submission id is guessable, and the only thing that makes this
 * safe is confirming the submission belongs to a student this teacher has.
 */
export async function gradeCourseSubmission(teacherId, submissionId, { score, maxScore, feedback }) {
  if (!Number.isFinite(score) || score < 0) {
    throw ApiError.badRequest('A score is required.', 'SCORE_REQUIRED');
  }
  if (!Number.isFinite(maxScore) || maxScore <= 0) {
    throw ApiError.badRequest('A maximum score is required.', 'MAX_SCORE_REQUIRED');
  }
  if (score > maxScore) {
    throw ApiError.badRequest(`Score cannot exceed the maximum of ${maxScore}.`, 'SCORE_OUT_OF_RANGE');
  }

  const { ids } = await ownedUserIds(teacherId);
  if (!ids.length) throw ApiError.notFound('Submission not found', 'SUBMISSION_NOT_FOUND');

  const { ok, submissions } = await fetchCourseSubmissions(ids, { ungradedOnly: false });
  if (!ok) {
    throw ApiError.serviceUnavailable('The student service is unreachable, so this cannot be graded right now.', 'STUDENT_SERVICE_UNAVAILABLE');
  }

  const owned = submissions.find((s) => s.submissionId === String(submissionId));
  // Same message whether it does not exist or belongs to another teacher's
  // student, so this cannot be used to discover who is on someone else's roster.
  if (!owned) throw ApiError.notFound('Submission not found', 'SUBMISSION_NOT_FOUND');

  const result = await pushGradeToStudent({
    studentSubmissionSourceId: owned.submissionId,
    score,
    maxScore,
    feedback: feedback || null,
  });

  if (!result.delivered) {
    throw ApiError.serviceUnavailable('The grade could not be delivered to the student portal.', 'GRADE_NOT_DELIVERED');
  }

  return { submissionId: owned.submissionId, score, maxScore, feedback: feedback || null };
}

export default { listCourseSubmissions, gradeCourseSubmission };
