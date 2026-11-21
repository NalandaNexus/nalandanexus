import { Router } from 'express';
import { body, param } from 'express-validator';
import * as controller from '../controllers/lessonVideo.controller.js';
import { authenticate, requireRole } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { videoInspectLimiter, videoUploadStartLimiter, videoUploadActivityLimiter } from '../middleware/rateLimiter.js';

/**
 * Module and lesson videos on a teacher's assigned courses: YouTube links,
 * Google Drive links and uploaded files. Shape is checked here; whether the
 * course is assigned to this teacher is checked in the controller
 * (CourseAccess) on every course-scoped request - upload steps included,
 * which is why every upload route names its course; and the link or file
 * itself is judged by the student service that stores it.
 */
const router = Router();
router.use(authenticate, requireRole('teacher'));

const slugParam = param('slug').trim().matches(/^[a-z0-9-]{1,100}$/i).withMessage('Invalid course.');
const lessonParam = param('lessonId').trim().isLength({ min: 1, max: 120 }).withMessage('Invalid lesson.');
const moduleParam = param('moduleId').trim().isLength({ min: 1, max: 120 }).withMessage('Invalid module.');
const uploadParam = param('uploadId').isMongoId().withMessage('Invalid upload session.');
const urlBody = body('url').isString().withMessage('Paste a video link.').isLength({ max: 2048 });
// The version of the video the editor loaded: an ISO timestamp, or null for "there was no video".
const expectedBody = body('expectedUpdatedAt')
  .optional({ values: 'undefined' })
  .custom((v) => v === null || (typeof v === 'string' && v.length <= 40 && !Number.isNaN(Date.parse(v))))
  .withMessage('Invalid version.');

const saveFields = [
  urlBody,
  body('provider').optional().isIn(['youtube', 'google_drive']),
  body('title').optional().isString().isLength({ max: 200 }),
  body('description').optional().isString().isLength({ max: 2000 }),
  body('playbackMode').optional().isIn(['embed', 'external']),
  body('isPublished').optional().isBoolean({ strict: true }),
  expectedBody,
];
const detailFields = [
  body('title').optional().isString().isLength({ max: 200 }),
  body('description').optional().isString().isLength({ max: 2000 }),
  body('playbackMode').optional().isIn(['embed', 'external']),
  body('isPublished').optional().isBoolean({ strict: true }),
  expectedBody,
];
const uploadFields = [
  body('fileName').isString().isLength({ min: 1, max: 255 }),
  body('fileSize').isInt({ min: 1 }).toInt(),
  body('mimeType').optional().isString().isLength({ max: 120 }),
  body('title').optional().isString().isLength({ max: 200 }),
  body('description').optional().isString().isLength({ max: 2000 }),
  body('isPublished').optional().isBoolean({ strict: true }),
  expectedBody,
];

router.get('/courses', controller.listCourses);
router.get('/courses/:slug', slugParam, validate, controller.getCourse);
router.get('/courses/:slug/activity', slugParam, validate, controller.listActivity);
router.post('/inspect', videoInspectLimiter, urlBody, body('provider').optional().isIn(['youtube', 'google_drive']), validate, controller.inspect);

for (const [node, nodeParam] of [
  ['lessons/:lessonId', lessonParam],
  ['modules/:moduleId', moduleParam],
]) {
  const path = `/courses/:slug/${node}`;
  router.put(path, slugParam, nodeParam, ...saveFields, validate, controller.save);
  router.patch(path, slugParam, nodeParam, ...detailFields, validate, controller.updateDetails);
  router.delete(path, slugParam, nodeParam, expectedBody, validate, controller.remove);
  router.post(`${path}/uploads`, videoUploadStartLimiter, slugParam, nodeParam, ...uploadFields, validate, controller.startUpload);
}

const uploadPath = '/courses/:slug/uploads/:uploadId';
router.post(
  `${uploadPath}/parts`,
  videoUploadActivityLimiter,
  slugParam,
  uploadParam,
  body('partNumbers').isArray({ min: 1, max: 50 }),
  body('partNumbers.*').isInt({ min: 1, max: 10000 }).toInt(),
  validate,
  controller.uploadPartUrls
);
router.post(`${uploadPath}/resume`, videoUploadActivityLimiter, slugParam, uploadParam, validate, controller.resumeUpload);
router.post(
  `${uploadPath}/complete`,
  videoUploadActivityLimiter,
  slugParam,
  uploadParam,
  body('duration').optional().isFloat({ min: 0, max: 86400 }).toFloat(),
  expectedBody,
  validate,
  controller.completeUpload
);
router.delete(uploadPath, slugParam, uploadParam, validate, controller.abortUpload);

export default router;
