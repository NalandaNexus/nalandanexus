import { Task } from '../models/Task.js';
import { Quiz } from '../models/Quiz.js';
import { TaskSubmission } from '../models/TaskSubmission.js';
import { QuizAttempt } from '../models/QuizAttempt.js';
import { LessonProgress } from '../models/LessonProgress.js';

/**
 * The mandatory sequential-progression gate: a student must finish a
 * module's required assignment(s) and pass its quiz(zes) before the next
 * module unlocks, and finish each lesson before the next one in the same
 * module does.
 *
 * Deliberately a sibling of lessonVideo.service.js/courseStructure.service.js,
 * not a file inside services/progression/ - this is NOT the Stage system
 * (PRARAMBH -> GARUD -> YODDHA course promotion, services/progression/*).
 * That system has no concept of a module; this one has no concept of a
 * Stage. They are two independent gates a student can be stopped by, and
 * keeping them in physically separate files is deliberate, so extending one
 * is never mistaken for extending the other.
 *
 * The existing manual `lesson.isLocked` flag (previously: a static admin
 * override, never computed) is preserved exactly as a signal - it ORs into
 * the computed result below rather than being replaced, so the two
 * seed-locked capstone lessons that predate this feature keep behaving
 * exactly as they did, and an admin has a real way to unlock them (or lock
 * any other lesson by hand) via courseStructure.service.js#updateLesson.
 */

/** Groups a list of lean docs by one of their own fields, into a Map. */
function groupBy(list, key) {
  const map = new Map();
  for (const item of list) {
    const k = item[key];
    if (!map.has(k)) map.set(k, []);
    map.get(k).push(item);
  }
  return map;
}

/** A module's own gatingEnabled overrides the course's; null (the schema default) means "inherit". */
function gatingEnabledFor(course, mod) {
  return mod.gatingEnabled ?? (course.progressionGatingEnabled !== false);
}

/**
 * Whether this module's own tagged tasks/quizzes are done - vacuously
 * satisfied (and `exempt: true`) when nothing is tagged to it, since an
 * untagged module cannot honestly be called "incomplete". `missingTasks`/
 * `missingQuizzes` name exactly what's outstanding, for the lock reason the
 * NEXT module reports to a student stopped at its door.
 */
function moduleRequirement(tasksByModule, quizzesByModule, completedTaskIds, bestScoreByQuiz, moduleId) {
  const modTasks = tasksByModule.get(moduleId) || [];
  const modQuizzes = quizzesByModule.get(moduleId) || [];
  const missingTasks = modTasks.filter((t) => !completedTaskIds.has(String(t._id)));
  const missingQuizzes = modQuizzes.filter((q) => (bestScoreByQuiz.get(String(q._id)) ?? -1) < (q.passingScore ?? 50));
  return {
    satisfied: missingTasks.length === 0 && missingQuizzes.length === 0,
    exempt: modTasks.length === 0 && modQuizzes.length === 0,
    missingTasks: missingTasks.map((t) => ({ taskId: t.taskId, title: t.title })),
    missingQuizzes: missingQuizzes.map((q) => ({ quizId: q.quizId, title: q.title, passingScore: q.passingScore ?? 50 })),
  };
}

function describeModuleLockReason(prevModule, prevReq) {
  const parts = [];
  if (prevReq.missingTasks.length) {
    parts.push(`${prevReq.missingTasks.length} assignment${prevReq.missingTasks.length > 1 ? 's' : ''}`);
  }
  if (prevReq.missingQuizzes.length) {
    parts.push(`a passing score on ${prevReq.missingQuizzes.length} quiz${prevReq.missingQuizzes.length > 1 ? 'zes' : ''}`);
  }
  const what = parts.length ? parts.join(' and ') : "the previous module's remaining work";
  return `Complete "${prevModule.title}" first — ${what} still needed.`;
}

/**
 * Computes every module's and lesson's lock state for one student in one
 * course, in a fixed number of queries regardless of course size - never
 * once per lesson. Call it once per request and read the result for as many
 * modules/lessons as that request needs (see course.controller.js, the
 * only caller today).
 *
 * `course` must be a Mongoose document or lean object with `modules` and
 * `progressionGatingEnabled` loaded - a plain findById/findOne result is
 * enough, no special projection needed.
 *
 * Returns `{ modules: { [moduleId]: {locked, reason, missingTasks,
 * missingQuizzes} }, lessons: { [lessonId]: {locked, reason} } }`, covering
 * every module and lesson on the course.
 */
