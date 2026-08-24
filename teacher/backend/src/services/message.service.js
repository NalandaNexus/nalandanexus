import { Conversation } from '../models/Conversation.js';
import { Message } from '../models/Message.js';
import { Student } from '../models/Student.js';
import { Teacher } from '../models/Teacher.js';
import { ApiError } from '../utils/ApiError.js';
import { dicebearAvatar } from './student.service.js';
import { emitToTeacher } from '../sockets/index.js';
import { pushMessageToStudent } from './studentBridge.service.js';

async function assertConversationOwnership(teacherId, conversationId) {
  const conversation = await Conversation.findOne({ _id: conversationId, teacher: teacherId });
  if (!conversation) throw ApiError.notFound('Conversation not found.', 'CONVERSATION_NOT_FOUND');
  return conversation;
}

export async function listConversations(teacherId) {
  const rows = await Conversation.find({ teacher: teacherId }).populate('student', 'name email avatarUrl class').sort({ lastMessageAt: -1 }).lean();
  return rows.map((c) => ({
    id: c._id,
    studentId: c.student?._id || null,
    externalStudentId: c.externalStudentId || null,
    name: c.student?.name || c.externalStudentName || 'Student',
    avatar: c.student?.avatarUrl || dicebearAvatar(c.student?.name || c.externalStudentName || 'Student'),
    lastMessage: c.lastMessageSnippet,
    lastMessageAt: c.lastMessageAt,
    unread: c.unreadForTeacher > 0,
    unreadCount: c.unreadForTeacher,
  }));
}

export async function getOrCreateConversation(teacherId, studentId) {
  const student = await Student.findOne({ _id: studentId, teacher: teacherId });
  if (!student) throw ApiError.notFound('Student not found.', 'STUDENT_NOT_FOUND');

  let conversation = await Conversation.findOne({ teacher: teacherId, student: studentId });
  if (!conversation) {
    conversation = await Conversation.create({ teacher: teacherId, student: studentId });
  }
  return conversation;
}

export async function getMessages(teacherId, conversationId) {
  await assertConversationOwnership(teacherId, conversationId);
  const messages = await Message.find({ conversation: conversationId }).sort({ createdAt: 1 }).lean();
  return messages.map((m) => ({
    id: m._id,
    senderRole: m.senderRole,
    text: m.text,
    createdAt: m.createdAt,
    readAt: m.readAt,
  }));
}

/**
 * Teacher -> student note. For a locally-rostered student there is no live
 * student-side inbox to deliver into (see the scope note in models/User.js),
 * so this persists the message and marks it unread-for-student for
 * whenever the student portal is wired up to read it. For a bridged
 * (external, real student-portal account) conversation, it ALSO pushes the
 * message live to that student's own real-time inbox via
 * studentBridge.service.js — best-effort, never blocks the reply that
 * already succeeded here.
 */
export async function sendMessage(teacherId, conversationId, text, ip) {
  const conversation = await assertConversationOwnership(teacherId, conversationId);

  const message = await Message.create({ conversation: conversation._id, senderRole: 'teacher', senderId: teacherId, text });

  conversation.lastMessageAt = message.createdAt;
  conversation.lastMessageSnippet = text.slice(0, 140);
  conversation.unreadForStudent += 1;
  await conversation.save();

  const payload = { id: message._id, senderRole: 'teacher', text, createdAt: message.createdAt };
  emitToTeacher(teacherId, 'message.created', { conversationId: conversation._id, message: payload });

  // A conversation with a local `student` ref can still belong to a real,
  // verified student-portal account (see Student.linkedUserId, set by
  // syncEnrollmentForClass) — resolved here at send time rather than on the
  // Conversation document itself, since the model's `student` XOR
  // `externalStudentId` invariant (see Conversation.js) is otherwise real
  // and worth keeping intact.
  const externalId = conversation.externalStudentId
    || (conversation.student ? (await Student.findById(conversation.student).select('linkedUserId').lean())?.linkedUserId : null);
  if (externalId) {
    const teacher = await Teacher.findById(teacherId).populate('user', 'name').lean();
    await pushMessageToStudent(String(externalId), text, teacher?.user?.name);
  }

  return payload;
}

export async function markConversationRead(teacherId, conversationId) {
  const conversation = await assertConversationOwnership(teacherId, conversationId);
  conversation.unreadForTeacher = 0;
  await conversation.save();
  await Message.updateMany({ conversation: conversation._id, senderRole: 'student', readAt: null }, { $set: { readAt: new Date() } });
  return { id: conversation._id };
}

export default { listConversations, getOrCreateConversation, getMessages, sendMessage, markConversationRead };
