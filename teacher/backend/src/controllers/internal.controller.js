import { catchAsync } from '../utils/catchAsync.js';
import { sendSuccess } from '../utils/ApiResponse.js';
import { resolveTeacherForCourseSlug, deliverExternalStudentMessage } from '../services/externalMessage.service.js';
import { createTeacherAccount, resetCredentials, setAccountStatus } from '../services/auth.service.js';
import { assignCourse, unassignCourse } from '../services/assignedCourse.service.js';
import { AdminAnnouncement } from '../models/AdminAnnouncement.js';
import { Teacher } from '../models/Teacher.js';
import { Notification } from '../models/Notification.js';
import { emitToAllTeachers, emitToTeacher } from '../sockets/index.js';
import { receiveBridgedSubmission } from '../services/submission.service.js';
import { receiveBridgedQuizResult } from '../services/exam.service.js';

/**
 * Persists a real, per-teacher Notification for every active teacher — the
 * `announcement:admin` socket broadcast alone only reaches a teacher who
 * happens to be connected at that exact instant; a teacher who logs in
 * later would otherwise never learn the announcement existed. Mirrors
 * notifyEnrolledStudents on the student-portal side (built for the same
 * "resource upload never notified anyone" gap).
 */
async function notifyAllTeachersOfAdminAnnouncement(announcement) {
  const teacherIds = await Teacher.find({ accountStatus: 'active' }).distinct('_id');
  if (!teacherIds.length) return;

  const docs = teacherIds.map((recipient) => ({
    recipient,
    type: 'announcement',
    title: `New announcement: "${announcement.title}"`,
    message: announcement.content.length > 140 ? `${announcement.content.slice(0, 140)}…` : announcement.content,
    relatedEntityType: 'AdminAnnouncement',
    relatedEntityId: announcement._id,
  }));
  const created = await Notification.insertMany(docs);

  created.forEach((n) => {
    emitToTeacher(n.recipient, 'notification.created', {
      id: n._id,
      type: n.type,
      title: n.title,
      message: n.message,
      isRead: n.isRead,
      relatedEntityType: n.relatedEntityType,
      relatedEntityId: n.relatedEntityId,
      createdAt: n.createdAt,
    });
  });
}

export const getTeacherForCourse = catchAsync(async (req, res) => {
  const resolved = await resolveTeacherForCourseSlug(req.params.studentCourseSlug);
  sendSuccess(res, { data: resolved });
});

/**
 * Called by admin/backend right after it creates its own governance Teacher
 * record, to actually provision the real login here. `tempPassword` is
 * plaintext in this request body deliberately — it travels only over this
 * server-to-server, shared-secret-authenticated channel, never a
 * public/user-facing endpoint. `mustChangePassword: true` is hardcoded here
 * (never client-supplied) so this path can only ever create a
 * forced-reset account, matching the master doc's mandatory first-login flow.
 */
export const provisionTeacher = catchAsync(async (req, res) => {
  const { name, email, phone, tempPassword, title, department, subject } = req.body;
  const { user, teacher } = await createTeacherAccount({
    name,
    email,
    password: tempPassword,
    phone,
    title,
    department,
    subject,
    mustChangePassword: true,
  });
  sendSuccess(res, { statusCode: 201, message: 'Teacher account provisioned.', data: { userId: user._id, teacherId: teacher._id } });
});

export const deliverMessage = catchAsync(async (req, res) => {
  const result = await deliverExternalStudentMessage(req.body);
  if (!result) {
    return sendSuccess(res, { statusCode: 200, message: 'No matching teacher for this course - not delivered.', data: null });
  }
  sendSuccess(res, { statusCode: 201, message: 'Delivered to teacher.', data: result });
});

/**
 * The "Resend Credentials" backend leg — called by admin/backend when an
 * admin resends a teacher's login credentials. Resets the REAL password on
 * this backend's own User record (the one that actually authenticates
 * Teacher Portal logins); admin's own Teacher.passwordHash is a separate,
 * cosmetic governance-record copy that admin updates on its own side.
 */
export const resetTeacherCredentials = catchAsync(async (req, res) => {
  const { email, newPassword } = req.body;
  const { user, teacher } = await resetCredentials({ email, newPassword });
  sendSuccess(res, { message: 'Teacher credentials reset.', data: { userId: user._id, teacherId: teacher._id } });
});

/**
 * Deactivates or reactivates the real Teacher Portal login - called when
 * admin deletes/restores a teacher on its own side (see
 * auth.service.js#setAccountStatus's doc-comment for the gap this closes).
 * Never throws on a not-found account - admin may delete a teacher whose
 * portal account was never fully provisioned.
 */
