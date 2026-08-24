import { Submission } from '../models/Submission.js';
import { Assignment } from '../models/Assignment.js';
import { Student } from '../models/Student.js';
import { ApiError } from '../utils/ApiError.js';
import { recalculateStudentMetrics } from './metrics.service.js';
import { logAudit } from './audit.service.js';
import { notifyTeacher } from './notification.service.js';
import { emitToClass } from '../sockets/index.js';
import { getAssignmentById, notifyAdminOfAssignment } from './assignment.service.js';
import { pushGradeToStudent } from './studentBridge.service.js';

async function assertSubmissionOwnership(teacherId, submissionId) {
  const submission = await Submission.findOne({ _id: submissionId, teacher: teacherId });
  if (!submission) throw ApiError.notFound('Submission not found.', 'SUBMISSION_NOT_FOUND');
  return submission;
}

export async function getSubmission(teacherId, submissionId) {
  const submission = await Submission.findOne({ _id: submissionId, teacher: teacherId })
    .populate('student', 'name email avatarUrl')
    .populate('assignment', 'title maxScore dueDate')
    .lean();
  if (!submission) throw ApiError.notFound('Submission not found.', 'SUBMISSION_NOT_FOUND');
  return submission;
}

/**
 * Records that a student turned work in (used when intake happens outside
 * this system — e.g. a paper submission the teacher is logging — since
 * live submission intake from students belongs to the separate student
 * portal, not this backend; see the scope note in models/User.js).
 */
export async function recordSubmission(teacherId, submissionId, { content, attachments }, ip) {
  const submission = await assertSubmissionOwnership(teacherId, submissionId);
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
export async function gradeSubmission(teacherId, submissionId, { score, feedback }, ip) {
  const submission = await assertSubmissionOwnership(teacherId, submissionId);

  if (score > submission.maxScore) {
    throw ApiError.badRequest(`Score cannot exceed the maximum of ${submission.maxScore}.`, 'SCORE_OUT_OF_RANGE');
  }

  submission.score = score;
  submission.feedback = feedback ?? null;
  submission.gradedBy = teacherId;
  submission.gradedAt = new Date();
  submission.status = 'graded';
  if (!submission.submittedAt) submission.submittedAt = submission.gradedAt;
  await submission.save();

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
    emitToClass(submission.class, 'score:update', {
      studentId: student._id,
      classId: submission.class,
      newScore: student.metrics.currentScore,
      timestamp: new Date().toISOString(),
    });
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

  const shapedAssignment = await getAssignmentById(teacherId, submission.assignment);
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
