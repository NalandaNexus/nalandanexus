import { catchAsync } from '../utils/catchAsync.js';
import { sendSuccess } from '../utils/ApiResponse.js';
import * as courseStructure from '../services/courseStructureBridge.service.js';
import { recordAuditLog } from '../services/auditLog.service.js';

/**
 * Module/lesson structure for any course - rename, reorder, add, edit,
 * remove. Lessons live in the student service, so this is a proxy with an
 * audit trail: the same shape as lessonVideo.controller.js, gated by the
 * same `courses.manage` permission.
 */

const actorOf = (req) => ({ portal: 'admin', userId: String(req.admin._id), name: req.admin.name || null });

export const getStructure = catchAsync(async (req, res) => {
  sendSuccess(res, { data: await courseStructure.getCourseStructure(req.params.slug) });
});

export const updateSettings = catchAsync(async (req, res) => {
  const { slug } = req.params;
  const { progressionGatingEnabled, expectedUpdatedAt } = req.body;
  const data = await courseStructure.updateCourseSettings(slug, {
    progressionGatingEnabled,
    ...(expectedUpdatedAt !== undefined ? { expectedUpdatedAt } : {}),
    actor: actorOf(req),
  });

  await recordAuditLog({
    actor: req.admin,
    action: 'course.settings.updated',
    entityType: 'Course',
    entityId: slug,
    metadata: { slug, progressionGatingEnabled: Boolean(progressionGatingEnabled) },
    req,
  });

  sendSuccess(res, { message: 'Course settings updated', data });
});

export const addModule = catchAsync(async (req, res) => {
  const { slug } = req.params;
  const { title, description, order, gatingEnabled } = req.body;
  const data = await courseStructure.addModule(slug, {
    title,
    ...(description !== undefined ? { description } : {}),
    ...(order !== undefined ? { order } : {}),
    ...(gatingEnabled !== undefined ? { gatingEnabled } : {}),
    actor: actorOf(req),
  });

  await recordAuditLog({
    actor: req.admin,
    action: 'course.module.added',
    entityType: 'Course',
    entityId: slug,
    metadata: { slug, title },
    req,
  });

  sendSuccess(res, { message: 'Module added', data });
});

export const updateModule = catchAsync(async (req, res) => {
  const { slug, moduleId } = req.params;
  const { title, description, gatingEnabled, expectedUpdatedAt } = req.body;
  const data = await courseStructure.updateModule(slug, moduleId, {
    ...(title !== undefined ? { title } : {}),
    ...(description !== undefined ? { description } : {}),
    ...(gatingEnabled !== undefined ? { gatingEnabled } : {}),
    ...(expectedUpdatedAt !== undefined ? { expectedUpdatedAt } : {}),
    actor: actorOf(req),
  });

  await recordAuditLog({
    actor: req.admin,
    action: 'course.module.updated',
    entityType: 'Course',
    entityId: slug,
    metadata: { slug, moduleId },
    req,
  });

  sendSuccess(res, { message: 'Module updated', data });
});

export const reorderModules = catchAsync(async (req, res) => {
  const { slug } = req.params;
  const { orderedModuleIds } = req.body;
  const data = await courseStructure.reorderModules(slug, { orderedModuleIds, actor: actorOf(req) });

  await recordAuditLog({
    actor: req.admin,
    action: 'course.modules.reordered',
    entityType: 'Course',
    entityId: slug,
    metadata: { slug, orderedModuleIds },
    req,
  });

  sendSuccess(res, { message: 'Modules reordered', data });
});

export const addLesson = catchAsync(async (req, res) => {
  const { slug, moduleId } = req.params;
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

  await recordAuditLog({
    actor: req.admin,
    action: 'course.lesson.added',
    entityType: 'Course',
    entityId: slug,
    metadata: { slug, moduleId, title },
    req,
  });

  sendSuccess(res, { message: 'Lesson added', data });
});

export const updateLesson = catchAsync(async (req, res) => {
  const { slug, moduleId, lessonId } = req.params;
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

  await recordAuditLog({
    actor: req.admin,
    action: 'course.lesson.updated',
    entityType: 'Course',
    entityId: slug,
    metadata: { slug, moduleId, lessonId },
    req,
  });

  sendSuccess(res, { message: 'Lesson updated', data });
});

export const reorderLessons = catchAsync(async (req, res) => {
  const { slug, moduleId } = req.params;
  const { orderedLessonIds } = req.body;
  const data = await courseStructure.reorderLessons(slug, moduleId, { orderedLessonIds, actor: actorOf(req) });

  await recordAuditLog({
    actor: req.admin,
    action: 'course.lessons.reordered',
    entityType: 'Course',
    entityId: slug,
    metadata: { slug, moduleId, orderedLessonIds },
    req,
  });

  sendSuccess(res, { message: 'Lessons reordered', data });
});

export const removeModule = catchAsync(async (req, res) => {
  const { slug, moduleId } = req.params;
  const data = await courseStructure.removeModule(slug, moduleId, { actor: actorOf(req) });

  await recordAuditLog({
    actor: req.admin,
    action: 'course.module.removed',
    entityType: 'Course',
    entityId: slug,
    metadata: { slug, moduleId },
    req,
  });

  sendSuccess(res, { message: 'Module removed', data });
});

export const removeLesson = catchAsync(async (req, res) => {
  const { slug, moduleId, lessonId } = req.params;
  const data = await courseStructure.removeLesson(slug, moduleId, lessonId, { actor: actorOf(req) });

  await recordAuditLog({
    actor: req.admin,
    action: 'course.lesson.removed',
    entityType: 'Course',
    entityId: slug,
    metadata: { slug, moduleId, lessonId },
    req,
  });

  sendSuccess(res, { message: 'Lesson removed', data });
});

/**
 * Preview-before-flip for the mandatory-progression gate - powers the
 * "preview impact" button next to the course-level gating toggle. Read-only:
 * no audit log entry, same as getStructure above.
 */
export const previewGatingImpact = catchAsync(async (req, res) => {
  const data = await courseStructure.previewGatingImpact(req.params.slug);
  sendSuccess(res, { data });
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
  previewGatingImpact,
};
