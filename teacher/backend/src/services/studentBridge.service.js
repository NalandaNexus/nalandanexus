import { env } from '../config/env.js';
import { SchoolClass } from '../models/SchoolClass.js';

/**
 * Bridges a published teacher-portal announcement to the student portal —
 * a separate service with its own database and its own authenticated
 * Socket.IO server (see student/backend/src/sockets/index.js). A teacher
 * has no user/session in that database, so this authenticates with a
 * shared secret (`X-Internal-Service-Key`) against a dedicated internal
 * route on the student backend, not a normal user-facing endpoint.
 *
 * Every call here is best-effort: a failure (student backend down, bridge
 * not configured, network error) must never break the teacher-side publish
 * flow that already succeeded and is the source of truth. This mirrors
 * `audit.service.js#logAudit`'s "never throws" contract for the same
 * reason — a side-channel delivery failure is not the caller's problem.
 *
 * Course targeting: resolves the announcement's targeted classes to their
 * linked `studentCourseSlug`s and sends those along as `courseSlugs`, which
 * the student backend resolves to real courseIds and uses to scope delivery
 * to only students enrolled in those courses. A class with no link, or an
 * `all_my_classes`-audience announcement (no natural course mapping), falls
 * back to an institution-wide broadcast rather than delivering to nobody.
 */

function isConfigured() {
  return Boolean(env.studentBridge.url && env.studentBridge.serviceKey);
}

function mapType(teacherType) {
  // The student portal's `type` enum is 'general' | 'course' | 'urgent'.
  // 'course' implies a specific enrolled-course association this bridge
  // cannot honestly claim (see the module comment), so only the clearly
  // safe 'urgent' mapping is used; everything else lands in 'general'.
  return teacherType === 'URGENT' ? 'urgent' : 'general';
}

