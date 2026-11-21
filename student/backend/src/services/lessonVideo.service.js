import { Course } from '../models/Course.js';
import { VideoUpload } from '../models/VideoUpload.js';
import { CourseVideoEvent } from '../models/CourseVideoEvent.js';
import { AppError } from '../utils/AppError.js';
import { logger } from '../utils/logger.js';
import { stripHtml } from '../utils/sanitize.js';
import { env } from '../config/env.js';
import {
  parseYoutubeUrl,
  isValidYoutubeVideoId,
  youtubeEmbedUrl,
  youtubeWatchUrl,
  youtubeThumbnailUrls,
} from '../utils/youtube.js';
import { parseGoogleDriveUrl, isValidGoogleDriveFileId, googleDriveEmbedUrl, googleDriveViewUrl } from '../utils/googleDrive.js';
import { classifyVideoFile, detectVideoContainer, containerMatches } from '../utils/videoFile.js';
import * as storage from './videoObjectStorage.service.js';
import { broadcastVideoChange } from './videoChangeBroadcast.service.js';

/**
 * Module and lesson videos: the one place they are written.
 *
 * Every module - and every lesson - has at most one primary video, stored as
 * the `video` subdocument of that module or lesson inside Course.modules[]. It
 * is a YouTube video, a Google Drive file, or a file uploaded to private
 * object storage. The Admin and Teacher portals reach this service over the
 * service-key bridge rather than keeping a copy: Admin may manage any course;
 * the teacher portal checks its own CourseAccess record for the course on
 * every request and only forwards what that allows.
 *
 * What this never touches: LessonProgress, XPEvent, ProgressionEvent,
 * Enrollment, a lesson's text, a module's structure. Attaching, replacing or
 * removing a video changes what a module shows, not whether anyone completed
 * it. Every write is a targeted update of one `video` path, guarded by the
 * version the editor loaded (`expectedUpdatedAt`), so two people editing the
 * same module find out instead of silently overwriting each other.
 *
 * After every change the history is written (CourseVideoEvent) and all three
 * portals are told (videoChangeBroadcast.service.js). Those are notices; the
 * course document stays the only source of truth.
 */

// --- Retired fixed video -------------------------------------------------------

/*
 * PRARAMBH used to play one fixed, pre-made file (/PRARAMBH.mp4) on every
 * lesson, set by the seed as each lesson's `videoUrl` and as the course
 * trailer. That file has been removed from the frontends, and PRARAMBH's
 * modules are now managed one by one. Whatever older database rows still
 * point at it are never shown (scripts/removeLegacyPrarambhVideo.js clears
 * them for good), and PRARAMBH shows only videos managed here.
 */
