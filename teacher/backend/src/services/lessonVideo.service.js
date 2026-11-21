import { env } from '../config/env.js';
import { CourseAccess } from '../models/CourseAccess.js';
import { ApiError } from '../utils/ApiError.js';

/**
 * Module and lesson videos for the courses a teacher is assigned.
 *
 * The authorisation is this portal's own CourseAccess record - the row an
 * administrator's assignment creates for (teacher, course slug), and the same
 * one that already decides whose students a teacher may see. It is consulted on
 * every request, so taking a course away from a teacher takes away their
 * ability to edit its videos in the same moment. There is no second assignment
 * system here.
 *
 * Modules and lessons live in the student service; this forwards an
 * authorised edit there over the service-key bridge, naming the teacher who
 * made it. The student service validates the link or file and is the only
 * writer. Upload bytes never pass through here: the browser sends them
 * straight to private storage on URLs the student service signs.
 */

const SLUG = /^[a-z0-9-]{1,100}$/;
const normSlug = (s) => String(s || '').trim().toLowerCase();

// The student service sleeps when idle and can take 30-60s to answer the first
// request. Two attempts, the second long enough to outlast a cold start; only
// transport failures and 5xx are retried, and PUT/DELETE here are idempotent.
const ATTEMPT_TIMEOUTS_MS = [8000, 35000];
const RETRY_BACKOFF_MS = 1000;

function unavailable() {
  return ApiError.serviceUnavailable(
    'The Student service is unavailable, so lesson videos cannot be loaded or saved right now. Nothing was changed - please try again in a moment.',
    'STUDENT_SERVICE_UNAVAILABLE'
  );
}

async function attempt(path, options, timeoutMs) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(`${env.studentBridge.url}${path}`, {
      ...options,
      headers: { 'Content-Type': 'application/json', 'X-Internal-Service-Key': env.studentBridge.serviceKey },
      signal: controller.signal,
    });
    const text = await res.text().catch(() => '');
    let body = null;
    try {
      body = text ? JSON.parse(text) : null;
    } catch {
      body = null;
    }
    if (res.ok) return { body };
    if (res.status >= 400 && res.status < 500) {
      // The student service judged the request on its merits (unsupported
      // link, unknown lesson, unpublishable video). That answer is the useful
      // one, so its status and code reach the teacher unchanged.
      const err = new ApiError(
        res.status,
        body?.error?.message || body?.message || 'The Student service rejected this request.',
        body?.error?.code || body?.code || 'STUDENT_SERVICE_REJECTED',
        body?.error?.details
      );
      err.retryable = false;
      throw err;
    }
    const err = new Error(`Student backend returned ${res.status}`);
    err.retryable = true;
    throw err;
  } catch (err) {
    if (err instanceof ApiError || err.retryable !== undefined) throw err;
    const wrapped = new Error(err.name === 'AbortError' ? `Timed out after ${timeoutMs}ms` : err.message);
    wrapped.retryable = true;
    throw wrapped;
  } finally {
    clearTimeout(timer);
  }
}

async function call(path, options, { idempotent = true } = {}) {
  if (!env.studentBridge.url || !env.studentBridge.serviceKey) throw unavailable();
  // A request that creates something (an upload session) is sent once, with
  // the long timeout: retrying it after a timeout could open it twice.
  const timeouts = idempotent ? ATTEMPT_TIMEOUTS_MS : [ATTEMPT_TIMEOUTS_MS[ATTEMPT_TIMEOUTS_MS.length - 1]];
  let last;
  for (let i = 0; i < timeouts.length; i += 1) {
    try {
      const { body } = await attempt(path, options, timeouts[i]);
      return body?.data ?? null;
    } catch (err) {
      last = err;
      if (!err.retryable || i === timeouts.length - 1) break;
      await new Promise((r) => setTimeout(r, RETRY_BACKOFF_MS));
    }
  }
  if (last instanceof ApiError) throw last;
  console.error('[lessonVideo] Student service call failed:', path, last?.message);
  throw unavailable();
}

/** Throws 403 unless an administrator has assigned this course to this teacher. */
export async function assertCourseAccess(teacherId, slug) {
  const studentCourseSlug = normSlug(slug);
  if (!SLUG.test(studentCourseSlug)) throw ApiError.badRequest('Invalid course.', 'INVALID_COURSE');
  const allowed = await CourseAccess.exists({ teacher: teacherId, studentCourseSlug });
  if (!allowed) {
    throw ApiError.forbidden('This course has not been assigned to you, so you cannot manage its videos.', 'COURSE_NOT_ASSIGNED');
  }
  return studentCourseSlug;
}

