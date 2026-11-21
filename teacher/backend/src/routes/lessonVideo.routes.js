import { Router } from 'express';
import { body, param } from 'express-validator';
import * as controller from '../controllers/lessonVideo.controller.js';
import { authenticate, requireRole } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';

/**
 * YouTube videos on the lessons of a teacher's assigned courses. Shape is
 * checked here, course assignment in the controller (CourseAccess), and the
 * link itself by the student service that stores it.
 */
const router = Router();
router.use(authenticate, requireRole('teacher'));

const slugParam = param('slug').trim().matches(/^[a-z0-9-]{1,100}$/i).withMessage('Invalid course.');
const lessonParam = param('lessonId').trim().isLength({ min: 1, max: 120 }).withMessage('Invalid lesson.');
const moduleParam = param('moduleId').trim().isLength({ min: 1, max: 120 }).withMessage('Invalid module.');
const urlBody = body('url').isString().withMessage('Paste a video link.').isLength({ max: 2048 });
// The version of the video the editor loaded: an ISO timestamp, or null for "there was no video".
const expectedBody = body('expectedUpdatedAt')
  .optional({ values: 'undefined' })
  .custom((v) => v === null || (typeof v === 'string' && v.length <= 40 && !Number.isNaN(Date.parse(v))))
  .withMessage('Invalid version.');

const saveFields = [
  urlBody,
  body('title').optional().isString().isLength({ max: 200 }),
  body('description').optional().isString().isLength({ max: 2000 }),
  body('playbackMode').optional().isIn(['embed', 'external']),
  body('provider').optional().isIn(['youtube', 'google_drive']),
  body('isPublished').optional().isBoolean({ strict: true }),
  expectedBody,
];

router.get('/courses', controller.listCourses);
router.get('/courses/:slug', slugParam, validate, controller.getCourse);
router.post('/inspect', urlBody, validate, controller.inspect);
router.put('/courses/:slug/lessons/:lessonId', slugParam, lessonParam, ...saveFields, validate, controller.save);
router.delete('/courses/:slug/lessons/:lessonId', slugParam, lessonParam, expectedBody, validate, controller.remove);
router.put('/courses/:slug/modules/:moduleId', slugParam, moduleParam, ...saveFields, validate, controller.save);
router.delete('/courses/:slug/modules/:moduleId', slugParam, moduleParam, expectedBody, validate, controller.remove);
const uploadFields = [
  body('fileName').isString().isLength({ min: 1, max: 255 }), body('fileSize').isInt({ min: 1 }),
  body('mimeType').isString().isLength({ min: 1, max: 120 }), body('title').optional().isString().isLength({ max: 200 }),
  body('description').optional().isString().isLength({ max: 2000 }), body('isPublished').optional().isBoolean({ strict: true }), expectedBody,
];
router.post('/courses/:slug/lessons/:lessonId/uploads', slugParam, lessonParam, ...uploadFields, validate, controller.startUpload);
router.post('/courses/:slug/modules/:moduleId/uploads', slugParam, moduleParam, ...uploadFields, validate, controller.startUpload);
router.post('/uploads/:uploadId/parts', param('uploadId').isMongoId(), body('partNumbers').isArray({ min: 1, max: 25 }), validate, controller.uploadPartUrls);
router.post('/uploads/:uploadId/complete', param('uploadId').isMongoId(), body('parts').isArray({ min: 1, max: 10000 }), body('duration').optional().isFloat({ min: 0, max: 86400 }), validate, controller.completeUpload);
router.delete('/uploads/:uploadId', param('uploadId').isMongoId(), validate, controller.abortUpload);

export default router;
