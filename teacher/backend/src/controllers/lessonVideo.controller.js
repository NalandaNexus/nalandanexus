import { catchAsync } from '../utils/catchAsync.js';
import { sendSuccess } from '../utils/ApiResponse.js';
import * as lessonVideos from '../services/lessonVideo.service.js';
import { logAudit } from '../services/audit.service.js';

/**
 * Module and lesson videos, for assigned courses only. Every route that names
 * a course checks the teacher's CourseAccess first - on the server, on every
 * request, upload steps included - so hiding a course in the UI is never what
 * keeps a teacher out of it, and taking a course away stops an upload already
 * in progress at its next step. The student service additionally refuses an
 * upload session that belongs to another course or another teacher.
 */

const actorOf = (req) => ({ portal: 'teacher', userId: String(req.user._id), name: req.user.name || null });

// A video belongs to one lesson or one module, named by the route.
const targetOf = (params) => (params.moduleId ? { moduleId: params.moduleId } : { lessonId: params.lessonId });

const audit = (req, action, metadata) =>
  logAudit({ actorId: req.user._id, action, targetType: 'Course', targetId: null, metadata, ip: req.ip });

export const listCourses = catchAsync(async (req, res) => {
  sendSuccess(res, { data: await lessonVideos.listManageableCourses(req.teacher._id) });
});

export const getCourse = catchAsync(async (req, res) => {
  const slug = await lessonVideos.assertCourseAccess(req.teacher._id, req.params.slug);
  res.setHeader('Cache-Control', 'no-store');
  sendSuccess(res, { data: await lessonVideos.getCourseVideos(slug) });
});

export const listActivity = catchAsync(async (req, res) => {
  const slug = await lessonVideos.assertCourseAccess(req.teacher._id, req.params.slug);
  sendSuccess(res, { data: await lessonVideos.listCourseActivity(slug) });
});

export const inspect = catchAsync(async (req, res) => {
  // Reads nothing of any course - it only describes a pasted link - so it needs
  // a teacher session but no particular assignment.
  sendSuccess(res, { data: await lessonVideos.inspectLink(req.body.url, req.body.provider) });
});

export const save = catchAsync(async (req, res) => {
  const slug = await lessonVideos.assertCourseAccess(req.teacher._id, req.params.slug);
  const target = targetOf(req.params);
  const { provider, url, title, description, playbackMode, isPublished, expectedUpdatedAt } = req.body;
  const result = await lessonVideos.saveCourseVideo(slug, target, {
    provider: provider || 'youtube',
    url,
    title: title ?? '',
    description: description ?? '',
    playbackMode: playbackMode || 'embed',
    isPublished: Boolean(isPublished),
    ...(expectedUpdatedAt !== undefined ? { expectedUpdatedAt } : {}),
    actor: actorOf(req),
  });

  const video = result?.video;
  await audit(req, video?.isPublished ? 'course.lesson_video.published' : 'course.lesson_video.saved', {
    slug,
    ...target,
    provider: video?.provider || null,
    videoId: video?.videoId || video?.externalVideoId || null,
    previousVideoId: result?.previousVideoId || null,
    previousProvider: result?.previousProvider || null,
    isPublished: Boolean(video?.isPublished),
  });

  sendSuccess(res, { message: video?.isPublished ? 'Video published' : 'Video saved as draft', data: result });
});

export const updateDetails = catchAsync(async (req, res) => {
  const slug = await lessonVideos.assertCourseAccess(req.teacher._id, req.params.slug);
  const target = targetOf(req.params);
  const { title, description, playbackMode, isPublished, expectedUpdatedAt } = req.body;
  const result = await lessonVideos.updateCourseVideo(slug, target, {
    ...(title !== undefined ? { title } : {}),
    ...(description !== undefined ? { description } : {}),
    ...(playbackMode !== undefined ? { playbackMode } : {}),
    ...(isPublished !== undefined ? { isPublished } : {}),
    ...(expectedUpdatedAt !== undefined ? { expectedUpdatedAt } : {}),
    actor: actorOf(req),
  });
  await audit(req, 'course.lesson_video.updated', { slug, ...target, isPublished: Boolean(result?.video?.isPublished) });
  sendSuccess(res, { message: 'Video updated', data: result });
});

