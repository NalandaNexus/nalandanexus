import { asyncHandler } from '../utils/asyncHandler.js';
import { sendSuccess } from '../utils/apiResponse.js';
import { AppError } from '../utils/AppError.js';
import { Course } from '../models/Course.js';
import { Enrollment } from '../models/Enrollment.js';
import { LessonProgress } from '../models/LessonProgress.js';
import { recordActivity } from '../services/progression/engine.service.js';
import { resolveLessonSubject } from '../services/progression/subject.service.js';
import { shapeLessonVideoForStudent, shapeModuleVideoForStudent, legacyVideoUrlFor } from '../services/lessonVideo.service.js';
import { computeLockState } from '../services/courseGating.service.js';

/**
 * GET /api/student/courses - courses the authenticated student is enrolled in,
 * with the enrollment details they can actually be told.
 *
 * `enrollmentId` previously carried this database's ObjectId under the name of
 * the business identifier, so anything rendering it would have shown a student
 * an internal key instead of the ENR-YYYY-NNNNNN they are asked to quote. The
 * two are now distinct: `enrollmentId` is the real business identity, and the
 * internal handle is not sent at all - nothing outside this service needs it.
 *
 * Batch and teacher are included because a coaching student's first questions
 * are which batch they are in and who teaches it. A null batch is honest: it
 * means placement has not happened yet, which is a real state.
 */
export const getMyCourses = asyncHandler(async (req, res) => {
  const enrollments = await Enrollment.find({ userId: req.user._id, status: 'active' }).populate('courseId');
  return sendSuccess(res, {
    data: enrollments.map((e) => ({
      enrollmentId: e.enrollmentId || null,
      courseId: e.courseId._id,
      slug: e.courseId.slug,
      title: e.courseId.title,
      subtitle: e.courseId.subtitle,
      bannerImage: e.courseId.bannerImage,
      progress: e.progressPercent,
      currentModuleId: e.currentModuleId,
      currentLessonId: e.currentLessonId,
      enrolledAt: e.enrolledAt,
      status: e.status,
      batchCode: e.batchCode || null,
      batchAssignedAt: e.batchAssignedAt || null,
      // Resolved and cached from the teacher portal (see
      // teacherBridge.service.js); null while it has not been resolved yet.
      teacherName: e.assignedTeacher?.name || null,
      teacherAvatarUrl: e.assignedTeacher?.avatarUrl || null,
    })),
  });
});

/**
 * GET /api/student/courses/:slug/content
 * Full syllabus with video URLs - gated behind requireEnrollment.
 */
export const getEnrolledCourseContent = asyncHandler(async (req, res) => {
  const course = await Course.findById(req.courseId);
  if (!course) throw AppError.notFound('Course not found', 'COURSE_NOT_FOUND');

  const [progressDocs, enrollment, lockState] = await Promise.all([
    LessonProgress.find({ userId: req.user._id, courseId: course._id }),
    Enrollment.findOne({ userId: req.user._id, courseId: course._id }),
    computeLockState(course, req.user._id),
  ]);
  const completedLessonIds = new Set(progressDocs.filter((p) => p.completed).map((p) => p.lessonId));

  // The response carries freshly signed playback URLs for uploaded videos, so
  // no browser or proxy may reuse it.
  res.setHeader('Cache-Control', 'no-store');

  const modules = await Promise.all(course.modules
    .sort((a, b) => a.order - b.order)
    .map(async (m) => ({
      moduleId: m.moduleId,
      title: m.title,
      order: m.order,
      description: m.description || '',
      // The module's own published video, or null. Not a lesson: it carries
      // no completion and awards nothing.
      video: await shapeModuleVideoForStudent(m),
      // The mandatory-progression gate (see courseGating.service.js) - a
      // module has no lock output at all before this; computeLockState
      // covers every module on the course, so these always resolve.
      isLocked: lockState.modules[m.moduleId]?.locked ?? false,
      lockReason: lockState.modules[m.moduleId]?.reason ?? null,
      missingTasks: lockState.modules[m.moduleId]?.missingTasks ?? [],
      missingQuizzes: lockState.modules[m.moduleId]?.missingQuizzes ?? [],
      // Draft lessons (isPublished: false) are withheld the same way a draft
      // video already was - an editor saving a lesson as a work-in-progress
      // must not make it appear for real students. This filter was missing
      // until courseStructure.service.js gave isPublished a real write path:
      // every existing lesson defaults isPublished to true, so nothing that
      // was visible before this fix becomes hidden now.
      lessons: await Promise.all(m.lessons
        .filter((l) => l.isPublished !== false)
        .sort((a, b) => a.order - b.order)
        .map(async (l) => ({
          lessonId: l.lessonId,
          title: l.title,
          duration: l.duration,
          order: l.order,
          // `video` is the lesson's published video (or null); `videoUrl` is a
          // legacy directly-hosted file, never PRARAMBH's retired fixed one.
          // A draft, or an upload not yet verified, is never sent.
          ...(await shapeLessonVideoForStudent(l)),
          // The teaching material. A lesson used to be a title, a duration and
          // a video URL, so a course with no video was a list of headings -
          // which is exactly what GARUD and YODDHA would have been.
          summary: l.summary,
          content: l.content,
          subject: l.subject,
          // Computed (module gate, previous-lesson gate, manual override),
          // not the static flag alone - see courseGating.service.js. The
          // fallback only matters if a lesson id somehow isn't in lockState,
          // which computeLockState never actually leaves out.
          isLocked: lockState.lessons[l.lessonId]?.locked ?? Boolean(l.isLocked),
          lockReason: lockState.lessons[l.lessonId]?.reason ?? null,
          completed: completedLessonIds.has(l.lessonId),
          isCurrent: l.lessonId === enrollment?.currentLessonId,
        }))),
    })));

  return sendSuccess(res, {
    data: {
      id: course._id,
      slug: course.slug,
      title: course.title,
      subtitle: course.subtitle,
      bannerImage: course.bannerImage,
      videoUrl: legacyVideoUrlFor(course.videoUrl),
      totalLessons: course.totalLessons,
      completedLessons: completedLessonIds.size,
      progress: enrollment?.progressPercent || 0,
      modules,
    },
  });
});

