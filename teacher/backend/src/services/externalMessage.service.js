import { SchoolClass } from '../models/SchoolClass.js';
import { Teacher } from '../models/Teacher.js';
import { Conversation } from '../models/Conversation.js';
import { Message } from '../models/Message.js';
import { emitToTeacher } from '../sockets/index.js';
import { notifyTeacher } from './notification.service.js';

/**
 * Resolves the teacher a student-portal course's linked class belongs to —
 * backs both `GET /api/internal/teacher-for-course/:slug` (so the student
 * portal can show/cache "your teacher") and inbound message delivery below.
 * If more than one class links to the same slug (unusual — one course
 * "should" map to one teacher), the first match wins; this mirrors the
 * single-thread messaging model chosen for the student side.
 */
export async function resolveTeacherForCourseSlug(studentCourseSlug) {
  const classDoc = await SchoolClass.findOne({ studentCourseSlug, status: 'active' });
  if (!classDoc) return null;
  const teacher = await Teacher.findById(classDoc.teacher).populate('user', 'name avatarUrl').lean();
  if (!teacher) return null;
  return { teacherId: String(teacher._id), name: teacher.user?.name || null, avatarUrl: teacher.user?.avatarUrl || null };
}

/**
 * Delivers a message sent BY a student-portal student TO their assigned
 * teacher — the other half of the bidirectional bridge (the teacher ->
 * student direction is `services/studentBridge.service.js#pushMessageToStudent`,
 * called from message.service.js#sendMessage). Persists into this backend's
 * own Conversation/Message collections exactly like a locally-initiated one,
 * using `externalStudentId`/`externalStudentName` in place of a local
 * roster `Student` ref (see Conversation.js's model comment).
 */
export async function deliverExternalStudentMessage({ studentCourseSlug, externalStudentId, externalStudentName, text }) {
  const resolved = await resolveTeacherForCourseSlug(studentCourseSlug);
  if (!resolved) return null;

  let conversation = await Conversation.findOne({ teacher: resolved.teacherId, externalStudentId });
  if (!conversation) {
    conversation = await Conversation.create({ teacher: resolved.teacherId, externalStudentId, externalStudentName });
  } else if (externalStudentName && conversation.externalStudentName !== externalStudentName) {
    conversation.externalStudentName = externalStudentName; // keep the display name current
  }

  const message = await Message.create({ conversation: conversation._id, senderRole: 'student', senderId: externalStudentId, text });

  conversation.lastMessageAt = message.createdAt;
  conversation.lastMessageSnippet = text.slice(0, 140);
  conversation.unreadForTeacher += 1;
  await conversation.save();

  emitToTeacher(resolved.teacherId, 'message.created', {
    conversationId: conversation._id,
    message: { id: message._id, senderRole: 'student', text, createdAt: message.createdAt },
  });

  // A real, persisted Notification (type 'message') - previously the enum
  // declared this value but nothing ever created one, so a new message
  // never reached the notification bell/badge, only the live chat event.
  await notifyTeacher(resolved.teacherId, {
    type: 'message',
    title: `New message from ${conversation.externalStudentName || 'a student'}`,
    message: text.length > 140 ? `${text.slice(0, 140)}…` : text,
    relatedEntityType: 'Conversation',
    relatedEntityId: conversation._id,
  });

  return { conversationId: conversation._id, messageId: message._id };
}

export default { resolveTeacherForCourseSlug, deliverExternalStudentMessage };
