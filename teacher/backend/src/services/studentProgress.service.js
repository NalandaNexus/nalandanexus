import { Student } from '../models/Student.js';
import { SchoolClass } from '../models/SchoolClass.js';
import { ApiError } from '../utils/ApiError.js';
import { fetchStudentProgress, fetchStudentActivity } from './studentBridge.service.js';

/**
 * A teacher's view of how their students are progressing.
 *
 * Scoped by ownership at the database level, not by filtering afterwards: the
 * roster query is always `{ teacher: teacherId }`, so a student who is not
 * this teacher's cannot appear even if their id is supplied. Progression is
 * then fetched only for the ids that survived that query.
 *
 * Teachers can read every figure here and write none of them. XP, rank, skill
 * scores and eligibility are produced by the student service's engine from
 * recorded activity; this service has no route that authors any of them.
 */

/**
 * Why a student needs attention, as configured thresholds rather than opinions
 * buried in a component.
 *
 * Returned as flags rather than a single "at risk" boolean so a teacher can see
 * which problem a student has - inactivity and a low score need different
 * conversations.
 */
const DEFAULT_THRESHOLDS = Object.freeze({
  inactiveDays: 7,
  lowAttendance: 75,
  lowOverallPower: 40,
  nearCompletion: 80,
  highPerformer: 80,
});

function flagsFor(progress, thresholds) {
  if (!progress) return { unlinked: true };

  const daysSince = progress.lastActivityAt
    ? Math.floor((Date.now() - new Date(progress.lastActivityAt).getTime()) / 86_400_000)
    : null;

  return {
    inactive: daysSince === null || daysSince >= thresholds.inactiveDays,
    daysSinceActivity: daysSince,
    // Attendance below the line only counts once there are classes to be absent
    // from; flagging a student for missing zero sessions is noise.
    lowAttendance: progress.classesConducted > 0 && progress.attendanceScore < thresholds.lowAttendance,
    lowPerformance: progress.overallPower > 0 && progress.overallPower < thresholds.lowOverallPower,
    highPerformer: progress.overallPower >= thresholds.highPerformer,
    nearCompletion: progress.stageProgress >= thresholds.nearCompletion && progress.stageProgress < 100,
    eligibleForNextStage: nextStageFor(progress) !== null,
  };
}

/**
 * The stage this student has earned but has not moved to, or null.
 *
 * `eligible` alone is not that question. Every student's first stage is
 * recorded as eligible - there is nothing before it to qualify for - so a plain
 * `.some(e => e.eligible)` was true for the entire roster and flagged everyone,
 * which is the same as flagging nobody. Two things narrow it to the students a
 * teacher actually wants to see:
 *
 *   - `status === 'ELIGIBLE'`, which only a published rule the student passed
 *     produces. STARTING_STAGE and NOT_CONFIGURED are excluded by construction.
 *   - not the stage they are already standing on, which they have plainly
 *     qualified for and just as plainly do not need moving to.
 */
function nextStageFor(progress) {
  const earned = (progress?.eligibility || []).find(
    (e) => e.status === 'ELIGIBLE' && e.stageCode !== progress.stageCode
  );
  return earned || null;
}

/**
 * What a stage is still waiting on, for the teacher's detail view.
 *
 * The criteria and the verdict both come from the student service - this
 * decides nothing and re-checks nothing. A teacher reading a different answer
 * from the one that gates enrolment would be worse than reading none.
 */
function blockedStagesFor(progress) {
  return (progress?.eligibility || [])
    .filter((e) => !e.eligible && e.stageCode !== progress.stageCode)
    .map((e) => ({
      stageCode: e.stageCode,
      status: e.status,
      // NOT_CONFIGURED has no outstanding criteria to list because none have
      // been published - a different thing to say, and said differently.
      outstanding: (e.requirements || []).filter((r) => !r.passed),
    }));
}

/**
 * The roster, with progression attached.
 *
 * Paginated, because the spec is explicit that a teacher table must not load
 * every student at once - and because the batched progression call should stay
 * one request per page rather than growing with the class.
 */
