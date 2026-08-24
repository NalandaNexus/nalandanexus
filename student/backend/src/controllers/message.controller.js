import { asyncHandler } from '../utils/asyncHandler.js';
import { sendSuccess } from '../utils/apiResponse.js';
import { Message } from '../models/Message.js';
import { resolveAssignedTeacher } from '../services/assignedTeacher.service.js';
import { pushMessageToTeacher } from '../services/teacherBridge.service.js';

export const listMessages = asyncHandler(async (req, res) => {
  const [messages, assignedTeacher] = await Promise.all([
    Message.find({ userId: req.user._id }).sort({ createdAt: 1 }).limit(200),
    resolveAssignedTeacher(req.user._id),
  ]);
  await Message.updateMany({ userId: req.user._id, sender: 'teacher', isRead: false }, { isRead: true });
  return sendSuccess(res, { data: messages, meta: { teacherName: assignedTeacher?.name || null } });
});

/**
 * Student -> teacher. Persists locally (source of truth for this student's
 * inbox), then delivers live to the real assigned teacher's own inbox via
 * the bidirectional bridge - best-effort, never blocks the send that
 * already succeeded here (master doc: "instant, persisted communication").
 */
export const sendMessage = asyncHandler(async (req, res) => {
  const assignedTeacher = await resolveAssignedTeacher(req.user._id);

  const message = await Message.create({
    userId: req.user._id,
    sender: 'student',
    body: req.body.body,
    teacherId: assignedTeacher?.teacherId || null,
    teacherName: assignedTeacher?.name || null,
  });

  if (assignedTeacher?.courseSlug) {
    await pushMessageToTeacher({
      studentCourseSlug: assignedTeacher.courseSlug,
      externalStudentId: String(req.user._id),
      externalStudentName: req.user.name,
      text: req.body.body,
    });
  }

  return sendSuccess(res, { status: 201, message: 'Message sent.', data: message });
});