function buildContent(announcement) {
  const parts = [announcement.description];
  const details = [];
  if (announcement.eventDate) {
    const date = new Date(announcement.eventDate).toLocaleDateString('en-IN', { year: 'numeric', month: 'long', day: 'numeric' });
    const time = announcement.startTime ? ` · ${announcement.startTime}${announcement.endTime ? `–${announcement.endTime}` : ''}` : '';
    details.push(`📅 ${date}${time}`);
  }
  if (announcement.venue) details.push(`📍 ${announcement.venue}`);
  if (announcement.registrationLink) details.push(`🔗 ${announcement.registrationLink}`);
  if (details.length) parts.push(details.join('\n'));
  return parts.join('\n\n').slice(0, 4000); // student Announcement.content maxlength
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

/** Resolves the classes an announcement targets to their linked student-course slugs (deduped, link-less classes skipped). */
async function resolveCourseSlugs(announcement) {
  if (!announcement.classes?.length) return [];
  const classes = await SchoolClass.find({ _id: { $in: announcement.classes } }).select('studentCourseSlug').lean();
  return [...new Set(classes.map((c) => c.studentCourseSlug).filter(Boolean))];
}

/** Pushes a just-published announcement to the student portal. Best-effort — never throws. */
export async function pushAnnouncementToStudents(announcement, authorName) {
  if (!isConfigured()) return { delivered: false, reason: 'NOT_CONFIGURED' };
  try {
    const courseSlugs = await resolveCourseSlugs(announcement);
    await call('/api/internal/announcements', {
      method: 'POST',
      body: JSON.stringify({
        title: announcement.title,
        content: buildContent(announcement),
        type: mapType(announcement.type),
        publishAt: announcement.publishAt,
        expiresAt: announcement.expiresAt,
        sourceId: String(announcement._id),
        authorName: authorName || null,
        courseSlugs,
      }),
    });
    return { delivered: true };
  } catch (err) {
    console.error('[studentBridge] Failed to deliver announcement to student portal:', err.message);
    return { delivered: false, reason: 'REQUEST_FAILED', error: err.message };
  }
}

/** Removes a previously-bridged announcement from the student portal (delete or archive). Best-effort. */
export async function retractAnnouncementFromStudents(announcementId) {
  if (!isConfigured()) return { retracted: false, reason: 'NOT_CONFIGURED' };
  try {
    await call(`/api/internal/announcements/${announcementId}`, { method: 'DELETE' });
    return { retracted: true };
  } catch (err) {
    console.error('[studentBridge] Failed to retract announcement from student portal:', err.message);
    return { retracted: false, reason: 'REQUEST_FAILED', error: err.message };
  }
}

/** Pushes a just-uploaded resource to the student portal for the course linked to `classDoc.studentCourseSlug`. Best-effort — never throws. No-op (not an error) when the class has no course link. */
export async function pushResourceToStudents(resource, classDoc, teacherName) {
  if (!isConfigured() || !classDoc?.studentCourseSlug) return { delivered: false, reason: 'NOT_LINKED' };
  try {
    await call('/api/internal/materials', {
      method: 'POST',
      body: JSON.stringify({
        studentCourseSlug: classDoc.studentCourseSlug,
        title: resource.title,
        moduleTitle: classDoc.subject || '',
        uploadedByName: teacherName || null,
        fileUrl: `${env.publicUrl}${resource.fileUrl}`,
        fileName: resource.fileName,
        fileType: resource.type,
        fileSizeBytes: resource.fileSize || 0,
        sourceId: String(resource._id),
      }),
    });
    return { delivered: true };
  } catch (err) {
    console.error('[studentBridge] Failed to deliver material to student portal:', err.message);
    return { delivered: false, reason: 'REQUEST_FAILED', error: err.message };
  }
}

/** Removes a previously-bridged resource from the student portal. Best-effort. */
export async function retractResourceFromStudents(resourceId) {
  if (!isConfigured()) return { retracted: false, reason: 'NOT_CONFIGURED' };
  try {
    await call(`/api/internal/materials/${resourceId}`, { method: 'DELETE' });
    return { retracted: true };
  } catch (err) {
    console.error('[studentBridge] Failed to retract material from student portal:', err.message);
    return { retracted: false, reason: 'REQUEST_FAILED', error: err.message };
  }
}

/** Pushes a created/updated assignment to the student portal for the course linked to `classDoc.studentCourseSlug`. Best-effort — never throws. No-op when the class has no course link. */
export async function pushTaskToStudents(assignment, classDoc) {
  if (!isConfigured() || !classDoc?.studentCourseSlug) return { delivered: false, reason: 'NOT_LINKED' };
  try {
    await call('/api/internal/tasks', {
      method: 'POST',
      body: JSON.stringify({
        studentCourseSlug: classDoc.studentCourseSlug,
        title: assignment.title,
        description: [assignment.description, assignment.instructions].filter(Boolean).join('\n\n'),
        moduleTitle: classDoc.subject || '',
        dueDate: assignment.dueDate,
        // No natural mapping exists between a grading maxScore (a 0-100
        // grading scale) and the student portal's gamified XP reward - left
        // unset so the student side's own default (30) applies uniformly,
        // rather than inventing a fabricated conversion formula.
        sourceId: String(assignment._id),
      }),
    });
    return { delivered: true };
  } catch (err) {
    console.error('[studentBridge] Failed to deliver task to student portal:', err.message);
    return { delivered: false, reason: 'REQUEST_FAILED', error: err.message };
  }
}

/** Retracts (unpublishes) a previously-bridged task from the student portal — used when an assignment is archived. Best-effort. */
export async function retractTaskFromStudents(assignmentId) {
  if (!isConfigured()) return { retracted: false, reason: 'NOT_CONFIGURED' };
  try {
    await call(`/api/internal/tasks/${assignmentId}`, { method: 'DELETE' });
    return { retracted: true };
  } catch (err) {
    console.error('[studentBridge] Failed to retract task from student portal:', err.message);
    return { retracted: false, reason: 'REQUEST_FAILED', error: err.message };
  }
}

/** Pushes a newly-scheduled YouTube live session to the student portal. Best-effort — never throws. No-op when the class has no course link. */
export async function pushLiveClassToStudents(session, classDoc, teacherName) {
  if (!isConfigured() || !classDoc?.studentCourseSlug) return { delivered: false, reason: 'NOT_LINKED' };
  try {
    await call('/api/internal/live-classes', {
      method: 'POST',
      body: JSON.stringify({
        studentCourseSlug: classDoc.studentCourseSlug,
        // Scopes the lecture to THIS batch on the student side; without it the
        // session is delivered to every batch of the course.
        batchId: String(classDoc._id),
        title: session.topic || `${classDoc.subject || 'Class'} Live Session`,
        instructor: teacherName || 'Your Teacher',
        scheduledAt: session.startAt,
        durationMinutes: session.durationMinutes,
        joinUrl: session.youtubeUrl,
        sourceId: String(session._id),
      }),
    });
    return { delivered: true };
  } catch (err) {
    console.error('[studentBridge] Failed to deliver live class to student portal:', err.message);
    return { delivered: false, reason: 'REQUEST_FAILED', error: err.message };
  }
}

/**
 * Updates a previously-bridged live class IN PLACE (the reschedule path) —
 * a real PATCH on the student portal's own LiveClass document by
 * `sourceId`, never a delete+recreate, so the session's identity there
 * (and any already-sent notifications referencing it) stay intact. Best-effort — never throws.
 */
export async function updateLiveClassToStudents(session, teacherName) {
  if (!isConfigured()) return { delivered: false, reason: 'NOT_CONFIGURED' };
  try {
    await call(`/api/internal/live-classes/${String(session._id)}`, {
      method: 'PATCH',
      body: JSON.stringify({
        title: session.topic || undefined,
        scheduledAt: session.startAt,
        durationMinutes: session.durationMinutes,
        joinUrl: session.youtubeUrl || undefined,
      }),
    });
    return { delivered: true };
  } catch (err) {
    console.error('[studentBridge] Failed to update live class on student portal:', err.message);
    return { delivered: false, reason: 'REQUEST_FAILED', error: err.message };
  }
}

/** Cancels/removes a previously-bridged live class on the student portal. Best-effort. */
export async function retractLiveClassFromStudents(sessionId, reason = 'cancelled') {
  if (!isConfigured()) return { retracted: false, reason: 'NOT_CONFIGURED' };
  try {
    await call(`/api/internal/live-classes/${sessionId}?reason=${reason}`, { method: 'DELETE' });
    return { retracted: true };
  } catch (err) {
    console.error('[studentBridge] Failed to retract live class from student portal:', err.message);
    return { retracted: false, reason: 'REQUEST_FAILED', error: err.message };
  }
}

/**
 * Pushes a real grade back to the student portal's own TaskSubmission — the
 * return leg of the task bridge (submission.service.js#gradeSubmission
 * calls this when the graded Submission carries a `studentSubmissionSourceId`,
 * meaning it originated from receiveBridgedSubmission). No-op for a
 * teacher-native submission with no student-portal origin. Best-effort —
 * never throws; a delivery failure must not fail the grading action itself.
 */
export async function pushGradeToStudent({ studentSubmissionSourceId, score, maxScore, feedback }) {
  if (!isConfigured() || !studentSubmissionSourceId) return { delivered: false, reason: 'NOT_LINKED' };
  try {
    await call(`/api/internal/task-submissions/${studentSubmissionSourceId}/grade`, {
      method: 'PATCH',
      body: JSON.stringify({ score, maxScore, feedback: feedback || null }),
    });
    return { delivered: true };
  } catch (err) {
    console.error('[studentBridge] Failed to deliver grade to student portal:', err.message);
    return { delivered: false, reason: 'REQUEST_FAILED', error: err.message };
  }
}

/** Pushes a teacher's reply to a bridged (external) conversation to the student portal. Best-effort — never throws. */
export async function pushMessageToStudent(externalStudentId, text, teacherName) {
  if (!isConfigured()) return { delivered: false, reason: 'NOT_CONFIGURED' };
  try {
    await call('/api/internal/messages', {
      method: 'POST',
      body: JSON.stringify({ studentUserId: externalStudentId, text, teacherName: teacherName || null }),
    });
    return { delivered: true };
  } catch (err) {
    console.error('[studentBridge] Failed to deliver message to student portal:', err.message);
    return { delivered: false, reason: 'REQUEST_FAILED', error: err.message };
  }
}

/** Pushes an active, question-bearing exam to the student portal as a real quiz. Best-effort — never throws. No-op when the class has no course link. */
export async function pushQuizToStudents(exam, classDoc) {
  if (!isConfigured() || !classDoc?.studentCourseSlug) return { delivered: false, reason: 'NOT_LINKED' };
  try {
    await call('/api/internal/quizzes', {
      method: 'POST',
      body: JSON.stringify({
        studentCourseSlug: classDoc.studentCourseSlug,
        title: exam.title,
        moduleTitle: classDoc.subject || '',
        timeLimitMins: exam.durationMinutes,
        questions: exam.questions.map((q, i) => ({
          questionId: `q-${i}`,
          question: q.question,
          options: q.options,
          correctIndex: q.correctIndex,
          explanation: q.explanation || '',
        })),
        sourceId: String(exam._id),
      }),
    });
    return { delivered: true };
  } catch (err) {
    console.error('[studentBridge] Failed to deliver quiz to student portal:', err.message);
    return { delivered: false, reason: 'REQUEST_FAILED', error: err.message };
  }
}

/** Unpublishes a previously-bridged quiz on the student portal — used when an exam is deleted. Best-effort. */
export async function retractQuizFromStudents(examId) {
  if (!isConfigured()) return { retracted: false, reason: 'NOT_CONFIGURED' };
  try {
    await call(`/api/internal/quizzes/${examId}`, { method: 'DELETE' });
    return { retracted: true };
  } catch (err) {
    console.error('[studentBridge] Failed to retract quiz from student portal:', err.message);
    return { retracted: false, reason: 'REQUEST_FAILED', error: err.message };
  }
}

/**
 * Lists the student portal's published purchasable courses (slug + title
 * only), used to populate the "link this class to a course" picker on the
 * Classes page. Public endpoint on the student side - no service key
 * needed - but still funneled through this backend rather than fetched
 * directly by the browser, so the frontend never talks to another portal's
 * backend directly. Best-effort: an empty list on failure just means the
 * picker shows no options, not a broken page.
 */
export async function fetchStudentCourseCatalog() {
  if (!env.studentBridge.url) return { ok: false, reason: 'NOT_CONFIGURED', courses: [] };
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    try {
      const res = await fetch(`${env.studentBridge.url}/api/public/courses`, { signal: controller.signal });
      if (!res.ok) return { ok: false, reason: 'UPSTREAM_ERROR', status: res.status, courses: [] };
      const body = await res.json();
      const courses = (body?.data || [])
        .filter((c) => c && typeof c.slug === 'string' && c.slug)
        .map((c) => ({
          slug: c.slug,
          title: c.title,
          category: c.category || null,
          instructor: c.instructor || null,
          priceInPaise: typeof c.priceInPaise === 'number' ? c.priceInPaise : null,
          // The student portal only lists published courses here, so every
          // entry is linkable; isPurchasable additionally says whether new
          // enrollments can still be bought, which the picker surfaces so a
          // teacher can tell a closed course from an open one.
          isPurchasable: Boolean(c.isPurchasable),
        }));
      return { ok: true, courses };
    } finally {
      clearTimeout(timeout);
    }
  } catch (err) {
    console.error('[studentBridge] Failed to fetch student course options:', err.message);
    return { ok: false, reason: 'REQUEST_FAILED', error: err.message, courses: [] };
  }
}