export async function listStudentsWithProgress(teacherId, { classId, page = 1, limit = 25, filter = null } = {}) {
  const query = { teacher: teacherId };
  if (classId) {
    const owned = await SchoolClass.findOne({ _id: classId, teacher: teacherId }).select('_id').lean();
    if (!owned) throw ApiError.forbidden('That class does not belong to you.', 'CLASS_NOT_OWNED');
    query.class = classId;
  }

  const skip = (Math.max(1, page) - 1) * limit;
  const [students, total] = await Promise.all([
    Student.find(query).select('name email linkedUserId class enrollmentId').populate('class', 'name').sort({ name: 1 }).skip(skip).limit(limit).lean(),
    Student.countDocuments(query),
  ]);

  // Only students with a portal account have progression to report; the rest
  // are shown with an explicit "not linked" rather than zeroes that would read
  // as poor performance.
  const linkedIds = students.map((s) => s.linkedUserId).filter(Boolean).map(String);
  const { ok, students: progressRows } = await fetchStudentProgress(linkedIds);
  const progressByUser = new Map(progressRows.map((p) => [p.userId, p]));

  const rows = students.map((s) => {
    const progress = s.linkedUserId ? progressByUser.get(String(s.linkedUserId)) : null;
    return {
      studentId: String(s._id),
      userId: s.linkedUserId ? String(s.linkedUserId) : null,
      name: s.name,
      email: s.email,
      enrollmentId: s.enrollmentId || null,
      className: s.class?.name || null,
      linked: Boolean(s.linkedUserId),
      progress: progress || null,
      flags: flagsFor(progress, DEFAULT_THRESHOLDS),
    };
  });

  const filtered = filter
    ? rows.filter((r) => {
        if (filter === 'inactive') return r.flags.inactive && r.linked;
        if (filter === 'at-risk') return (r.flags.lowAttendance || r.flags.lowPerformance) && r.linked;
        if (filter === 'high-performers') return r.flags.highPerformer;
        if (filter === 'near-completion') return r.flags.nearCompletion;
        if (filter === 'eligible') return r.flags.eligibleForNextStage;
        return true;
      })
    : rows;

  return {
    items: filtered,
    meta: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit) || 1,
      // Says plainly when the progression columns are missing, rather than
      // letting an unreachable peer look like a class of zeroes.
      progressionAvailable: ok,
      thresholds: DEFAULT_THRESHOLDS,
    },
  };
}

/** One student's detail, ownership checked before anything is fetched. */
export async function getStudentProgressDetail(teacherId, studentId, { limit = 50 } = {}) {
  const student = await Student.findOne({ _id: studentId, teacher: teacherId })
    .select('name email linkedUserId class enrollmentId')
    .populate('class', 'name')
    .lean();
  // Same message whether the student does not exist or belongs to someone else,
  // so this cannot be used to discover who is on another teacher's roster.
  if (!student) throw ApiError.notFound('Student not found', 'STUDENT_NOT_FOUND');

  if (!student.linkedUserId) {
    return { student: { ...student, linked: false }, progress: null, activity: [], flags: { unlinked: true } };
  }

  const [{ students: rows }, { events }] = await Promise.all([
    fetchStudentProgress([String(student.linkedUserId)]),
    fetchStudentActivity(String(student.linkedUserId), limit),
  ]);

  const progress = rows[0] || null;
  return {
    student: {
      studentId: String(student._id),
      name: student.name,
      email: student.email,
      enrollmentId: student.enrollmentId || null,
      className: student.class?.name || null,
      linked: true,
    },
    progress,
    activity: events,
    flags: flagsFor(progress, DEFAULT_THRESHOLDS),
    // Read-only, and authored elsewhere. Surfaced so a teacher can answer
    // "why am I still locked out of GARUD?" with the same list the student is
    // looking at, instead of guessing.
    eligibility: {
      earnedNextStage: nextStageFor(progress),
      blocked: blockedStagesFor(progress),
    },
  };
}

export default { listStudentsWithProgress, getStudentProgressDetail };
