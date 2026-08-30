import { Student } from '../models/Student.js';
import { SchoolClass } from '../models/SchoolClass.js';
import { Submission } from '../models/Submission.js';
import { Attendance } from '../models/Attendance.js';
import { ApiError } from '../utils/ApiError.js';
import { parsePagination, buildPaginationMeta } from '../utils/pagination.js';
import { assertClassOwnership } from './class.service.js';
import { logAudit } from './audit.service.js';
import { fetchEnrollmentSnapshot } from './studentBridge.service.js';
import { recountBatchSeats } from './batchPlacement.service.js';

function shapeStudentSummary(s) {
  return {
    id: s._id,
    name: s.name,
    email: s.email,
    avatar: s.avatarUrl || dicebearAvatar(s.name),
    classId: s.class?._id || s.class,
    className: s.class?.name || undefined,
    rollNumber: s.rollNumber,
    score: s.metrics?.currentScore ?? 0,
    previousScore: s.metrics?.previousScore ?? 0,
    scoreChange: s.metrics?.scoreChange ?? 0,
    classAverage: s.metrics?.classAverage ?? 0,
    attendanceRate: s.metrics?.attendanceRate ?? 0,
    submissionRate: s.metrics?.submissionRate ?? 0,
    engagementScore: s.metrics?.engagementScore ?? 0,
    riskLevel: s.metrics?.riskLevel ?? 'good',
    atRiskReason: s.metrics?.atRiskReason ?? undefined,
    status: s.status,
    // True only once matched, by email, against a REAL active enrollment in
    // student/backend (see syncEnrollmentForClass) — never inferred from
    // merely being on this roster. A class with no linked student course
    // has no way to verify anyone, so this is always false there rather
    // than silently claiming a guarantee that can't be checked.
    verified: Boolean(s.linkedUserId),
  };
}

export function dicebearAvatar(name) {
  return `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(name)}&backgroundColor=22355e,ab5236,5c7a5e`;
}

const SORT_FIELDS = {
  name: 'name',
  score: 'metrics.currentScore',
  attendance: 'metrics.attendanceRate',
};

/** Backend-side search / filter / sort / pagination — never ships the full roster to the client just to filter it there. */
export async function listStudents(teacherId, { classId, riskLevel, search, page, limit, sortBy, sortOrder } = {}) {
  const { page: p, limit: l, skip } = parsePagination({ page, limit });

  // Real, verified students only — a roster row is never proof of purchase
  // on its own (see syncEnrollmentForClass); only a real matched enrollment
  // (linkedUserId set) counts as a student a teacher should actually see.
  const filter = { teacher: teacherId, status: 'active', linkedUserId: { $ne: null } };
  if (classId && classId !== 'all') filter.class = classId;
  if (riskLevel && riskLevel !== 'all') filter['metrics.riskLevel'] = riskLevel;
  if (search && search.trim()) {
    const q = search.trim();
    filter.$or = [{ name: new RegExp(escapeRegex(q), 'i') }, { email: new RegExp(escapeRegex(q), 'i') }];
  }

  const sortField = SORT_FIELDS[sortBy] || SORT_FIELDS.name;
  const sortDir = sortOrder === 'desc' ? -1 : 1;

  const [rows, total] = await Promise.all([
    Student.find(filter).populate('class', 'name').sort({ [sortField]: sortDir }).skip(skip).limit(l).lean(),
    Student.countDocuments(filter),
  ]);

  return {
    students: rows.map(shapeStudentSummary),
    meta: buildPaginationMeta({ page: p, limit: l, total }),
  };
}

export async function getAtRiskStudents(teacherId) {
  const rows = await Student.find({ teacher: teacherId, status: 'active', linkedUserId: { $ne: null }, 'metrics.riskLevel': { $in: ['act_now', 'watch'] } })
    .populate('class', 'name')
    .sort({ 'metrics.currentScore': 1 })
    .lean();

  const shaped = rows.map(shapeStudentSummary);
  const actNow = shaped.filter((s) => s.riskLevel === 'act_now');
  const watch = shaped.filter((s) => s.riskLevel === 'watch');
  return { all: [...actNow, ...watch], actNow, watch, totalCount: actNow.length + watch.length };
}

async function assertStudentOwnership(teacherId, studentId) {
  const student = await Student.findOne({ _id: studentId, teacher: teacherId });
  if (!student) throw ApiError.notFound('Student not found.', 'STUDENT_NOT_FOUND');
  return student;
}

