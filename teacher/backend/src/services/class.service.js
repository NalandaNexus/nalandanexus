import mongoose from 'mongoose';
import { SchoolClass } from '../models/SchoolClass.js';
import { Student } from '../models/Student.js';
import { ApiError } from '../utils/ApiError.js';
import { logAudit } from './audit.service.js';
import { fetchStudentCourseOptions } from './studentBridge.service.js';

/**
 * Aggregates live student-count / average-score / attendance / engagement /
 * risk for a set of classes in a single query (never hardcoded, never
 * N+1 — one aggregation pipeline covers every class in the list).
 */
export async function getClassAggregateStatsMap(classIds) {
  if (!classIds.length) return new Map();
  const ids = classIds.map((id) => new mongoose.Types.ObjectId(id));

  const rows = await Student.aggregate([
    { $match: { class: { $in: ids }, status: 'active', linkedUserId: { $ne: null } } },
    {
      $group: {
        _id: '$class',
        studentCount: { $sum: 1 },
        averageScore: { $avg: '$metrics.currentScore' },
        attendanceRate: { $avg: '$metrics.attendanceRate' },
        engagementRate: { $avg: '$metrics.engagementScore' },
        atRiskCount: { $sum: { $cond: [{ $ne: ['$metrics.riskLevel', 'good'] }, 1, 0] } },
        actNowCount: { $sum: { $cond: [{ $eq: ['$metrics.riskLevel', 'act_now'] }, 1, 0] } },
      },
    },
  ]);

  const map = new Map();
  for (const row of rows) {
    const atRiskShare = row.studentCount ? row.atRiskCount / row.studentCount : 0;
    const riskLevel = row.actNowCount > 0 && atRiskShare >= 0.2 ? 'act_now' : atRiskShare >= 0.2 ? 'watch' : 'good';
    map.set(String(row._id), {
      studentCount: row.studentCount,
      averageScore: round1(row.averageScore),
      attendanceRate: round1(row.attendanceRate),
      engagementRate: round1(row.engagementRate),
      riskLevel,
      atRiskCount: row.atRiskCount,
    });
  }
  return map;
}

function emptyStats() {
  return { studentCount: 0, averageScore: 0, attendanceRate: 0, engagementRate: 0, riskLevel: 'good', atRiskCount: 0 };
}

function shapeClass(cls, statsMap, courseTitleBySlug) {
  const stats = statsMap.get(String(cls._id)) || emptyStats();
  return {
    id: cls._id,
    code: cls.code,
    name: cls.name,
    subject: cls.subject,
    grade: cls.grade || null,
    section: cls.section || null,
    academicSession: cls.academicSession,
    room: cls.room,
    schedule: cls.schedule,
    capacity: cls.capacity,
    status: cls.status,
    studentCourseSlug: cls.studentCourseSlug || null,
    // Resolved live from the real public course catalog (student/backend),
    // never stored/cached here — always reflects the course's current
    // title. Null only for a legacy class predating the "every batch has a
    // course" requirement, or if the linked course was since removed.
    courseTitle: (cls.studentCourseSlug && courseTitleBySlug?.get(cls.studentCourseSlug)) || null,
    studentCount: stats.studentCount,
    averageScore: stats.averageScore,
    attendanceRate: stats.attendanceRate,
    engagementRate: stats.engagementRate,
    riskLevel: stats.riskLevel,
    atRiskCount: stats.atRiskCount,
    createdAt: cls.createdAt,
  };
}

async function buildCourseTitleMap() {
  const courses = await fetchStudentCourseOptions();
  return new Map(courses.map((c) => [c.slug, c.title]));
}

export async function listClasses(teacherId, { status = 'active' } = {}) {
  const filter = { teacher: teacherId };
  if (status && status !== 'all') filter.status = status;

  const classes = await SchoolClass.find(filter).sort({ name: 1 }).lean();
  const [statsMap, courseTitleBySlug] = await Promise.all([
    getClassAggregateStatsMap(classes.map((c) => c._id)),
    buildCourseTitleMap(),
  ]);
  return classes.map((c) => shapeClass(c, statsMap, courseTitleBySlug));
}

export async function getClassById(teacherId, classId) {
  const cls = await SchoolClass.findOne({ _id: classId, teacher: teacherId }).lean();
  if (!cls) throw ApiError.notFound('Class not found.', 'CLASS_NOT_FOUND');
  const [statsMap, courseTitleBySlug] = await Promise.all([
    getClassAggregateStatsMap([classId]),
    buildCourseTitleMap(),
  ]);
  return shapeClass(cls, statsMap, courseTitleBySlug);
}

