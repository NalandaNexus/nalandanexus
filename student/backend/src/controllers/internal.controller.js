import { asyncHandler } from '../utils/asyncHandler.js';
import { sendSuccess } from '../utils/apiResponse.js';
import { AppError } from '../utils/AppError.js';
import { Announcement } from '../models/Announcement.js';
import { Course } from '../models/Course.js';
import { CourseMaterial } from '../models/CourseMaterial.js';
import { Resource } from '../models/Resource.js';
import { Task } from '../models/Task.js';
import { LiveClass } from '../models/LiveClass.js';
import { Message } from '../models/Message.js';
import { User } from '../models/User.js';
import { Quiz } from '../models/Quiz.js';
import { Enrollment } from '../models/Enrollment.js';
import { Notification } from '../models/Notification.js';
import { TaskSubmission } from '../models/TaskSubmission.js';
import { StudentProfile } from '../models/StudentProfile.js';
import { createAnnouncement as createAnnouncementService } from '../services/announcement.service.js';

/**
 * Resolves a teacher-supplied `studentCourseSlug` to a real Course _id,
 * server-side — the bridge payload is trusted for WHAT to deliver (title,
 * file, etc.) but never for WHICH course, same as every other internal
 * endpoint here. Returns null (not an error) when the slug doesn't match
 * any published course, so a stale/typo'd link just silently doesn't
 * bridge rather than 500ing the caller's primary flow.
 */
async function resolveCourseIdFromSlug(slug) {
  if (!slug) return null;
  const course = await Course.findOne({ slug, isPublished: true }).select('_id');
  return course?._id || null;
}

/**
 * Receives a just-published announcement from the teacher backend's
 * cross-portal bridge (see teacher/backend/src/services/studentBridge.service.js)
 * and delivers it exactly the way a native admin-authored one is delivered
 * - persisted here, then pushed live to every connected student via the
 * same `createAnnouncement` service/socket path `POST /api/admin/announcements`
 * already uses. Idempotent on `sourceId` (the teacher portal's own
 * Announcement _id): a retried delivery must not create a duplicate.
 */
export const createBridgedAnnouncement = asyncHandler(async (req, res) => {
  const { title, content, type, publishAt, expiresAt, sourceId, authorName, courseSlugs, source } = req.body;
  const resolvedSource = source || 'teacher-portal';

  if (sourceId) {
    const existing = await Announcement.findOne({ source: resolvedSource, sourceId });
    if (existing) {
      return sendSuccess(res, { status: 200, message: 'Already delivered.', data: existing });
    }
  }

  const courseIds = (
    await Promise.all((courseSlugs || []).map((slug) => resolveCourseIdFromSlug(slug)))
  ).filter(Boolean);

  const announcement = await createAnnouncementService({
    title,
    content,
    type: type || 'general',
    publishAt,
    expiresAt: expiresAt || null,
    source: resolvedSource,
    sourceId: sourceId || null,
    externalAuthorName: authorName || null,
    courseIds,
  });

  return sendSuccess(res, { status: 201, message: 'Delivered to students.', data: announcement });
});

// A bridged announcement's sourceId is a real MongoDB ObjectId minted by
// whichever portal authored it (teacher or admin) - collision between the
// two is not a practical concern, so update/retract match on sourceId
// across BOTH bridged sources rather than requiring the caller to also
// name which one, which keeps this endpoint correct for admin-originated
// announcements too even though only teacher/backend calls it today.
const BRIDGED_SOURCES = ['teacher-portal', 'admin-portal'];

export const updateBridgedAnnouncement = asyncHandler(async (req, res) => {
  const announcement = await Announcement.findOneAndUpdate(
    { source: { $in: BRIDGED_SOURCES }, sourceId: req.params.sourceId },
    { $set: req.body },
    { new: true }
  );
  if (!announcement) throw AppError.notFound('No bridged announcement with that source id.', 'ANNOUNCEMENT_NOT_FOUND');
  return sendSuccess(res, { message: 'Updated.', data: announcement });
});

