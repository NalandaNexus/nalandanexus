import { asyncHandler } from '../utils/asyncHandler.js';
import { sendSuccess } from '../utils/apiResponse.js';
import * as courseStructure from '../services/courseStructure.service.js';

/**
 * Module/lesson structure, reached only over the service-key bridge (see
 * routes/internal.routes.js). Admin calls it for any course; the Teacher
 * portal calls it only for courses its own records say the signed-in teacher
 * is assigned to. No student session can reach this at all.
 */

export const getCourseStructure = asyncHandler(async (req, res) => {
  return sendSuccess(res, { data: await courseStructure.getCourseStructure(req.params.slug) });
});

export const updateCourseSettings = asyncHandler(async (req, res) => {
  const { actor, ...input } = req.body;
  const data = await courseStructure.updateCourseSettings(req.params.slug, input, actor);
  return sendSuccess(res, { message: 'Course settings updated', data });
});

export const addModule = asyncHandler(async (req, res) => {
  const { actor, ...input } = req.body;
  const data = await courseStructure.addModule(req.params.slug, input, actor);
  return sendSuccess(res, { message: 'Module added', data });
});

export const updateModule = asyncHandler(async (req, res) => {
  const { actor, ...input } = req.body;
  const data = await courseStructure.updateModule(req.params.slug, req.params.moduleId, input, actor);
  return sendSuccess(res, { message: 'Module updated', data });
});

export const reorderModules = asyncHandler(async (req, res) => {
  const { orderedModuleIds, actor } = req.body;
  const data = await courseStructure.reorderModules(req.params.slug, orderedModuleIds, actor);
  return sendSuccess(res, { message: 'Modules reordered', data });
});

export const addLesson = asyncHandler(async (req, res) => {
  const { actor, ...input } = req.body;
  const data = await courseStructure.addLesson(req.params.slug, req.params.moduleId, input, actor);
  return sendSuccess(res, { message: 'Lesson added', data });
});

export const updateLesson = asyncHandler(async (req, res) => {
  const { actor, ...input } = req.body;
  const data = await courseStructure.updateLesson(req.params.slug, req.params.moduleId, req.params.lessonId, input, actor);
  return sendSuccess(res, { message: 'Lesson updated', data });
});

export const reorderLessons = asyncHandler(async (req, res) => {
  const { orderedLessonIds, actor } = req.body;
  const data = await courseStructure.reorderLessons(req.params.slug, req.params.moduleId, orderedLessonIds, actor);
  return sendSuccess(res, { message: 'Lessons reordered', data });
});

export const removeLesson = asyncHandler(async (req, res) => {
  const result = await courseStructure.removeLesson(req.params.slug, req.params.moduleId, req.params.lessonId, req.body?.actor);
  return sendSuccess(res, { message: 'Lesson removed', data: result });
});

export default {
  getCourseStructure,
  updateCourseSettings,
  addModule,
  updateModule,
  reorderModules,
  addLesson,
  updateLesson,
  reorderLessons,
  removeLesson,
};
