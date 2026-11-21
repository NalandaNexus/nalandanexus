import mongoose from 'mongoose';
import { SchoolClass } from '../models/SchoolClass.js';
import { Student } from '../models/Student.js';
import { Teacher } from '../models/Teacher.js';
import { findTeacherUserByEmail } from './credentials.service.js';
import { ApiError } from '../utils/ApiError.js';
import { logAudit } from './audit.service.js';
import { createClass, updateClass, getClassById, getClassAggregateStatsMap } from './class.service.js';
import { fetchStudentCourseCatalog } from './studentBridge.service.js';

/**
 * Batch administration on behalf of the Admin portal.
 *
 * Batches live in THIS service's database, so Admin cannot own a competing
 * model - it calls these over the existing shared-secret internal bridge. Every
 * mutation routes through the same class.service functions a teacher uses, so
 * course validation, the update allow-list and the audit trail apply identically
 * no matter which portal asked.
 *
 * The one thing Admin can do that a teacher cannot is REASSIGN a batch to a
 * different teacher. That is deliberately not part of the teacher-facing update
 * allow-list (a teacher moving their own batch to someone else is the
 * mass-assignment hole that was closed), so it gets its own explicit function
 * here rather than a widened allow-list.
 */

/** Cross-service teacher identity is the email, matching assignedCourse.service.js. */
async function resolveTeacherByEmail(email) {
  const { user } = await findTeacherUserByEmail(email);
  if (!user) throw ApiError.unprocessable(`No teacher account exists for ${email}.`, 'TEACHER_NOT_FOUND');
  const teacher = await Teacher.findOne({ user: user._id });
  if (!teacher) throw ApiError.unprocessable(`${email} has no teacher profile.`, 'TEACHER_PROFILE_MISSING');
  return { teacher, user };
}

function shapeForAdmin(cls, stats, courseTitleBySlug, teacherInfo) {
  const capacity = Number.isFinite(cls.capacity) && cls.capacity > 0 ? cls.capacity : 60;
  const enrolled = Number.isFinite(cls.enrolledCount) ? cls.enrolledCount : 0;
  return {
    id: String(cls._id),
    code: cls.code,
    name: cls.name,
    status: cls.status,
    courseSlug: cls.studentCourseSlug || null,
    courseTitle: (cls.studentCourseSlug && courseTitleBySlug.get(cls.studentCourseSlug)) || null,
    teacher: teacherInfo || null,
    capacity,
    enrolledCount: enrolled,
    seatsRemaining: Math.max(0, capacity - enrolled),
    isFull: enrolled >= capacity,
    // Verified roster size, which can lag enrolledCount between a placement and
    // the next sync. Both are shown rather than reconciled silently.
    verifiedStudents: stats?.studentCount ?? 0,
    room: cls.room || null,
    schedule: cls.schedule || null,
    createdAt: cls.createdAt,
  };
}

/** Teacher display info for a set of batches, in one query rather than per row. */
async function teacherInfoFor(teacherIds) {
  const ids = [...new Set(teacherIds.map(String))].map((id) => new mongoose.Types.ObjectId(id));
  if (!ids.length) return new Map();
  const teachers = await Teacher.find({ _id: { $in: ids } }).populate('user', 'name email').lean();
  return new Map(
    teachers.map((t) => [
      String(t._id),
      { id: String(t._id), teacherId: t.teacherId, name: t.user?.name || null, email: t.user?.email || null },
    ])
  );
}

/**
 * Every batch across every teacher, which is the view only Admin has.
 * Filters are applied in the query, never by trimming a full result set.
 */
export async function listAllBatches({ courseSlug, teacherEmail, status, search } = {}) {
  const filter = {};
  if (status && status !== 'all') filter.status = status;
  if (courseSlug) filter.studentCourseSlug = courseSlug;
  if (teacherEmail) {
    const { teacher } = await resolveTeacherByEmail(teacherEmail);
    filter.teacher = teacher._id;
  }
  if (search && search.trim()) {
    const q = search.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    filter.$or = [{ name: new RegExp(q, 'i') }, { code: new RegExp(q, 'i') }];
  }

  const batches = await SchoolClass.find(filter).sort({ createdAt: 1 }).lean();
  const [statsMap, catalog, teacherMap] = await Promise.all([
    getClassAggregateStatsMap(batches.map((b) => b._id)),
    fetchStudentCourseCatalog(),
    teacherInfoFor(batches.map((b) => b.teacher)),
  ]);
  const titleBySlug = new Map(catalog.courses.map((c) => [c.slug, c.title]));

  return {
    batches: batches.map((b) =>
      shapeForAdmin(b, statsMap.get(String(b._id)), titleBySlug, teacherMap.get(String(b.teacher)))
    ),
    catalogAvailable: catalog.ok,
  };
}

