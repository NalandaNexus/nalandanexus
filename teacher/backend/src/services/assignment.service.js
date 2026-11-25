import { Assignment } from '../models/Assignment.js';
import { Submission } from '../models/Submission.js';
import { Student } from '../models/Student.js';
import { SchoolClass } from '../models/SchoolClass.js';
import { Teacher } from '../models/Teacher.js';
import { ApiError } from '../utils/ApiError.js';
import { assertClassOwnership } from './class.service.js';
import { canActOnClass, getAccessibleClassIds } from './courseAccess.service.js';
import { logAudit } from './audit.service.js';
import { pushTaskToStudents, retractTaskFromStudents } from './studentBridge.service.js';
import { pushAssignmentActivity } from './adminBridge.service.js';

/** Best-effort admin monitoring push — never blocks the primary teacher flow. */
export async function notifyAdminOfAssignment(shaped, teacherId) {
  const teacher = await Teacher.findById(teacherId).populate('user', 'name').lean();
  await pushAssignmentActivity({ ...shaped, teacherName: teacher?.user?.name || '' });
}

/** Batch-resolves {teacherId: name}, for the "whose assignment" indicator in attachLiveCounts - one query per list, never one per row. */
async function resolveTeacherNames(teacherIds) {
  const ids = [...new Set(teacherIds.map((id) => (id ? String(id) : null)).filter(Boolean))];
  if (!ids.length) return new Map();
  const rows = await Teacher.find({ _id: { $in: ids } }).populate('user', 'name').lean();
  return new Map(rows.map((t) => [String(t._id), t.user?.name || null]));
}

async function assertAssignmentOwnership(teacherId, assignmentId) {
  const assignment = await Assignment.findOne({ _id: assignmentId, teacher: teacherId });
  if (!assignment) throw ApiError.notFound('Assignment not found.', 'ASSIGNMENT_NOT_FOUND');
  return assignment;
}

/**
 * Live counts derived from Submission — never stored/cached on the
 * Assignment itself. `viewerTeacherId` powers the "whose assignment"
 * indicator (isOwn/teacherName): listing now spans every class a teacher may
 * act on, not only ones they authored (see listAssignments), so a row here
 * can belong to a different teacher than whoever is looking at it.
 */
async function attachLiveCounts(assignments, viewerTeacherId = null) {
  const ids = assignments.map((a) => a._id);
  if (!ids.length) return [];

  const [rows, teacherNameById] = await Promise.all([
    Submission.aggregate([
      { $match: { assignment: { $in: ids } } },
      {
        $group: {
          _id: '$assignment',
          total: { $sum: 1 },
          submitted: { $sum: { $cond: [{ $in: ['$status', ['submitted', 'late', 'graded']] }, 1, 0] } },
          toGrade: { $sum: { $cond: [{ $in: ['$status', ['submitted', 'late']] }, 1, 0] } },
          gradedScores: { $push: { $cond: [{ $eq: ['$status', 'graded'] }, { score: '$score', maxScore: '$maxScore' }, '$$REMOVE'] } },
        },
      },
    ]),
    resolveTeacherNames(assignments.map((a) => a.teacher)),
  ]);

  const countsById = new Map(rows.map((r) => [String(r._id), r]));

  return assignments.map((a) => {
    const c = countsById.get(String(a._id));
    const avgScore = c && c.gradedScores.length
      ? Math.round(
          c.gradedScores.reduce((sum, g) => sum + (g.maxScore ? (g.score / g.maxScore) * 100 : g.score), 0) /
            c.gradedScores.length
        )
      : null;
    const ownerId = a.teacher ? String(a.teacher) : null;

    return {
      id: a._id,
      title: a.title,
      description: a.description,
      instructions: a.instructions,
      classId: a.class?._id || a.class,
      className: a.class?.name,
      course: a.course,
      conceptId: a.concept,
      dueDate: a.dueDate,
      maxScore: a.maxScore,
      attachments: a.attachments,
      status: a.status,
      total: c?.total ?? 0,
      submitted: c?.submitted ?? 0,
      toGrade: c?.toGrade ?? 0,
      avgScore,
      // Whose assignment this is - listAssignments now spans every class this
      // teacher may act on, own or course-access alike. Null (not false)
      // when viewerTeacherId wasn't supplied, rather than ever guessing.
      teacherId: ownerId,
      isOwn: ownerId && viewerTeacherId ? ownerId === String(viewerTeacherId) : null,
      teacherName: ownerId ? teacherNameById.get(ownerId) || null : null,
      createdAt: a.createdAt,
      updatedAt: a.updatedAt,
    };
  });
}

