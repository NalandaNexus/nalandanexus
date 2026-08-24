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

export default { pushAnnouncementToStudents };
