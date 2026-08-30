import { env } from '../config/env.js';

/**
 * Outbound half of the bidirectional messaging bridge — calls the
 * (separate) teacher backend's own `/api/internal/*` routes, authenticated
 * with the same shared secret teacher/backend already sends when it calls
 * *this* backend. Mirrors teacher/backend/src/services/studentBridge.service.js
 * (best-effort, never throws, short timeout).
 */

function isConfigured() {
  return Boolean(env.teacherBridge.url && env.teacherBridge.serviceKey);
}

async function call(path, options) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5000);
  try {
    const res = await fetch(`${env.teacherBridge.url}${path}`, {
      ...options,
      headers: { 'Content-Type': 'application/json', 'X-Internal-Service-Key': env.teacherBridge.serviceKey, ...options?.headers },
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

/** Resolves the real teacher assigned to a course slug via teacher/backend. Returns null (not a throw) on any failure. */
export async function fetchTeacherForCourse(studentCourseSlug) {
  if (!isConfigured() || !studentCourseSlug) return null;
  try {
    const body = await call(`/api/internal/teacher-for-course/${encodeURIComponent(studentCourseSlug)}`, { method: 'GET' });
    return body?.data || null;
  } catch (err) {
    console.error('[teacherBridge] Failed to resolve assigned teacher:', err.message);
    return null;
  }
}

/** Delivers a student's message to their assigned teacher's own inbox. Best-effort — never throws. */
export async function pushMessageToTeacher({ studentCourseSlug, externalStudentId, externalStudentName, text }) {
  if (!isConfigured()) return { delivered: false, reason: 'NOT_CONFIGURED' };
  try {
    await call('/api/internal/messages', {
      method: 'POST',
      body: JSON.stringify({ studentCourseSlug, externalStudentId, externalStudentName, text }),
    });
    return { delivered: true };
  } catch (err) {
    console.error('[teacherBridge] Failed to deliver message to teacher portal:', err.message);
    return { delivered: false, reason: 'REQUEST_FAILED', error: err.message };
  }
}

/**
 * Pushes a real student submission back to the owning teacher/backend
 * Assignment when the completed Task was itself bridged FROM there — the
 * return leg of the task bridge that never previously existed (a teacher
 * could publish an assignment to real students but never learn they'd
 * turned it in). No-op (not an error) for a native, non-bridged task.
 */
export async function pushTaskSubmission({ assignmentSourceId, studentUserId, studentName, studentEmail, submissionText, isLate, submissionSourceId }) {
  if (!isConfigured() || !assignmentSourceId) return { delivered: false, reason: 'NOT_LINKED' };
  try {
    await call('/api/internal/submissions', {
      method: 'POST',
      body: JSON.stringify({ assignmentSourceId, studentUserId, studentName, studentEmail, submissionText, isLate, submissionSourceId }),
    });
    return { delivered: true };
  } catch (err) {
    console.error('[teacherBridge] Failed to deliver submission to teacher portal:', err.message);
    return { delivered: false, reason: 'REQUEST_FAILED', error: err.message };
  }
}

/**
 * Pushes a student's real, server-graded quiz result back to the owning
 * teacher/backend Exam when the Quiz was itself bridged FROM there — the
 * return leg of the quiz bridge that never previously existed (a teacher
 * could publish an exam to real students but never learn any student's
 * score). Mirrors pushTaskSubmission. No-op for a native, non-bridged quiz.
 */
export async function pushQuizResult({ examSourceId, studentUserId, studentName, studentEmail, scorePercentage, correctCount, totalCount }) {
  if (!isConfigured() || !examSourceId) return { delivered: false, reason: 'NOT_LINKED' };
  try {
    await call('/api/internal/quiz-results', {
      method: 'POST',
      body: JSON.stringify({ examSourceId, studentUserId, studentName, studentEmail, scorePercentage, correctCount, totalCount }),
    });
    return { delivered: true };
  } catch (err) {
    console.error('[teacherBridge] Failed to deliver quiz result to teacher portal:', err.message);
    return { delivered: false, reason: 'REQUEST_FAILED', error: err.message };
  }
}

/**
 * Asks the teacher portal to place a paid enrollment into one of its batches.
 *
 * Batches, their capacity and their teachers all live in that service's
 * database, so it is the only one that can answer "which batch of this course
 * still has room" - and the only one that can decide it atomically, without two
 * simultaneous purchases both being handed the last remaining seat.
 *
 * Best-effort like every other call here: an unreachable teacher portal returns
 * null and the enrollment simply stays unplaced. A student who has paid must
 * never lose their purchase because a downstream service was restarting.
 */
export async function requestBatchPlacement({ courseSlug, enrollmentId, studentName }) {
  if (!isConfigured() || !courseSlug || !enrollmentId) return null;
  try {
    const body = await call('/api/internal/batches/place', {
      method: 'POST',
      body: JSON.stringify({ studentCourseSlug: courseSlug, enrollmentId, studentName: studentName || null }),
    });
    return body?.data || null;
  } catch (err) {
    console.error('[teacherBridge] Batch placement unavailable, enrollment left unplaced:', err.message);
    return null;
  }
}

export default { fetchTeacherForCourse, requestBatchPlacement, pushMessageToTeacher, pushTaskSubmission, pushQuizResult };
