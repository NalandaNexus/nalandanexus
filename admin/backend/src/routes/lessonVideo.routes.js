import { Router } from 'express';
import { z } from 'zod';
import * as controller from '../controllers/lessonVideo.controller.js';
import { authenticate, requirePermission } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';

/**
 * YouTube videos on course lessons. Guarded by `courses.manage`, the same
 * permission as editing a course's subjects or price: what a lesson shows its
 * students is course content, and nobody below that permission edits it.
 *
 * Shape is checked here; whether a link is a real YouTube video is decided by
 * the student service, which owns the lessons and is the only writer.
 */
const router = Router();
router.use(authenticate, requirePermission('courses.manage'));

const slug = z.string().trim().min(1).max(120).regex(/^[a-z0-9-]+$/i, 'Invalid course');
const nodeId = z.string().trim().min(1).max(120);
// The version of the video the editor loaded; null = "there was no video".
const expectedUpdatedAt = z.union([z.string().datetime({ offset: true }), z.null()]).optional();

const slugParams = { params: z.object({ slug }) };
const lessonParams = { params: z.object({ slug, lessonId: nodeId }) };
const moduleParams = { params: z.object({ slug, moduleId: nodeId }) };

const saveBody = z.object({
  provider: z.enum(['youtube', 'google_drive']).optional().default('youtube'),
  url: z.string().max(2048),
  title: z.string().max(200).optional().default(''),
  description: z.string().max(2000).optional().default(''),
  playbackMode: z.enum(['embed', 'external']).optional().default('embed'),
  isPublished: z.boolean().optional().default(false),
  expectedUpdatedAt,
});
const removeBody = z.object({ expectedUpdatedAt }).optional().default({});

router.get('/courses', controller.listCourses);
router.get('/courses/:slug', validate(slugParams), controller.getCourse);
router.post('/inspect', validate({ body: z.object({ url: z.string().max(2048) }) }), controller.inspect);
router.put('/courses/:slug/lessons/:lessonId', validate({ ...lessonParams, body: saveBody }), controller.save);
router.delete('/courses/:slug/lessons/:lessonId', validate({ ...lessonParams, body: removeBody }), controller.remove);
router.put('/courses/:slug/modules/:moduleId', validate({ ...moduleParams, body: saveBody }), controller.save);
router.delete('/courses/:slug/modules/:moduleId', validate({ ...moduleParams, body: removeBody }), controller.remove);
const uploadStart = z.object({
  fileName: z.string().min(1).max(255), fileSize: z.number().int().positive(), mimeType: z.string().min(1).max(120),
  title: z.string().max(200).optional().default(''), description: z.string().max(2000).optional().default(''),
  isPublished: z.boolean().optional().default(true), expectedUpdatedAt,
});
const uploadParams = { params: z.object({ uploadId: z.string().regex(/^[a-f\d]{24}$/i) }) };
router.post('/courses/:slug/lessons/:lessonId/uploads', validate({ ...lessonParams, body: uploadStart }), controller.startUpload);
router.post('/courses/:slug/modules/:moduleId/uploads', validate({ ...moduleParams, body: uploadStart }), controller.startUpload);
router.post('/uploads/:uploadId/parts', validate({ ...uploadParams, body: z.object({ partNumbers: z.array(z.number().int()).min(1).max(25) }) }), controller.uploadPartUrls);
router.post('/uploads/:uploadId/complete', validate({ ...uploadParams, body: z.object({ parts: z.array(z.object({ partNumber: z.number().int().positive(), etag: z.string().min(1).max(256) })).min(1).max(10000), duration: z.number().finite().min(0).max(86400).optional() }) }), controller.completeUpload);
router.delete('/uploads/:uploadId', validate({ ...uploadParams, body: z.object({}).optional().default({}) }), controller.abortUpload);

export default router;