/**
 * Every assignment across the classes this teacher may act on - authored by
 * them or not, since browsing to an assignment is how the grading flow
 * finds it (see listSubmissionsForAssignment). Widened the same way the
 * class/assignment pickers are on the frontend; authoring an assignment
 * (create/update/archive, below) is a different action and stays
 * owner-scoped.
 */
export async function listAssignments(teacherId, { classId, status } = {}) {
  const accessibleClassIds = await getAccessibleClassIds(teacherId);
  const filter = { class: { $in: accessibleClassIds } };
  if (classId && classId !== 'all') {
    if (!accessibleClassIds.some((id) => String(id) === String(classId))) return [];
    filter.class = classId;
  }
  if (status && status !== 'all') filter.status = status;
  else filter.status = { $ne: 'archived' };

  const rows = await Assignment.find(filter).populate('class', 'name').sort({ dueDate: 1 }).lean();
  return attachLiveCounts(rows, teacherId);
}

export async function getAssignmentById(teacherId, assignmentId) {
  const assignment = await Assignment.findOne({ _id: assignmentId, teacher: teacherId }).populate('class', 'name').lean();
  if (!assignment) throw ApiError.notFound('Assignment not found.', 'ASSIGNMENT_NOT_FOUND');
  const [shaped] = await attachLiveCounts([assignment], teacherId);
  return shaped;
}

/**
 * The same read as getAssignmentById, but authorized by course-access
 * rather than strict authorship - used only from the grading path
 * (submission.service.js#gradeSubmission), where the teacher doing the
 * grading may be a different one than whoever authored the assignment.
 * Assignment CRUD itself (create/update/archive/list) stays authorship-only
 * via getAssignmentById/assertAssignmentOwnership above: authoring content
 * is a different action from grading it, and only the former stays
 * owner-scoped (see the plan's "stays owner-scoped" note on assignments).
 */
export async function getAssignmentForGrading(teacherId, assignmentId) {
  const assignment = await Assignment.findById(assignmentId).populate('class', 'name').lean();
  if (!assignment || !(await canActOnClass(teacherId, assignment.class?._id || assignment.class))) {
    throw ApiError.notFound('Assignment not found.', 'ASSIGNMENT_NOT_FOUND');
  }
  const [shaped] = await attachLiveCounts([assignment], teacherId);
  return shaped;
}

/**
 * Creates the assignment and, if published immediately, generates one
 * 'pending' Submission stub per currently-enrolled student — see the
 * doc-comment on models/Submission.js for why this up-front fan-out keeps
 * "submitted / to-grade / missing" counts simple, indexed, and honest.
 */
export async function createAssignment(teacherId, payload, ip) {
  const classDoc = await assertClassOwnership(teacherId, payload.classId);

  const assignment = await Assignment.create({
    title: payload.title,
    description: payload.description || '',
    instructions: payload.instructions || '',
    class: payload.classId,
    teacher: teacherId,
    course: payload.course || null,
    concept: payload.conceptId || null,
    dueDate: payload.dueDate,
    maxScore: payload.maxScore || 100,
    status: payload.status || 'published',
  });

  if (assignment.status === 'published') {
    await seedSubmissionStubs(assignment);
    await pushTaskToStudents(assignment, classDoc);
  }

  await logAudit({ actorId: teacherId, action: 'assignment.created', targetType: 'Assignment', targetId: assignment._id, metadata: { title: assignment.title }, ip });
  const shaped = await getAssignmentById(teacherId, assignment._id);
  await notifyAdminOfAssignment(shaped, teacherId);
  return shaped;
}

async function seedSubmissionStubs(assignment) {
  const students = await Student.find({ class: assignment.class, status: 'active', linkedUserId: { $ne: null } }).select('_id').lean();
  if (!students.length) return;

  const ops = students.map((s) => ({
    updateOne: {
      filter: { assignment: assignment._id, student: s._id },
      update: {
        $setOnInsert: {
          assignment: assignment._id,
          student: s._id,
          class: assignment.class,
          teacher: assignment.teacher,
          status: 'pending',
          maxScore: assignment.maxScore,
        },
      },
      upsert: true,
    },
  }));
  await Submission.bulkWrite(ops, { ordered: false });
}