export const setTeacherAccountStatus = catchAsync(async (req, res) => {
  const { email, status } = req.body;
  const result = await setAccountStatus({ email, status });
  sendSuccess(res, { message: result.found ? `Account ${status}.` : 'No matching account.', data: result });
});

/**
 * Upserts a lightweight, read-only mirror of an admin-authored commerce
 * course into THIS teacher's "assigned to me" list, resolved by email since
 * admin/backend and teacher/backend have no shared ObjectId space for
 * teachers (see models/AssignedCourse.js). Never throws to the caller on a
 * missing teacher — that's a legitimate, expected outcome (e.g. the admin
 * assigned a teacher whose email doesn't match an active Teacher Portal
 * account yet), not a server error.
 */
export const upsertAssignedCourse = catchAsync(async (req, res) => {
  const result = await assignCourse({ ...req.body, sourceId: req.params.sourceId });
  sendSuccess(res, { statusCode: 200, message: result.assigned ? 'Course assigned.' : 'Not assigned.', data: result });
});

export const removeAssignedCourse = catchAsync(async (req, res) => {
  await unassignCourse(req.params.sourceId);
  sendSuccess(res, { message: 'Course unassigned.', data: null });
});

/**
 * Receives an Admin-broadcast announcement (audience 'ALL' or 'TEACHERS')
 * into the read-only AdminAnnouncement mirror and pushes it live to every
 * connected teacher — the receiving leg that never existed before (admin
 * could previously only broadcast to students, never to teachers).
 * Idempotent on `sourceId` (admin's own Announcement _id).
 */
export const upsertAdminAnnouncement = catchAsync(async (req, res) => {
  const { sourceId, title, content, priority, authorName, publishedAt } = req.body;

  const existing = await AdminAnnouncement.findOne({ sourceId });
  if (existing) {
    return sendSuccess(res, { statusCode: 200, message: 'Already delivered.', data: existing });
  }

  const announcement = await AdminAnnouncement.create({
    sourceId,
    title,
    content,
    priority: priority || 'MEDIUM',
    authorName: authorName || null,
    publishedAt: publishedAt || new Date(),
  });

  emitToAllTeachers('announcement:admin', announcement);
  await notifyAllTeachersOfAdminAnnouncement(announcement);

  sendSuccess(res, { statusCode: 201, message: 'Delivered to teachers.', data: announcement });
});

export const removeAdminAnnouncement = catchAsync(async (req, res) => {
  const announcement = await AdminAnnouncement.findOneAndDelete({ sourceId: req.params.sourceId });
  if (!announcement) {
    return sendSuccess(res, { message: 'Already removed.', data: { sourceId: req.params.sourceId } });
  }
  emitToAllTeachers('announcement:admin_removed', { sourceId: req.params.sourceId });
  sendSuccess(res, { message: 'Removed.', data: { id: announcement._id } });
});

/**
 * Receives a real student submission for a bridged assignment (Task on the
 * student side) - the missing return leg of the task bridge (see
 * submission.service.js#receiveBridgedSubmission's doc-comment). Never
 * throws to the caller on a not-found assignment - a stale/retracted
 * assignment is a legitimate, expected outcome, not a server error.
 */
export const receiveSubmission = catchAsync(async (req, res) => {
  const result = await receiveBridgedSubmission(req.body);
  sendSuccess(res, { statusCode: result.recorded ? 201 : 200, message: result.recorded ? 'Submission recorded.' : 'Not recorded.', data: result });
});

/**
 * Receives a real, server-graded quiz result for a bridged exam - the
 * missing return leg of the quiz bridge (see exam.service.js
 * #receiveBridgedQuizResult's doc-comment). Never throws on a not-found
 * exam - a stale/retracted exam is a legitimate outcome, not a server error.
 */
export const receiveQuizResult = catchAsync(async (req, res) => {
  const result = await receiveBridgedQuizResult(req.body);
  sendSuccess(res, { statusCode: result.recorded ? 201 : 200, message: result.recorded ? 'Result recorded.' : 'Not recorded.', data: result });
});

export default {
  getTeacherForCourse,
  deliverMessage,
  resetTeacherCredentials,
  setTeacherAccountStatus,
  upsertAssignedCourse,
  removeAssignedCourse,
  upsertAdminAnnouncement,
  receiveSubmission,
  receiveQuizResult,
  removeAdminAnnouncement,
};
