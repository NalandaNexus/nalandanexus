import mongoose from 'mongoose';
import { SchoolClass } from '../models/SchoolClass.js';
import { Student } from '../models/Student.js';
import { ApiError } from '../utils/ApiError.js';
import { logAudit } from './audit.service.js';
import { fetchStudentCourseCatalog } from './studentBridge.service.js';

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

/**
 * The batch's real position in the course-link -> enrollment pipeline.
 *
 * The card previously showed only "Verified enrollment enabled" vs "No linked
 * course", which collapsed three genuinely different situations into one
 * reassuring label: a batch linked to a course nobody has bought yet, a batch
 * whose linked course has since been unpublished, and a batch actually serving
 * verified students all read identically. Callers must be able to distinguish
 * "the mapping worked" from "students were found".
 *
 *   UNLINKED             - no studentCourseSlug; sync short-circuits, roster can never verify
 *   LINK_BROKEN          - slug set, but no published course matches it any more
 *   LINKED_NO_ENROLLMENT - mapping is good; nobody has an active enrollment yet
 *   LINKED_VERIFIED      - mapping is good and real enrolled students are on the roster
 */
function deriveLinkState(cls, courseTitle, studentCount, catalogReachable) {
  if (!cls.studentCourseSlug) return 'UNLINKED';
  // Only accuse a link of being broken when the catalogue actually answered.
  if (catalogReachable && !courseTitle) return 'LINK_BROKEN';
  return studentCount > 0 ? 'LINKED_VERIFIED' : 'LINKED_NO_ENROLLMENT';
}

function shapeClass(cls, statsMap, catalog) {
  const stats = statsMap.get(String(cls._id)) || emptyStats();
  const courseTitle = (cls.studentCourseSlug && catalog?.titleBySlug?.get(cls.studentCourseSlug)) || null;
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
    courseTitle,
    linkState: deriveLinkState(cls, courseTitle, stats.studentCount, Boolean(catalog?.ok)),
    studentCount: stats.studentCount,
    averageScore: stats.averageScore,
    attendanceRate: stats.attendanceRate,
    engagementRate: stats.engagementRate,
    riskLevel: stats.riskLevel,
    atRiskCount: stats.atRiskCount,
    createdAt: cls.createdAt,
  };
}

/**
 * Returns the live slug -> title map plus whether the catalogue could actually
 * be reached. `ok` matters: a failed fetch and a genuinely empty catalogue both
 * yield an empty map, and without the distinction every linked batch would be
 * reported as LINK_BROKEN during a student-portal cold start.
 */
async function buildCourseTitleMap() {
  const { ok, courses } = await fetchStudentCourseCatalog();
  return { ok, titleBySlug: new Map(courses.map((c) => [c.slug, c.title])) };
}

export async function listClasses(teacherId, { status = 'active' } = {}) {
  const filter = { teacher: teacherId };
  if (status && status !== 'all') filter.status = status;

  const classes = await SchoolClass.find(filter).sort({ name: 1 }).lean();
  const [statsMap, catalog] = await Promise.all([
    getClassAggregateStatsMap(classes.map((c) => c._id)),
    buildCourseTitleMap(),
  ]);
  return classes.map((c) => shapeClass(c, statsMap, catalog));
}

export async function getClassById(teacherId, classId) {
  const cls = await SchoolClass.findOne({ _id: classId, teacher: teacherId }).lean();
  if (!cls) throw ApiError.notFound('Class not found.', 'CLASS_NOT_FOUND');
  const [statsMap, catalog] = await Promise.all([
    getClassAggregateStatsMap([classId]),
    buildCourseTitleMap(),
  ]);
  return shapeClass(cls, statsMap, catalog);
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
  const { ok, courses } = await fetchStudentCourseCatalog();

  // Fail CLOSED. This previously returned early on an empty list so a
  // temporarily-unreachable catalog wouldn't block a legitimate batch — but an
  // empty list is also what a failed fetch returns, so during any student-portal
  // outage every slug was accepted, including ones that exist nowhere. The batch
  // written in that window looks healthy and can never receive a student, which
  // is precisely the unrepairable state this whole workflow exists to prevent.
  // A retryable 503 costs the teacher a minute; a silently-orphaned batch costs
  // them a roster.
  if (!ok) {
    throw ApiError.serviceUnavailable(
      'The course catalogue is unavailable right now, so this course link cannot be verified. Nothing was changed — please try again in a moment.',
      'COURSE_CATALOG_UNAVAILABLE'
    );
  }

  if (!courses.some((c) => c.slug === studentCourseSlug)) {
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

/**
 * The only class fields a teacher may set through the edit endpoint.
 *
 * The handler used to Object.assign the whole request body onto the document,
 * and the validator only constrains the fields it names — so `teacher`, `code`,
 * `grade`, `section` and `academicSession` all rode straight through unchecked.
 * A PATCH carrying `{"teacher": "<someone else's id>"}` reassigned ownership of
 * the batch, and `{"code": "..."}` could collide with the unique per-teacher
 * index. Enumerating what may change is the fix; anything absent here is
 * ignored rather than rejected, so a client echoing back a full class object
 * still works.
 */
const UPDATABLE_CLASS_FIELDS = ['name', 'subject', 'room', 'schedule', 'capacity', 'status', 'studentCourseSlug'];

function pickClassUpdates(updates) {
  const picked = {};
  for (const field of UPDATABLE_CLASS_FIELDS) {
    if (Object.prototype.hasOwnProperty.call(updates, field)) picked[field] = updates[field];
  }
  return picked;
}

export async function updateClass(teacherId, classId, updates, ip) {
  const cls = await assertClassOwnership(teacherId, classId);
  const safeUpdates = pickClassUpdates(updates);

  // Reassigning a batch to a different course must clear the same bar as
  // creating one, or the orphan is simply introduced a step later. Checked
  // BEFORE anything is written, so a rejected link leaves the batch untouched.
  if (safeUpdates.studentCourseSlug && safeUpdates.studentCourseSlug !== cls.studentCourseSlug) {
    await assertCourseSlugExists(safeUpdates.studentCourseSlug);
  }

  Object.assign(cls, safeUpdates);
  await cls.save();
  await logAudit({ actorId: teacherId, action: 'class.updated', targetType: 'SchoolClass', targetId: cls._id, metadata: { updates: safeUpdates }, ip });
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
