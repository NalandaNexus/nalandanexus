import { catchAsync } from '../utils/catchAsync.js';
import { sendSuccess } from '../utils/ApiResponse.js';
import * as courseStructure from '../services/courseStructure.service.js';
import { assertCourseAccess } from '../services/courseAccess.service.js';
import { logAudit } from '../services/audit.service.js';

/**
 * Module/lesson structure, for assigned courses only. Every route checks the
 * teacher's CourseAccess first - on the server, on every request - the same
 * pattern lessonVideo.controller.js uses for videos, so hiding a course in
 * the UI is never what keeps a teacher out of editing its content.
 *
 * Teachers get the same structural scope as Admin here (including adding a
 * whole module, not just editing one), scoped to the courses they are
 * assigned to - there is no reduced, lesson-only tier.
 */

const actorOf = (req) => ({ portal: 'teacher', userId: String(req.user._id), name: req.user.name || null });

export const getStructure = catchAsync(async (req, res) => {
  const slug = await assertCourseAccess(req.teacher._id, req.params.slug);
  sendSuccess(res, { data: await courseStructure.getCourseStructure(slug) });
});

export const updateSettings = catchAsync(async (req, res) => {
  const slug = await assertCourseAccess(req.teacher._id, req.params.slug);
  const { progressionGatingEnabled, expectedUpdatedAt } = req.body;
  const data = await courseStructure.updateCourseSettings(slug, {
    progressionGatingEnabled,
    ...(expectedUpdatedAt !== undefined ? { expectedUpdatedAt } : {}),
    actor: actorOf(req),
  });

  await logAudit({
    actorId: req.user._id,
    action: 'course.settings.updated',
    targetType: 'Course',
    targetId: null,
    metadata: { slug, progressionGatingEnabled: Boolean(progressionGatingEnabled) },
    ip: req.ip,
  });

  sendSuccess(res, { message: 'Course settings updated', data });
});

export const addModule = catchAsync(async (req, res) => {
  const slug = await assertCourseAccess(req.teacher._id, req.params.slug);
  const { title, description, order, gatingEnabled } = req.body;
  const data = await courseStructure.addModule(slug, {
    title,
    ...(description !== undefined ? { description } : {}),
    ...(order !== undefined ? { order } : {}),
    ...(gatingEnabled !== undefined ? { gatingEnabled } : {}),
    actor: actorOf(req),
  });

  await logAudit({
    actorId: req.user._id,
    action: 'course.module.added',
    targetType: 'Course',
    targetId: null,
    metadata: { slug, title },
    ip: req.ip,
  });

  sendSuccess(res, { message: 'Module added', data });
});

export const updateModule = catchAsync(async (req, res) => {
  const slug = await assertCourseAccess(req.teacher._id, req.params.slug);
  const { moduleId } = req.params;
  const { title, description, gatingEnabled, expectedUpdatedAt } = req.body;
  const data = await courseStructure.updateModule(slug, moduleId, {
    ...(title !== undefined ? { title } : {}),
    ...(description !== undefined ? { description } : {}),
    ...(gatingEnabled !== undefined ? { gatingEnabled } : {}),
    ...(expectedUpdatedAt !== undefined ? { expectedUpdatedAt } : {}),
    actor: actorOf(req),
  });

  await logAudit({
    actorId: req.user._id,
    action: 'course.module.updated',
    targetType: 'Course',
    targetId: null,
    metadata: { slug, moduleId },
    ip: req.ip,
  });

  sendSuccess(res, { message: 'Module updated', data });
});

export const reorderModules = catchAsync(async (req, res) => {
  const slug = await assertCourseAccess(req.teacher._id, req.params.slug);
  const { orderedModuleIds } = req.body;
  const data = await courseStructure.reorderModules(slug, { orderedModuleIds, actor: actorOf(req) });

  await logAudit({
    actorId: req.user._id,
    action: 'course.modules.reordered',
    targetType: 'Course',
    targetId: null,
    metadata: { slug, orderedModuleIds },
    ip: req.ip,
  });

  sendSuccess(res, { message: 'Modules reordered', data });
});