/** Throws 404 (not 403) for classes owned by another teacher, so IDs can't be used to probe existence. */
export async function assertClassOwnership(teacherId, classId) {
  const cls = await SchoolClass.findOne({ _id: classId, teacher: teacherId });
  if (!cls) throw ApiError.notFound('Class not found.', 'CLASS_NOT_FOUND');
  return cls;
}

/** Slug-safe, uppercase batch code — e.g. course "prarambh" + name "Morning Batch A" -> "PRARAMBH-MORNING-BATCH-A". Namespaced by course so two courses can each have their own "Batch A" without colliding. */
function batchCode(courseSlug, name) {
  const slug = name.trim().toUpperCase().replace(/[^A-Z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  return `${courseSlug.toUpperCase()}-${slug}`.slice(0, 80);
}

/**
 * Confirms the batch is being linked to a course that actually exists in the
 * Student portal.
 *
 * The validator only checks the slug's SHAPE, so any well-formed string was
 * accepted - creating a batch permanently linked to nothing. Such a batch
 * looks healthy (status active, no error) but can never receive a student,
 * because enrollment sync matches on this slug: syncing reports success with
 * 0 results forever, and courseTitle renders empty. Confirmed live before
 * this check existed.
 *
 * If the bridge is unreachable the list comes back empty; that must not block
 * a legitimate batch, so an empty list skips the check rather than rejecting
 * everything.
 */
async function assertCourseSlugExists(studentCourseSlug) {
  const options = await fetchStudentCourseOptions();
  if (!options.length) return;

  if (!options.some((o) => o.slug === studentCourseSlug)) {
    throw ApiError.unprocessable(
      `'${studentCourseSlug}' is not an available course. Pick one from the course list.`,
      'COURSE_SLUG_UNKNOWN'
    );
  }
}

export async function createClass(teacherId, payload, ip) {
  await assertCourseSlugExists(payload.studentCourseSlug);

  const code = batchCode(payload.studentCourseSlug, payload.name);
  const existing = await SchoolClass.findOne({ teacher: teacherId, code });
  if (existing) throw ApiError.conflict(`You already have a batch named '${payload.name}' for this course.`, 'CLASS_CODE_TAKEN');

  const cls = await SchoolClass.create({
    ...payload,
    code,
    subject: payload.subject || undefined,
    teacher: teacherId,
    academicSession: payload.academicSession || currentAcademicSession(),
    studentCourseSlug: payload.studentCourseSlug,
  });

  await logAudit({ actorId: teacherId, action: 'class.created', targetType: 'SchoolClass', targetId: cls._id, metadata: { name: cls.name }, ip });
  return getClassById(teacherId, cls._id);
}

export async function updateClass(teacherId, classId, updates, ip) {
  const cls = await assertClassOwnership(teacherId, classId);
  // Reassigning a batch to a different course must clear the same bar as
  // creating one, or the orphan is simply introduced a step later.
  if (updates.studentCourseSlug && updates.studentCourseSlug !== cls.studentCourseSlug) {
    await assertCourseSlugExists(updates.studentCourseSlug);
  }
  Object.assign(cls, updates);
  await cls.save();
  await logAudit({ actorId: teacherId, action: 'class.updated', targetType: 'SchoolClass', targetId: cls._id, metadata: { updates }, ip });
  return getClassById(teacherId, cls._id);
}

/** Archives rather than hard-deletes, preserving historical grade/attendance data tied to the class. */
export async function archiveClass(teacherId, classId, ip) {
  const cls = await assertClassOwnership(teacherId, classId);
  cls.status = 'archived';
  await cls.save();
  await logAudit({ actorId: teacherId, action: 'class.archived', targetType: 'SchoolClass', targetId: cls._id, ip });
  return { id: cls._id, status: cls.status };
}

function currentAcademicSession() {
  const now = new Date();
  const year = now.getFullYear();
  // Academic year rolls over in June in most Indian school calendars.
  return now.getMonth() >= 5 ? `${year}-${year + 1}` : `${year - 1}-${year}`;
}

function round1(n) {
  if (typeof n !== 'number' || Number.isNaN(n)) return 0;
  return Math.round((n + Number.EPSILON) * 10) / 10;
}

export default { listClasses, getClassById, createClass, updateClass, archiveClass, assertClassOwnership, getClassAggregateStatsMap };