/** The teacher's assigned courses, with lesson and video counts from the student service. */
export async function listManageableCourses(teacherId) {
  const access = await CourseAccess.find({ teacher: teacherId }).select('studentCourseSlug title').lean();
  if (!access.length) return [];
  const slugs = access.map((a) => a.studentCourseSlug);
  const catalog = (await call(`/api/internal/lesson-videos/courses?slugs=${encodeURIComponent(slugs.join(','))}`, { method: 'GET' })) || [];
  const bySlug = new Map(catalog.map((c) => [c.slug, c]));
  // An assignment for a course the student service does not (yet) have is
  // shown rather than hidden, so the teacher can see why it has no lessons.
  return access.map((a) => bySlug.get(a.studentCourseSlug) || {
    slug: a.studentCourseSlug,
    title: a.title || a.studentCourseSlug.toUpperCase(),
    subtitle: '',
    isPublished: false,
    moduleCount: 0,
    lessonCount: 0,
    videoCount: 0,
    publishedVideoCount: 0,
    moduleVideoCount: 0,
    publishedModuleVideoCount: 0,
    modulesWithoutVideo: 0,
  });
}

export async function getCourseVideos(slug) {
  return call(`/api/internal/lesson-videos/courses/${encodeURIComponent(slug)}`, { method: 'GET' });
}

export async function inspectLink(url, provider) {
  return call('/api/internal/lesson-videos/inspect', { method: 'POST', body: JSON.stringify({ url, ...(provider ? { provider } : {}) }) });
}

/** The video history of one assigned course (uploads, replacements, failures). */
export async function listCourseActivity(slug, { limit = 30 } = {}) {
  return call(`/api/internal/lesson-videos/events?slug=${encodeURIComponent(slug)}&limit=${Number(limit) || 30}`, { method: 'GET' });
}

// A video belongs to one lesson or one module: { lessonId } or { moduleId }.
const videoPath = (slug, target) =>
  `/api/internal/lesson-videos/courses/${encodeURIComponent(slug)}/${
    target.moduleId ? `modules/${encodeURIComponent(target.moduleId)}` : `lessons/${encodeURIComponent(target.lessonId)}`
  }`;
const uploadPath = (slug, uploadId) =>
  `/api/internal/lesson-videos/courses/${encodeURIComponent(slug)}/uploads/${encodeURIComponent(uploadId)}`;

export async function saveCourseVideo(slug, target, payload) {
  return call(videoPath(slug, target), { method: 'PUT', body: JSON.stringify(payload) });
}

export async function updateCourseVideo(slug, target, payload) {
  return call(videoPath(slug, target), { method: 'PATCH', body: JSON.stringify(payload) });
}

export async function removeCourseVideo(slug, target, payload) {
  return call(videoPath(slug, target), { method: 'DELETE', body: JSON.stringify(payload) });
}

export async function startCourseVideoUpload(slug, target, payload) {
  return call(`${videoPath(slug, target)}/uploads`, { method: 'POST', body: JSON.stringify(payload) }, { idempotent: false });
}
export async function getCourseVideoPartUrls(slug, uploadId, payload) {
  return call(`${uploadPath(slug, uploadId)}/parts`, { method: 'POST', body: JSON.stringify(payload) });
}
export async function resumeCourseVideoUpload(slug, uploadId, payload) {
  return call(`${uploadPath(slug, uploadId)}/resume`, { method: 'POST', body: JSON.stringify(payload) });
}
// Completing is safe to repeat: the student service answers "processing" or
// the finished result instead of doing the work twice.
export async function completeCourseVideoUpload(slug, uploadId, payload) {
  return call(`${uploadPath(slug, uploadId)}/complete`, { method: 'POST', body: JSON.stringify(payload) });
}
export async function abortCourseVideoUpload(slug, uploadId, payload) {
  return call(uploadPath(slug, uploadId), { method: 'DELETE', body: JSON.stringify(payload) });
}

/** Teachers assigned to a course, for relaying a video change to them live. */
export async function teachersAssignedTo(slug) {
  const rows = await CourseAccess.find({ studentCourseSlug: normSlug(slug) }).select('teacher').lean();
  return [...new Set(rows.map((r) => String(r.teacher)))];
}

export default {
  assertCourseAccess,
  listManageableCourses,
  getCourseVideos,
  inspectLink,
  listCourseActivity,
  saveCourseVideo,
  updateCourseVideo,
  removeCourseVideo,
  startCourseVideoUpload,
  getCourseVideoPartUrls,
  resumeCourseVideoUpload,
  completeCourseVideoUpload,
  abortCourseVideoUpload,
  teachersAssignedTo,
};
