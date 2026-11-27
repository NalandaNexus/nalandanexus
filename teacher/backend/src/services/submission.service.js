import { Submission } from '../models/Submission.js';
import { Assignment } from '../models/Assignment.js';
import { Student } from '../models/Student.js';
import { SchoolClass } from '../models/SchoolClass.js';
import { ApiError } from '../utils/ApiError.js';
import { recalculateStudentMetrics } from './metrics.service.js';
import { logAudit } from './audit.service.js';
import { notifyTeacher } from './notification.service.js';
import { emitToClass, emitToCourse } from '../sockets/index.js';
import { getAssignmentForGrading, notifyAdminOfAssignment } from './assignment.service.js';
import { pushGradeToStudent } from './studentBridge.service.js';
import { canActOnClass } from './courseAccess.service.js';

/**
 * Authorized by course-access now, not just by who the submission's own
 * `teacher` field names (the assignment's author/class owner - unchanged,
 * see models/Submission.js): any teacher sharing this submission's class's
 * course may grade or read it too. Reports the same SUBMISSION_NOT_FOUND
 * either way a lookup fails, matching the rest of this backend's
 * not-found-hides-authorization convention for sensitive per-student data.
 */
async function assertSubmissionAccess(teacherId, submissionId) {
  const submission = await Submission.findOne({ _id: submissionId });
  if (!submission || !(await canActOnClass(teacherId, submission.class))) {
    throw ApiError.notFound('Submission not found.', 'SUBMISSION_NOT_FOUND');
  }
  return submission;
}

export async function getSubmission(teacherId, submissionId) {
  const submission = await Submission.findOne({ _id: submissionId })
    .populate('student', 'name email avatarUrl')
    .populate('assignment', 'title maxScore dueDate')
    .lean();
  if (!submission || !(await canActOnClass(teacherId, submission.class))) {
    throw ApiError.notFound('Submission not found.', 'SUBMISSION_NOT_FOUND');
  }
  return submission;
}

/**
 * Records that a student turned work in (used when intake happens outside
 * this system — e.g. a paper submission the teacher is logging — since
 * live submission intake from students belongs to the separate student
 * portal, not this backend; see the scope note in models/User.js).
 */
export async function recordSubmission(teacherId, submissionId, { content, attachments }, ip) {
  const submission = await assertSubmissionAccess(teacherId, submissionId);
  const assignment = await Assignment.findById(submission.assignment);

  submission.content = content ?? submission.content;
  if (attachments?.length) submission.attachments = attachments;
  submission.submittedAt = new Date();
  submission.status = assignment && submission.submittedAt > assignment.dueDate ? 'late' : 'submitted';
  await submission.save();

  await logAudit({ actorId: teacherId, action: 'submission.recorded', targetType: 'Submission', targetId: submission._id, ip });
  return getSubmission(teacherId, submissionId);
}

/**
 * Grades a submission: persists marks/feedback/grader/timestamp, recomputes
 * that student's cached metrics (score, risk level, ...) from the fresh
 * data, and pushes a real-time score update + (if this closed out the last
 * ungraded submission for the assignment) a notification.
 */