export const remove = catchAsync(async (req, res) => {
  const slug = await lessonVideos.assertCourseAccess(req.teacher._id, req.params.slug);
  const target = targetOf(req.params);
  const result = await lessonVideos.removeCourseVideo(slug, target, {
    actor: actorOf(req),
    ...(req.body?.expectedUpdatedAt !== undefined ? { expectedUpdatedAt: req.body.expectedUpdatedAt } : {}),
  });

  if (result?.removed) {
    await audit(req, 'course.lesson_video.removed', {
      slug,
      ...target,
      previousVideoId: result.previousVideoId || null,
      previousProvider: result.previousProvider || null,
    });
  }

  sendSuccess(res, { message: result?.removed ? 'Video removed' : 'There was no video to remove', data: result });
});

export const startUpload = catchAsync(async (req, res) => {
  const slug = await lessonVideos.assertCourseAccess(req.teacher._id, req.params.slug);
  const target = targetOf(req.params);
  const { fileName, fileSize, mimeType, title, description, isPublished, expectedUpdatedAt } = req.body;
  const result = await lessonVideos.startCourseVideoUpload(slug, target, {
    fileName,
    fileSize,
    mimeType: mimeType || '',
    title: title ?? '',
    description: description ?? '',
    isPublished: isPublished !== false,
    ...(expectedUpdatedAt !== undefined ? { expectedUpdatedAt } : {}),
    actor: actorOf(req),
  });
  await audit(req, 'course.lesson_video.upload_started', { slug, ...target, uploadId: result?.uploadId || null, fileName, fileSize });
  sendSuccess(res, { statusCode: 201, message: 'Upload started', data: result });
});

export const uploadPartUrls = catchAsync(async (req, res) => {
  const slug = await lessonVideos.assertCourseAccess(req.teacher._id, req.params.slug);
  res.setHeader('Cache-Control', 'no-store');
  const result = await lessonVideos.getCourseVideoPartUrls(slug, req.params.uploadId, { partNumbers: req.body.partNumbers, actor: actorOf(req) });
  sendSuccess(res, { data: result });
});

export const resumeUpload = catchAsync(async (req, res) => {
  const slug = await lessonVideos.assertCourseAccess(req.teacher._id, req.params.slug);
  sendSuccess(res, { data: await lessonVideos.resumeCourseVideoUpload(slug, req.params.uploadId, { actor: actorOf(req) }) });
});

export const completeUpload = catchAsync(async (req, res) => {
  const slug = await lessonVideos.assertCourseAccess(req.teacher._id, req.params.slug);
  const result = await lessonVideos.completeCourseVideoUpload(slug, req.params.uploadId, {
    ...(req.body.duration !== undefined ? { duration: req.body.duration } : {}),
    ...(req.body.expectedUpdatedAt !== undefined ? { expectedUpdatedAt: req.body.expectedUpdatedAt } : {}),
    actor: actorOf(req),
  });
  if (result?.status === 'completed' && !result.alreadyCompleted) {
    await audit(req, result.video?.isPublished ? 'course.lesson_video.published' : 'course.lesson_video.saved', {
      slug,
      moduleId: result.moduleId || null,
      lessonId: result.lessonId || null,
      provider: 'upload',
      uploadId: req.params.uploadId,
      fileName: result.video?.fileName || null,
      previousVideoId: result.previousVideoId || null,
      previousProvider: result.previousProvider || null,
    });
  }
  sendSuccess(res, {
    statusCode: result?.status === 'processing' ? 202 : 200,
    message: result?.status === 'processing' ? 'The video is still being verified' : 'Video verified',
    data: result,
  });
});

export const abortUpload = catchAsync(async (req, res) => {
  const slug = await lessonVideos.assertCourseAccess(req.teacher._id, req.params.slug);
  const result = await lessonVideos.abortCourseVideoUpload(slug, req.params.uploadId, { actor: actorOf(req) });
  if (result?.aborted) await audit(req, 'course.lesson_video.upload_cancelled', { slug, uploadId: req.params.uploadId });
  sendSuccess(res, { message: 'Upload cancelled', data: result });
});

export default {
  listCourses,
  getCourse,
  listActivity,
  inspect,
  save,
  updateDetails,
  remove,
  startUpload,
  uploadPartUrls,
  resumeUpload,
  completeUpload,
  abortUpload,
};
