import { Assignment } from '../models/Assignment.js';
import { Submission } from '../models/Submission.js';
import { Student } from '../models/Student.js';
import { SchoolClass } from '../models/SchoolClass.js';
import { Teacher } from '../models/Teacher.js';
import { ApiError } from '../utils/ApiError.js';
import { assertClassOwnership } from './class.service.js';
import { logAudit } from './audit.service.js';
import { pushTaskToStudents, retractTaskFromStudents } from './studentBridge.service.js';
import { pushAssignmentActivity } from './adminBridge.service.js';

/** Best-effort admin monitoring push — never blocks the primary teacher flow. */
export async function notifyAdminOfAssignment(shaped, teacherId) {
  const teacher = await Teacher.findById(teacherId).populate('user', 'name').lean();
  await pushAssignmentActivity({ ...shaped, teacherName: teacher?.user?.name || '' });
}

async function assertAssignmentOwnership(teacherId, assignmentId) {
  const assignment = await Assignment.findOne({ _id: assignmentId, teacher: teacherId });
  if (!assignment) throw ApiError.notFound('Assignment not found.', 'ASSIGNMENT_NOT_FOUND');
  return assignment;
}

/** Live counts derived from Submission — never stored/cached on the Assignment itself. */
async function attachLiveCounts(assignments) {
  const ids = assignments.map((a) => a._id);
  if (!ids.length) return [];

  const rows = await Submission.aggregate([
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
      createdAt: a.createdAt,
      updatedAt: a.updatedAt,
    };
  });
}

export async function listAssignments(teacherId, { classId, status } = {}) {
  const filter = { teacher: teacherId };
  if (classId && classId !== 'all') filter.class = classId;
  if (status && status !== 'all') filter.status = status;
  else filter.status = { $ne: 'archived' };

  const rows = await Assignment.find(filter).populate('class', 'name').sort({ dueDate: 1 }).lean();
  return attachLiveCounts(rows);
}

export async function getAssignmentById(teacherId, assignmentId) {
  const assignment = await Assignment.findOne({ _id: assignmentId, teacher: teacherId }).populate('class', 'name').lean();
  if (!assignment) throw ApiError.notFound('Assignment not found.', 'ASSIGNMENT_NOT_FOUND');
  const [shaped] = await attachLiveCounts([assignment]);
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

export async function listSubmissionsForAssignment(teacherId, assignmentId) {
  const assignment = await assertAssignmentOwnership(teacherId, assignmentId);
  const isPastDue = new Date() > new Date(assignment.dueDate);

  const rows = await Submission.find({ assignment: assignmentId, teacher: teacherId })
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
  }));
}

export default {
  listAssignments,
  getAssignmentById,
  createAssignment,
  updateAssignment,
  archiveAssignment,
  listSubmissionsForAssignment,
};
