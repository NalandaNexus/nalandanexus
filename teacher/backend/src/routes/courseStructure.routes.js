import { Router } from 'express';
import { body, param } from 'express-validator';
import * as controller from '../controllers/courseStructure.controller.js';
import { authenticate, requireRole } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';

/**
 * Module/lesson structure on a teacher's assigned courses - rename, reorder,
 * add, edit, remove a module or lesson. Shape is checked here, course
 * assignment in the controller (CourseAccess), and the structure itself
 * lives in and is enforced by the student service - the same division
 * lessonVideo.routes.js uses for videos.
 */
const router = Router();
router.use(authenticate, requireRole('teacher'));

const slugParam = param('slug').trim().matches(/^[a-z0-9-]{1,100}$/i).withMessage('Invalid course.');
const moduleParam = param('moduleId').trim().isLength({ min: 1, max: 120 }).withMessage('Invalid module.');
const lessonParam = param('lessonId').trim().isLength({ min: 1, max: 120 }).withMessage('Invalid lesson.');

// The version of the module/lesson/course the editor loaded: an ISO
// timestamp, or null for "no prior edit exists yet". Omitted = don't check.
const expectedBody = body('expectedUpdatedAt')
  .optional({ values: 'undefined' })
  .custom((v) => v === null || (typeof v === 'string' && v.length <= 40 && !Number.isNaN(Date.parse(v))))
  .withMessage('Invalid version.');

// null clears a module's override back to "inherit the course setting";
// true/false sets one; omitted leaves it untouched.
const gatingEnabledBody = body('gatingEnabled')
  .optional({ values: 'undefined' })
  .custom((v) => v === null || typeof v === 'boolean')
  .withMessage('Invalid value.');

router.get('/courses/:slug', slugParam, validate, controller.getStructure);

router.patch(
  '/courses/:slug',
  slugParam,
  body('progressionGatingEnabled').isBoolean({ strict: true }),
  expectedBody,
  validate,
  controller.updateSettings
);

router.post(
  '/courses/:slug/modules',
  slugParam,
  body('title').isString().trim().isLength({ min: 1, max: 200 }),
  body('description').optional().isString().isLength({ max: 2000 }),
  body('order').optional().isInt({ min: 1 }).toInt(),
  gatingEnabledBody,
  validate,
  controller.addModule
);

router.put(
  '/courses/:slug/modules/order',
  slugParam,
  body('orderedModuleIds').isArray({ min: 1 }),
  body('orderedModuleIds.*').isString().trim().isLength({ min: 1, max: 120 }),
  validate,
  controller.reorderModules
);

router.patch(
  '/courses/:slug/modules/:moduleId',
  slugParam,
  moduleParam,
  body('title').optional().isString().trim().isLength({ min: 1, max: 200 }),
  body('description').optional().isString().isLength({ max: 2000 }),
  gatingEnabledBody,
  expectedBody,
  validate,
  controller.updateModule
);

router.post(
  '/courses/:slug/modules/:moduleId/lessons',
  slugParam,
  moduleParam,
  body('title').isString().trim().isLength({ min: 1, max: 200 }),
  body('duration').optional().isString().isLength({ max: 40 }),
  body('summary').optional().isString().isLength({ max: 500 }),
  body('content').optional().isString().isLength({ max: 20000 }),
  body('order').optional().isInt({ min: 1 }).toInt(),
  body('isPublished').optional().isBoolean({ strict: true }),
  validate,
  controller.addLesson
);

router.put(
  '/courses/:slug/modules/:moduleId/lessons/order',
  slugParam,
  moduleParam,
  body('orderedLessonIds').isArray({ min: 1 }),
  body('orderedLessonIds.*').isString().trim().isLength({ min: 1, max: 120 }),
  validate,
  controller.reorderLessons
);

router.patch(
  '/courses/:slug/modules/:moduleId/lessons/:lessonId',
  slugParam,
  moduleParam,
  lessonParam,
  body('title').optional().isString().trim().isLength({ min: 1, max: 200 }),
  body('duration').optional().isString().isLength({ max: 40 }),
  body('summary').optional().isString().isLength({ max: 500 }),
  body('content').optional().isString().isLength({ max: 20000 }),
  body('isPublished').optional().isBoolean({ strict: true }),
  expectedBody,
  validate,
  controller.updateLesson
);

router.delete(
  '/courses/:slug/modules/:moduleId/lessons/:lessonId',
  slugParam,
  moduleParam,
  lessonParam,
  validate,
  controller.removeLesson
);

export default router;
