import { CourseAccess } from '../models/CourseAccess.js';
import { assertCourseAccess } from './courseAccess.service.js';
import { callStudentBridge } from './studentBridgeClient.service.js';

/**
 * Lesson videos for the courses a teacher is assigned.
 *
 * The authorisation is this portal's own CourseAccess record - the row an
 * administrator's assignment creates for (teacher, course slug), and the same
 * one that already decides whose students a teacher may see. It is consulted on
 * every request, so taking a course away from a teacher takes away their
 * ability to edit its videos in the same moment. There is no second assignment
 * system here. (assertCourseAccess itself now lives in courseAccess.service.js,
 * shared with course-structure editing and course-wide grading/attendance -
 * re-exported below so existing imports of it from this file keep working.)
 *
 * Lessons themselves live in the student service; this forwards an authorised
 * edit there over the service-key bridge (studentBridgeClient.service.js,
 * shared with course-structure editing - the retry/timeout/error-propagation
 * rules are identical, since both treat the student backend as the sole
 * source of truth), naming the teacher who made it. The student service
 * validates the link and is the only writer.
 */

export { assertCourseAccess };

const UNAVAILABLE_LABEL = 'lesson videos cannot be loaded or saved right now';

async function call(path, options) {
  return callStudentBridge(path, options, UNAVAILABLE_LABEL);
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
  });
}

export async function getCourseVideos(slug) {
  return call(`/api/internal/lesson-videos/courses/${encodeURIComponent(slug)}`, { method: 'GET' });
}

export async function inspectLink(url) {
  return call('/api/internal/lesson-videos/inspect', { method: 'POST', body: JSON.stringify({ url }) });
}

// A video belongs to one lesson or one module: { lessonId } or { moduleId }.
const videoPath = (slug, target) =>
  `/api/internal/lesson-videos/courses/${encodeURIComponent(slug)}/${
    target.moduleId ? `modules/${encodeURIComponent(target.moduleId)}` : `lessons/${encodeURIComponent(target.lessonId)}`
  }`;

export async function saveCourseVideo(slug, target, payload) {
  return call(videoPath(slug, target), { method: 'PUT', body: JSON.stringify(payload) });
}

export async function removeCourseVideo(slug, target, payload) {
  return call(videoPath(slug, target), { method: 'DELETE', body: JSON.stringify(payload) });
}

export default { assertCourseAccess, listManageableCourses, getCourseVideos, inspectLink, saveCourseVideo, removeCourseVideo };
