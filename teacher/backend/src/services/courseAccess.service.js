import { CourseAccess } from '../models/CourseAccess.js';
import { SchoolClass } from '../models/SchoolClass.js';
import { Student } from '../models/Student.js';
import { ApiError } from '../utils/ApiError.js';

/**
 * The one check that decides whether a teacher may touch a given course's
 * content, students, grades, attendance or messages: an administrator's
 * CourseAccess row for (teacher, course slug). Consulted fresh on every
 * request - taking a course away from a teacher takes away everything this
 * grants in the same moment, with no second assignment system anywhere.
 *
 * Originally defined inline in lessonVideo.service.js (the first feature to
 * need it); lifted out here once a second feature - course-wide grading,
 * attendance and messaging - needed the same primitive, so there is one
 * definition instead of two that could drift apart.
 *
 * This file also holds the second authorization primitive those same
 * features need: "may this teacher act on this CLASS" (grade/mark
 * attendance/message/monitor), below. It is deliberately a UNION of
 * ownership and course-access, never a replacement of one by the other -
 * see canActOnClass for why that matters.
 */

const SLUG = /^[a-z0-9-]{1,100}$/;
const normSlug = (s) => String(s || '').trim().toLowerCase();

/** Throws 403 unless an administrator has assigned this course to this teacher. Returns the normalized slug. */
export async function assertCourseAccess(teacherId, slug) {
  const studentCourseSlug = normSlug(slug);
  if (!SLUG.test(studentCourseSlug)) throw ApiError.badRequest('Invalid course.', 'INVALID_COURSE');
  const allowed = await CourseAccess.exists({ teacher: teacherId, studentCourseSlug });
  if (!allowed) {
    throw ApiError.forbidden('This course has not been assigned to you.', 'COURSE_NOT_ASSIGNED');
  }
  return studentCourseSlug;
}

/** Every course slug this teacher currently holds CourseAccess to. */
export async function getAccessibleCourseSlugs(teacherId) {
  return CourseAccess.distinct('studentCourseSlug', { teacher: teacherId });
}

/**
 * Whether `teacherId` may grade, mark attendance for, message, or otherwise
 * monitor students in `classId` - true if they own the batch (today's rule,
 * unchanged) OR they hold CourseAccess for whatever real course the batch is
 * linked to (the new, shared rule).
 *
 * This is a UNION, never a replacement. Confirmed by direct read of
 * class.service.js#createClass before this was written: creating a batch
 * only checks that its course slug exists in the public catalog
 * (assertCourseSlugExists) - it does not require, or create, a CourseAccess
 * row for the creating teacher. So a teacher's own batch is NOT guaranteed
 * to be backed by CourseAccess, and replacing ownership with course-access
 * outright would silently lock teachers out of batches they created
 * themselves the moment this shipped. A class with no linked course
 * (studentCourseSlug null - a legacy batch predating the "every batch has a
 * course" requirement, see class.service.js#deriveLinkState's UNLINKED
 * case) has no course-access path at all, so ownership is the only way in
 * for it, exactly as today.
 */
export async function canActOnClass(teacherId, classId) {
  if (!classId) return false;
  const cls = await SchoolClass.findById(classId).select('teacher studentCourseSlug').lean();
  if (!cls) return false;
  if (String(cls.teacher) === String(teacherId)) return true;
  if (!cls.studentCourseSlug) return false;
  return Boolean(await CourseAccess.exists({ teacher: teacherId, studentCourseSlug: cls.studentCourseSlug }));
}

/**
 * Same decision as canActOnClass, but for routes that need the class
 * document itself and a real, actionable error rather than a boolean: 404
 * CLASS_NOT_FOUND if the class genuinely does not exist, 403
 * COURSE_NOT_ASSIGNED if it exists but this teacher may act on neither the
 * batch nor its linked course. Returns the loaded class document (callers
 * that need the batch's own owning teacher - e.g. for an attendance alert
 * that must keep going to the home teacher - read it off the return value).
 */
export async function assertCourseAccessForClass(teacherId, classId) {
  const cls = await SchoolClass.findById(classId);
  if (!cls) throw ApiError.notFound('Class not found.', 'CLASS_NOT_FOUND');
  if (String(cls.teacher) === String(teacherId)) return cls;
  if (cls.studentCourseSlug && (await CourseAccess.exists({ teacher: teacherId, studentCourseSlug: cls.studentCourseSlug }))) {
    return cls;
  }
  throw ApiError.forbidden('This class belongs to a course that has not been assigned to you.', 'COURSE_NOT_ASSIGNED');
}

/**
 * Same resolution, starting from a student's roster row rather than a class
 * id. Reports STUDENT_NOT_FOUND (404) either way - whether the student
 * genuinely does not exist or this teacher may not act on their class -
 * matching how every other student lookup in this backend already hides an
 * authorization failure behind "not found" rather than a separate 403
 * (assertStudentOwnership, assertConversationOwnership, ...). Submission and
 * conversation data is more sensitive than "which course is this batch in",
 * so this deliberately does not adopt assertCourseAccessForClass's 403.
 */
export async function assertCourseAccessForStudent(teacherId, studentId) {
  const student = await Student.findById(studentId);
  if (!student || !(await canActOnClass(teacherId, student.class))) {
    throw ApiError.notFound('Student not found.', 'STUDENT_NOT_FOUND');
  }
  return student;
}

/**
 * Every class id this teacher may act on: every batch they own, union every
 * batch linked to a course they hold CourseAccess for (whoever owns that
 * batch). Powers the widened read/aggregate views (dashboard, analytics,
 * leaderboard, student lists) without duplicating this resolution in each.
 */
export async function getAccessibleClassIds(teacherId) {
  const [ownedIds, accessSlugs] = await Promise.all([
    SchoolClass.distinct('_id', { teacher: teacherId }),
    getAccessibleCourseSlugs(teacherId),
  ]);
  const viaAccess = accessSlugs.length
    ? await SchoolClass.distinct('_id', { studentCourseSlug: { $in: accessSlugs } })
    : [];
  const seen = new Map();
  for (const id of [...ownedIds, ...viaAccess]) seen.set(String(id), id);
  return [...seen.values()];
}

/** Full class documents for every class this teacher may act on - powers widened class pickers that are not scoped to one course. */
export async function listClassesForAccessibleCourses(teacherId) {
  const classIds = await getAccessibleClassIds(teacherId);
  if (!classIds.length) return [];
  return SchoolClass.find({ _id: { $in: classIds } }).sort({ name: 1 }).lean();
}

/**
 * Every batch linked to `slug`, regardless of which teacher owns it. Only
 * safe to call once assertCourseAccess(teacherId, slug) has already
 * confirmed this teacher holds the course itself - this does not re-check
 * that on its own, since its one caller always calls it right after.
 * Powers the class picker shown once a teacher has chosen an assigned course
 * (GET /api/teacher/courses/assigned/:slug/classes).
 */
export async function listClassesForCourseSlug(slug) {
  const rows = await SchoolClass.find({ studentCourseSlug: normSlug(slug) }).sort({ name: 1 }).lean();
  return rows.map((c) => ({
    id: c._id,
    name: c.name,
    code: c.code,
    studentCourseSlug: c.studentCourseSlug,
    teacher: c.teacher,
    status: c.status,
  }));
}

export default {
  assertCourseAccess,
  getAccessibleCourseSlugs,
  canActOnClass,
  assertCourseAccessForClass,
  assertCourseAccessForStudent,
  getAccessibleClassIds,
  listClassesForAccessibleCourses,
  listClassesForCourseSlug,
};