/** Retracts (deletes) a bridged announcement — used when the teacher/admin archives or deletes the source. Idempotent: retracting twice is not an error. */
export const deleteBridgedAnnouncement = asyncHandler(async (req, res) => {
  const announcement = await Announcement.findOneAndDelete({ source: { $in: BRIDGED_SOURCES }, sourceId: req.params.sourceId });
  if (!announcement) {
    return sendSuccess(res, { message: 'Already removed.', data: { sourceId: req.params.sourceId } });
  }
  return sendSuccess(res, { message: 'Removed.', data: { id: announcement._id } });
});

// --- Course materials (teacher-uploaded resources) ------------------------

/**
 * Receives a just-uploaded resource from the teacher backend's cross-portal
 * bridge (teacher/backend/src/services/studentBridge.service.js). Silently
 * no-ops (200, not delivered) when the class has no linked student course -
 * the teacher-side upload already succeeded and is the source of truth; a
 * missing link is a configuration gap, not a failure to report. Idempotent
 * on `sourceId` (the teacher portal's own Resource _id).
 */
export const createBridgedMaterial = asyncHandler(async (req, res) => {
  const { studentCourseSlug, title, moduleTitle, uploadedByName, fileUrl, fileName, fileType, fileSizeBytes, sourceId } = req.body;

  const existing = await CourseMaterial.findOne({ source: 'teacher-portal', sourceId });
  if (existing) {
    return sendSuccess(res, { status: 200, message: 'Already delivered.', data: existing });
  }

  const courseId = await resolveCourseIdFromSlug(studentCourseSlug);
  if (!courseId) {
    return sendSuccess(res, { status: 200, message: 'No matching student course - not delivered.', data: null });
  }

  const material = await CourseMaterial.create({
    courseId,
    title,
    moduleTitle,
    uploadedByName,
    fileUrl,
    fileName,
    fileType,
    fileSizeBytes,
    source: 'teacher-portal',
    sourceId,
  });

  try {
    const { emitToCourse } = await import('../sockets/index.js');
    emitToCourse(courseId, 'course:notes_added', { id: material._id, title: material.title, courseId: String(courseId) });
  } catch {
    // socket layer optional - never break the bridge delivery itself
  }

  await notifyEnrolledStudents(courseId, {
    title: `New resource: "${title}"`,
    description: uploadedByName ? `${uploadedByName} uploaded a new resource for your course.` : 'A new resource is available for your course.',
    link: '/student/notes',
  });

  return sendSuccess(res, { status: 201, message: 'Delivered to students.', data: material });
});

/** Retracts (deletes) a bridged material — used when the teacher deletes the source resource. Idempotent. */
export const deleteBridgedMaterial = asyncHandler(async (req, res) => {
  const material = await CourseMaterial.findOneAndDelete({ source: 'teacher-portal', sourceId: req.params.sourceId });
  if (!material) {
    return sendSuccess(res, { message: 'Already removed.', data: { sourceId: req.params.sourceId } });
  }
  return sendSuccess(res, { message: 'Removed.', data: { id: material._id } });
});

// --- Tasks (teacher-authored assignments) ---------------------------------

/**
 * Upserts a bridged task by `sourceId` (the teacher portal's Assignment
 * _id) — handles both first delivery and subsequent edits (title/dueDate
 * changes) with one idempotent call, unlike the announcement/material
 * bridges which split create vs update. `taskId` (this collection's own
 * unique human-readable key) is derived from `sourceId` since a bridged
 * task has no natural slug of its own.
 */
