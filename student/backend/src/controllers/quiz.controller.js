import { asyncHandler } from '../utils/asyncHandler.js';
import { sendSuccess } from '../utils/apiResponse.js';
import { AppError } from '../utils/AppError.js';
import { Quiz } from '../models/Quiz.js';
import { QuizAttempt } from '../models/QuizAttempt.js';
import { Enrollment } from '../models/Enrollment.js';
import { awardXp, recalculateAverages } from '../services/xp.service.js';
import { pushQuizResult } from '../services/teacherBridge.service.js';

export const listMyQuizzes = asyncHandler(async (req, res) => {
  const enrollments = await Enrollment.find({ userId: req.user._id, status: 'active' }).select('courseId');
  const courseIds = enrollments.map((e) => e.courseId);

  const quizzes = await Quiz.find({ courseId: { $in: courseIds }, isPublished: true });
  const attempts = await QuizAttempt.find({
    userId: req.user._id,
    quizId: { $in: quizzes.map((q) => q._id) },
    status: { $in: ['submitted', 'expired'] },
  }).sort({ createdAt: -1 });

  const bestAttemptByQuiz = new Map();
  for (const attempt of attempts) {
    const key = String(attempt.quizId);
    if (!bestAttemptByQuiz.has(key)) bestAttemptByQuiz.set(key, attempt);
  }

  const data = quizzes.map((q) => ({
    id: q.quizId,
    title: q.title,
    moduleTitle: q.moduleTitle,
    pointsReward: q.pointsReward,
    timeLimitMins: q.timeLimitMins,
    questionCount: q.questions.length,
    lastScore: bestAttemptByQuiz.get(String(q._id))?.scorePercentage ?? null,
    attempted: bestAttemptByQuiz.has(String(q._id)),
  }));

  return sendSuccess(res, { data });
});

/** GET /api/student/quizzes/:quizId - never includes correctIndex/explanation. */
export const getQuiz = asyncHandler(async (req, res) => {
  const quiz = await Quiz.findOne({ quizId: req.params.quizId, isPublished: true });
  if (!quiz) throw AppError.notFound('Quiz not found', 'QUIZ_NOT_FOUND');
  return sendSuccess(res, { data: quiz.toPublicJSON() });
});

/**
 * POST /api/student/quizzes/:quizId/start
 * Server-authoritative start: records `startedAt`/`expiresAt` from server
 * time + the quiz's time limit, and that expiry is what /submit checks -
 * never a client-reported countdown (master doc section 8-10). Resuming an
 * already-open, not-yet-expired attempt returns the SAME attempt/expiresAt
 * (idempotent - a page refresh doesn't grant extra time).
 */
export const startQuiz = asyncHandler(async (req, res) => {
  const quiz = await Quiz.findOne({ quizId: req.params.quizId, isPublished: true });
  if (!quiz) throw AppError.notFound('Quiz not found', 'QUIZ_NOT_FOUND');

  const existing = await QuizAttempt.findOne({ userId: req.user._id, quizId: quiz._id, status: 'in_progress' }).sort({ startedAt: -1 });
  if (existing) {
    if (existing.expiresAt > new Date()) {
      return sendSuccess(res, { data: { attemptId: existing._id, startedAt: existing.startedAt, expiresAt: existing.expiresAt, timeLimitMins: quiz.timeLimitMins } });
    }
    // Left over from a session that never submitted in time - finalize it now rather than leaving it dangling.
    await finalizeExpiredAttempt(existing);
  }

  const finalizedCount = await QuizAttempt.countDocuments({ userId: req.user._id, quizId: quiz._id, status: { $in: ['submitted', 'expired'] } });
  const now = new Date();
  const expiresAt = new Date(now.getTime() + quiz.timeLimitMins * 60000);

  const attempt = await QuizAttempt.create({
    userId: req.user._id,
    quizId: quiz._id,
    isFirstAttempt: finalizedCount === 0,
    attemptNumber: finalizedCount + 1,
    startedAt: now,
    expiresAt,
    status: 'in_progress',
  });

  return sendSuccess(res, {
    status: 201,
    data: { attemptId: attempt._id, startedAt: attempt.startedAt, expiresAt: attempt.expiresAt, timeLimitMins: quiz.timeLimitMins },
  });
});

/**
 * POST /api/student/quizzes/:quizId/submit
 * The backend re-grades against the stored correct answers - it NEVER
 * trusts a client-submitted score (master doc section 30). Requires a live
 * `in_progress` attempt from /start and rejects if the server-computed
 * deadline has already passed, even if the client's own timer disagrees.
 * Gated by requireEnrollment on the quiz's parent course.
 */