export async function getStudentDetail(teacherId, studentId) {
  const student = await assertStudentOwnership(teacherId, studentId);
  await student.populate('class', 'name');

  const submissions = await Submission.find({ student: studentId })
    .populate('assignment', 'title maxScore dueDate')
    .sort({ createdAt: -1 })
    .limit(20)
    .lean();

  const attendanceHistory = await Attendance.find({ student: studentId })
    .sort({ date: -1 })
    .limit(14)
    .lean();

  const scoreTimeline = await buildScoreTimeline(studentId, student.metrics?.classAverage ?? 0);

  return {
    ...shapeStudentSummary(student),
    conceptScores: mapToObject(student.conceptScores),
    submissions: submissions.map((sub) => ({
      id: sub._id,
      title: sub.assignment?.title || 'Assignment',
      submittedAt: sub.submittedAt ? sub.submittedAt.toISOString() : null,
      status: effectiveSubmissionStatus(sub),
      score: sub.score,
      maxScore: sub.maxScore || sub.assignment?.maxScore || 100,
    })),
    attendanceHistory: attendanceHistory.map((a) => ({
      date: a.date.toISOString().slice(0, 10),
      status: a.status,
    })),
    scoreTimeline,
  };
}

function effectiveSubmissionStatus(sub) {
  if (sub.status === 'pending') return 'missing';
  return sub.status;
}

async function buildScoreTimeline(studentId, classAverage) {
  const graded = await Submission.find({ student: studentId, status: 'graded', gradedAt: { $ne: null } })
    .sort({ gradedAt: 1 })
    .limit(5)
    .lean();

  return graded.map((s, idx) => ({
    time: idx === graded.length - 1 ? 'Current' : `Week ${idx + 1}`,
    score: s.maxScore ? Math.round((s.score / s.maxScore) * 100) : s.score,
    classAvg: Math.round(classAverage),
  }));
}

/**
 * Reconciles this class's roster against the REAL enrolled students for its
 * linked student-portal course — the one place "purchased/enrolled" access
 * is actually verified, per the student portal's own Enrollment collection
 * (see studentBridge.service.js#fetchEnrolledStudents). Never trusts the
 * locally-curated roster as proof of purchase on its own.
 *
 * Additive, not destructive: a genuinely-enrolled student who isn't yet on
 * the roster is created (this is how "a purchase makes them appear under
 * the teacher" actually happens); an existing roster row matched by email
 * gets `linkedUserId` set (verified). A roster row that WAS linked but is
 * no longer in the active-enrollment list (refunded/revoked) has its link
 * cleared rather than being deleted — the teacher's attendance/grading
 * history for that student must not vanish, but they stop counting as
 * verified until re-synced true again.
 */
export async function syncEnrollmentForClass(teacherId, classId) {
  const classDoc = await assertClassOwnership(teacherId, classId);
  if (!classDoc.studentCourseSlug) {
    return { synced: false, outcome: 'NOT_LINKED', created: 0, linked: 0, unlinked: 0, totalEnrolled: 0 };
  }

  const snapshot = await fetchEnrollmentSnapshot(classDoc.studentCourseSlug, { batchId: String(classId) });

  // A failed fetch used to be indistinguishable from "nobody is enrolled":
  // both produced an empty list, and the unlink pass below then read that as
  // every student having been refunded and cleared `linkedUserId` across the
  // whole roster. One sync during a student-portal cold start would silently
  // de-verify a real class. Refuse to reconcile against an answer we never got.
  if (!snapshot.ok) {
    throw ApiError.serviceUnavailable(
      'Could not reach the student portal to confirm enrollments. The roster was left exactly as it was - please try again in a moment.',
      'ENROLLMENT_SOURCE_UNAVAILABLE'
    );
  }

  // Only students actually PLACED in this batch. The student portal returns
  // everyone who bought the course, because a course runs several batches and it
  // has no opinion about which one this caller is. Importing all of them was
  // invisible while a course had a single batch and a cross-batch data leak the
  // moment it had two: PB1's teacher would see PB2's students. An enrollment
  // still awaiting placement (batchId null) belongs to no batch yet and is left
  // alone rather than swept into whichever batch happened to sync first.
  const forThisBatch = snapshot.students.filter((e) => e && String(e.batchId || '') === String(classId));

  const capacity = Number.isFinite(classDoc.capacity) && classDoc.capacity > 0 ? classDoc.capacity : 60;
  const enrolled = forThisBatch.slice(0, capacity);
  const overCapacity = forThisBatch.length - enrolled.length;

  let created = 0;
  let linked = 0;

  for (const e of enrolled) {
    const email = typeof e.email === 'string' && e.email ? e.email.toLowerCase() : null;
    if (!email) continue;

    // Enrollment ID first, email only as a fallback for rows predating it.
    // Matching on email alone meant a student who changed their address on the
    // student portal returned as a second roster row, orphaning their grades and
    // attendance under the old one.
    const existing = e.enrollmentId
      ? await Student.findOne({ class: classId, $or: [{ enrollmentId: e.enrollmentId }, { email }] })
      : await Student.findOne({ class: classId, email });

    if (existing) {
      const before = { link: String(existing.linkedUserId || ''), email: existing.email };
      existing.linkedUserId = e.userId;
      if (e.enrollmentId) existing.enrollmentId = e.enrollmentId;
      // A placement placeholder carries no real identity yet; the first sync
      // that finds the enrollment is what fills it in.
      if (email !== existing.email) existing.email = email;
      if (e.name) existing.name = e.name;
      if (e.avatar) existing.avatarUrl = e.avatar;
      await existing.save();
      if (before.link !== String(e.userId) || before.email !== email) linked += 1;
    } else {
      const previous = await Student.findOneAndUpdate(
        { class: classId, email },
        {
          $setOnInsert: { name: e.name, class: classId, teacher: teacherId },
          $set: {
            avatarUrl: e.avatar || null,
            linkedUserId: e.userId,
            ...(e.enrollmentId ? { enrollmentId: e.enrollmentId } : {}),
          },
        },
        { upsert: true, new: false, setDefaultsOnInsert: true }
      );
      if (previous) linked += 1;
      else created += 1;
    }
  }

  // Clear verification on roster rows whose enrollment is no longer active in
  // this batch. Safe to run now: `snapshot` is a real answer from the student
  // portal, never a fallback empty list.
  const placedIds = new Set(enrolled.map((e) => String(e.enrollmentId || '')).filter(Boolean));
  const placedEmails = new Set(enrolled.map((e) => (e.email || '').toLowerCase()).filter(Boolean));
  const currentlyLinked = await Student.find({ class: classId, teacher: teacherId, linkedUserId: { $ne: null } })
    .select('_id email enrollmentId')
    .lean();
  const toUnlink = currentlyLinked
    .filter((s) => (s.enrollmentId ? !placedIds.has(s.enrollmentId) : !placedEmails.has((s.email || '').toLowerCase())))
    .map((s) => s._id);
  let unlinked = 0;
  if (toUnlink.length) {
    const result = await Student.updateMany({ _id: { $in: toUnlink } }, { linkedUserId: null });
    unlinked = result.modifiedCount || 0;
  }

  // `enrolledCount` is a cache that lets capacity be claimed atomically at
  // placement time; reconciling it here against the real roster means it can
  // never drift permanently.
  await recountBatchSeats(classId);

  await logAudit({ actorId: teacherId, action: 'class.enrollment_synced', targetType: 'SchoolClass', targetId: classId, metadata: { created, linked, unlinked, overCapacity, totalEnrolled: enrolled.length } });

  // The mapping working and students being found are separate facts, and the
  // caller has to be able to say which happened: a correctly-linked course
  // nobody has enrolled in yet is a success, not a silent no-op reported as
  // "enrollment synced".
  const outcome = enrolled.length === 0 ? 'NO_ENROLLMENTS' : 'SYNCED';
  return { synced: true, outcome, created, linked, unlinked, overCapacity, totalEnrolled: enrolled.length };
}