export const upsertBridgedTask = asyncHandler(async (req, res) => {
  const { studentCourseSlug, title, description, moduleTitle, dueDate, pointsReward, sourceId } = req.body;

  const courseId = await resolveCourseIdFromSlug(studentCourseSlug);
  if (!courseId) {
    return sendSuccess(res, { status: 200, message: 'No matching student course - not delivered.', data: null });
  }

  const isNew = !(await Task.exists({ source: 'teacher-portal', sourceId }));
  const task = await Task.findOneAndUpdate(
    { source: 'teacher-portal', sourceId },
    {
      taskId: `teacher-${sourceId}`,
      courseId,
      title,
      type: 'Task',
      description,
      moduleTitle,
      dueDate,
      pointsReward,
      isPublished: true,
      source: 'teacher-portal',
      sourceId,
    },
    { upsert: true, new: true }
  );

  if (isNew) {
    try {
      const { emitToCourse } = await import('../sockets/index.js');
      emitToCourse(courseId, 'course:task_created', { id: task._id, title: task.title, courseId: String(courseId) });
    } catch {
      // socket layer optional
    }
    await notifyEnrolledStudents(courseId, {
      title: `New assignment: "${task.title}"`,
      description: 'A new assignment has been posted for your course.',
      link: '/student/tasks',
    });
  }

  return sendSuccess(res, { status: isNew ? 201 : 200, message: isNew ? 'Delivered to students.' : 'Updated.', data: task });
});

/** Retracts (unpublishes) a bridged task — used when the teacher archives the source assignment. Idempotent. */
export const retractBridgedTask = asyncHandler(async (req, res) => {
  const task = await Task.findOneAndUpdate(
    { source: 'teacher-portal', sourceId: req.params.sourceId },
    { isPublished: false },
    { new: true }
  );
  if (!task) {
    return sendSuccess(res, { message: 'Already removed.', data: { sourceId: req.params.sourceId } });
  }
  return sendSuccess(res, { message: 'Removed.', data: { id: task._id } });
});

/**
 * Creates a real, persisted Notification for every actively-enrolled
 * student in a course and pushes it live — the shared helper behind both
 * the reschedule and cancellation paths below, so a student is actively
 * told about a real disruption to their schedule rather than just seeing
 * their dashboard silently re-render.
 */
async function notifyEnrolledStudents(courseId, { title, description, link }) {
  if (!courseId) return;
  const enrollments = await Enrollment.find({ courseId, status: 'active' }).select('userId').lean();
  if (!enrollments.length) return;
  const docs = enrollments.map((e) => ({ userId: e.userId, title, description, type: 'course', link: link || null }));
  const created = await Notification.insertMany(docs);
  try {
    const { emitNotificationCreated } = await import('../sockets/index.js');
    created.forEach((n) => emitNotificationCreated(n.userId, n));
  } catch {
    // socket layer optional
  }
}

// --- Live classes (YouTube lectures) ---------------------------------------

/** Delivers a newly-scheduled teacher-portal live session. Idempotent on `sourceId` (the ClassSession _id). */
export const createBridgedLiveClass = asyncHandler(async (req, res) => {
  const { studentCourseSlug, title, instructor, scheduledAt, durationMinutes, joinUrl, sourceId } = req.body;

  const existing = await LiveClass.findOne({ source: 'teacher-portal', sourceId });
  if (existing) {
    return sendSuccess(res, { status: 200, message: 'Already delivered.', data: existing });
  }

  const courseId = await resolveCourseIdFromSlug(studentCourseSlug);
  if (!courseId) {
    return sendSuccess(res, { status: 200, message: 'No matching student course - not delivered.', data: null });
  }

  const liveClass = await LiveClass.create({
    courseId,
    title,
    instructor,
    scheduledAt,
    durationMinutes,
    joinUrl,
    status: 'upcoming',
    isPublished: true,
    source: 'teacher-portal',
    sourceId,
  });

  try {
    const { emitToCourse } = await import('../sockets/index.js');
    emitToCourse(courseId, 'course:lecture_created', { id: liveClass._id, title: liveClass.title, courseId: String(courseId) });
  } catch {
    // socket layer optional
  }

  const when = new Date(liveClass.scheduledAt).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' });
  await notifyEnrolledStudents(courseId, {
    title: `New live class: "${liveClass.title}"`,
    description: `Scheduled for ${when}.`,
    link: '/student/live-classes',
  });

  return sendSuccess(res, { status: 201, message: 'Delivered to students.', data: liveClass });
});