export const submitQuiz = asyncHandler(async (req, res) => {
  const quiz = await Quiz.findOne({ quizId: req.params.quizId, isPublished: true });
  if (!quiz) throw AppError.notFound('Quiz not found', 'QUIZ_NOT_FOUND');

  const attempt = await QuizAttempt.findOne({ userId: req.user._id, quizId: quiz._id, status: 'in_progress' }).sort({ startedAt: -1 });
  if (!attempt) {
    throw AppError.badRequest('Start the quiz before submitting (no active attempt found).', 'QUIZ_NOT_STARTED');
  }

  if (attempt.expiresAt < new Date()) {
    await finalizeExpiredAttempt(attempt);
    throw AppError.badRequest('Time is up for this attempt. It has been recorded as expired.', 'QUIZ_TIME_EXPIRED');
  }

  const { answers } = req.body;

  let correctCount = 0;
  const gradedQuestions = quiz.questions.map((q) => {
    const selected = answers[q.questionId];
    const isCorrect = selected === q.correctIndex;
    if (isCorrect) correctCount += 1;
    return {
      questionId: q.questionId,
      question: q.question,
      options: q.options,
      selectedIndex: selected ?? null,
      correctIndex: q.correctIndex,
      isCorrect,
      explanation: q.explanation,
    };
  });

  const totalCount = quiz.questions.length;
  const scorePercentage = totalCount === 0 ? 0 : Math.round((correctCount / totalCount) * 100);
  // Only the first attempt awards XP - prevents infinite-retake farming
  // while still letting students retake quizzes to learn (master doc
  // section 29/30).
  const pointsAwarded = attempt.isFirstAttempt ? Math.round((scorePercentage / 100) * quiz.pointsReward) : 0;

  attempt.answers = answers;
  attempt.correctCount = correctCount;
  attempt.totalCount = totalCount;
  attempt.scorePercentage = scorePercentage;
  attempt.pointsAwarded = pointsAwarded;
  attempt.status = 'submitted';
  attempt.submittedAt = new Date();
  await attempt.save();

  let profile = null;
  if (pointsAwarded > 0) {
    profile = await awardXp(req.user._id, { amount: pointsAwarded, source: 'quiz', refId: quiz.quizId, courseId: quiz.courseId });
    // Order matters: recalculateAverages treats stats.quizzesCompleted as the
    // number of quizzes counted BEFORE this one (it divides by n + 1).
    // Incrementing first made n include the attempt being recorded, which
    // halved a student's very first score - a single 25% quiz stored as 13% -
    // and skewed every average after it. Same off-by-one that was already
    // fixed on the task-grading path (internal.controller.js).
    await recalculateAverages(profile, { quizScore: scorePercentage });
    profile.stats.quizzesCompleted += 1;
    await profile.save();
  }

  // The other half of the quiz bridge: if this quiz was itself delivered
  // FROM teacher/backend's own Exam, push the real, first-attempt result
  // back so the teacher actually sees it (previously a one-way delivery
  // only - task submissions had a return leg, quiz results never did).
  if (quiz.source === 'teacher-portal' && quiz.sourceId && attempt.isFirstAttempt) {
    await pushQuizResult({
      examSourceId: quiz.sourceId,
      studentUserId: String(req.user._id),
      studentName: req.user.name,
      studentEmail: req.user.email,
      scorePercentage,
      correctCount,
      totalCount,
    });
  }

  return sendSuccess(res, {
    message: attempt.isFirstAttempt
      ? `Quiz submitted! You scored ${scorePercentage}% and earned +${pointsAwarded} points.`
      : `Quiz retaken. You scored ${scorePercentage}%. (Points are only awarded on your first attempt.)`,
    data: {
      attemptId: attempt._id,
      scorePercentage,
      correctCount,
      totalCount,
      pointsAwarded,
      isFirstAttempt: attempt.isFirstAttempt,
      questions: gradedQuestions,
      profile: profile || undefined,
    },
  });
});

/**
 * Finalizes an attempt that ran out the clock: zero credit, consumes the
 * attempt (a fresh /start call is required to try again). Shared by
 * startQuiz (lazy cleanup of a stale attempt), submitQuiz (submission
 * arrives after the deadline), and the background sweep
 * (jobs/quizExpirySweep.job.js) so a student who never comes back is still
 * enforced.
 */
export async function finalizeExpiredAttempt(attempt) {
  attempt.status = 'expired';
  attempt.scorePercentage = 0;
  attempt.pointsAwarded = 0;
  attempt.submittedAt = attempt.expiresAt;
  await attempt.save();

  try {
    const { Notification } = await import('../models/Notification.js');
    const { emitNotificationCreated } = await import('../sockets/index.js');
    const notification = await Notification.create({
      userId: attempt.userId,
      title: 'A quiz attempt expired',
      description: 'You ran out of time on a quiz and it was submitted automatically with no score for that attempt.',
      type: 'deadline',
      link: '/student/dashboard',
    });
    emitNotificationCreated(attempt.userId, notification);
  } catch {
    // best-effort notification - never let this block finalization
  }

  return attempt;
}

export async function resolveCourseIdFromQuizParam(req) {
  const quiz = await Quiz.findOne({ quizId: req.params.quizId });
  return quiz?.courseId || null;
}
