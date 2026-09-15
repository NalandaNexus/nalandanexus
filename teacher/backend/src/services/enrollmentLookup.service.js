import { Student } from '../models/Student.js';
import { ApiError } from '../utils/ApiError.js';
import { lookupStudentByEnrollmentNumber } from './studentBridge.service.js';

/**
 * Finding one of a teacher's students by enrollment number.
 *
 * The student's identity and profile live in the student portal, which issues
 * enrollment numbers. What decides whether THIS teacher may see a student lives
 * here: the roster. So the authorization is done here, in three steps, and none
 * of them trusts the one before.
 *
 *   1. The roster query is always `{ teacher: teacherId, status: 'active' }`, and
 *      only the identities that survive it - linked student accounts, and the
 *      enrollment IDs of places in this teacher's batches - are ever sent to the
 *      student portal as the scope of the question.
 *   2. The student portal answers only within that scope.
 *   3. The answer is checked against the roster again before anything is
 *      returned, and cut down to the enrolments this teacher actually teaches.
 *
 * A student outside the teacher's scope produces exactly the same response as a
 * number that does not exist, so the endpoint cannot be used to learn whether
 * an enrollment number belongs to somebody else's student. Payment information
 * is never requested and never passed on.
 */

const notFound = () =>
  ApiError.notFound('No student with that enrollment number was found in your classes.', 'STUDENT_NOT_FOUND');

/** The canonical form of an enrollment number however it was typed, or null when it is not one. */
export function normalizeEnrollmentNumber(raw) {
  const compact = String(raw ?? '')
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '');
  const match = /^NN(\d{2})(\d{6,9})$/.exec(compact);
  return match ? `NN${match[1]}-${match[2]}` : null;
}

export async function findStudentForTeacher(teacherId, rawNumber) {
  const enrollmentNumber = normalizeEnrollmentNumber(rawNumber);
  if (!enrollmentNumber) {
    throw ApiError.unprocessable('Enter a valid enrollment number, for example NN26-000124.', 'INVALID_ENROLLMENT_NUMBER');
  }

  // Roster rows that stand for a real student: matched to an account by sync, or
  // placed into this batch by the student portal at purchase. A row a teacher
  // typed in by hand carries neither and grants nothing.
  const rows = await Student.find({
    teacher: teacherId,
    status: 'active',
    $or: [{ linkedUserId: { $ne: null } }, { enrollmentId: { $exists: true, $ne: null } }],
  })
    .populate('class', 'name code studentCourseSlug')
    .lean();

  // No students, nothing to look up - and no reason to ask another service.
  if (!rows.length) throw notFound();

  const scope = {
    userIds: [...new Set(rows.filter((r) => r.linkedUserId).map((r) => String(r.linkedUserId)))],
    enrollmentIds: [...new Set(rows.map((r) => r.enrollmentId).filter(Boolean))],
    courseSlugs: [...new Set(rows.map((r) => r.class?.studentCourseSlug).filter(Boolean))],
  };

  const { ok, student } = await lookupStudentByEnrollmentNumber(enrollmentNumber, scope);
  if (!ok) {
    throw ApiError.serviceUnavailable(
      'Could not reach the student portal to look this student up. Please try again in a moment.',
      'STUDENT_SERVICE_UNAVAILABLE'
    );
  }
  if (!student) throw notFound();

  // Checked again rather than trusted: this is the teacher's authority, and it
  // is decided against this service's own roster.
  const userIds = new Set(scope.userIds);
  const enrollmentIds = new Set(scope.enrollmentIds);
  const courseSlugs = new Set(scope.courseSlugs);
  const linked = userIds.has(String(student.userId));
  const enrollments = (student.enrollments || []).filter((e) =>
    e.enrollmentId ? enrollmentIds.has(String(e.enrollmentId).toUpperCase()) : linked && courseSlugs.has(e.courseSlug)
  );
  if (!linked && !enrollments.length) throw notFound();

  const placedIds = new Set(enrollments.map((e) => e.enrollmentId).filter(Boolean));
  const roster = rows.filter(
    (r) => (r.linkedUserId && String(r.linkedUserId) === String(student.userId)) || (r.enrollmentId && placedIds.has(r.enrollmentId))
  );

  // Named field by field, so nothing the student portal might add - payments
  // above all - can pass through to a teacher by accident.
  return {
    enrollmentNumber: student.enrollmentNumber,
    fullName: student.fullName,
    guardianName: student.guardianName || null,
    grade: student.grade || null,
    phone: student.phone || null,
    email: student.email,
    avatar: student.avatar || null,
    profileComplete: Boolean(student.profileComplete),
    enrollments: enrollments.map((e) => ({
      enrollmentId: e.enrollmentId || null,
      courseSlug: e.courseSlug || null,
      courseTitle: e.courseTitle || null,
      status: e.status,
      enrolledAt: e.enrolledAt || null,
      endsAt: e.endsAt || null,
      batchCode: e.batchCode || null,
    })),
    classes: roster.map((r) => ({
      studentId: String(r._id),
      classId: String(r.class?._id || r.class),
      className: r.class?.name || null,
      classCode: r.class?.code || null,
    })),
  };
}

export default { findStudentForTeacher, normalizeEnrollmentNumber };