export async function computeLockState(course, userId) {
  const modulesSorted = [...(course.modules || [])].sort((a, b) => a.order - b.order);
  const moduleIds = modulesSorted.map((m) => m.moduleId);

  const [tasks, quizzes, progressDocs] = await Promise.all([
    moduleIds.length
      ? Task.find({ courseId: course._id, moduleId: { $in: moduleIds }, isPublished: { $ne: false } })
          .select('taskId moduleId title')
          .lean()
      : [],
    moduleIds.length
      ? Quiz.find({ courseId: course._id, moduleId: { $in: moduleIds }, isPublished: { $ne: false } })
          .select('quizId moduleId title passingScore')
          .lean()
      : [],
    LessonProgress.find({ userId, courseId: course._id, completed: true }).select('lessonId').lean(),
  ]);

  const [submissions, attempts] = await Promise.all([
    tasks.length
      ? TaskSubmission.find({ userId, taskId: { $in: tasks.map((t) => t._id) }, isCompleted: true }).select('taskId').lean()
      : [],
    quizzes.length
      ? QuizAttempt.find({ userId, quizId: { $in: quizzes.map((q) => q._id) }, status: 'submitted' }).select('quizId scorePercentage').lean()
      : [],
  ]);

  const completedLessonIds = new Set(progressDocs.map((p) => p.lessonId));
  const completedTaskIds = new Set(submissions.map((s) => String(s.taskId)));
  // Best score per quiz - a student who fails once and passes on a retake
  // has satisfied the gate; only the best attempt counts, matching how a
  // student is credited everywhere else a quiz score is read.
  const bestScoreByQuiz = new Map();
  for (const a of attempts) {
    const key = String(a.quizId);
    if (!bestScoreByQuiz.has(key) || a.scorePercentage > bestScoreByQuiz.get(key)) {
      bestScoreByQuiz.set(key, a.scorePercentage);
    }
  }

  const tasksByModule = groupBy(tasks, 'moduleId');
  const quizzesByModule = groupBy(quizzes, 'moduleId');

  const modules = {};
  const lessons = {};
  let previousReq = null; // the PRECEDING module's own requirement check, used to decide THIS module's lock

  modulesSorted.forEach((mod, j) => {
    const req = moduleRequirement(tasksByModule, quizzesByModule, completedTaskIds, bestScoreByQuiz, mod.moduleId);
    const moduleGated = gatingEnabledFor(course, mod);
    const moduleLocked = Boolean(moduleGated && j > 0 && previousReq && !previousReq.satisfied);

    modules[mod.moduleId] = {
      locked: moduleLocked,
      reason: moduleLocked ? describeModuleLockReason(modulesSorted[j - 1], previousReq) : null,
      missingTasks: moduleLocked ? previousReq.missingTasks : [],
      missingQuizzes: moduleLocked ? previousReq.missingQuizzes : [],
    };

    // Only published lessons form the sequence. A draft is withheld from students,
    // so letting it sit in the chain locked the lesson after it behind something
    // no student could ever open. A draft itself is unavailable, which also keeps
    // it out of "next lesson" and refuses an attempt to complete it.
    for (const draft of (mod.lessons || []).filter((l) => l.isPublished === false)) {
      lessons[draft.lessonId] = { locked: true, reason: 'This lesson is not available yet.' };
    }
    const lessonsSorted = [...(mod.lessons || [])].filter((l) => l.isPublished !== false).sort((a, b) => a.order - b.order);
    lessonsSorted.forEach((lesson, i) => {
      const prevLessonLocked = Boolean(moduleGated && i > 0 && !completedLessonIds.has(lessonsSorted[i - 1].lessonId));
      const manuallyLocked = Boolean(lesson.isLocked);
      const locked = moduleLocked || prevLessonLocked || manuallyLocked;
      lessons[lesson.lessonId] = {
        locked,
        reason: !locked
          ? null
          : moduleLocked
          ? modules[mod.moduleId].reason
          : prevLessonLocked
          ? `Complete "${lessonsSorted[i - 1].title}" first.`
          : 'This lesson has been locked by your instructor.',
      };
    });

    previousReq = req;
  });

  return { modules, lessons };
}

/**
 * Previews the real-world impact of turning a course's progression gate on,
 * WITHOUT writing anything - the required first step before flipping
 * `progressionGatingEnabled` for a course that already has enrolled
 * students (see the project's rollout-safety plan: dry-run, then notify,
 * then flip - never a single blind global flip). Compares each actively
 * enrolled student's lock state today against what it would be if the
 * course-level gate were forced on, and reports only students who would
 * newly lose access to something they can open right now. A module whose
 * own `gatingEnabled` override already says `false` stays exempt in the
 * simulation too, exactly as it would after the real flip - only the
 * course-level flag is forced; per-module overrides are left exactly as
 * configured.
 *
 * `course` must be a Mongoose document or lean object, same as
 * computeLockState. Call sites: moduleGatingDryRun.js (CLI) and
 * adminModuleGatingDryRun (internal HTTP endpoint).
 */
export async function dryRunImpact(course) {
  const { Enrollment } = await import('../models/Enrollment.js');
  const { User } = await import('../models/User.js');

  const enrollments = await Enrollment.find({ courseId: course._id, status: 'active' }).select('userId').lean();
  const plainCourse = course.toObject ? course.toObject() : course;
  const simulatedCourse = { ...plainCourse, progressionGatingEnabled: true };

  const impacted = [];
  for (const e of enrollments) {
    const [before, after] = await Promise.all([
      computeLockState(plainCourse, e.userId),
      computeLockState(simulatedCourse, e.userId),
    ]);

    const newlyLockedModules = Object.entries(after.modules)
      .filter(([moduleId, state]) => state.locked && !before.modules[moduleId]?.locked)
      .map(([moduleId, state]) => ({ moduleId, reason: state.reason }));
    const newlyLockedLessons = Object.entries(after.lessons)
      .filter(([lessonId, state]) => state.locked && !before.lessons[lessonId]?.locked)
      .map(([lessonId, state]) => ({ lessonId, reason: state.reason }));

    if (newlyLockedModules.length || newlyLockedLessons.length) {
      impacted.push({ userId: e.userId, newlyLockedModules, newlyLockedLessons });
    }
  }

  if (impacted.length) {
    const users = await User.find({ _id: { $in: impacted.map((i) => i.userId) } }).select('name email').lean();
    const userById = new Map(users.map((u) => [String(u._id), u]));
    for (const row of impacted) {
      const u = userById.get(String(row.userId));
      row.name = u?.name || null;
      row.email = u?.email || null;
    }
  }

  return {
    courseSlug: plainCourse.slug,
    courseTitle: plainCourse.title,
    currentlyGated: plainCourse.progressionGatingEnabled !== false,
    totalActiveEnrollments: enrollments.length,
    studentsNewlyLocked: impacted.length,
    impacted,
  };
}

export default { computeLockState, dryRunImpact };