export const addLesson = catchAsync(async (req, res) => {
  const slug = await assertCourseAccess(req.teacher._id, req.params.slug);
  const { moduleId } = req.params;
  const { title, duration, summary, content, order, isPublished } = req.body;
  const data = await courseStructure.addLesson(slug, moduleId, {
    title,
    ...(duration !== undefined ? { duration } : {}),
    ...(summary !== undefined ? { summary } : {}),
    ...(content !== undefined ? { content } : {}),
    ...(order !== undefined ? { order } : {}),
    ...(isPublished !== undefined ? { isPublished } : {}),
    actor: actorOf(req),
  });

  await logAudit({
    actorId: req.user._id,
    action: 'course.lesson.added',
    targetType: 'Course',
    targetId: null,
    metadata: { slug, moduleId, title },
    ip: req.ip,
  });

  sendSuccess(res, { message: 'Lesson added', data });
});

export const updateLesson = catchAsync(async (req, res) => {
  const slug = await assertCourseAccess(req.teacher._id, req.params.slug);
  const { moduleId, lessonId } = req.params;
  const { title, duration, summary, content, isPublished, expectedUpdatedAt } = req.body;
  const data = await courseStructure.updateLesson(slug, moduleId, lessonId, {
    ...(title !== undefined ? { title } : {}),
    ...(duration !== undefined ? { duration } : {}),
    ...(summary !== undefined ? { summary } : {}),
    ...(content !== undefined ? { content } : {}),
    ...(isPublished !== undefined ? { isPublished } : {}),
    ...(expectedUpdatedAt !== undefined ? { expectedUpdatedAt } : {}),
    actor: actorOf(req),
  });

  await logAudit({
    actorId: req.user._id,
    action: 'course.lesson.updated',
    targetType: 'Course',
    targetId: null,
    metadata: { slug, moduleId, lessonId },
    ip: req.ip,
  });

  sendSuccess(res, { message: 'Lesson updated', data });
});

export const reorderLessons = catchAsync(async (req, res) => {
  const slug = await assertCourseAccess(req.teacher._id, req.params.slug);
  const { moduleId } = req.params;
  const { orderedLessonIds } = req.body;
  const data = await courseStructure.reorderLessons(slug, moduleId, { orderedLessonIds, actor: actorOf(req) });

  await logAudit({
    actorId: req.user._id,
    action: 'course.lessons.reordered',
    targetType: 'Course',
    targetId: null,
    metadata: { slug, moduleId, orderedLessonIds },
    ip: req.ip,
  });

  sendSuccess(res, { message: 'Lessons reordered', data });
});

export const removeModule = catchAsync(async (req, res) => {
  const slug = await assertCourseAccess(req.teacher._id, req.params.slug);
  const { moduleId } = req.params;
  const data = await courseStructure.removeModule(slug, moduleId, { actor: actorOf(req) });

  // Reached only on a real removal: an unknown module, or one with student
  // history or coursework, is a 404/409 the student service already threw.
  await logAudit({
    actorId: req.user._id,
    action: 'course.module.removed',
    targetType: 'Course',
    targetId: null,
    metadata: { slug, moduleId },
    ip: req.ip,
  });

  sendSuccess(res, { message: 'Module removed', data });
});

export const removeLesson = catchAsync(async (req, res) => {
  const slug = await assertCourseAccess(req.teacher._id, req.params.slug);
  const { moduleId, lessonId } = req.params;
  const data = await courseStructure.removeLesson(slug, moduleId, lessonId, { actor: actorOf(req) });

  // Unlike a lesson video (which can legitimately have none to remove), a
  // successful call here always removed a real lesson subdocument - the
  // "nothing to do" cases (unknown lesson, real student progress against it)
  // are 404/409s the service already threw, so this line is only reached on
  // a genuine removal.
  await logAudit({
    actorId: req.user._id,
    action: 'course.lesson.removed',
    targetType: 'Course',
    targetId: null,
    metadata: { slug, moduleId, lessonId },
    ip: req.ip,
  });

  sendSuccess(res, { message: 'Lesson removed', data });
});

export default {
  getStructure,
  updateSettings,
  addModule,
  updateModule,
  reorderModules,
  addLesson,
  updateLesson,
  reorderLessons,
  removeModule,
  removeLesson,
};