export async function gradeSubmission(teacherId, submissionId, { score, feedback, expectedUpdatedAt }, ip) {
  const existing = await assertSubmissionAccess(teacherId, submissionId);

  if (score > existing.maxScore) {
    throw ApiError.badRequest(`Score cannot exceed the maximum of ${existing.maxScore}.`, 'SCORE_OUT_OF_RANGE');
  }

  // Atomic, filter-based optimistic-concurrency guard (matches the pattern
  // already established for course content edits - see
  // student/backend/src/services/courseStructure.service.js#guardFilter):
  // the UPDATE's own filter requires updatedAt to still match what this
  // caller loaded, so two teachers grading the same submission around the
  // same moment can never silently clobber one another. A "read, compare,
  // then write" check would leave a race window between the check and the
  // save; matching on updatedAt inside the update itself does not.
  const filter = { _id: submissionId };
  if (expectedUpdatedAt !== undefined) {
    filter.updatedAt = expectedUpdatedAt === null ? null : new Date(expectedUpdatedAt);
  }

  const gradedAt = new Date();
  const submission = await Submission.findOneAndUpdate(
    filter,
    {
      $set: {
        score,
        feedback: feedback ?? null,
        gradedBy: teacherId,
        gradedAt,
        status: 'graded',
        ...(existing.submittedAt ? {} : { submittedAt: gradedAt }),
      },
    },
    { new: true }
  );

  if (!submission) {
    const current = await getSubmission(teacherId, submissionId);
    throw ApiError.conflict(
      'This submission was graded or edited by someone else just now. Review the latest version before saving again.',
      'SUBMISSION_CHANGED',
      { current }
    );
  }

  await logAudit({
    actorId: teacherId,
    action: 'submission.graded',
    targetType: 'Submission',
    targetId: submission._id,
    metadata: { score, maxScore: submission.maxScore },
    ip,
  });

  const student = await recalculateStudentMetrics(submission.student);

  if (student) {
    const scoreUpdatePayload = {
      studentId: student._id,
      classId: submission.class,
      newScore: student.metrics.currentScore,
      timestamp: new Date().toISOString(),
    };
    emitToClass(submission.class, 'score:update', scoreUpdatePayload);
    // Also reaches every other teacher sharing this student's course, not
    // just whoever is watching this one class room - the live-update half
    // of "any course-access teacher can grade any student in the course".
    const classDoc = await SchoolClass.findById(submission.class).select('studentCourseSlug').lean();
    if (classDoc?.studentCourseSlug) emitToCourse(classDoc.studentCourseSlug, 'score:update', scoreUpdatePayload);
  }

  const remainingToGrade = await Submission.countDocuments({
    assignment: submission.assignment,
    status: { $in: ['submitted', 'late'] },
  });
  if (remainingToGrade === 0) {
    const assignment = await Assignment.findById(submission.assignment).lean();
    if (assignment) {
      await notifyTeacher(teacherId, {
        type: 'grading',
        title: 'Grading complete',
        message: `All submissions for "${assignment.title}" have been graded.`,
        relatedEntityType: 'Assignment',
        relatedEntityId: assignment._id,
      });
    }
  }

  // getAssignmentForGrading, not getAssignmentById: the assignment may
  // belong to a different teacher than the one grading it now (that's the
  // whole point), and getAssignmentById's strict `teacher: teacherId` match
  // would 404 here even though the grade above was already saved.
  const shapedAssignment = await getAssignmentForGrading(teacherId, submission.assignment);
  await notifyAdminOfAssignment(shapedAssignment, teacherId);

  // The return leg of the task bridge: a submission that arrived via
  // receiveBridgedSubmission carries the originating student portal's own
  // TaskSubmission id - push the real grade back so it isn't stuck at the
  // self-awarded placeholder forever.
  if (submission.studentSubmissionSourceId) {
    await pushGradeToStudent({
      studentSubmissionSourceId: submission.studentSubmissionSourceId,
      score: submission.score,
      maxScore: submission.maxScore,
      feedback: submission.feedback,
    });
  }

  return getSubmission(teacherId, submissionId);
}

/**
 * Receives a REAL student submission bridged in from student/backend (the
 * gap this closes: a bridged Task's submission never previously reached
 * teacher/backend at all — a teacher could publish an assignment to real
 * students but would never see that they'd actually turned it in). Resolves
 * the assignment by `sourceId` (this backend's own Assignment._id, the same
 * value `studentBridge.service.js#pushTaskToStudents` already sends
 * outbound), and the student by `linkedUserId` first (set by
 * syncEnrollmentForClass), falling back to email, creating the roster row on
 * the fly if genuinely new — the same "a real enrollment makes them appear"
 * rule used there, so a submission is never silently dropped just because a
 * sync hasn't run yet.
 */
export async function receiveBridgedSubmission({ assignmentSourceId, studentUserId, studentName, studentEmail, submissionText, isLate, submissionSourceId }) {
  const assignment = await Assignment.findById(assignmentSourceId);
  if (!assignment) return { recorded: false, reason: 'ASSIGNMENT_NOT_FOUND' };

  let student = await Student.findOne({ class: assignment.class, linkedUserId: studentUserId });
  if (!student && studentEmail) {
    student = await Student.findOne({ class: assignment.class, email: studentEmail.toLowerCase() });
    if (student && !student.linkedUserId) {
      student.linkedUserId = studentUserId;
      await student.save();
    }
  }
  if (!student) {
    student = await Student.create({
      name: studentName || studentEmail || 'Student',
      email: (studentEmail || `${studentUserId}@unknown.student`).toLowerCase(),
      class: assignment.class,
      teacher: assignment.teacher,
      linkedUserId: studentUserId,
    });
  }

  const submission = await Submission.findOneAndUpdate(
    { assignment: assignment._id, student: student._id },
    {
      assignment: assignment._id,
      student: student._id,
      class: assignment.class,
      teacher: assignment.teacher,
      status: isLate ? 'late' : 'submitted',
      submittedAt: new Date(),
      content: submissionText || null,
      ...(submissionSourceId ? { studentSubmissionSourceId: submissionSourceId } : {}),
    },
    { upsert: true, new: true }
  );

  await recalculateStudentMetrics(student._id);

  emitToClass(String(assignment.class), 'submission.received', {
    submissionId: submission._id,
    assignmentId: assignment._id,
    studentId: student._id,
  });
  await notifyTeacher(assignment.teacher, {
    type: 'submission',
    title: `New submission: ${assignment.title}`,
    message: `${student.name} submitted "${assignment.title}"${isLate ? ' (late)' : ''}.`,
    relatedEntityType: 'Submission',
    relatedEntityId: submission._id,
  });

  return { recorded: true, submissionId: submission._id };
}

export default { getSubmission, recordSubmission, gradeSubmission, receiveBridgedSubmission };