/** Best-effort list form, for display-only callers (the picker, the course-title map) where an empty list just means "nothing to show". */
export async function fetchStudentCourseOptions() {
  const { courses } = await fetchStudentCourseCatalog();
  return courses;
}

/**
 * Fetches the REAL, currently-active enrolled/purchased students for the
 * course linked to `studentCourseSlug` — the sole source of truth this
 * backend has for "did this person actually enroll", per the student
 * portal's own Enrollment collection (never this backend's own
 * teacher-curated Student roster, which only tracks who a teacher has
 * chosen to add and carries no purchase verification of its own). Returns
 * an empty array (not an error) when unconfigured/unreachable/unlinked —
 * callers must treat that as "nothing to show", never fall back to fake data.
 */
export async function fetchEnrollmentSnapshot(studentCourseSlug, { batchId } = {}) {
  if (!isConfigured()) return { ok: false, reason: 'NOT_CONFIGURED', students: [] };
  if (!studentCourseSlug) return { ok: false, reason: 'NOT_LINKED', students: [] };
  try {
    // Scoped to ONE batch when the caller has one. A course runs several
    // batches, so an unscoped answer lists every student who bought the course
    // and each batch would import all of them.
    const query = batchId ? `?batchId=${encodeURIComponent(batchId)}` : '';
    const result = await call(`/api/internal/courses/${encodeURIComponent(studentCourseSlug)}/enrolled-students${query}`, { method: 'GET' });
    return { ok: true, students: result?.data || [] };
  } catch (err) {
    console.error('[studentBridge] Failed to fetch enrolled students:', err.message);
    return { ok: false, reason: 'REQUEST_FAILED', error: err.message, students: [] };
  }
}

/** Best-effort list form. Callers that must not confuse "nobody is enrolled" with "we could not ask" use fetchEnrollmentSnapshot instead. */
export async function fetchEnrolledStudents(studentCourseSlug) {
  const { students } = await fetchEnrollmentSnapshot(studentCourseSlug);
  return students;
}

export default {
  pushAnnouncementToStudents,
  retractAnnouncementFromStudents,
  pushResourceToStudents,
  retractResourceFromStudents,
  pushTaskToStudents,
  retractTaskFromStudents,
  pushLiveClassToStudents,
  updateLiveClassToStudents,
  retractLiveClassFromStudents,
  pushMessageToStudent,
  pushQuizToStudents,
  retractQuizFromStudents,
  fetchStudentCourseCatalog,
  fetchStudentCourseOptions,
  fetchEnrollmentSnapshot,
  fetchEnrolledStudents,
  pushGradeToStudent,
};