export async function getBatchForAdmin(batchId) {
  const cls = await SchoolClass.findById(batchId).lean();
  if (!cls) throw ApiError.notFound('Batch not found.', 'BATCH_NOT_FOUND');
  const [statsMap, catalog, teacherMap] = await Promise.all([
    getClassAggregateStatsMap([cls._id]),
    fetchStudentCourseCatalog(),
    teacherInfoFor([cls.teacher]),
  ]);
  const titleBySlug = new Map(catalog.courses.map((c) => [c.slug, c.title]));
  return shapeForAdmin(cls, statsMap.get(String(cls._id)), titleBySlug, teacherMap.get(String(cls.teacher)));
}

/**
 * Creates a batch on a named teacher's behalf.
 *
 * Delegates to the same createClass a teacher uses, so the course is validated
 * against the live catalogue and an unreachable catalogue still fails closed.
 */
export async function createBatchForAdmin({ courseSlug, name, teacherEmail, capacity, room, schedule }, actor) {
  const { teacher } = await resolveTeacherByEmail(teacherEmail);
  const created = await createClass(
    teacher._id,
    { name, studentCourseSlug: courseSlug, capacity, room, schedule },
    actor?.ip
  );
  await logAudit({
    actorId: teacher._id,
    action: 'class.created_by_admin',
    targetType: 'SchoolClass',
    targetId: created.id,
    metadata: { name, courseSlug, byAdmin: actor?.adminEmail || 'admin' },
  });
  return getBatchForAdmin(created.id);
}

/**
 * Edits a batch's own attributes.
 *
 * Routed through the teacher-facing updateClass with the batch's CURRENT owner,
 * so the same allow-list and course validation apply - Admin gets no wider write
 * surface than a teacher, only a wider selection of which batch to write to.
 */
export async function updateBatchForAdmin(batchId, updates, actor) {
  const cls = await SchoolClass.findById(batchId).select('teacher').lean();
  if (!cls) throw ApiError.notFound('Batch not found.', 'BATCH_NOT_FOUND');
  await updateClass(cls.teacher, batchId, updates, actor?.ip);
  return getBatchForAdmin(batchId);
}

/**
 * Moves a batch to a different teacher.
 *
 * Admin-only and explicit. The roster moves with the batch: Student.teacher is
 * a denormalised owner used by every roster query, so leaving it pointing at the
 * previous teacher would strand the students - the new teacher would own a batch
 * whose students they cannot see, and the old teacher would still see them.
 */
export async function reassignBatchTeacher(batchId, teacherEmail, actor) {
  const cls = await SchoolClass.findById(batchId);
  if (!cls) throw ApiError.notFound('Batch not found.', 'BATCH_NOT_FOUND');

  const { teacher } = await resolveTeacherByEmail(teacherEmail);
  if (String(teacher._id) === String(cls.teacher)) return getBatchForAdmin(batchId);

  const previousTeacher = cls.teacher;
  cls.teacher = teacher._id;
  await cls.save();
  const moved = await Student.updateMany({ class: cls._id, teacher: previousTeacher }, { teacher: teacher._id });

  await logAudit({
    actorId: teacher._id,
    action: 'class.teacher_reassigned',
    targetType: 'SchoolClass',
    targetId: cls._id,
    metadata: {
      from: String(previousTeacher),
      to: String(teacher._id),
      rosterRowsMoved: moved.modifiedCount || 0,
      byAdmin: actor?.adminEmail || 'admin',
    },
  });

  return getBatchForAdmin(batchId);
}

/** The batch's verified roster, with the enrollment identity Admin needs to trace a student. */
export async function listBatchStudentsForAdmin(batchId) {
  const cls = await SchoolClass.findById(batchId).select('_id').lean();
  if (!cls) throw ApiError.notFound('Batch not found.', 'BATCH_NOT_FOUND');

  const rows = await Student.find({ class: batchId, status: 'active' })
    .select('name email enrollmentId linkedUserId status createdAt')
    .sort({ name: 1 })
    .lean();

  return rows.map((s) => ({
    id: String(s._id),
    name: s.name,
    email: s.email,
    enrollmentId: s.enrollmentId || null,
    // True only once matched against a real active enrollment on the student
    // portal - never inferred from being on the roster.
    verified: Boolean(s.linkedUserId),
    status: s.status,
    addedAt: s.createdAt,
  }));
}

export default {
  listAllBatches,
  getBatchForAdmin,
  createBatchForAdmin,
  updateBatchForAdmin,
  reassignBatchTeacher,
  listBatchStudentsForAdmin,
};
