import { env } from '../config/env.js';
import { logger } from '../utils/logger.js';

/**
 * Tells every portal that a module or lesson video changed.
 *
 * The database stays the only authority: these are notices, not state. Each
 * one names what changed (course, module or lesson, the kind of change) and
 * carries no URL, file key or draft content, so a client that receives one
 * re-reads through its own authenticated API - which applies its own
 * permissions - rather than trusting the message.
 *
 *  - Students: the course's Socket.IO room, which only students enrolled in
 *    that course are joined to (sockets/index.js).
 *  - Admin and Teacher portals: their backends' internal routes, which relay
 *    the notice to signed-in administrators and to the teachers assigned to
 *    the course. A portal that is asleep or unreachable just misses the push;
 *    its pages also re-read on reconnect and when the tab regains focus.
 */

const RELAY_TIMEOUT_MS = 4000;
let testHook = null;

/** Test seam: observe broadcasts without sockets or network. */
export function setVideoBroadcastHookForTests(fn) {
  testHook = fn;
}

async function relay(name, bridge, payload) {
  if (!bridge?.url || !bridge?.serviceKey) return { portal: name, status: 'skipped' };
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), RELAY_TIMEOUT_MS);
  try {
    const res = await fetch(`${bridge.url}/api/internal/course-videos/events`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Internal-Service-Key': bridge.serviceKey },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
    if (!res.ok) {
      logger.warn(`[videoBroadcast] ${name} portal answered ${res.status} to a video change notice`);
      return { portal: name, status: 'failed' };
    }
    return { portal: name, status: 'sent' };
  } catch (err) {
    logger.warn(`[videoBroadcast] ${name} portal unreachable for a video change notice: ${err.name === 'AbortError' ? 'timeout' : err.message}`);
    return { portal: name, status: 'failed' };
  } finally {
    clearTimeout(timer);
  }
}

/**
 * @param {object} change   { courseId, slug, moduleId, lessonId, action, provider, isPublished, version, actor }
 * @param {object} options  { students: whether enrolled students' view changed }
 * @returns {Promise<object[]>} relay outcomes (callers normally do not await it)
 */
export async function broadcastVideoChange(change, { students = true } = {}) {
  const payload = {
    type: 'course_video.changed',
    courseId: String(change.courseId),
    slug: change.slug,
    moduleId: change.moduleId || null,
    lessonId: change.lessonId || null,
    targetType: change.lessonId ? 'lesson' : 'module',
    action: change.action,
    provider: change.provider || null,
    isPublished: change.isPublished ?? null,
    version: change.version || null,
    actor: change.actor ? { portal: change.actor.portal || 'system', name: change.actor.name || null } : null,
    at: new Date().toISOString(),
  };

  if (testHook) {
    testHook(payload, { students });
    return [];
  }

  if (students) {
    try {
      // Imported lazily so scripts and tests never pull the socket server in.
      const { emitToCourse } = await import('../sockets/index.js');
      emitToCourse(change.courseId, 'course:content_updated', {
        courseId: payload.courseId,
        slug: payload.slug,
        moduleId: payload.moduleId,
        lessonId: payload.lessonId,
        reason: 'video',
      });
    } catch {
      // No socket server in this process (a script); students re-read on focus.
    }
  }

  return Promise.all([relay('admin', env.adminBridge, payload), relay('teacher', env.teacherBridge, payload)]);
}

export default { broadcastVideoChange, setVideoBroadcastHookForTests };
