import { env } from '../config/env.js';

/**
 * Provisions a REAL Teacher Portal login when Admin creates a teacher.
 * admin/backend's own `Teacher` document is a governance/roster record only
 * — it cannot authenticate anyone into teacher/backend, a separate
 * service with a structurally different Teacher/User schema in a separate
 * database. This calls teacher/backend's internal
 * `createTeacherAccount()` (already existed, was never wired to a caller)
 * via the same shared-secret `X-Internal-Service-Key` pattern already
 * proven for the announcement bridge.
 *
 * Unlike the announcement bridge, this is NOT swallow-and-log: a failure
 * here means the teacher literally cannot log in, so the caller
 * (teacher.service.js#createTeacher) must surface it as a real warning
 * rather than a silently-dropped side effect.
 */

function isConfigured() {
  return Boolean(env.teacherBridge.url && env.teacherBridge.serviceKey);
}

async function call(path, options) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);
  try {
    const res = await fetch(`${env.teacherBridge.url}${path}`, {
      ...options,
      headers: { 'Content-Type': 'application/json', 'X-Internal-Service-Key': env.teacherBridge.serviceKey, ...options.headers },
      signal: controller.signal,
    });
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      throw new Error(`Teacher backend returned ${res.status}: ${body.slice(0, 200)}`);
    }
    return res.json();
  } finally {
    clearTimeout(timeout);
  }
}

/** Creates the real teacher/backend login. Returns a real status — never throws, never silently succeeds. */
export async function provisionTeacherAccount({ name, email, phone, tempPassword, title, department, subject }) {
  if (!isConfigured()) return { provisioned: false, reason: 'NOT_CONFIGURED' };
  try {
    await call('/api/internal/teachers', {
      method: 'POST',
      body: JSON.stringify({ name, email, phone, tempPassword, title, department, subject }),
    });
    return { provisioned: true };
  } catch (err) {
    console.error('[teacherBridge] Failed to provision Teacher Portal account:', err.message);
    return { provisioned: false, reason: 'REQUEST_FAILED', error: err.message };
  }
}

/**
 * "Resend Credentials" backend leg — resets the REAL Teacher Portal
 * password to a new admin-issued temporary one. Same honesty contract as
 * provisionTeacherAccount: a real status is always returned, never assumed.
 */
export async function resetTeacherCredentials({ email, newPassword }) {
  if (!isConfigured()) return { reset: false, reason: 'NOT_CONFIGURED' };
  try {
    await call('/api/internal/teachers/credentials', {
      method: 'PATCH',
      body: JSON.stringify({ email, newPassword }),
    });
    return { reset: true };
  } catch (err) {
    console.error('[teacherBridge] Failed to reset Teacher Portal credentials:', err.message);
    return { reset: false, reason: 'REQUEST_FAILED', error: err.message };
  }
}

/**
 * Pushes an admin-authored course assignment into the assigned teacher's
 * Teacher Portal — best-effort (never throws), matching the academics
 * read-model bridge already proven for assignment/quiz/attendance data.
 * `sourceId` is admin's own Course _id (string), resolved on the teacher
 * side by email since the two services share no ObjectId space.
 */
export async function pushCourseAssignment({ sourceId, teacherEmail, title, courseCode, description, image, priceInPaise, status }) {
  if (!isConfigured()) return { assigned: false, reason: 'NOT_CONFIGURED' };
  try {
    const result = await call(`/api/internal/courses/${encodeURIComponent(sourceId)}`, {
      method: 'PUT',
      body: JSON.stringify({ teacherEmail, title, courseCode, description, image, priceInPaise, status }),
    });
    return { assigned: Boolean(result?.data?.assigned), reason: result?.data?.reason };
  } catch (err) {
    console.error('[teacherBridge] Failed to push course assignment:', err.message);
    return { assigned: false, reason: 'REQUEST_FAILED', error: err.message };
  }
}

/**
 * Pushes an Admin-broadcast announcement (audience 'ALL' or 'TEACHERS') to
 * every teacher — the receiving leg that never existed before (announcements
 * only ever reached students). Best-effort, never throws.
 */
export async function pushAnnouncementToTeachers({ sourceId, title, content, priority, authorName, publishedAt }) {
  if (!isConfigured()) return { delivered: false, reason: 'NOT_CONFIGURED' };
  try {
    await call('/api/internal/admin-announcements', {
      method: 'POST',
      body: JSON.stringify({ sourceId, title, content, priority, authorName, publishedAt }),
    });
    return { delivered: true };
  } catch (err) {
    console.error('[teacherBridge] Failed to push announcement to teachers:', err.message);
    return { delivered: false, reason: 'REQUEST_FAILED', error: err.message };
  }
}

/**
 * Deactivates (or reactivates) the real Teacher Portal login - the gap this
 * closes: deleting a teacher on admin's side previously only soft-deleted
 * admin's own governance record, leaving the real portal account fully
 * able to log in and use the app indefinitely (confirmed live via a QA
 * pass). Best-effort like the rest of this bridge, but the caller should
 * still treat a failure here as worth surfacing - unlike a missed
 * announcement, a teacher who should be locked out but isn't is a real
 * access-control gap, not a cosmetic delivery miss.
 */
export async function setTeacherAccountStatus({ email, status }) {
  if (!isConfigured()) return { updated: false, reason: 'NOT_CONFIGURED' };
  try {
    await call('/api/internal/teachers/status', {
      method: 'PATCH',
      body: JSON.stringify({ email, status }),
    });
    return { updated: true };
  } catch (err) {
    console.error('[teacherBridge] Failed to update Teacher Portal account status:', err.message);
    return { updated: false, reason: 'REQUEST_FAILED', error: err.message };
  }
}

export async function removeCourseAssignment(sourceId) {
  if (!isConfigured()) return { removed: false, reason: 'NOT_CONFIGURED' };
  try {
    await call(`/api/internal/courses/${encodeURIComponent(sourceId)}`, { method: 'DELETE' });
    return { removed: true };
  } catch (err) {
    console.error('[teacherBridge] Failed to remove course assignment:', err.message);
    return { removed: false, reason: 'REQUEST_FAILED', error: err.message };
  }
}

export default {
  provisionTeacherAccount,
  resetTeacherCredentials,
  setTeacherAccountStatus,
  pushCourseAssignment,
  removeCourseAssignment,
  pushAnnouncementToTeachers,
};