const RETIRED_FIXED_VIDEO = /(^|\/)prarambh\.mp4(?:[?#].*)?$/i;
const MANAGED_ONLY_COURSES = new Set(['prarambh']);

export function isRetiredLegacyVideoUrl(url) {
  return typeof url === 'string' && RETIRED_FIXED_VIDEO.test(url.trim());
}

/** A directly-hosted legacy file a student may still be given, or ''. */
export function legacyVideoUrlFor(courseSlug, url) {
  if (!url || MANAGED_ONLY_COURSES.has(courseSlug) || isRetiredLegacyVideoUrl(url)) return '';
  return url;
}

// --- Availability checks ---------------------------------------------------------

/*
 * YouTube's public oEmbed endpoint needs no API key and is the documented way
 * to ask about a video without scraping its page. Observed answers (checked
 * live, 2026-11-11):
 *   200      public or unlisted, embeddable - with the title;
 *   401/403  embedding disabled OR not publicly viewable (private, removed);
 *   400/404  no such video.
 * 401/403 is ambiguous on its own, so the video's hqdefault thumbnail settles
 * it: a public video always has one, a private or removed one answers 404.
 *
 * Google Drive has no equivalent. Its file page answers (checked live,
 * 2026-11-21): 404 for an id that does not exist, a redirect to Google sign-in
 * for a file that is not shared publicly, and 200 for a file anyone with the
 * link can open. "Not public" is not "unusable" - students signed in with an
 * account the file is shared with can still watch it - so it is reported as
 * restricted, never refused.
 *
 * Anything else - 429, 5xx, a timeout, no network - is "unknown": the save
 * still goes through, and the student's player has its own fallback. A 429
 * pauses checking that provider for a minute.
 */
const CHECK_TIMEOUT_MS = 4000;
const CHECK_CACHE_TTL_MS = 10 * 60 * 1000;
const CHECK_CACHE_MAX = 500;
const RATE_LIMIT_COOLDOWN_MS = 60 * 1000;
const checkCache = new Map();
const pausedUntil = { youtube: 0, google_drive: 0 };

async function timedFetch(url, init = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), CHECK_TIMEOUT_MS);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

async function defaultOembedFetcher(videoId) {
  const target = `https://www.youtube.com/oembed?format=json&url=${encodeURIComponent(youtubeWatchUrl(videoId))}`;
  const res = await timedFetch(target, { headers: { Accept: 'application/json' } });
  const body = res.ok ? await res.json().catch(() => null) : null;
  let thumbnailStatus;
  if (res.status === 401 || res.status === 403) {
    try {
      thumbnailStatus = (await timedFetch(youtubeThumbnailUrls(videoId).hq, { method: 'HEAD' })).status;
    } catch {
      thumbnailStatus = undefined;
    }
  }
  return { status: res.status, body, thumbnailStatus };
}

async function defaultDriveFetcher(fileId, resourceKey) {
  // `manual`: a redirect is the answer (to sign-in = not public), not something to follow.
  const res = await timedFetch(googleDriveViewUrl(fileId, resourceKey), {
    headers: { Accept: 'text/html', 'Accept-Language': 'en' },
    redirect: 'manual',
  });
  const text = res.status === 200 ? (await res.text().catch(() => '')).slice(0, 300_000) : '';
  return { status: res.status, location: res.headers.get('location') || '', text };
}

// Tests run without network access; they install their own fetchers.
let oembedFetcher = process.env.NODE_ENV === 'test' ? null : defaultOembedFetcher;
let driveFetcher = process.env.NODE_ENV === 'test' ? null : defaultDriveFetcher;

/** Test seam: replaces the YouTube oEmbed transport (null disables the check). */
export function setOembedFetcherForTests(fn) {
  oembedFetcher = fn;
  checkCache.clear();
  pausedUntil.youtube = 0;
}

/** Test seam: replaces the Google Drive transport (null disables the check). */
export function setDriveFetcherForTests(fn) {
  driveFetcher = fn;
  checkCache.clear();
  pausedUntil.google_drive = 0;
}

const UNKNOWN = Object.freeze({ availability: 'unknown', title: null, authorName: null });

function remember(key, result) {
  // "unknown" is not cached: it describes this attempt, not the video.
  if (result.availability === 'unknown') return result;
  if (checkCache.size >= CHECK_CACHE_MAX) checkCache.delete(checkCache.keys().next().value);
  checkCache.set(key, { at: Date.now(), result });
  return result;
}

function cached(key, bypassCache) {
  const hit = checkCache.get(key);
  return !bypassCache && hit && Date.now() - hit.at < CHECK_CACHE_TTL_MS ? hit.result : null;
}

export async function checkYoutubeAvailability(videoId, { bypassCache = false } = {}) {
  if (!isValidYoutubeVideoId(videoId)) return { availability: 'unavailable', title: null, authorName: null };
  const key = `yt:${videoId}`;
  const hit = cached(key, bypassCache);
  if (hit) return hit;
  if (!oembedFetcher || Date.now() < pausedUntil.youtube) return UNKNOWN;

  let result = UNKNOWN;
  try {
    const { status, body, thumbnailStatus } = await oembedFetcher(videoId);
    if (status === 200) {
      result = {
        availability: 'available',
        title: typeof body?.title === 'string' ? body.title.slice(0, 200) : null,
        authorName: typeof body?.author_name === 'string' ? body.author_name.slice(0, 120) : null,
      };
    } else if (status === 401 || status === 403) {
      result = { availability: thumbnailStatus === 404 ? 'unavailable' : 'restricted', title: null, authorName: null };
    } else if (status === 400 || status === 404) {
      result = { availability: 'unavailable', title: null, authorName: null };
    } else if (status === 429) {
      pausedUntil.youtube = Date.now() + RATE_LIMIT_COOLDOWN_MS;
      logger.warn(`[lessonVideo] YouTube oEmbed rate-limited this service; pausing checks for ${RATE_LIMIT_COOLDOWN_MS / 1000}s`);
    }
  } catch (err) {
    logger.warn(`[lessonVideo] oEmbed check failed for ${videoId}: ${err.message}`);
  }
  return remember(key, result);
}

const ENTITIES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", '#39': "'", '#x27': "'" };
const decodeEntities = (s) => s.replace(/&(amp|lt|gt|quot|apos|#39|#x27);/g, (_, e) => ENTITIES[e]);
const NON_VIDEO_EXTENSION = /\.(pdf|docx?|xlsx?|pptx?|jpe?g|png|gif|webp|heic|zip|rar|txt|csv|mp3|wav|m4a)$/i;

export async function checkGoogleDriveAvailability(fileId, resourceKey = null, { bypassCache = false } = {}) {
  if (!isValidGoogleDriveFileId(fileId)) return { availability: 'unavailable', title: null, notVideo: false };
  const key = `gd:${fileId}:${resourceKey || ''}`;
  const hit = cached(key, bypassCache);
  if (hit) return hit;
  if (!driveFetcher || Date.now() < pausedUntil.google_drive) return { ...UNKNOWN, notVideo: false };

  let result = { ...UNKNOWN, notVideo: false };
  try {
    const { status, location, text } = await driveFetcher(fileId, resourceKey);
    if (status === 200) {
      const raw =
        text.match(/<meta\s+property="og:title"\s+content="([^"]{1,300})"/i)?.[1] ||
        text.match(/<title>([^<]{1,300})<\/title>/i)?.[1]?.replace(/\s*-\s*Google Drive\s*$/i, '') ||
        null;
      const title = raw ? decodeEntities(raw).trim().slice(0, 200) : null;
      result = { availability: 'available', title, notVideo: Boolean(title && NON_VIDEO_EXTENSION.test(title)) };
    } else if (status >= 300 && status < 400) {
      if (/(^|\/\/)accounts\.google\.com|ServiceLogin/i.test(location)) result = { availability: 'restricted', title: null, notVideo: false };
    } else if (status === 401 || status === 403) {
      result = { availability: 'restricted', title: null, notVideo: false };
    } else if (status === 404) {
      result = { availability: 'unavailable', title: null, notVideo: false };
    } else if (status === 429) {
      pausedUntil.google_drive = Date.now() + RATE_LIMIT_COOLDOWN_MS;
      logger.warn('[lessonVideo] Google Drive rate-limited this service; pausing checks for a minute');
    }
  } catch (err) {
    logger.warn(`[lessonVideo] Google Drive check failed for ${fileId}: ${err.message}`);
  }
  return remember(key, result);
}

// For YouTube, 'restricted' means embedding is off: students get "Watch on
// YouTube". A restricted Drive file still plays for students it is shared with.
const embeddableOf = (provider, availability) => {
  if (provider === 'google_drive' || provider === 'upload') return availability === 'unavailable' ? false : true;
  return availability === 'restricted' ? false : availability === 'available' ? true : null;
};

// --- Shapes ----------------------------------------------------------------------------

function derivedUrls(videoId) {
  const thumbs = youtubeThumbnailUrls(videoId);
  return {
    embedUrl: youtubeEmbedUrl(videoId),
    watchUrl: youtubeWatchUrl(videoId),
    thumbnailUrl: thumbs.hq,
    thumbnailMaxUrl: thumbs.maxres,
  };
}

/** Whether a stored video record is complete enough to be shown at all. */
function isUsable(video) {
  if (!video?.provider) return false;
  if (video.provider === 'youtube') return isValidYoutubeVideoId(video.videoId);
  if (video.provider === 'google_drive') return isValidGoogleDriveFileId(video.externalVideoId);
  if (video.provider === 'upload') {
    return Boolean(video.storageKey) && video.uploadStatus === 'completed' && video.processingStatus === 'verified';
  }
  return false;
}

/** A short description of a video for the history: never a URL or a storage key. */
function refOf(video) {
  if (!video?.provider) return null;
  const ref =
    video.provider === 'youtube' ? video.videoId : video.provider === 'google_drive' ? video.externalVideoId : video.fileName || 'uploaded file';
  return { provider: video.provider, ref: ref ? String(ref).slice(0, 300) : null, isPublished: Boolean(video.isPublished) };
}

async function playbackFor(video) {
  try {
    return await storage.signedPlaybackUrl(video.storageKey, { contentType: video.mimeType || undefined });
  } catch (err) {
    logger.warn(`[lessonVideo] could not sign a playback URL: ${err.code || err.message}`);
    return null;
  }
}

/** Everything an editor needs, including draft state. Never sent to students. */
export async function shapeVideoForEditor(video, { withPlayback = true } = {}) {
  if (!isUsable(video)) return null;
  const provider = video.provider;
  const shaped = {
    provider,
    videoId: provider === 'youtube' ? video.videoId : null,
    externalVideoId: provider === 'google_drive' ? video.externalVideoId : null,
    externalResourceKey: provider === 'google_drive' ? video.externalResourceKey || null : null,
    originalUrl: video.originalUrl || '',
    uploadId: provider === 'upload' && video.uploadId ? String(video.uploadId) : null,
    fileName: video.fileName || '',
    fileSize: video.fileSize ?? null,
    duration: video.duration ?? null,
    mimeType: video.mimeType || '',
    uploadStatus: video.uploadStatus || null,
    processingStatus: video.processingStatus || null,
    uploadedAt: video.uploadedAt || null,
    title: video.title || '',
    description: video.description || '',
    playbackMode: provider === 'youtube' ? video.playbackMode || 'embed' : 'embed',
    isPublished: Boolean(video.isPublished),
    publishedAt: video.publishedAt || null,
    availability: video.availability || 'unknown',
    embeddable: embeddableOf(provider, video.availability),
    checkedAt: video.checkedAt || null,
    updatedAt: video.updatedAt || null,
    updatedBy: video.updatedBy?.portal ? { portal: video.updatedBy.portal, name: video.updatedBy.name || null } : null,
  };
  if (provider === 'youtube') Object.assign(shaped, derivedUrls(video.videoId));
  if (provider === 'google_drive') {
    shaped.embedUrl = googleDriveEmbedUrl(video.externalVideoId, video.externalResourceKey);
    shaped.watchUrl = googleDriveViewUrl(video.externalVideoId, video.externalResourceKey);
  }
  if (provider === 'upload' && withPlayback) {
    const playback = await playbackFor(video);
    shaped.streamUrl = playback?.url || null;
    shaped.streamExpiresAt = playback?.expiresAt || null;
  }
  return shaped;
}

/** The student-safe projection of a published video. */
async function publishedVideoForStudent(managed) {
  if (!isUsable(managed)) return null;
  const base = { provider: managed.provider, title: managed.title || '', description: managed.description || '' };
  if (managed.provider === 'upload') {
    const playback = await playbackFor(managed);
    return {
      ...base,
      title: base.title || managed.fileName || '',
      fileSize: managed.fileSize ?? null,
      duration: managed.duration ?? null,
      mimeType: managed.mimeType || 'video/mp4',
      // Signed for this response only; never cached or stored. Null when the
      // storage provider cannot be reached - the player says so instead of
      // showing a dead frame.
      streamUrl: playback?.url || null,
      streamExpiresAt: playback?.expiresAt || null,
    };
  }
  if (managed.provider === 'google_drive') {
    return {
      ...base,
      externalVideoId: managed.externalVideoId,
      externalResourceKey: managed.externalResourceKey || null,
      // 'restricted' = not shared publicly: the player tells students to sign
      // in with the Google account the file is shared with.
      availability: managed.availability || 'unknown',
      embeddable: true,
      embedUrl: googleDriveEmbedUrl(managed.externalVideoId, managed.externalResourceKey),
      watchUrl: googleDriveViewUrl(managed.externalVideoId, managed.externalResourceKey),
    };
  }
  return {
    ...base,
    videoId: managed.videoId,
    playbackMode: managed.playbackMode || 'embed',
    embeddable: embeddableOf('youtube', managed.availability),
    ...derivedUrls(managed.videoId),
  };
}

/**
 * What a student may see of a lesson's video.
 *
 * A managed video reaches a student only once published (and, for an upload,
 * only once its file was verified); a draft is not sent at all, not even its
 * id. Lessons nobody has managed keep their legacy `videoUrl` - unless it is
 * the retired fixed PRARAMBH file - and when that legacy value is itself a
 * YouTube link it is played through the same embed.
 */
export async function shapeLessonVideoForStudent(lesson, { courseSlug = '' } = {}) {
  const managed = lesson.video?.provider ? lesson.video : null;
  if (managed) {
    if (!managed.isPublished) return { video: null, videoUrl: '', videoManaged: true };
    return { video: await publishedVideoForStudent(managed), videoUrl: '', videoManaged: true };
  }

  const legacy = legacyVideoUrlFor(courseSlug, lesson.videoUrl || '');
  const parsed = legacy ? parseYoutubeUrl(legacy) : null;
  if (parsed?.ok) {
    return {
      video: { provider: 'youtube', videoId: parsed.videoId, title: '', description: '', playbackMode: 'embed', embeddable: null, ...derivedUrls(parsed.videoId) },
      videoUrl: '',
      videoManaged: false,
    };
  }
  return { video: null, videoUrl: legacy, videoManaged: false };
}

/** A module's own video, published only; null otherwise. */
export async function shapeModuleVideoForStudent(mod) {
  const managed = mod.video?.provider ? mod.video : null;
  return managed?.isPublished ? publishedVideoForStudent(managed) : null;
}

// --- Reads -----------------------------------------------------------------------------

/** Every course with modules, including unpublished ones (GARUD/YODDHA are not on the public purchase path). */
export async function listVideoCatalog({ slugs } = {}) {
  const filter = slugs ? { slug: { $in: slugs } } : {};
  const courses = await Course.find(filter)
    .select('slug title subtitle isPublished modules.moduleId modules.video.provider modules.video.isPublished modules.lessons.lessonId modules.lessons.video.provider modules.lessons.video.isPublished')
    .sort({ createdAt: 1 })
    .lean();
  return courses.map((c) => {
    let lessonCount = 0;
    let videoCount = 0;
    let publishedCount = 0;
    let moduleVideoCount = 0;
    let publishedModuleVideoCount = 0;
    for (const m of c.modules || []) {
      if (m.video?.provider) {
        moduleVideoCount += 1;
        if (m.video.isPublished) publishedModuleVideoCount += 1;
      }
      for (const l of m.lessons || []) {
        lessonCount += 1;
        if (l.video?.provider) {
          videoCount += 1;
          if (l.video.isPublished) publishedCount += 1;
        }
      }
    }
    const moduleCount = (c.modules || []).length;
    return {
      slug: c.slug,
      title: c.title,
      subtitle: c.subtitle || '',
      isPublished: c.isPublished !== false,
      moduleCount,
      lessonCount,
      videoCount,
      publishedVideoCount: publishedCount,
      moduleVideoCount,
      publishedModuleVideoCount,
      modulesWithoutVideo: moduleCount - moduleVideoCount,
    };
  });
}

const IN_PROGRESS = ['uploading', 'processing', 'verified'];

function shapeUploadSummary(u) {
  return {
    uploadId: String(u._id),
    status: u.status,
    fileName: u.fileName,
    fileSize: u.fileSize,
    startedAt: u.createdAt,
    expiresAt: u.expiresAt,
    actor: { portal: u.actor?.portal || null, name: u.actor?.name || null },
  };
}

export async function getCourseVideos(slug) {
  const course = await Course.findOne({ slug }).select('_id slug title isPublished modules').lean();
  if (!course) throw AppError.notFound('Course not found', 'COURSE_NOT_FOUND');

  const uploads = await VideoUpload.find({ courseId: course._id, status: { $in: IN_PROGRESS } })
    .select('targetType targetId status fileName fileSize createdAt expiresAt actor')
    .sort({ createdAt: -1 })
    .lean();
  const activeUploads = new Map();
  for (const u of uploads) {
    const key = `${u.targetType}:${u.targetId}`;
    if (!activeUploads.has(key)) activeUploads.set(key, shapeUploadSummary(u));
  }

  const modules = await Promise.all(
    [...(course.modules || [])]
      .sort((a, b) => a.order - b.order)
      .map(async (m) => ({
        moduleId: m.moduleId,
        title: m.title,
        order: m.order,
        video: await shapeVideoForEditor(m.video),
        activeUpload: activeUploads.get(`module:${m.moduleId}`) || null,
        lessons: await Promise.all(
          [...(m.lessons || [])]
            .sort((a, b) => a.order - b.order)
            .map(async (l) => ({
              lessonId: l.lessonId,
              title: l.title,
              order: l.order,
              duration: l.duration || '',
              isPublished: l.isPublished !== false,
              isLocked: Boolean(l.isLocked),
              video: await shapeVideoForEditor(l.video),
              activeUpload: activeUploads.get(`lesson:${l.lessonId}`) || null,
              // Shown to the editor so "Remove" is not a surprise: removing a
              // video also clears this older directly-hosted file.
              legacyVideoUrl: l.video?.provider ? '' : legacyVideoUrlFor(course.slug, l.videoUrl || ''),
            }))
        ),
      }))
  );

  return {
    slug: course.slug,
    title: course.title,
    isPublished: course.isPublished !== false,
    uploadsEnabled: storage.isVideoStorageConfigured(),
    maxUploadBytes: env.videoStorage.maxUploadBytes,
    modules,
  };
}

/** The video history, newest first - all courses or one, optionally only warnings and errors. */
export async function listVideoEvents({ slug, slugs, level, limit = 50, before } = {}) {
  const filter = {};
  if (slug) filter.courseSlug = slug;
  else if (slugs) filter.courseSlug = { $in: slugs };
  if (level === 'problems') filter.level = { $in: ['warn', 'error'] };
  else if (level) filter.level = level;
  if (before) filter.createdAt = { $lt: new Date(before) };
  const rows = await CourseVideoEvent.find(filter)
    .sort({ createdAt: -1 })
    .limit(Math.min(Math.max(Number(limit) || 50, 1), 200))
    .lean();
  return rows.map((e) => ({
    id: String(e._id),
    at: e.createdAt,
    courseSlug: e.courseSlug,
    targetType: e.targetType,
    targetId: e.targetId,
    moduleId: e.moduleId,
    action: e.action,
    level: e.level,
    video: e.video || null,
    previous: e.previous || null,
    uploadId: e.uploadId ? String(e.uploadId) : null,
    message: e.message || '',
    actor: { portal: e.actor?.portal || 'system', name: e.actor?.name || null },
  }));
}

/**
 * Parses a pasted link and asks its provider about it, without saving
 * anything. `provider` restricts which kind of link is accepted, so the Drive
 * tab explains that a YouTube link belongs in the YouTube tab.
 */
export async function inspectLink(url, { provider } = {}) {
  if (provider !== 'google_drive') {
    const youtube = parseYoutubeUrl(url);
    if (youtube.ok) {
      const check = await checkYoutubeAvailability(youtube.videoId);
      return {
        provider: 'youtube',
        videoId: youtube.videoId,
        canonicalUrl: youtube.canonicalUrl,
        ...derivedUrls(youtube.videoId),
        availability: check.availability,
        embeddable: embeddableOf('youtube', check.availability),
        title: check.title,
        authorName: check.authorName,
      };
    }
    if (provider === 'youtube') throw AppError.unprocessable(youtube.message, youtube.code);
  }
  const drive = parseGoogleDriveUrl(url);
  if (!drive.ok) {
    if (provider === 'google_drive') throw AppError.unprocessable(drive.message, drive.code);
    throw AppError.unprocessable('Paste a YouTube or Google Drive video link.', drive.code === 'EMPTY_URL' ? 'EMPTY_URL' : 'UNSUPPORTED_PROVIDER');
  }
  const check = await checkGoogleDriveAvailability(drive.fileId, drive.resourceKey);
  return {
    provider: 'google_drive',
    externalVideoId: drive.fileId,
    externalResourceKey: drive.resourceKey,
    canonicalUrl: drive.canonicalUrl,
    embedUrl: drive.embedUrl,
    watchUrl: drive.canonicalUrl,
    availability: check.availability,
    embeddable: embeddableOf('google_drive', check.availability),
    title: check.title,
    notVideo: Boolean(check.notVideo),
  };
}

/** Kept for existing callers. */
export const inspectYoutubeLink = (url) => inspectLink(url);

// --- Targets -----------------------------------------------------------------------------

/*
 * A target is one lesson ({ lessonId }) or one module ({ moduleId }). Both are
 * located on a fresh read, then written by position-independent arrayFilters,
 * so reordering lessons between the read and the write cannot misdirect it.
 */
async function locate(slug, target) {
  const course = await Course.findOne({ slug }).select('_id slug modules.moduleId modules.video modules.lessons').lean();
  if (!course) throw AppError.notFound('Course not found', 'COURSE_NOT_FOUND');
  if (target.moduleId) {
    const mod = (course.modules || []).find((m) => m.moduleId === target.moduleId);
    if (!mod) throw AppError.notFound('Module not found in this course', 'MODULE_NOT_FOUND');
    return { course, moduleId: mod.moduleId, node: mod };
  }
  for (const m of course.modules || []) {
    const lesson = (m.lessons || []).find((l) => l.lessonId === target.lessonId);
    if (lesson) return { course, moduleId: m.moduleId, node: lesson };
  }
  throw AppError.notFound('Lesson not found in this course', 'LESSON_NOT_FOUND');
}

function paths(target) {
  if (target.moduleId) {
    return { video: 'modules.$[m].video', videoUrl: null, arrayFilters: (moduleId) => [{ 'm.moduleId': moduleId }] };
  }
  return {
    video: 'modules.$[m].lessons.$[l].video',
    videoUrl: 'modules.$[m].lessons.$[l].videoUrl',
    arrayFilters: (moduleId) => [{ 'm.moduleId': moduleId }, { 'l.lessonId': target.lessonId }],
  };
}

const labelOf = (target) => (target.moduleId ? `module ${target.moduleId}` : target.lessonId);

/**
 * The write filter. With no `expectedUpdatedAt` it matches the course; with
 * one, it matches only while the target's video is still the version the
 * editor loaded (null meaning "had no video"). A miss is a 409, not a write.
 */
function guardFilter(courseId, moduleId, target, expectedUpdatedAt) {
  if (expectedUpdatedAt === undefined) return { _id: courseId };
  const cond = expectedUpdatedAt === null ? { 'video.provider': { $exists: false } } : { 'video.updatedAt': new Date(expectedUpdatedAt) };
  if (target.moduleId) return { _id: courseId, modules: { $elemMatch: { moduleId, ...cond } } };
  return { _id: courseId, modules: { $elemMatch: { moduleId, lessons: { $elemMatch: { lessonId: target.lessonId, ...cond } } } } };
}

async function conflict(slug, target, extra = {}) {
  const { node } = await locate(slug, target);
  const current = await shapeVideoForEditor(node.video);
  const who = current?.updatedBy?.name ? ` by ${current.updatedBy.name}` : '';
  const err = new AppError(
    `This video was changed${who} since you opened it. Reload to see the current version before saving.`,
    409,
    'VIDEO_CHANGED',
    { current, ...extra }
  );
  // The editor needs the current version to recover, in production too.
  err.exposeDetails = true;
  return err;
}

function cleanText(value, max) {
  if (typeof value !== 'string') return '';
  // Control characters (other than newlines in a description) never belong in
  // a title, and markup is stripped on the way in like every other free text.
  return stripHtml(value.replace(/[\u0000-\u0009\u000B-\u001F\u007F]/g, '')).slice(0, max);
}

function actorOf(actor) {
  return {
    portal: actor?.portal === 'teacher' ? 'teacher' : 'admin',
    userId: actor?.userId ? String(actor.userId).slice(0, 64) : null,
    name: actor?.name ? String(actor.name).slice(0, 120) : null,
  };
}

// --- History and notices ---------------------------------------------------------------

async function recordEvent({ course, moduleId, target, action, level = 'info', video, previous, actor, uploadId, message }) {
  try {
    await CourseVideoEvent.create({
      courseId: course._id,
      courseSlug: course.slug,
      targetType: target.moduleId ? 'module' : 'lesson',
      targetId: target.moduleId || target.lessonId,
      moduleId: moduleId || target.moduleId || null,
      action,
      level,
      video: refOf(video),
      previous: refOf(previous),
      uploadId: uploadId || null,
      message: message ? String(message).slice(0, 500) : '',
      actor: actor ? { portal: actor.portal || 'system', userId: actor.userId || null, name: actor.name || null } : { portal: 'system' },
    });
  } catch (err) {
    // History must never undo a change that already happened.
    logger.warn(`[lessonVideo] could not record video history: ${err.message}`);
  }
}

function notify({ course, moduleId, target, action, video, actor, students = true }) {
  broadcastVideoChange(
    {
      courseId: course._id,
      slug: course.slug,
      moduleId: moduleId || target.moduleId || null,
      lessonId: target.lessonId || null,
      action,
      provider: video?.provider || null,
      isPublished: video ? Boolean(video.isPublished) : null,
      version: video?.updatedAt ? new Date(video.updatedAt).toISOString() : null,
      actor,
    },
    { students }
  ).catch((err) => logger.warn(`[lessonVideo] change notice failed: ${err.message}`));
}

// --- Stored-object lifecycle -------------------------------------------------------------

/*
 * A replaced or removed upload is not deleted on the spot. Students who loaded
 * the page a moment earlier hold a signed URL for it and may be mid-video; the
 * object is kept until every URL that could have been issued has expired, then
 * the storage sweep deletes it - after checking that no module or lesson has
 * come to point at it again.
 */
const RETIRE_GRACE_MS = (storage.PLAYBACK_URL_TTL_SECONDS + 10 * 60) * 1000;

async function retireStoredObject(video, { immediately = false } = {}) {
  if (video?.provider !== 'upload' || !video.storageKey) return;
  const now = new Date();
  const res = await VideoUpload.updateOne(
    { objectKey: video.storageKey, status: { $in: ['completed', 'verified', 'processing', 'failed'] } },
    { $set: { status: 'retired', retiredAt: now, deleteAfter: immediately ? now : new Date(now.getTime() + RETIRE_GRACE_MS) } }
  );
  if (!res.matchedCount) logger.warn(`[lessonVideo] retired object has no upload record; it will not be cleaned up automatically: ${video.storageKey}`);
}

async function isObjectReferenced(storageKey) {
  return Boolean(
    await Course.exists({ $or: [{ 'modules.video.storageKey': storageKey }, { 'modules.lessons.video.storageKey': storageKey }] })
  );
}

// --- Link writes ----------------------------------------------------------------------------

/**
 * Creates or replaces the video of one lesson or module with a YouTube or
 * Google Drive link. The new link is parsed and checked before anything is
 * written; if it fails, the previous video stays exactly as it was.
 *
 * `isPublished` is the editor's decision, but a link its provider says does
 * not exist is never published - students would get a dead player.
 */
export async function upsertVideo(slug, target, input, actorInput) {
  const { course, moduleId, node } = await locate(slug, target);
  const actor = actorOf(actorInput);
  const previous = node.video?.provider ? node.video : null;
  const provider = input.provider === 'google_drive' ? 'google_drive' : 'youtube';

  let videoId = null;
  let externalVideoId = null;
  let externalResourceKey = null;
  let originalUrl;
  let check;
  if (provider === 'youtube') {
    const parsed = parseYoutubeUrl(input.url);
    if (!parsed.ok) throw AppError.unprocessable(parsed.message, parsed.code);
    videoId = parsed.videoId;
    originalUrl = parsed.canonicalUrl;
    check = await checkYoutubeAvailability(videoId);
  } else {
    const parsed = parseGoogleDriveUrl(input.url);
    if (!parsed.ok) throw AppError.unprocessable(parsed.message, parsed.code);
    externalVideoId = parsed.fileId;
    externalResourceKey = parsed.resourceKey;
    originalUrl = parsed.canonicalUrl;
    check = await checkGoogleDriveAvailability(externalVideoId, externalResourceKey);
  }

  // A temporary verification outage should not demote an identical working link.
  const samePrevious =
    previous?.provider === provider &&
    (provider === 'youtube' ? previous.videoId === videoId : previous.externalVideoId === externalVideoId);
  const availability = check.availability === 'unknown' && samePrevious ? previous.availability || 'unknown' : check.availability;
  const isPublished = Boolean(input.isPublished);
  if (isPublished && availability === 'unavailable') {
    throw AppError.unprocessable(
      provider === 'youtube'
        ? 'YouTube reports that this video does not exist or is private, so it cannot be published.'
        : 'Google Drive reports that this file does not exist, so it cannot be published.',
      'VIDEO_UNAVAILABLE'
    );
  }

  const now = new Date();
  const video = {
    provider,
    videoId,
    externalVideoId,
    externalResourceKey,
    originalUrl,
    title: cleanText(input.title, 200) || (check.title ? cleanText(check.title, 200) : ''),
    description: cleanText(input.description, 2000),
    playbackMode: provider === 'youtube' && input.playbackMode === 'external' ? 'external' : 'embed',
    isPublished,
    publishedAt: isPublished ? (previous?.isPublished && previous.publishedAt && samePrevious ? previous.publishedAt : now) : null,
    availability,
    checkedAt: check.availability === 'unknown' ? (samePrevious ? previous?.checkedAt || null : null) : now,
    updatedAt: now,
    updatedBy: actor,
  };

  const p = paths(target);
  const result = await Course.updateOne(
    guardFilter(course._id, moduleId, target, input.expectedUpdatedAt),
    { $set: { [p.video]: video } },
    { arrayFilters: p.arrayFilters(moduleId), runValidators: true }
  );
  if (!result.matchedCount) throw await conflict(slug, target);

  if (previous?.provider === 'upload') await retireStoredObject(previous);

  const action = isPublished ? 'published' : previous?.isPublished ? 'unpublished' : 'link_saved';
  logger.info(`[lessonVideo] ${actor.portal}:${actor.userId || '?'} set ${slug}/${labelOf(target)} -> ${provider}:${videoId || externalVideoId} (published=${isPublished}, availability=${availability})`);
  await recordEvent({ course, moduleId, target, action, video, previous, actor });
  notify({ course, moduleId, target, action, video, actor, students: isPublished || Boolean(previous?.isPublished) });

  return {
    lessonId: target.lessonId || null,
    moduleId: target.moduleId || moduleId,
    video: await shapeVideoForEditor(video),
    previousVideoId: refOf(previous)?.ref || null,
    previousProvider: previous?.provider || null,
    wasPublished: Boolean(previous?.isPublished),
  };
}

/**
 * Changes the title, description or visibility of the video already on a
 * module or lesson, whatever its source - including an uploaded file, which
 * cannot be "re-saved" from a link.
 */
export async function updateVideoDetails(slug, target, input, actorInput) {
  const { course, moduleId, node } = await locate(slug, target);
  const actor = actorOf(actorInput);
  const current = node.video?.provider ? node.video : null;
  if (!current) throw AppError.notFound('There is no video here to update.', 'VIDEO_NOT_FOUND');

  const isPublished = input.isPublished === undefined ? Boolean(current.isPublished) : Boolean(input.isPublished);
  if (isPublished && !current.isPublished && current.availability === 'unavailable') {
    throw AppError.unprocessable('This video is reported unavailable, so it cannot be published.', 'VIDEO_UNAVAILABLE');
  }
  const now = new Date();
  const base = paths(target).video;
  const set = {
    [`${base}.isPublished`]: isPublished,
    [`${base}.publishedAt`]: isPublished ? current.publishedAt || now : null,
    [`${base}.updatedAt`]: now,
    [`${base}.updatedBy`]: actor,
  };
  if (input.title !== undefined) set[`${base}.title`] = cleanText(input.title, 200) || (current.provider === 'upload' ? current.fileName : '');
  if (input.description !== undefined) set[`${base}.description`] = cleanText(input.description, 2000);
  if (input.playbackMode !== undefined && current.provider === 'youtube') set[`${base}.playbackMode`] = input.playbackMode === 'external' ? 'external' : 'embed';

  const p = paths(target);
  const result = await Course.updateOne(guardFilter(course._id, moduleId, target, input.expectedUpdatedAt), { $set: set }, {
    arrayFilters: p.arrayFilters(moduleId),
    runValidators: true,
  });
  if (!result.matchedCount) throw await conflict(slug, target);

  const { node: after } = await locate(slug, target);
  const action = isPublished === Boolean(current.isPublished) ? 'link_saved' : isPublished ? 'published' : 'unpublished';
  await recordEvent({ course, moduleId, target, action, video: after.video, previous: current, actor, message: 'Details updated' });
  notify({ course, moduleId, target, action, video: after.video, actor, students: isPublished || Boolean(current.isPublished) });
  return { lessonId: target.lessonId || null, moduleId: target.moduleId || moduleId, video: await shapeVideoForEditor(after.video) };
}

/**
 * Removes the video from one lesson or module. On a lesson the older
 * directly-hosted `videoUrl` goes too, so "remove" leaves the lesson without a
 * video of its own rather than quietly bringing back whatever file it had.
 * An uploaded file is retired, then deleted once that is safe.
 */
export async function removeVideo(slug, target, actorInput, { expectedUpdatedAt } = {}) {
  const { course, moduleId, node } = await locate(slug, target);
  const actor = actorOf(actorInput);
  const previous = node.video?.provider ? node.video : null;
  const hadVideo = Boolean(previous) || Boolean(!target.moduleId && node.videoUrl);
  if (!hadVideo) return { lessonId: target.lessonId || null, moduleId: target.moduleId || moduleId, removed: false, previousVideoId: null };

  const p = paths(target);
  const update = { $unset: { [p.video]: '' } };
  if (p.videoUrl) update.$set = { [p.videoUrl]: '' };
  const result = await Course.updateOne(guardFilter(course._id, moduleId, target, expectedUpdatedAt), update, {
    arrayFilters: p.arrayFilters(moduleId),
  });
  if (!result.matchedCount) throw await conflict(slug, target);

  logger.info(`[lessonVideo] ${actor.portal}:${actor.userId || '?'} removed video from ${slug}/${labelOf(target)}`);
  if (previous?.provider === 'upload') await retireStoredObject(previous);
  await recordEvent({ course, moduleId, target, action: 'removed', previous, actor });
  notify({ course, moduleId, target, action: 'removed', video: null, actor, students: true });
  return {
    lessonId: target.lessonId || null,
    moduleId: target.moduleId || moduleId,
    removed: true,
    previousVideoId: refOf(previous)?.ref || null,
    previousProvider: previous?.provider || null,
  };
}

// Lesson-named wrappers, kept because they read naturally at the call sites.
export const upsertLessonVideo = (slug, lessonId, input, actor) => upsertVideo(slug, { lessonId }, input, actor);
export const removeLessonVideo = (slug, lessonId, actor, opts) => removeVideo(slug, { lessonId }, actor, opts);

// --- Uploads ----------------------------------------------------------------------------------

/*
 * The browser uploads straight to private storage in parts (multipart upload),
 * each to its own presigned URL, several at a time:
 *
 *   start    -> validates the file's name, type and size, opens a multipart
 *               session at the storage provider, records it here
 *   parts    -> presigned URLs for a batch of part numbers
 *   resume   -> which parts the provider already holds (after a failure, a
 *               refresh or a lost connection only the missing ones are sent)
 *   complete -> assembles the parts, checks the stored size and reads the
 *               file's first bytes back to confirm it really is a video,
 *               then attaches it to the module - only now can students see it
 *   abort    -> abandons the session and its parts
 *
 * A file is never visible to students while it is uploading or processing.
 * The previous video keeps playing until the new one is verified and attached.
 */
const UPLOAD_IDLE_EXPIRY_MS = 24 * 60 * 60 * 1000;
const PROCESSING_TIMEOUT_MS = 30 * 60 * 1000;
const MAX_ACTIVE_UPLOADS_PER_ACTOR = 3;
const MAX_PART_URLS_PER_REQUEST = 50;

function uploadActor(actor) {
  if (!actor?.userId || !['admin', 'teacher'].includes(actor.portal)) {
    throw AppError.forbidden('A signed-in administrator or teacher is required to upload a video.', 'UPLOAD_ACTOR_REQUIRED');
  }
  return actorOf(actor);
}

function requireStorage() {
  if (!storage.isVideoStorageConfigured()) {
    throw new AppError(
      'Video uploads are not available yet: private video storage has not been configured on the server. YouTube and Google Drive links still work.',
      503,
      'VIDEO_STORAGE_NOT_CONFIGURED'
    );
  }
}

const targetOfUpload = (upload) => (upload.targetType === 'module' ? { moduleId: upload.targetId } : { lessonId: upload.targetId });

/** An upload session, if it belongs to this course and this actor may manage it. */
async function getUploadFor(slug, uploadId, actor) {
  const upload = await VideoUpload.findById(uploadId);
  if (!upload || upload.courseSlug !== slug) throw AppError.notFound('Upload session not found.', 'UPLOAD_NOT_FOUND');
  // A teacher manages only their own sessions; an administrator may manage any.
  const own = upload.actor?.portal === actor.portal && upload.actor?.userId === actor.userId;
  if (!own && actor.portal !== 'admin') throw AppError.forbidden('This upload was started by someone else.', 'UPLOAD_FORBIDDEN');
  return upload;
}

function expectedPartSize(upload, partNumber) {
  return partNumber < upload.totalParts ? upload.partSize : upload.fileSize - upload.partSize * (upload.totalParts - 1);
}

function shapeSession(upload, uploadedParts) {
  return {
    uploadId: String(upload._id),
    status: upload.status,
    fileName: upload.fileName,
    fileSize: upload.fileSize,
    mimeType: upload.mimeType,
    partSize: upload.partSize,
    totalParts: upload.totalParts,
    expiresAt: upload.expiresAt,
    failureCode: upload.failureCode || null,
    failureReason: upload.failureReason || null,
    ...(uploadedParts ? { uploadedParts } : {}),
  };
}

export async function startUpload(slug, target, input, actorInput) {
  requireStorage();
  const actor = uploadActor(actorInput);
  const file = classifyVideoFile({ fileName: input.fileName, mimeType: input.mimeType });
  if (!file.ok) {
    throw AppError.unprocessable(
      file.code === 'VIDEO_TYPE_MISMATCH'
        ? 'The file type does not match its extension. Upload an MP4, MOV, WEBM or MKV video.'
        : 'Upload an MP4, MOV, WEBM or MKV video file.',
      file.code
    );
  }
  const fileSize = Number(input.fileSize);
  if (!Number.isSafeInteger(fileSize) || fileSize < 1) throw AppError.unprocessable('The selected video file is empty.', 'INVALID_VIDEO_SIZE');
  const max = env.videoStorage.maxUploadBytes;
  if (fileSize > max) {
    throw AppError.unprocessable(`This video is larger than the ${Math.floor(max / 1024 ** 3)} GB upload limit.`, 'VIDEO_TOO_LARGE');
  }

  const active = await VideoUpload.countDocuments({
    'actor.portal': actor.portal,
    'actor.userId': actor.userId,
    status: { $in: ['uploading', 'processing'] },
    expiresAt: { $gt: new Date() },
  });
  if (active >= MAX_ACTIVE_UPLOADS_PER_ACTOR) {
    throw new AppError(
      `You already have ${active} uploads in progress. Finish or cancel one before starting another.`,
      429,
      'TOO_MANY_ACTIVE_UPLOADS'
    );
  }

  const { course, moduleId, node } = await locate(slug, target);
  const objectKey = storage.createObjectKey(course._id, file.extension);
  const partSize = storage.partSizeFor(fileSize);
  const multipartUploadId = await storage.initiateMultipartUpload({ key: objectKey, contentType: file.mimeType, fileName: file.fileName });

  let upload;
  try {
    upload = await VideoUpload.create({
      courseId: course._id,
      courseSlug: course.slug,
      targetType: target.moduleId ? 'module' : 'lesson',
      targetId: target.moduleId || target.lessonId,
      moduleId,
      objectKey,
      multipartUploadId,
      partSize,
      totalParts: Math.ceil(fileSize / partSize),
      fileName: file.fileName,
      fileSize,
      mimeType: file.mimeType,
      title: cleanText(input.title, 200),
      description: cleanText(input.description, 2000),
      isPublished: input.isPublished !== false,
      // Undefined = attach regardless; null = only if there is still no video.
      ...(input.expectedUpdatedAt !== undefined ? { expectedUpdatedAt: input.expectedUpdatedAt } : {}),
      actor,
      expiresAt: new Date(Date.now() + UPLOAD_IDLE_EXPIRY_MS),
    });
  } catch (err) {
    await storage.abortMultipartUpload({ key: objectKey, uploadId: multipartUploadId });
    throw err;
  }

  logger.info(`[lessonVideo] ${actor.portal}:${actor.userId} started an upload for ${slug}/${labelOf(target)} (${file.fileName}, ${fileSize} bytes, ${upload.totalParts} parts)`);
  await recordEvent({
    course,
    moduleId,
    target,
    action: 'upload_started',
    video: { provider: 'upload', fileName: file.fileName },
    previous: node.video,
    actor,
    uploadId: upload._id,
  });
  notify({ course, moduleId, target, action: 'upload_started', video: null, actor, students: false });
  return shapeSession(upload);
}

export async function getUploadPartUrls(slug, uploadId, input, actorInput) {
  requireStorage();
  const actor = uploadActor(actorInput);
  const upload = await getUploadFor(slug, uploadId, actor);
  if (upload.status !== 'uploading') {
    throw AppError.conflict(`This upload is ${upload.status} and no longer accepts file parts.`, 'UPLOAD_NOT_WRITABLE');
  }
  const numbers = Array.isArray(input.partNumbers) ? [...new Set(input.partNumbers.map(Number))] : [];
  if (
    !numbers.length ||
    numbers.length > MAX_PART_URLS_PER_REQUEST ||
    numbers.some((n) => !Number.isInteger(n) || n < 1 || n > upload.totalParts)
  ) {
    throw AppError.unprocessable('Invalid upload part numbers.', 'INVALID_UPLOAD_PARTS');
  }
  // Activity keeps a long upload alive.
  upload.expiresAt = new Date(Date.now() + UPLOAD_IDLE_EXPIRY_MS);
  await upload.save();
  const parts = await Promise.all(
    numbers
      .sort((a, b) => a - b)
      .map(async (partNumber) => ({
        partNumber,
        size: expectedPartSize(upload, partNumber),
        url: await storage.partUploadUrl({ key: upload.objectKey, uploadId: upload.multipartUploadId, partNumber }),
      }))
  );
  return { uploadId: String(upload._id), expiresIn: storage.PART_URL_TTL_SECONDS, parts };
}

/** Where an upload stands, including the parts storage already holds (for resuming). */
export async function resumeUpload(slug, uploadId, actorInput) {
  requireStorage();
  const actor = uploadActor(actorInput);
  const upload = await getUploadFor(slug, uploadId, actor);
  if (upload.status !== 'uploading') return shapeSession(upload);

  let parts;
  try {
    parts = await storage.listUploadedParts({ key: upload.objectKey, uploadId: upload.multipartUploadId });
  } catch (err) {
    if (err.code === 'UPLOAD_EXPIRED') {
      upload.status = 'expired';
      upload.failureCode = 'UPLOAD_EXPIRED';
      upload.failureReason = 'The storage provider no longer has this upload session.';
      await upload.save();
      return shapeSession(upload, []);
    }
    throw err;
  }
  upload.expiresAt = new Date(Date.now() + UPLOAD_IDLE_EXPIRY_MS);
  await upload.save();
  // A part only counts if it is complete: a cut-off part is uploaded again.
  const uploadedParts = parts
    .filter((p) => p.partNumber >= 1 && p.partNumber <= upload.totalParts && p.size === expectedPartSize(upload, p.partNumber))
    .map((p) => ({ partNumber: p.partNumber, size: p.size }));
  return shapeSession(upload, uploadedParts);
}

async function failUpload(upload, code, reason, { course, moduleId } = {}) {
  upload.status = 'failed';
  upload.failureCode = code;
  upload.failureReason = String(reason).slice(0, 400);
  await upload.save();
  // The parts or the assembled object are useless now; clean up whichever exists.
  await storage.abortMultipartUpload({ key: upload.objectKey, uploadId: upload.multipartUploadId });
  try {
    await storage.deleteObject(upload.objectKey);
  } catch {
    // Left for the sweep to retry.
    await VideoUpload.updateOne({ _id: upload._id }, { $set: { status: 'retired', retiredAt: new Date(), deleteAfter: new Date() } });
  }
  if (course) {
    const target = targetOfUpload(upload);
    await recordEvent({
      course,
      moduleId,
      target,
      action: 'upload_failed',
      level: 'error',
      video: { provider: 'upload', fileName: upload.fileName },
      actor: upload.actor,
      uploadId: upload._id,
      message: `${code}: ${reason}`,
    });
    notify({ course, moduleId, target, action: 'upload_failed', video: null, actor: upload.actor, students: false });
  }
}

function uploadVideoRecord(upload) {
  const now = new Date();
  return {
    provider: 'upload',
    videoId: null,
    externalVideoId: null,
    externalResourceKey: null,
    originalUrl: '',
    storageKey: upload.objectKey,
    uploadId: upload._id,
    fileName: upload.fileName,
    fileSize: upload.fileSize,
    duration: upload.duration ?? null,
    mimeType: upload.mimeType,
    uploadStatus: 'completed',
    processingStatus: 'verified',
    uploadedAt: upload.verifiedAt || now,
    title: upload.title || upload.fileName,
    description: upload.description || '',
    playbackMode: 'embed',
    isPublished: Boolean(upload.isPublished),
    publishedAt: upload.isPublished ? now : null,
    availability: 'available',
    checkedAt: now,
    updatedAt: now,
    updatedBy: { portal: upload.actor.portal, userId: upload.actor.userId, name: upload.actor.name || null },
  };
}

/** Attaches a verified upload to its module or lesson, replacing what was there. */
async function attachUpload(upload, { expectedUpdatedAt } = {}) {
  const target = targetOfUpload(upload);
  const { course, moduleId, node } = await locate(upload.courseSlug, target);
  const previous = node.video?.provider ? node.video : null;
  const video = uploadVideoRecord(upload);
  const guard = expectedUpdatedAt !== undefined ? expectedUpdatedAt : upload.expectedUpdatedAt;
  const p = paths(target);
  const result = await Course.updateOne(
    guardFilter(course._id, moduleId, target, guard),
    { $set: { [p.video]: video, ...(p.videoUrl ? { [p.videoUrl]: '' } : {}) } },
    { arrayFilters: p.arrayFilters(moduleId), runValidators: true }
  );
  if (!result.matchedCount) {
    // The module changed while this file was uploading. The verified file is
    // kept for a day so the uploader can choose to use it anyway.
    upload.expiresAt = new Date(Date.now() + UPLOAD_IDLE_EXPIRY_MS);
    await upload.save();
    await recordEvent({
      course,
      moduleId,
      target,
      action: 'upload_conflict',
      level: 'warn',
      video: { provider: 'upload', fileName: upload.fileName },
      actor: upload.actor,
      uploadId: upload._id,
      message: 'Upload verified but not attached: the video was changed by someone else meanwhile.',
    });
    throw await conflict(upload.courseSlug, target, { uploadId: String(upload._id), uploadStatus: 'verified' });
  }

  upload.status = 'completed';
  upload.appliedAt = new Date();
  await upload.save();
  if (previous?.provider === 'upload' && previous.storageKey !== upload.objectKey) await retireStoredObject(previous);

  logger.info(`[lessonVideo] ${upload.actor.portal}:${upload.actor.userId} attached upload ${upload._id} to ${upload.courseSlug}/${labelOf(target)}`);
  const action = 'upload_completed';
  await recordEvent({ course, moduleId, target, action, video, previous, actor: upload.actor, uploadId: upload._id });
  notify({ course, moduleId, target, action, video, actor: upload.actor, students: video.isPublished || Boolean(previous?.isPublished) });
  return {
    status: 'completed',
    lessonId: target.lessonId || null,
    moduleId: target.moduleId || moduleId,
    uploadId: String(upload._id),
    video: await shapeVideoForEditor(video),
    previousVideoId: refOf(previous)?.ref || null,
    previousProvider: previous?.provider || null,
    wasPublished: Boolean(previous?.isPublished),
  };
}

/**
 * Finishes an upload: verifies every part against what storage holds,
 * assembles the file, checks its size and its first bytes, then attaches it.
 * Safe to call again - a retry after a timeout sees "processing" or the
 * finished result rather than doing the work twice.
 */
export async function completeUpload(slug, uploadId, input, actorInput) {
  requireStorage();
  const actor = uploadActor(actorInput);
  const owned = await getUploadFor(slug, uploadId, actor);

  if (owned.status === 'verified') return attachUpload(owned, { expectedUpdatedAt: input.expectedUpdatedAt });
  if (owned.status === 'completed') {
    const { node } = await locate(slug, targetOfUpload(owned));
    return { status: 'completed', uploadId: String(owned._id), video: await shapeVideoForEditor(node.video), alreadyCompleted: true };
  }
  if (owned.status === 'processing') return { status: 'processing', uploadId: String(owned._id) };

  // Only one caller moves a session from uploading to processing.
  const upload = await VideoUpload.findOneAndUpdate(
    { _id: owned._id, status: 'uploading' },
    { $set: { status: 'processing' } },
    { new: true }
  );
  if (!upload) {
    const latest = await VideoUpload.findById(owned._id).lean();
    if (latest?.status === 'processing') return { status: 'processing', uploadId: String(owned._id) };
    throw AppError.conflict(`This upload is ${latest?.status || 'gone'} and cannot be completed.`, 'UPLOAD_NOT_WRITABLE');
  }
  if (input.duration !== undefined && Number.isFinite(Number(input.duration)) && Number(input.duration) >= 0) {
    upload.duration = Math.min(Number(input.duration), 24 * 60 * 60);
  }

  const target = targetOfUpload(upload);
  const { course, moduleId } = await locate(slug, target);

  // 1. Every part present, at exactly the size it must have.
  let parts;
  try {
    parts = await storage.listUploadedParts({ key: upload.objectKey, uploadId: upload.multipartUploadId });
  } catch (err) {
    if (err.code === 'UPLOAD_EXPIRED') {
      await failUpload(upload, 'UPLOAD_EXPIRED', 'The storage provider no longer has this upload session.', { course, moduleId });
      throw err;
    }
    upload.status = 'uploading';
    await upload.save();
    throw err;
  }
  const byNumber = new Map(parts.map((p) => [p.partNumber, p]));
  const missing = [];
  for (let n = 1; n <= upload.totalParts; n += 1) {
    const part = byNumber.get(n);
    if (!part || part.size !== expectedPartSize(upload, n)) missing.push(n);
  }
  if (missing.length) {
    // Not a failure: the client uploads these and completes again.
    upload.status = 'uploading';
    await upload.save();
    const incomplete = AppError.unprocessable(`${missing.length} part(s) of the file have not reached storage yet.`, 'UPLOAD_INCOMPLETE', {
      missingParts: missing.slice(0, 500),
    });
    incomplete.exposeDetails = true;
    throw incomplete;
  }

  // 2. Assemble, then verify what storage actually holds.
  try {
    await storage.completeMultipartUpload({
      key: upload.objectKey,
      uploadId: upload.multipartUploadId,
      parts: [...byNumber.values()].sort((a, b) => a.partNumber - b.partNumber),
    });
    const head = await storage.headObject(upload.objectKey);
    if (!head) throw new AppError('The assembled file could not be found in storage.', 422, 'VIDEO_VERIFICATION_FAILED');
    if (head.size !== upload.fileSize) {
      throw new AppError(`The stored file is ${head.size} bytes, but ${upload.fileSize} were expected.`, 422, 'VIDEO_SIZE_MISMATCH');
    }
    const firstBytes = await storage.readObjectStart(upload.objectKey);
    const { family } = classifyVideoFile({ fileName: upload.fileName, mimeType: upload.mimeType });
    if (!containerMatches(family, detectVideoContainer(firstBytes))) {
      throw new AppError(
        'This file is not a playable video: its contents do not match an MP4, MOV, WEBM or MKV video.',
        422,
        'VIDEO_VERIFICATION_FAILED'
      );
    }
  } catch (err) {
    if (err instanceof AppError && err.statusCode === 422) {
      await failUpload(upload, err.code, err.message, { course, moduleId });
      throw err;
    }
    if (err instanceof AppError && err.code === 'UPLOAD_EXPIRED') {
      await failUpload(upload, 'UPLOAD_EXPIRED', err.message, { course, moduleId });
      throw err;
    }
    // A storage outage: the parts are still there, so completing again later works.
    upload.status = 'uploading';
    await upload.save();
    throw err;
  }

  upload.status = 'verified';
  upload.verifiedAt = new Date();
  await upload.save();
  return attachUpload(upload, { expectedUpdatedAt: input.expectedUpdatedAt });
}

export async function abortUpload(slug, uploadId, actorInput) {
  requireStorage();
  const actor = uploadActor(actorInput);
  const upload = await getUploadFor(slug, uploadId, actor);
  if (upload.status === 'processing') {
    throw AppError.conflict('This upload is being verified and cannot be cancelled now.', 'UPLOAD_PROCESSING');
  }
  if (upload.status === 'completed') {
    throw AppError.conflict('This upload is already the module video. Remove the video instead.', 'UPLOAD_ALREADY_ATTACHED');
  }
  if (!['uploading', 'verified'].includes(upload.status)) return { uploadId: String(upload._id), status: upload.status, aborted: false };

  const wasVerified = upload.status === 'verified';
  if (wasVerified) {
    try {
      await storage.deleteObject(upload.objectKey);
      upload.status = 'aborted';
      upload.deletedAt = new Date();
    } catch {
      upload.status = 'retired';
      upload.retiredAt = new Date();
      upload.deleteAfter = new Date();
    }
  } else {
    await storage.abortMultipartUpload({ key: upload.objectKey, uploadId: upload.multipartUploadId });
    upload.status = 'aborted';
  }
  await upload.save();

  const target = targetOfUpload(upload);
  const course = { _id: upload.courseId, slug: upload.courseSlug };
  await recordEvent({
    course,
    moduleId: upload.moduleId,
    target,
    action: 'upload_aborted',
    video: { provider: 'upload', fileName: upload.fileName },
    actor,
    uploadId: upload._id,
  });
  notify({ course, moduleId: upload.moduleId, target, action: 'upload_aborted', video: null, actor, students: false });
  return { uploadId: String(upload._id), status: upload.status, aborted: true };
}

// --- Storage sweep ----------------------------------------------------------------------------

/**
 * Housekeeping, run every few minutes (jobs/videoStorageSweep.job.js):
 *  - sessions idle for a day are aborted at the provider and marked expired;
 *  - a session stuck in processing (a crash mid-verification) is failed;
 *  - verified-but-unattached files nobody claimed within a day are deleted;
 *  - retired files are deleted once no playback URL for them can be live and
 *    no module or lesson points at them. A failed deletion is retried with
 *    back-off and reported as an error in the video history.
 */
export async function sweepVideoStorage({ now = new Date(), batch = 25 } = {}) {
  const outcome = { expired: 0, stuck: 0, unclaimed: 0, deleted: 0, cleanupFailed: 0, restored: 0 };
  if (!storage.isVideoStorageConfigured()) return { ...outcome, skipped: 'STORAGE_NOT_CONFIGURED' };

  const historyCourse = (u) => ({ _id: u.courseId, slug: u.courseSlug });

  for (const upload of await VideoUpload.find({ status: 'uploading', expiresAt: { $lt: now } }).limit(batch)) {
    await storage.abortMultipartUpload({ key: upload.objectKey, uploadId: upload.multipartUploadId });
    upload.status = 'expired';
    upload.failureCode = 'UPLOAD_EXPIRED';
    upload.failureReason = 'No upload activity for 24 hours.';
    await upload.save();
    outcome.expired += 1;
    await recordEvent({
      course: historyCourse(upload),
      moduleId: upload.moduleId,
      target: targetOfUpload(upload),
      action: 'upload_expired',
      level: 'warn',
      video: { provider: 'upload', fileName: upload.fileName },
      actor: upload.actor,
      uploadId: upload._id,
      message: 'Upload abandoned: no activity for 24 hours.',
    });
  }

  const stuckBefore = new Date(now.getTime() - PROCESSING_TIMEOUT_MS);
  for (const upload of await VideoUpload.find({ status: 'processing', updatedAt: { $lt: stuckBefore } }).limit(batch)) {
    await failUpload(upload, 'PROCESSING_TIMEOUT', 'Verification did not finish (the server restarted or storage stopped answering).', {
      course: historyCourse(upload),
      moduleId: upload.moduleId,
    });
    outcome.stuck += 1;
  }

  for (const upload of await VideoUpload.find({ status: 'verified', expiresAt: { $lt: now } }).limit(batch)) {
    upload.status = 'retired';
    upload.retiredAt = now;
    upload.deleteAfter = now;
    upload.failureCode = 'NOT_ATTACHED';
    upload.failureReason = 'Verified but never attached to the module.';
    await upload.save();
    outcome.unclaimed += 1;
  }

  for (const upload of await VideoUpload.find({ status: 'retired', deleteAfter: { $lte: now } }).limit(batch)) {
    if (await isObjectReferenced(upload.objectKey)) {
      // Something points at it again; deleting it would break a live video.
      upload.status = 'completed';
      upload.deleteAfter = null;
      await upload.save();
      outcome.restored += 1;
      continue;
    }
    try {
      await storage.deleteObject(upload.objectKey);
      upload.status = 'deleted';
      upload.deletedAt = now;
      upload.lastCleanupError = null;
      await upload.save();
      outcome.deleted += 1;
      await recordEvent({
        course: historyCourse(upload),
        moduleId: upload.moduleId,
        target: targetOfUpload(upload),
        action: 'object_deleted',
        video: { provider: 'upload', fileName: upload.fileName },
        uploadId: upload._id,
      });
    } catch (err) {
      upload.cleanupAttempts += 1;
      upload.lastCleanupError = String(err.message || err).slice(0, 400);
      const backoffMs = Math.min(2 ** upload.cleanupAttempts * 10 * 60 * 1000, 24 * 60 * 60 * 1000);
      upload.deleteAfter = new Date(now.getTime() + backoffMs);
      await upload.save();
      outcome.cleanupFailed += 1;
      if ([1, 5, 10].includes(upload.cleanupAttempts)) {
        await recordEvent({
          course: historyCourse(upload),
          moduleId: upload.moduleId,
          target: targetOfUpload(upload),
          action: 'object_cleanup_failed',
          level: 'error',
          video: { provider: 'upload', fileName: upload.fileName },
          uploadId: upload._id,
          message: `Could not delete a retired video file (attempt ${upload.cleanupAttempts}): ${upload.lastCleanupError}`,
        });
      }
    }
  }
  return outcome;
}

// --- Re-validation ----------------------------------------------------------------------------

/**
 * Re-asks YouTube and Google Drive about published links whose last answer
 * is older than `staleAfterMs`, a bounded batch at a time.
 *
 * Owners change things after a video is saved - they disable embedding, make
 * it private, stop sharing it, delete it. This keeps the stored availability
 * close to the truth without anyone re-saving.
 *
 * It only ever changes `availability` and `checkedAt`, and only on a definite
 * answer. It never unpublishes - a video that has become unavailable is
 * recorded as a warning in the video history and shown to editors, who decide.
 */
export async function revalidatePublishedVideos({ staleAfterMs = 24 * 60 * 60 * 1000, limit = 40 } = {}) {
  if (!oembedFetcher && !driveFetcher) return { checked: 0, changed: 0, skipped: 'CHECKS_DISABLED' };
  const cutoff = new Date(Date.now() - staleAfterMs);
  const checkable = (v) =>
    v?.isPublished && ((v.provider === 'youtube' && v.videoId && oembedFetcher) || (v.provider === 'google_drive' && v.externalVideoId && driveFetcher));
  const stale = (v) => checkable(v) && (!v.checkedAt || new Date(v.checkedAt) < cutoff);

  const courses = await Course.find({
    $or: [{ 'modules.video.isPublished': true }, { 'modules.lessons.video.isPublished': true }],
  })
    .select('_id slug modules.moduleId modules.video modules.lessons.lessonId modules.lessons.video')
    .lean();

  const due = [];
  for (const c of courses) {
    for (const m of c.modules || []) {
      if (stale(m.video)) due.push({ course: c, moduleId: m.moduleId, target: { moduleId: m.moduleId }, video: m.video });
      for (const l of m.lessons || []) {
        if (stale(l.video)) due.push({ course: c, moduleId: m.moduleId, target: { lessonId: l.lessonId }, video: l.video });
      }
    }
  }
  due.sort((a, b) => new Date(a.video.checkedAt || 0) - new Date(b.video.checkedAt || 0));

  let checked = 0;
  let changed = 0;
  for (const item of due.slice(0, limit)) {
    const v = item.video;
    if (Date.now() < pausedUntil[v.provider]) continue;
    const { availability } =
      v.provider === 'youtube'
        ? await checkYoutubeAvailability(v.videoId, { bypassCache: true })
        : await checkGoogleDriveAvailability(v.externalVideoId, v.externalResourceKey, { bypassCache: true });
    checked += 1;
    if (availability === 'unknown') continue;

    const base = paths(item.target).video;
    // Matched on the same updatedAt it was read with, so an editor's save in
    // the meantime is never overwritten by this background answer.
    const res = await Course.updateOne(
      guardFilter(item.course._id, item.moduleId, item.target, v.updatedAt),
      { $set: { [`${base}.availability`]: availability, [`${base}.checkedAt`]: new Date() } },
      { arrayFilters: paths(item.target).arrayFilters(item.moduleId) }
    );
    if (res.modifiedCount && availability !== v.availability) {
      changed += 1;
      logger.warn(`[lessonVideo] ${item.course.slug}/${labelOf(item.target)}: ${v.provider} now reports "${availability}" (was "${v.availability}")`);
      await recordEvent({
        course: item.course,
        moduleId: item.moduleId,
        target: item.target,
        action: 'availability_changed',
        level: availability === 'available' ? 'info' : 'warn',
        video: v,
        message: `${v.provider === 'youtube' ? 'YouTube' : 'Google Drive'} now reports this video as ${availability} (was ${v.availability}).`,
      });
      notify({ course: item.course, moduleId: item.moduleId, target: item.target, action: 'availability_changed', video: v, actor: null, students: true });
    }
  }
  return { checked, changed, due: due.length };
}

export default {
  listVideoCatalog,
  getCourseVideos,
  listVideoEvents,
  inspectLink,
  inspectYoutubeLink,
  upsertVideo,
  updateVideoDetails,
  removeVideo,
  upsertLessonVideo,
  removeLessonVideo,
  startUpload,
  getUploadPartUrls,
  resumeUpload,
  completeUpload,
  abortUpload,
  sweepVideoStorage,
  revalidatePublishedVideos,
  shapeLessonVideoForStudent,
  shapeModuleVideoForStudent,
  shapeVideoForEditor,
  checkYoutubeAvailability,
  checkGoogleDriveAvailability,
  isRetiredLegacyVideoUrl,
  legacyVideoUrlFor,
};