export async function createStudent(teacherId, payload, ip) {
  await assertClassOwnership(teacherId, payload.classId);

  const student = await Student.create({
    name: payload.name,
    email: payload.email,
    phone: payload.phone || null,
    rollNumber: payload.rollNumber || null,
    class: payload.classId,
    teacher: teacherId,
    guardianName: payload.guardianName || null,
    guardianPhone: payload.guardianPhone || null,
    guardianEmail: payload.guardianEmail || null,
  });

  await logAudit({ actorId: teacherId, action: 'student.created', targetType: 'Student', targetId: student._id, metadata: { name: student.name }, ip });
  return getStudentDetail(teacherId, student._id);
}

/**
 * The only roster fields a teacher may edit directly.
 *
 * The same mass-assignment hole updateClass had: the raw request body was
 * assigned onto the document, and the validator only constrains the fields it
 * names - so an unvalidated `linkedUserId` in the payload would forge the very
 * "verified enrollment" flag syncEnrollmentForClass exists to establish, making
 * an arbitrary roster row look like a paying student, and `teacher` would move
 * the row to another account.
 */
const UPDATABLE_STUDENT_FIELDS = ['name', 'phone', 'rollNumber', 'guardianName', 'guardianPhone', 'guardianEmail', 'status'];

export async function updateStudent(teacherId, studentId, updates, ip) {
  const student = await assertStudentOwnership(teacherId, studentId);
  if (updates.classId) {
    await assertClassOwnership(teacherId, updates.classId);
    student.class = updates.classId;
  }
  for (const field of UPDATABLE_STUDENT_FIELDS) {
    if (Object.prototype.hasOwnProperty.call(updates, field)) student[field] = updates[field];
  }
  await student.save();
  await logAudit({ actorId: teacherId, action: 'student.updated', targetType: 'Student', targetId: student._id, metadata: { fields: Object.keys(updates) }, ip });
  return getStudentDetail(teacherId, studentId);
}

export async function archiveStudent(teacherId, studentId, ip) {
  const student = await assertStudentOwnership(teacherId, studentId);
  student.status = 'inactive';
  await student.save();
  await logAudit({ actorId: teacherId, action: 'student.archived', targetType: 'Student', targetId: student._id, ip });
  return { id: student._id, status: student.status };
}

function mapToObject(map) {
  if (!map) return {};
  if (map instanceof Map) return Object.fromEntries(map);
  return map;
}

function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export default {
  listStudents,
  getAtRiskStudents,
  getStudentDetail,
  syncEnrollmentForClass,
  createStudent,
  updateStudent,
  archiveStudent,
  dicebearAvatar,
};
