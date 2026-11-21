import { asyncHandler } from '../utils/asyncHandler.js';
import { sendSuccess } from '../utils/apiResponse.js';
import * as lessonVideos from '../services/lessonVideo.service.js';

/**
 * Module and lesson video management, reached only over the service-key
 * bridge (see routes/internal.routes.js). The Admin portal calls it for any
 * course; the Teacher portal calls it only for courses its own records say
 * the signed-in teacher is assigned to, and passes that teacher as `actor`.
 * Neither portal can reach these routes with a user session, and no student
 * can reach them at all.
 */

const slugList = (value) =>
  value
    ? value
        .split(',')
        .map((s) => s.trim().toLowerCase())
        .filter(Boolean)
    : undefined;

export const listVideoCatalog = asyncHandler(async (req, res) => {
  return sendSuccess(res, { data: await lessonVideos.listVideoCatalog({ slugs: slugList(req.query.slugs) }) });
});

export const getCourseVideos = asyncHandler(async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  return sendSuccess(res, { data: await lessonVideos.getCourseVideos(req.params.slug) });
});

export const listVideoEvents = asyncHandler(async (req, res) => {
  const { slug, slugs, level, limit, before } = req.query;
  return sendSuccess(res, { data: await lessonVideos.listVideoEvents({ slug, slugs: slugList(slugs), level, limit, before }) });
});

export const inspectVideo = asyncHandler(async (req, res) => {
  return sendSuccess(res, { data: await lessonVideos.inspectLink(req.body.url, { provider: req.body.provider }) });
});

const targetOf = (params) => (params.moduleId ? { moduleId: params.moduleId } : { lessonId: params.lessonId });

/** PUT .../lessons/:lessonId and .../modules/:moduleId - attach a YouTube or Drive link. */
export const upsertVideo = asyncHandler(async (req, res) => {
  const { actor, ...input } = req.body;
  const data = await lessonVideos.upsertVideo(req.params.slug, targetOf(req.params), input, actor);
  return sendSuccess(res, { message: data.video?.isPublished ? 'Video published' : 'Video saved as draft', data });
});

/** PATCH .../lessons/:lessonId and .../modules/:moduleId - title, description, visibility. */
export const updateVideo = asyncHandler(async (req, res) => {
  const { actor, ...input } = req.body;
  const data = await lessonVideos.updateVideoDetails(req.params.slug, targetOf(req.params), input, actor);
  return sendSuccess(res, { message: 'Video updated', data });
});

/** DELETE .../lessons/:lessonId and .../modules/:moduleId. */
export const removeVideo = asyncHandler(async (req, res) => {
  const data = await lessonVideos.removeVideo(req.params.slug, targetOf(req.params), req.body?.actor, {
    expectedUpdatedAt: req.body?.expectedUpdatedAt,
  });
  return sendSuccess(res, { message: data.removed ? 'Video removed' : 'This had no video', data });
});

/** Opens a multipart upload session. The response carries no URL and no credential. */
export const startUpload = asyncHandler(async (req, res) => {
  const { actor, ...input } = req.body;
  const data = await lessonVideos.startUpload(req.params.slug, targetOf(req.params), input, actor);
  return sendSuccess(res, { status: 201, message: 'Upload session started', data });
});

export const uploadPartUrls = asyncHandler(async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  const data = await lessonVideos.getUploadPartUrls(req.params.slug, req.params.uploadId, req.body, req.body.actor);
  return sendSuccess(res, { data });
});

export const resumeUpload = asyncHandler(async (req, res) => {
  const data = await lessonVideos.resumeUpload(req.params.slug, req.params.uploadId, req.body.actor);
  return sendSuccess(res, { data });
});

export const completeUpload = asyncHandler(async (req, res) => {
  const { actor, ...input } = req.body;
  const data = await lessonVideos.completeUpload(req.params.slug, req.params.uploadId, input, actor);
  if (data.status === 'processing') {
    return sendSuccess(res, { status: 202, message: 'The video is still being verified', data });
  }
  return sendSuccess(res, { message: data.video?.isPublished ? 'Video verified and published' : 'Video verified and saved as draft', data });
});

export const abortUpload = asyncHandler(async (req, res) => {
  const data = await lessonVideos.abortUpload(req.params.slug, req.params.uploadId, req.body?.actor);
  return sendSuccess(res, { message: 'Upload cancelled', data });
});
