import { Router } from 'express';
import { z } from 'zod';
import * as controller from '../controllers/courseStructure.controller.js';
import { authenticate, requirePermission } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';

/**
 * Module/lesson structure for any course - rename, reorder, add, edit,
 * remove. Guarded by `courses.manage`, the same permission lesson videos and
 * subject tagging use: this is course content, and nobody below that
 * permission edits it.
 *
 * Shape is checked here; the structure itself lives in and is enforced by
 * the student service, the only writer.
 */
const router = Router();
router.use(authenticate, requirePermission('courses.manage'));

const slug = z.string().trim().min(1).max(120).regex(/^[a-z0-9-]+$/i, 'Invalid course');
const nodeId = z.string().trim().min(1).max(120);
// The version of the course/module/lesson the editor loaded: an ISO
// timestamp, or null for "no prior edit exists yet". Omitted = don't check.
const expectedUpdatedAt = z.union([z.string().datetime({ offset: true }), z.null()]).optional();
// null clears a module's override back to "inherit the course setting";
// true/false sets one; omitted leaves it untouched.
const gatingEnabled = z.boolean().nullable().optional();

const slugParams = { params: z.object({ slug }) };
const moduleParams = { params: z.object({ slug, moduleId: nodeId }) };
const lessonParams = { params: z.object({ slug, moduleId: nodeId, lessonId: nodeId }) };

const updateSettingsBody = z.object({ progressionGatingEnabled: z.boolean(), expectedUpdatedAt });
const addModuleBody = z.object({
  title: z.string().min(1).max(200),
  description: z.string().max(2000).optional().default(''),
  order: z.number().int().positive().optional(),
  gatingEnabled,
});
const updateModuleBody = z.object({
  title: z.string().min(1).max(200).optional(),
  description: z.string().max(2000).optional(),
  gatingEnabled,
  expectedUpdatedAt,
});
const reorderModulesBody = z.object({ orderedModuleIds: z.array(nodeId).min(1) });
const addLessonBody = z.object({
  title: z.string().min(1).max(200),
  duration: z.string().max(40).optional().default(''),
  summary: z.string().max(500).optional().default(''),
  content: z.string().max(20000).optional().default(''),
  order: z.number().int().positive().optional(),
  isPublished: z.boolean().optional().default(true),
});
const updateLessonBody = z.object({
  title: z.string().min(1).max(200).optional(),
  duration: z.string().max(40).optional(),
  summary: z.string().max(500).optional(),
  content: z.string().max(20000).optional(),
  isPublished: z.boolean().optional(),
  expectedUpdatedAt,
});
const reorderLessonsBody = z.object({ orderedLessonIds: z.array(nodeId).min(1) });
const removeLessonBody = z.object({}).optional().default({});

router.get('/courses/:slug', validate(slugParams), controller.getStructure);
router.patch('/courses/:slug', validate({ ...slugParams, body: updateSettingsBody }), controller.updateSettings);
router.post('/courses/:slug/modules', validate({ ...slugParams, body: addModuleBody }), controller.addModule);
router.put('/courses/:slug/modules/order', validate({ ...slugParams, body: reorderModulesBody }), controller.reorderModules);
router.patch('/courses/:slug/modules/:moduleId', validate({ ...moduleParams, body: updateModuleBody }), controller.updateModule);
router.post('/courses/:slug/modules/:moduleId/lessons', validate({ ...moduleParams, body: addLessonBody }), controller.addLesson);
router.put(
  '/courses/:slug/modules/:moduleId/lessons/order',
  validate({ ...moduleParams, body: reorderLessonsBody }),
  controller.reorderLessons
);
router.patch(
  '/courses/:slug/modules/:moduleId/lessons/:lessonId',
  validate({ ...lessonParams, body: updateLessonBody }),
  controller.updateLesson
);
router.delete(
  '/courses/:slug/modules/:moduleId/lessons/:lessonId',
  validate({ ...lessonParams, body: removeLessonBody }),
  controller.removeLesson
);

// Preview-before-flip for the mandatory-progression gate. Read-only - no
// request body, so no schema beyond the slug itself.
router.post('/courses/:slug/gating/dry-run', validate(slugParams), controller.previewGatingImpact);

export default router;