export async function updateAssignment(teacherId, assignmentId, updates, ip) {
  const assignment = await assertAssignmentOwnership(teacherId, assignmentId);
  const wasPublished = assignment.status === 'published';
  // Explicit whitelist matching updateAssignmentValidator's declared fields
  // — same rationale as the analogous fix in course.service.js#updateCourse
  // and exam.service.js#updateExam: never let Object.assign let an
  // undeclared field (e.g. `class`/`teacher`) reach the document.
  const patchable = ['title', 'dueDate', 'description', 'instructions', 'maxScore', 'status'];
  for (const key of patchable) {
    if (updates[key] !== undefined) assignment[key] = updates[key];
  }
  await assignment.save();

  if (!wasPublished && assignment.status === 'published') {
    await seedSubmissionStubs(assignment);
  }

  await logAudit({ actorId: teacherId, action: 'assignment.updated', targetType: 'Assignment', targetId: assignment._id, metadata: { updates }, ip });

  if (assignment.status === 'published') {
    const classDoc = await SchoolClass.findById(assignment.class);
    await pushTaskToStudents(assignment, classDoc);
  } else if (wasPublished) {
    await retractTaskFromStudents(String(assignment._id));
  }

  const shaped = await getAssignmentById(teacherId, assignmentId);
  await notifyAdminOfAssignment(shaped, teacherId);
  return shaped;
}

export async function archiveAssignment(teacherId, assignmentId, ip) {
  const assignment = await assertAssignmentOwnership(teacherId, assignmentId);
  assignment.status = 'archived';
  await assignment.save();
  await logAudit({ actorId: teacherId, action: 'assignment.archived', targetType: 'Assignment', targetId: assignment._id, ip });
  await retractTaskFromStudents(String(assignment._id));
  const shaped = await getAssignmentById(teacherId, assignmentId);
  await notifyAdminOfAssignment(shaped, teacherId);
  return { id: assignment._id, status: assignment.status };
}

/** Course-access-authorized, like the rest of the grading path: the assignment may belong to a different teacher than the one grading its submissions. */
export async function listSubmissionsForAssignment(teacherId, assignmentId) {
  const assignment = await Assignment.findById(assignmentId).lean();
  if (!assignment || !(await canActOnClass(teacherId, assignment.class))) {
    throw ApiError.notFound('Assignment not found.', 'ASSIGNMENT_NOT_FOUND');
  }
  const isPastDue = new Date() > new Date(assignment.dueDate);

  // Scoped by assignment alone, not `teacher` - the check above already
  // decided whether this teacher may see this assignment's submissions at
  // all, and most rows here were seeded with `teacher: assignment.teacher`
  // (see seedSubmissionStubs), which is not necessarily the teacher grading
  // them now.
  const rows = await Submission.find({ assignment: assignmentId })
    .populate('student', 'name email avatarUrl')
    .sort({ status: 1, submittedAt: -1 })
    .lean();

  // Submission has no dueDate of its own (every row here shares the parent
  // assignment's dueDate) — "missing" is only correct once that one date has
  // passed, not derived from a per-row field that doesn't exist.
  return rows.map((s) => ({
    id: s._id,
    studentId: s.student?._id,
    studentName: s.student?.name,
    studentEmail: s.student?.email,
    status: s.status === 'pending' && isPastDue ? 'missing' : s.status,
    submittedAt: s.submittedAt,
    score: s.score,
    maxScore: s.maxScore,
    feedback: s.feedback,
    gradedAt: s.gradedAt,
    // The grading form's optimistic-concurrency baseline (see
    // submission.service.js#gradeSubmission's expectedUpdatedAt) - without
    // it the frontend has no way to detect that someone else just graded
    // this submission.
    updatedAt: s.updatedAt,
  }));
}

export default {
  listAssignments,
  getAssignmentById,
  getAssignmentForGrading,
  createAssignment,
  updateAssignment,
  archiveAssignment,
  listSubmissionsForAssignment,
};
