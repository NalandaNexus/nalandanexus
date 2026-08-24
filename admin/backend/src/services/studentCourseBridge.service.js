import { env } from '../config/env.js';

/**
 * Bridges an APPROVED admin-authored course into student/backend's real
 * purchasable Course catalog — a separate service/database. Mirrors
 * studentBridge.service.js's announcement bridge exactly (shared-secret
 * auth, idempotent on sourceId), reusing the same STUDENT_BACKEND_* config.
 *
 * Non-destructive by design: this never deletes a course on the student
 * side (students may already have paid for it) — "retract" unpublishes it
 * (isPurchasable/isPublished: false) rather than removing it.
 */

function isConfigured() {
  return Boolean(env.studentBridge.url && env.studentBridge.serviceKey);
}

async function call(path, options) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);
  try {
    const res = await fetch(`${env.studentBridge.url}${path}`, {
      ...options,
      headers: { 'Content-Type': 'application/json', 'X-Internal-Service-Key': env.studentBridge.serviceKey, ...options.headers },
      signal: controller.signal,
    });
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      throw new Error(`Student backend returned ${res.status}: ${body.slice(0, 200)}`);
    }
    return res.json();
  } finally {
    clearTimeout(timeout);
  }
}

/** Publishes (creates or updates) a course in the real student catalog. Never throws; returns a real status. */
export async function publishCourseToStudents(course) {
  if (!isConfigured()) return { synced: false, reason: 'NOT_CONFIGURED' };
  try {
    await call('/api/internal/courses', {
      method: 'POST',
      body: JSON.stringify({
        sourceId: String(course._id),
        slug: course.slug,
        title: course.title,
        description: course.description || '',
        features: course.features || [],
        priceInPaise: course.priceInPaise || 0,
        // Resolved to an absolute URL here (this backend already serves
        // /uploads statically) - student backend just stores whatever it's
        // given, no extra config needed on that side, mirroring how
        // teacher/backend's resource bridge resolves its own file URLs.
        image: course.image ? `${env.serverUrl}${course.image}` : null,
      }),
    });
    return { synced: true };
  } catch (err) {
    console.error('[studentCourseBridge] Failed to publish course to student catalog:', err.message);
    return { synced: false, reason: 'REQUEST_FAILED', error: err.message };
  }
}

/** Unpublishes a previously-bridged course (status left ARCHIVED/REJECTED here). Never deletes — existing enrollments must stay resolvable. */
export async function unpublishCourseFromStudents(sourceId) {
  if (!isConfigured()) return { synced: false, reason: 'NOT_CONFIGURED' };
  try {
    await call(`/api/internal/courses/${sourceId}/unpublish`, { method: 'PATCH' });
    return { synced: true };
  } catch (err) {
    console.error('[studentCourseBridge] Failed to unpublish course from student catalog:', err.message);
    return { synced: false, reason: 'REQUEST_FAILED', error: err.message };
  }
}

export default { publishCourseToStudents, unpublishCourseFromStudents };