/**
 * POST /api/student/lessons/:lessonId/progress
 * Marks a lesson complete, awards XP exactly once (idempotent), and
 * recalculates course-level progress percentage. Gated behind
 * requireEnrollment so a student can't record progress on a course they
 * haven't purchased.
 */
export const markLessonComplete = asyncHandler(async (req, res) => {
  const { lessonId } = req.params;
  const course = await Course.findById(req.courseId);
  if (!course) throw AppError.notFound('Course not found', 'COURSE_NOT_FOUND');

  let targetModule = null;
  let targetLesson = null;
  for (const m of course.modules) {
    const found = m.lessons.find((l) => l.lessonId === lessonId);
    if (found) {
      targetModule = m;
      targetLesson = found;
      break;
    }
  }
  if (!targetLesson) throw AppError.notFound('Lesson not found in this course', 'LESSON_NOT_FOUND');

  // Computed (module gate, previous-lesson gate, manual override) rather
  // than the flat `targetLesson.isLocked` check this used to be - see
  // courseGating.service.js. The real reason rides along in the error so
  // the student is told what to do, not just that they can't.
  const preWriteLockState = await computeLockState(course, req.user._id);
  const lock = preWriteLockState.lessons[lessonId];
  if (lock?.locked) {
    throw AppError.forbidden(lock.reason || 'This lesson is locked.', 'LESSON_LOCKED', { reason: lock.reason });
  }

  const existing = await LessonProgress.findOne({ userId: req.user._id, lessonId });
  const alreadyCompleted = existing?.completed;

  // Written only the first time. Marking a completed lesson again used to
  // overwrite completedAt with "now", so a student's record of when they
  // finished a lesson moved every time the request was repeated.
  if (!alreadyCompleted) {
    await LessonProgress.findOneAndUpdate(
      { userId: req.user._id, lessonId },
      {
        userId: req.user._id,
        courseId: course._id,
        moduleId: targetModule.moduleId,
        lessonId,
        completed: true,
        completedAt: new Date(),
      },
      { upsert: true, new: true }
    );
  }

  // Routed through the progression engine rather than awarding XP directly:
  // the engine owns the XP rule, the duplicate check and every derived score.
  // It is idempotent, so it is called unconditionally and its own verdict -
  // not a prior read - decides whether this counts.
  const subjectCode = await resolveLessonSubject(course, lessonId);
  const outcome = await recordActivity({
    userId: req.user._id,
    activityType: 'LECTURE_COMPLETED',
    status: 'COMPLETED',
    refId: lessonId,
    courseId: course._id,
    subjectCode,
  });

  let profile = outcome.profile;
  if (!outcome.duplicate && !alreadyCompleted && profile) {
    profile.stats.lessonsCompleted += 1;
    await profile.save();
  }

  const completedCount = await LessonProgress.countDocuments({ userId: req.user._id, courseId: course._id, completed: true });
  const totalLessons = course.totalLessons || 1;
  const progressPercent = Math.min(100, Math.round((completedCount / totalLessons) * 100));

  // Recomputed, not reused: completing this lesson may have just unlocked
  // the very next one (the per-lesson gate above depends on exactly this
  // completion), and the pre-write lockState above would still show it
  // locked.
  const postWriteLockState = await computeLockState(course, req.user._id);
  const nextLesson = findNextLesson(course, lessonId, postWriteLockState);

  const enrollment = await Enrollment.findOneAndUpdate(
    { userId: req.user._id, courseId: course._id },
    {
      progressPercent,
      currentModuleId: nextLesson?.moduleId || targetModule.moduleId,
      currentLessonId: nextLesson?.lessonId || lessonId,
    },
    { new: true }
  );

  return sendSuccess(res, {
    message: alreadyCompleted ? 'Lesson already completed.' : 'Lesson marked complete. +10 XP',
    data: { enrollment, xpAwarded: alreadyCompleted ? 0 : 10, profile: profile || undefined },
  });
});

/** The next lesson after `currentLessonId` that isn't locked under `lockState` (see courseGating.service.js), or null past the end of the course. */
function findNextLesson(course, currentLessonId, lockState) {
  const flat = [];
  for (const m of [...course.modules].sort((a, b) => a.order - b.order)) {
    for (const l of [...m.lessons].sort((a, b) => a.order - b.order)) {
      flat.push({ moduleId: m.moduleId, lessonId: l.lessonId });
    }
  }
  const idx = flat.findIndex((l) => l.lessonId === currentLessonId);
  if (idx === -1) return null;
  return flat.slice(idx + 1).find((l) => !lockState.lessons[l.lessonId]?.locked) || null;
}

/** Helper used by middleware/routes to resolve a courseId from a :slug param. */
export async function resolveCourseIdFromSlugParam(req) {
  const course = await Course.findOne({ slug: req.params.slug });
  return course?._id || null;
}

/** Helper used by middleware/routes to resolve a courseId from a :lessonId param. */
export async function resolveCourseIdFromLessonParam(req) {
  const course = await Course.findOne({ 'modules.lessons.lessonId': req.params.lessonId });
  return course?._id || null;
}
