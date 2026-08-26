import { env } from '../config/env.js';

/**
 * Bridges an admin-published announcement to the student portal — a
 * separate service with its own database. Mirrors teacher/backend's
 * identical bridge (see that file for the full rationale). An admin
 * account has no session in the student backend's database, so this
 * authenticates with a shared secret (`X-Internal-Service-Key`) rather than
 * a user JWT — the same secret configured on the teacher-side bridge, since
 * `requireInternalServiceKey` on the student side doesn't distinguish
 * callers.
 *
 * Every call here is best-effort: a failure must never break the
 * already-successful admin-side publish flow.
 *
 * Admin has no class/course-roster concept (see IMPLEMENTATION_REPORT.md
 * §10 — that's owned by teacher/backend), so unlike the teacher bridge this
 * one never resolves course-specific targeting — an ALL/STUDENTS-audience
 * announcement is always delivered as an institution-wide broadcast.
 */

function isConfigured() {
  return Boolean(env.studentBridge.url && env.studentBridge.serviceKey);
}

async function call(path, options) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5000);
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

/** Pushes a just-published admin announcement to the student portal. Best-effort — never throws. */
export async function pushAnnouncementToStudents(announcement, authorName) {
  if (!isConfigured()) return { delivered: false, reason: 'NOT_CONFIGURED' };
  if (announcement.audience === 'TEACHERS') return { delivered: false, reason: 'NOT_FOR_STUDENTS' };
  try {
    await call('/api/internal/announcements', {
      method: 'POST',
      body: JSON.stringify({
        title: announcement.title,
        content: announcement.content,
        type: announcement.priority === 'HIGH' ? 'urgent' : 'general',
        sourceId: String(announcement._id),
        authorName: authorName || null,
        courseSlugs: [], // admin has no course-roster concept — always institution-wide
      }),
    });
    return { delivered: true };
  } catch (err) {
    console.error('[studentBridge] Failed to deliver announcement to student portal:', err.message);
    return { delivered: false, reason: 'REQUEST_FAILED', error: err.message };
  }
}

/**
 * Mirrors an edit through to the student portal. The receiving endpoint
 * matches on sourceId (this announcement's own _id), which is what the
 * original push sent, so an announcement edited here changes wherever it
 * was delivered rather than leaving a stale copy on the landing page.
 */
export async function updateAnnouncementForStudents(announcement) {
  if (!isConfigured()) return { delivered: false, reason: 'NOT_CONFIGURED' };
  try {
    await call(`/api/internal/announcements/${String(announcement._id)}`, {
      method: 'PATCH',
      body: JSON.stringify({
        title: announcement.title,
        content: announcement.content,
        type: announcement.priority === 'HIGH' ? 'urgent' : 'general',
      }),
    });
    return { delivered: true };
  } catch (err) {
    console.error('[studentBridge] Failed to update announcement on student portal:', err.message);
    return { delivered: false, reason: 'REQUEST_FAILED', error: err.message };
  }
}

/** Retracts a deleted announcement from the student portal. Best-effort - never throws. */
export async function removeAnnouncementFromStudents(sourceId) {
  if (!isConfigured()) return { delivered: false, reason: 'NOT_CONFIGURED' };
  try {
    await call(`/api/internal/announcements/${sourceId}`, { method: 'DELETE' });
    return { delivered: true };
  } catch (err) {
    console.error('[studentBridge] Failed to retract announcement from student portal:', err.message);
    return { delivered: false, reason: 'REQUEST_FAILED', error: err.message };
  }
}

export default { pushAnnouncementToStudents, updateAnnouncementForStudents, removeAnnouncementFromStudents };
