import { Router } from 'express';
import { z } from 'zod';
import * as controller from '../controllers/lessonVideo.controller.js';
import { authenticate, requirePermission } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { videoInspectLimiter, videoUploadStartLimiter, videoUploadActivityLimiter } from '../middleware/rateLimiter.js';

/**
 * Module and lesson videos on every course: YouTube links, Google Drive links
 * and uploaded files, plus the video history (uploads, replacements, errors).
 * Guarded by `courses.manage`, the same permission as editing a course's
 * subjects or price: what a module shows its students is course content, and
 * nobody below that permission edits it.
 *
 * Shape is checked here; whether a link or file is a usable video is decided
 * by the student service, which owns modules and lessons and is the only
 * writer.
 */
const router = Router();
router.use(authenticate, requirePermission('courses.manage'));

const slug = z.string().trim().min(1).max(120).regex(/^[a-z0-9-]+$/i, 'Invalid course');
const nodeId = z.string().trim().min(1).max(120);
const uploadId = z.string().regex(/^[a-f\d]{24}$/i, 'Invalid upload session');
// The version of the video the editor loaded; null = "there was no video".
const expectedUpdatedAt = z.union([z.string().datetime({ offset: true }), z.null()]).optional();
const provider = z.enum(['youtube', 'google_drive']);

const slugParams = { params: z.object({ slug }) };
const uploadParams = { params: z.object({ slug, uploadId }) };

const saveBody = z.object({
  provider: provider.optional().default('youtube'),
  url: z.string().max(2048),
  title: z.string().max(200).optional().default(''),
  description: z.string().max(2000).optional().default(''),
  playbackMode: z.enum(['embed', 'external']).optional().default('embed'),
  isPublished: z.boolean().optional().default(false),
  expectedUpdatedAt,
});
const detailsBody = z
  .object({
    title: z.string().max(200).optional(),
    description: z.string().max(2000).optional(),
    playbackMode: z.enum(['embed', 'external']).optional(),
    isPublished: z.boolean().optional(),
    expectedUpdatedAt,
  })
  .strict();
const removeBody = z.object({ expectedUpdatedAt }).optional().default({});
const uploadStart = z.object({
  fileName: z.string().min(1).max(255),
  fileSize: z.number().int().positive().max(Number.MAX_SAFE_INTEGER),
  mimeType: z.string().max(120).optional().default(''),
  title: z.string().max(200).optional().default(''),
  description: z.string().max(2000).optional().default(''),
  isPublished: z.boolean().optional().default(true),
  expectedUpdatedAt,
});

router.get('/courses', controller.listCourses);
router.get('/activity', validate({ query: z.object({
  slug: slug.optional(),
  level: z.enum(['info', 'warn', 'error', 'problems']).optional(),
  limit: z.coerce.number().int().min(1).max(200).optional(),
  before: z.string().datetime({ offset: true }).optional(),
}) }), controller.listActivity);
router.get('/courses/:slug', validate(slugParams), controller.getCourse);
router.post('/inspect', videoInspectLimiter, validate({ body: z.object({ url: z.string().max(2048), provider: provider.optional() }) }), controller.inspect);

for (const [node, params] of [
  ['lessons/:lessonId', z.object({ slug, lessonId: nodeId })],
  ['modules/:moduleId', z.object({ slug, moduleId: nodeId })],
]) {
  const path = `/courses/:slug/${node}`;
  router.put(path, validate({ params, body: saveBody }), controller.save);
  router.patch(path, validate({ params, body: detailsBody }), controller.updateDetails);
  router.delete(path, validate({ params, body: removeBody }), controller.remove);
  router.post(`${path}/uploads`, videoUploadStartLimiter, validate({ params, body: uploadStart }), controller.startUpload);
}

const uploadPath = '/courses/:slug/uploads/:uploadId';
router.post(
  `${uploadPath}/parts`,
  videoUploadActivityLimiter,
  validate({ ...uploadParams, body: z.object({ partNumbers: z.array(z.number().int().positive()).min(1).max(50) }) }),
  controller.uploadPartUrls
);
router.post(`${uploadPath}/resume`, videoUploadActivityLimiter, validate({ ...uploadParams, body: z.object({}).optional().default({}) }), controller.resumeUpload);
router.post(
  `${uploadPath}/complete`,
  videoUploadActivityLimiter,
  validate({ ...uploadParams, body: z.object({ duration: z.number().finite().min(0).max(86400).optional(), expectedUpdatedAt }) }),
  controller.completeUpload
);
router.delete(uploadPath, validate({ ...uploadParams, body: z.object({}).optional().default({}) }), controller.abortUpload);

export default router;
