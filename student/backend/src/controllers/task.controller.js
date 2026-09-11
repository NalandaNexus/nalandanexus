import { asyncHandler } from '../utils/asyncHandler.js';
import { sendSuccess } from '../utils/apiResponse.js';
import { AppError } from '../utils/AppError.js';
import { Task } from '../models/Task.js';
import { TaskSubmission } from '../models/TaskSubmission.js';
import { Enrollment } from '../models/Enrollment.js';
import { recalculateAverages } from '../services/xp.service.js';
import { recordActivity } from '../services/progression/engine.service.js';
// recalculateAverages is used below when a real teacher grade arrives
// (gradeBridgedTaskSubmission), not at submission time - see that function.
import { pushTaskSubmission } from '../services/teacherBridge.service.js';

export const listMyTasks = asyncHandler(async (req, res) => {
  const enrollments = await Enrollment.find({ userId: req.user._id, status: 'active' }).select('courseId enrolledAt');
  const courseIds = enrollments.map((e) => e.courseId);
  const enrolledAtByCourse = new Map(enrollments.map((e) => [String(e.courseId), e.enrolledAt]));

  const [tasks, submissions] = await Promise.all([
    Task.find({ courseId: { $in: courseIds }, isPublished: true }).sort({ order: 1 }),
    TaskSubmission.find({ userId: req.user._id }),
  ]);
  const submissionMap = new Map(submissions.map((s) => [String(s.taskId), s]));

  const data = tasks.map((t) => {
    const submission = submissionMap.get(String(t._id));
    const enrolledAt = enrolledAtByCourse.get(String(t.courseId));
    // A bridged task (from a teacher-authored Assignment) carries a real
    // absolute deadline - prefer it over the enrollment-relative fallback
    // used by the platform's own catalog tasks.
    const dueDate = t.dueDate
      ? t.dueDate
      : enrolledAt
      ? new Date(new Date(enrolledAt).getTime() + t.dueOffsetDays * 24 * 60 * 60 * 1000)
      : null;
    return {
      id: t.taskId,
      title: t.title,
      type: t.type,
      description: t.description,
      moduleTitle: t.moduleTitle,
      urgency: t.urgency,
      iconName: t.iconName,
      pointsReward: t.pointsReward,
      isCompleted: Boolean(submission?.isCompleted),
      completedAt: submission?.completedAt || null,
      dueDate,
      targetUrl: t.type === 'Quiz' ? `/student/parambh/quizzes/${t.taskId}` : `/student/parambh/tasks/${t.taskId}`,
    };
  });

  return sendSuccess(res, { data });
});

export const getTaskDetail = asyncHandler(async (req, res) => {
  const task = await Task.findOne({ taskId: req.params.taskId, isPublished: true });
  if (!task) throw AppError.notFound('Task not found', 'TASK_NOT_FOUND');

  const submission = await TaskSubmission.findOne({ userId: req.user._id, taskId: task._id });

  return sendSuccess(res, {
    data: {
      id: task.taskId,
      title: task.title,
      type: task.type,
      description: task.description,
      moduleTitle: task.moduleTitle,
      pointsReward: task.pointsReward,
      isCompleted: Boolean(submission?.isCompleted),
      submissionText: submission?.submissionText || '',
    },
  });
});

/**
 * POST /api/student/tasks/:taskId/submit
 * Gated by requireEnrollment (resolved via the task's parent course).
 * Awards XP exactly once per task (unique index on userId+taskId).
 */
export const submitTask = asyncHandler(async (req, res) => {
  const task = await Task.findOne({ taskId: req.params.taskId, isPublished: true });
  if (!task) throw AppError.notFound('Task not found', 'TASK_NOT_FOUND');

  const existing = await TaskSubmission.findOne({ userId: req.user._id, taskId: task._id });
  if (existing?.isCompleted) {
    return sendSuccess(res, { message: 'Task already submitted.', data: { alreadySubmitted: true } });
  }

  // Late submissions are recorded, never hard-blocked - mirrors
  // teacher/backend's own Assignment/Submission lifecycle (pending ->
  // submitted/late), which this task may have been bridged from.
  const isLate = Boolean(task.dueDate) && new Date() > new Date(task.dueDate);

  const submission = await TaskSubmission.findOneAndUpdate(
    { userId: req.user._id, taskId: task._id },
    {
      userId: req.user._id,
      taskId: task._id,
      submissionText: req.body.submissionText || '',
      isCompleted: true,
      status: isLate ? 'late' : 'on_time',
      pointsAwarded: task.pointsReward,
      completedAt: new Date(),
    },
    { upsert: true, new: true }
  );

  const outcome = await recordActivity({
    userId: req.user._id,
    activityType: 'ASSIGNMENT_SUBMITTED',
    status: 'SUBMITTED',
    refId: task.taskId,
    courseId: task.courseId,
    subjectCode: task.subject || null,
  });
  const profile = outcome.profile;
  profile.stats.tasksCompleted += 1;
  // No real score exists yet at submission time - tasks aren't auto-graded.
  // A bridged task's real score arrives later from the teacher's actual
  // grade (see internal.controller.js#gradeBridgedTaskSubmission), which
  // recalculates averageTaskScore with the genuine number then. A native,
  // non-bridged task has no grading mechanism at all in this codebase, so
  // it's honestly excluded from the average rather than fabricated.
  await profile.save();

  // The other half of the task bridge: if this task was itself delivered
  // FROM teacher/backend's own Assignment, push the real submission back so
  // the teacher actually sees it (was previously a one-way delivery only).
  if (task.source === 'teacher-portal' && task.sourceId) {
    await pushTaskSubmission({
      assignmentSourceId: task.sourceId,
      studentUserId: String(req.user._id),
      studentName: req.user.name,
      studentEmail: req.user.email,
      submissionText: req.body.submissionText || '',
      isLate,
      submissionSourceId: String(submission._id),
    });
  }

  return sendSuccess(res, {
    message: isLate
      ? `Task submitted late. +${task.pointsReward} points.`
      : `Task submitted! +${task.pointsReward} points.`,
    data: { submission, pointsAwarded: task.pointsReward, profile },
  });
});

export async function resolveCourseIdFromTaskParam(req) {
  const task = await Task.findOne({ taskId: req.params.taskId });
  return task?.courseId || null;
}