/**
 * Updates a previously-bridged live class in place — the reschedule path.
 * Deliberately a real update on the SAME document (never delete+recreate),
 * so the session's identity/history and any student notifications already
 * tied to its _id stay intact. A reschedule that doesn't explicitly pass
 * `status` resets it to 'upcoming' - the natural meaning of "this session
 * now has a new time" even if it had been 'cancelled' or 'completed'.
 */
export const updateBridgedLiveClass = asyncHandler(async (req, res) => {
  const { title, scheduledAt, durationMinutes, joinUrl, status } = req.body;

  const update = { status: status || 'upcoming' };
  if (title !== undefined) update.title = title;
  if (scheduledAt !== undefined) update.scheduledAt = scheduledAt;
  if (durationMinutes !== undefined) update.durationMinutes = durationMinutes;
  if (joinUrl !== undefined) update.joinUrl = joinUrl;

  const before = await LiveClass.findOne({ source: 'teacher-portal', sourceId: req.params.sourceId }).select('scheduledAt courseId').lean();
  if (!before) throw AppError.notFound('No bridged live class with that source id.', 'LIVE_CLASS_NOT_FOUND');
  const timeActuallyChanged = scheduledAt !== undefined && new Date(scheduledAt).getTime() !== new Date(before.scheduledAt).getTime();

  const liveClass = await LiveClass.findOneAndUpdate(
    { source: 'teacher-portal', sourceId: req.params.sourceId },
    update,
    { new: true }
  );

  try {
    const { emitToCourse } = await import('../sockets/index.js');
    emitToCourse(liveClass.courseId, 'course:lecture_rescheduled', {
      id: liveClass._id,
      title: liveClass.title,
      scheduledAt: liveClass.scheduledAt,
      status: liveClass.status,
      courseId: String(liveClass.courseId),
    });
  } catch {
    // socket layer optional
  }

  // A genuine time change is the one case students must be actively told
  // about (not just have their dashboard silently re-render).
  if (timeActuallyChanged) {
    const when = new Date(liveClass.scheduledAt).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' });
    await notifyEnrolledStudents(liveClass.courseId, {
      title: `"${liveClass.title}" rescheduled`,
      description: `The live class has been moved to ${when}.`,
      link: '/student/live-classes',
    });
  }

  return sendSuccess(res, { message: 'Updated.', data: liveClass });
});

/** Cancels/removes a previously-bridged live class — used when the teacher cancels the source session. Idempotent. */
export const retractBridgedLiveClass = asyncHandler(async (req, res) => {
  const liveClass = await LiveClass.findOneAndUpdate(
    { source: 'teacher-portal', sourceId: req.params.sourceId },
    { status: 'cancelled' },
    { new: true }
  );
  if (!liveClass) {
    return sendSuccess(res, { message: 'Already removed.', data: { sourceId: req.params.sourceId } });
  }

  try {
    const { emitToCourse } = await import('../sockets/index.js');
    emitToCourse(liveClass.courseId, 'course:lecture_cancelled', { id: liveClass._id, courseId: String(liveClass.courseId) });
  } catch {
    // socket layer optional
  }

  await notifyEnrolledStudents(liveClass.courseId, {
    title: `"${liveClass.title}" cancelled`,
    description: 'This live class has been cancelled by your teacher.',
    link: '/student/live-classes',
  });

  return sendSuccess(res, { message: 'Cancelled.', data: { id: liveClass._id } });
});

// --- Quizzes (teacher-authored exams with real questions) -----------------

/**
 * Upserts a bridged quiz by `sourceId` (the teacher portal's Exam _id) —
 * handles both first delivery and subsequent edits (question changes,
 * duration changes) with one idempotent call, mirroring upsertBridgedTask.
 * `quizId` (this collection's own unique human-readable key) is derived
 * from `sourceId`.
 */
