import { env } from '../config/env.js';

/**
 * Pushes live assignment/quiz/attendance activity to admin/backend's
 * monitoring dashboard (a separate service/database) — mirrors
 * studentBridge.service.js exactly (shared secret, best-effort, never
 * throws). Admin only ever gets metadata/counts here, never question
 * content or per-student detail — see the master doc's "metadata where
 * appropriate" scope for academic monitoring.
 */

function isConfigured() {
  return Boolean(env.adminBridge.url && env.adminBridge.serviceKey);
}

async function call(path, body, method = 'POST') {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5000);
  try {
    const res = await fetch(`${env.adminBridge.url}${path}`, {
      method,
      headers: { 'Content-Type': 'application/json', 'X-Internal-Service-Key': env.adminBridge.serviceKey },
      body: body ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(`Admin backend returned ${res.status}: ${text.slice(0, 200)}`);
    }
    return res.json();
  } finally {
    clearTimeout(timeout);
  }
}

export async function pushAssignmentActivity(assignment) {
  if (!isConfigured()) return { delivered: false, reason: 'NOT_CONFIGURED' };
  try {
    await call('/api/internal/academics/assignments', {
      sourceId: String(assignment.id || assignment._id),
      title: assignment.title,
      className: assignment.className || '',
      teacherName: assignment.teacherName || '',
      dueDate: assignment.dueDate,
      total: assignment.total ?? 0,
      submitted: assignment.submitted ?? 0,
      toGrade: assignment.toGrade ?? 0,
      avgScore: assignment.avgScore ?? null,
      status: assignment.status || 'published',
    });
    return { delivered: true };
  } catch (err) {
    console.error('[adminBridge] Failed to push assignment activity:', err.message);
    return { delivered: false, reason: 'REQUEST_FAILED', error: err.message };
  }
}

export async function pushQuizActivity(exam) {
  if (!isConfigured()) return { delivered: false, reason: 'NOT_CONFIGURED' };
  try {
    await call('/api/internal/academics/quizzes', {
      sourceId: String(exam.id || exam._id),
      title: exam.title,
      className: exam.className || '',
      teacherName: exam.teacherName || '',
      type: exam.type || 'quiz',
      questionCount: exam.questions?.length ?? exam.totalQuestions ?? 0,
      durationMinutes: exam.durationMinutes ?? 0,
      scheduledAt: exam.scheduledAt,
      status: exam.status || 'draft',
    });
    return { delivered: true };
  } catch (err) {
    console.error('[adminBridge] Failed to push quiz activity:', err.message);
    return { delivered: false, reason: 'REQUEST_FAILED', error: err.message };
  }
}

export async function pushAttendanceSummary({ classId, date, className, teacherName, presentCount, absentCount, lateCount, totalCount }) {
  if (!isConfigured()) return { delivered: false, reason: 'NOT_CONFIGURED' };
  try {
    await call('/api/internal/academics/attendance', {
      sourceId: `${classId}_${date}`,
      className,
      teacherName,
      date,
      presentCount,
      absentCount,
      lateCount,
      totalCount,
    });
    return { delivered: true };
  } catch (err) {
    console.error('[adminBridge] Failed to push attendance summary:', err.message);
    return { delivered: false, reason: 'REQUEST_FAILED', error: err.message };
  }
}

export async function pushAnnouncementActivity(announcement, teacherName) {
  if (!isConfigured()) return { delivered: false, reason: 'NOT_CONFIGURED' };
  try {
    await call('/api/internal/teacher-announcements', {
      sourceId: String(announcement._id || announcement.id),
      title: announcement.title,
      content: announcement.description || announcement.content,
      priority: announcement.priority || 'MEDIUM',
      teacherName: teacherName || '',
      className: announcement.className || '',
      publishedAt: announcement.publishAt || announcement.publishedAt,
    });
    return { delivered: true };
  } catch (err) {
    console.error('[adminBridge] Failed to push announcement activity:', err.message);
    return { delivered: false, reason: 'REQUEST_FAILED', error: err.message };
  }
}

export async function retractAnnouncementActivity(announcementId) {
  if (!isConfigured()) return { retracted: false, reason: 'NOT_CONFIGURED' };
  try {
    await call(`/api/internal/teacher-announcements/${announcementId}`, null, 'DELETE');
    return { retracted: true };
  } catch (err) {
    console.error('[adminBridge] Failed to retract announcement activity:', err.message);
    return { retracted: false, reason: 'REQUEST_FAILED', error: err.message };
  }
}

export default { pushAssignmentActivity, pushQuizActivity, pushAttendanceSummary, pushAnnouncementActivity, retractAnnouncementActivity };
