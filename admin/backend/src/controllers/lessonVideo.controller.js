import { catchAsync } from '../utils/catchAsync.js';
import { sendSuccess } from '../utils/ApiResponse.js';
import * as studentBridge from '../services/studentCourseBridge.service.js';
import { recordAuditLog } from '../services/auditLog.service.js';

/**
 * Module and lesson videos for any course - PRARAMBH, GARUD, YODDHA and every
 * bridged course alike. Modules and lessons live in the student service, so
 * this is a proxy with an audit trail: the student service validates the link
 * or the uploaded file and stores it, and this portal records who did what.
 * An administrator may also cancel an upload a teacher left running.
 */

const actorOf = (req) => ({ portal: 'admin', userId: String(req.admin._id), name: req.admin.name || null });

// A video belongs to one lesson or one module, named by the route.
const targetOf = (params) => (params.moduleId ? { moduleId: params.moduleId } : { lessonId: params.lessonId });

const audit = (req, action, slug, metadata) => recordAuditLog({ actor: req.admin, action, entityType: 'Course', entityId: slug, metadata: { slug, ...metadata }, req });

export const listCourses = catchAsync(async (req, res) => {
  sendSuccess(res, { data: await studentBridge.listLessonVideoCourses() });
});

export const getCourse = catchAsync(async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  sendSuccess(res, { data: await studentBridge.getLessonVideos(req.params.slug) });
});

/** Video history across courses; `level=problems` lists only warnings and errors. */
export const listActivity = catchAsync(async (req, res) => {
  sendSuccess(res, { data: await studentBridge.listCourseVideoEvents(req.query) });
});

export const inspect = catchAsync(async (req, res) => {
  sendSuccess(res, { data: await studentBridge.inspectLessonVideo(req.body.url, req.body.provider) });
});

export const save = catchAsync(async (req, res) => {
  const { slug } = req.params;
  const target = targetOf(req.params);
  const result = await studentBridge.saveCourseVideo(slug, target, { ...req.body, actor: actorOf(req) });

  const video = result?.video;
  await audit(req, video?.isPublished ? 'course.lesson_video.published' : 'course.lesson_video.saved', slug, {
    ...target,
    provider: video?.provider || null,
    videoId: video?.videoId || video?.externalVideoId || null,
    previousVideoId: result?.previousVideoId || null,
    previousProvider: result?.previousProvider || null,
    wasPublished: Boolean(result?.wasPublished),
    isPublished: Boolean(video?.isPublished),
    availability: video?.availability || null,
  });

  sendSuccess(res, { message: video?.isPublished ? 'Video published' : 'Video saved as draft', data: result });
});

export const updateDetails = catchAsync(async (req, res) => {
  const { slug } = req.params;
  const target = targetOf(req.params);
  const result = await studentBridge.updateCourseVideo(slug, target, { ...req.body, actor: actorOf(req) });
  await audit(req, 'course.lesson_video.updated', slug, { ...target, isPublished: Boolean(result?.video?.isPublished) });
  sendSuccess(res, { message: 'Video updated', data: result });
});

export const remove = catchAsync(async (req, res) => {
  const { slug } = req.params;
  const target = targetOf(req.params);
  const result = await studentBridge.removeCourseVideo(slug, target, {
    actor: actorOf(req),
    ...(req.body?.expectedUpdatedAt !== undefined ? { expectedUpdatedAt: req.body.expectedUpdatedAt } : {}),
  });

  if (result?.removed) {
    await audit(req, 'course.lesson_video.removed', slug, {
      ...target,
      previousVideoId: result.previousVideoId || null,
      previousProvider: result.previousProvider || null,
    });
  }

  sendSuccess(res, { message: result?.removed ? 'Video removed' : 'There was no video to remove', data: result });
});

export const startUpload = catchAsync(async (req, res) => {
  const { slug } = req.params;
  const target = targetOf(req.params);
  const result = await studentBridge.startCourseVideoUpload(slug, target, { ...req.body, actor: actorOf(req) });
  await audit(req, 'course.lesson_video.upload_started', slug, {
    ...target,
    uploadId: result?.uploadId || null,
    fileName: req.body.fileName,
    fileSize: req.body.fileSize,
  });
  sendSuccess(res, { statusCode: 201, message: 'Upload started', data: result });
});

export const uploadPartUrls = catchAsync(async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  const { slug, uploadId } = req.params;
  sendSuccess(res, { data: await studentBridge.getCourseVideoPartUrls(slug, uploadId, { partNumbers: req.body.partNumbers, actor: actorOf(req) }) });
});

export const resumeUpload = catchAsync(async (req, res) => {
  const { slug, uploadId } = req.params;
  sendSuccess(res, { data: await studentBridge.resumeCourseVideoUpload(slug, uploadId, { actor: actorOf(req) }) });
});

export const completeUpload = catchAsync(async (req, res) => {
  const { slug, uploadId } = req.params;
  const result = await studentBridge.completeCourseVideoUpload(slug, uploadId, { ...req.body, actor: actorOf(req) });
  if (result?.status === 'completed' && !result.alreadyCompleted) {
    await audit(req, result.video?.isPublished ? 'course.lesson_video.published' : 'course.lesson_video.saved', slug, {
      moduleId: result.moduleId || null,
      lessonId: result.lessonId || null,
      provider: 'upload',
      uploadId,
      fileName: result.video?.fileName || null,
      previousVideoId: result.previousVideoId || null,
      previousProvider: result.previousProvider || null,
    });
  }
  const processing = result?.status === 'processing';
  sendSuccess(res, {
    statusCode: processing ? 202 : 200,
    message: processing ? 'The video is still being verified' : 'Video verified',
    data: result,
  });
});

export const abortUpload = catchAsync(async (req, res) => {
  const { slug, uploadId } = req.params;
  const result = await studentBridge.abortCourseVideoUpload(slug, uploadId, { actor: actorOf(req) });
  if (result?.aborted) await audit(req, 'course.lesson_video.upload_cancelled', slug, { uploadId });
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