export const upsertBridgedQuiz = asyncHandler(async (req, res) => {
  const { studentCourseSlug, title, moduleTitle, timeLimitMins, questions, sourceId } = req.body;

  const courseId = await resolveCourseIdFromSlug(studentCourseSlug);
  if (!courseId) {
    return sendSuccess(res, { status: 200, message: 'No matching student course - not delivered.', data: null });
  }

  const isNew = !(await Quiz.exists({ source: 'teacher-portal', sourceId }));
  const quiz = await Quiz.findOneAndUpdate(
    { source: 'teacher-portal', sourceId },
    {
      quizId: `teacher-${sourceId}`,
      courseId,
      title,
      moduleTitle,
      timeLimitMins,
      questions,
      isPublished: true,
      source: 'teacher-portal',
      sourceId,
    },
    { upsert: true, new: true }
  );

  if (isNew) {
    try {
      const { emitToCourse } = await import('../sockets/index.js');
      emitToCourse(courseId, 'course:quiz_created', { id: quiz._id, title: quiz.title, courseId: String(courseId) });
    } catch {
      // socket layer optional
    }
    await notifyEnrolledStudents(courseId, {
      title: `New quiz: "${quiz.title}"`,
      description: 'A new quiz has been posted for your course.',
      link: '/student/quizzes',
    });
  }

  return sendSuccess(res, { status: isNew ? 201 : 200, message: isNew ? 'Delivered to students.' : 'Updated.', data: quiz });
});

/** Unpublishes a bridged quiz — used when the teacher deletes the source exam. Idempotent. */
export const retractBridgedQuiz = asyncHandler(async (req, res) => {
  const quiz = await Quiz.findOneAndUpdate(
    { source: 'teacher-portal', sourceId: req.params.sourceId },
    { isPublished: false },
    { new: true }
  );
  if (!quiz) {
    return sendSuccess(res, { message: 'Already removed.', data: { sourceId: req.params.sourceId } });
  }
  return sendSuccess(res, { message: 'Removed.', data: { id: quiz._id } });
});

// --- Enrolled students (read) — the "who is really enrolled" query --------

/**
 * Returns the REAL, currently-active enrolled students for a course, keyed
 * by the student portal's own `Enrollment` collection — the sole source of
 * truth for "has this person actually purchased/enrolled" (see
 * models/Enrollment.js). This is what lets teacher/backend distinguish a
 * genuinely paying/enrolled student from someone who merely has an account,
 * rather than trusting a locally-curated roster. Deliberately read-only and
 * course-scoped: never returns a student's payment/order details, only the
 * identity + enrollment fields a teacher legitimately needs.
 */
export const listEnrolledStudents = asyncHandler(async (req, res) => {
  const course = await Course.findOne({ slug: req.params.slug }).select('_id');
  if (!course) {
    return sendSuccess(res, { message: 'No matching student course.', data: [] });
  }

  const enrollments = await Enrollment.find({ courseId: course._id, status: 'active' })
    .populate('userId', 'name email avatar')
    .sort({ enrolledAt: -1 })
    .lean();

  const students = enrollments
    .filter((e) => e.userId) // drop any enrollment whose user was hard-deleted
    .map((e) => ({
      userId: String(e.userId._id),
      name: e.userId.name,
      email: e.userId.email,
      avatar: e.userId.avatar || null,
      enrolledAt: e.enrolledAt,
      progressPercent: e.progressPercent,
    }));

  return sendSuccess(res, { message: 'Enrolled students.', data: students });
});

// --- Messages (teacher -> student, the other bridge direction) -----------

/**
 * Delivers a teacher's reply into the student's own message thread and
 * pushes it live over this backend's own Socket.IO — the other half of the
 * bidirectional bridge (student -> teacher is
 * services/teacherBridge.service.js#pushMessageToTeacher).
 */
export const deliverTeacherMessage = asyncHandler(async (req, res) => {
  const { studentUserId, text, teacherName } = req.body;

  const user = await User.findById(studentUserId).select('_id');
  if (!user) {
    return sendSuccess(res, { status: 200, message: 'No matching student - not delivered.', data: null });
  }

  const message = await Message.create({
    userId: studentUserId,
    sender: 'teacher',
    body: text,
    teacherName: teacherName || null,
  });

  try {
    const { emitToUser, emitNotificationCreated } = await import('../sockets/index.js');
    emitToUser(studentUserId, 'message.created', message);

    const notification = await Notification.create({
      userId: studentUserId,
      title: `New message from ${teacherName || 'your teacher'}`,
      description: text.length > 140 ? `${text.slice(0, 140)}…` : text,
      type: 'message',
      link: '/student/messages',
    });
    emitNotificationCreated(studentUserId, notification);
  } catch {
    // socket/notification layer optional - never break message delivery itself
  }

  return sendSuccess(res, { status: 201, message: 'Delivered to student.', data: message });
});

// --- Courses (admin -> student, publishing the real purchasable catalog) --

/**
 * Publishes (creates or updates) a real purchasable course from an
 * admin-approved governance record. Never deletes on retraction (see
 * unpublishBridgedCourse) - a student may already own it. `modules` is
 * deliberately left empty on create: admin authors commerce metadata only,
 * not lesson/video content, which stays this backend's own separate,
 * already-existing authoring surface.
 */
export const upsertBridgedCourse = asyncHandler(async (req, res) => {
  const { sourceId, slug, title, description, features, priceInPaise, image } = req.body;

  const course = await Course.findOneAndUpdate(
    { source: 'admin-portal', sourceId },
    {
      $set: {
        slug,
        title,
        description: description || '',
        skills: features || [],
        priceInPaise: priceInPaise || 0,
        bannerImage: image || '',
        isPurchasable: true,
        isPublished: true,
        source: 'admin-portal',
        sourceId,
      },
      $setOnInsert: { modules: [] },
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );

  return sendSuccess(res, { status: 201, message: 'Published to catalog.', data: course });
});

/** Unpublishes (never deletes) a previously-bridged course when admin archives/rejects it. */
export const unpublishBridgedCourse = asyncHandler(async (req, res) => {
  const course = await Course.findOneAndUpdate(
    { source: 'admin-portal', sourceId: req.params.sourceId },
    // Both flags, not just isPurchasable. The public catalog (list, detail,
    // search, stats) filters exclusively on isPublished, so clearing only
    // the purchase flag left an archived course still browsable on the
    // storefront - visible, described, priced, and merely un-buyable. An
    // admin who archives a course means "take it down", so retract it from
    // the catalog too. Existing enrollments are unaffected: enrolled
    // students read their course through Enrollment, not this filter, which
    // is why this stays an unpublish and never a delete.
    { isPurchasable: false, isPublished: false },
    { new: true }
  );
  if (!course) {
    return sendSuccess(res, { message: 'No matching bridged course.', data: { sourceId: req.params.sourceId } });
  }
  return sendSuccess(res, { message: 'Unpublished.', data: { id: course._id } });
});

// --- Task submission grading (teacher -> student, return leg of the task
// bridge) --------------------------------------------------------------

/**
 * Records a real teacher grade on a bridged TaskSubmission - the return leg
 * that never previously existed (see task.controller.js#submitTask, which
 * used to fabricate a fixed taskScore instead of waiting for this). Matches
 * by `:sourceId` = this submission's own _id, which was sent outbound in
 * pushTaskSubmission and stored by teacher/backend on its own Submission
 * doc. Recalculates the student's real averageTaskScore from the genuine
 * percentage, never a placeholder.
 */
export const gradeBridgedTaskSubmission = asyncHandler(async (req, res) => {
  const { score, maxScore, feedback } = req.body;

  const submission = await TaskSubmission.findByIdAndUpdate(
    req.params.sourceId,
    { teacherScore: score, teacherMaxScore: maxScore, teacherFeedback: feedback || null, gradedAt: new Date() },
    { new: true }
  );
  if (!submission) {
    return sendSuccess(res, { message: 'No matching submission - not recorded.', data: null });
  }

  const profile = await StudentProfile.findOne({ userId: submission.userId });
  if (profile) {
    // Computed fresh from every graded submission this user has, rather
    // than a stateful running-average - tasksCompleted increments at
    // SUBMISSION time (before any real score exists), so reusing it as the
    // running-average's "n" (as recalculateAverages does for quizzes, whose
    // score+completion always land in the same request) double-counts
    // ungraded tasks and dilutes the average. Confirmed via live QA: a
    // single 92/100 grade showed as 46% before this fix.
    const gradedSubmissions = await TaskSubmission.find({ userId: submission.userId, teacherScore: { $ne: null } })
      .select('teacherScore teacherMaxScore')
      .lean();
    const percentages = gradedSubmissions.map((s) => (s.teacherMaxScore > 0 ? (s.teacherScore / s.teacherMaxScore) * 100 : 0));
    profile.stats.averageTaskScore = percentages.length
      ? Math.round(percentages.reduce((a, b) => a + b, 0) / percentages.length)
      : 0;
    await profile.save();
  }

  const notification = await Notification.create({
    userId: submission.userId,
    title: 'Your assignment was graded',
    description: `You scored ${score}/${maxScore}${feedback ? ` — "${feedback.length > 100 ? `${feedback.slice(0, 100)}…` : feedback}"` : ''}.`,
    type: 'course',
    link: '/student/tasks',
  });
  try {
    const { emitToUser, emitNotificationCreated } = await import('../sockets/index.js');
    emitToUser(submission.userId, 'task.graded', { submissionId: String(submission._id), score, maxScore });
    emitNotificationCreated(submission.userId, notification);
  } catch {
    // socket layer optional
  }

  return sendSuccess(res, { message: 'Grade recorded.', data: submission });
});

// --- Resources (admin-uploaded magazines/events/program content) ---------

/**
 * Upserts a bridged resource by `sourceId` (admin/backend's Resource _id) -
 * one idempotent call handles both first delivery and edits, matching the
 * course bridge. Publishes on the public socket namespace immediately after
 * the write is confirmed, so the Landing Page's Resources section updates
 * live as admin uploads - see sockets/index.js#emitToPublic.
 */
export const upsertBridgedResource = asyncHandler(async (req, res) => {
  const { sourceId, title, description, type, fileUrl, fileName, fileType, fileSizeBytes, uploadedByName, isPublished } = req.body;

  const resource = await Resource.findOneAndUpdate(
    { source: 'admin-portal', sourceId },
    {
      $set: {
        title,
        description,
        type,
        fileUrl,
        fileName: fileName || null,
        fileType,
        fileSizeBytes,
        uploadedByName,
        isPublished,
        source: 'admin-portal',
        sourceId,
      },
      $setOnInsert: { publishedAt: new Date() },
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );

  try {
    const { emitToPublic } = await import('../sockets/index.js');
    emitToPublic('resource.upserted', {
      id: String(resource._id),
      title: resource.title,
      type: resource.type,
      isPublished: resource.isPublished,
    });
  } catch {
    // socket layer optional - never break the bridge delivery itself
  }

  return sendSuccess(res, { status: 201, message: 'Published to Resources.', data: resource });
});

/** Retracts (deletes) a bridged resource - used when admin deletes the source upload. Idempotent. */
export const retractBridgedResource = asyncHandler(async (req, res) => {
  const resource = await Resource.findOneAndDelete({ source: 'admin-portal', sourceId: req.params.sourceId });
  if (!resource) {
    return sendSuccess(res, { message: 'Already removed.', data: { sourceId: req.params.sourceId } });
  }

  try {
    const { emitToPublic } = await import('../sockets/index.js');
    emitToPublic('resource.deleted', { id: String(resource._id) });
  } catch {
    // socket layer optional - never break the bridge delivery itself
  }

  return sendSuccess(res, { message: 'Removed.', data: { id: resource._id } });
});

export default {
  createBridgedAnnouncement,
  updateBridgedAnnouncement,
  deleteBridgedAnnouncement,
  createBridgedMaterial,
  deleteBridgedMaterial,
  upsertBridgedTask,
  retractBridgedTask,
  createBridgedLiveClass,
  updateBridgedLiveClass,
  retractBridgedLiveClass,
  listEnrolledStudents,
  upsertBridgedQuiz,
  retractBridgedQuiz,
  deliverTeacherMessage,
  upsertBridgedCourse,
  unpublishBridgedCourse,
  upsertBridgedResource,
  retractBridgedResource,
  gradeBridgedTaskSubmission,
};
