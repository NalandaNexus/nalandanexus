import { Notification } from '../models/Notification.js';
import { ApiError } from '../utils/ApiError.js';
import { parsePagination, buildPaginationMeta } from '../utils/pagination.js';
import { emitToTeacher } from '../sockets/index.js';

function shape(n) {
  return {
    id: n._id,
    type: n.type,
    title: n.title,
    message: n.message,
    isRead: n.isRead,
    relatedEntityType: n.relatedEntityType,
    relatedEntityId: n.relatedEntityId,
    createdAt: n.createdAt,
  };
}

/**
 * Creates a persisted notification for a teacher and pushes it over
 * Socket.IO in the same call — the socket event is a live nudge, the
 * database row is the source of truth the bell/badge reload from on any
 * fresh page load.
 */
export async function notifyTeacher(teacherId, { type, title, message, relatedEntityType = null, relatedEntityId = null }) {
  const notification = await Notification.create({ recipient: teacherId, type, title, message, relatedEntityType, relatedEntityId });
  const payload = shape(notification);
  emitToTeacher(teacherId, 'notification.created', payload);
  return payload;
}

export async function listNotifications(teacherId, { unreadOnly, page, limit } = {}) {
  const { page: p, limit: l, skip } = parsePagination({ page, limit });
  const filter = { recipient: teacherId };
  if (unreadOnly) filter.isRead = false;

  const [rows, total, unreadCount] = await Promise.all([
    Notification.find(filter).sort({ createdAt: -1 }).skip(skip).limit(l).lean(),
    Notification.countDocuments(filter),
    Notification.countDocuments({ recipient: teacherId, isRead: false }),
  ]);

  return { notifications: rows.map(shape), unreadCount, meta: buildPaginationMeta({ page: p, limit: l, total }) };
}

export async function getUnreadCount(teacherId) {
  return Notification.countDocuments({ recipient: teacherId, isRead: false });
}

export async function markAsRead(teacherId, notificationId) {
  const n = await Notification.findOneAndUpdate(
    { _id: notificationId, recipient: teacherId },
    { $set: { isRead: true } },
    { new: true }
  );
  if (!n) throw ApiError.notFound('Notification not found.', 'NOTIFICATION_NOT_FOUND');
  return shape(n);
}

export async function markAllAsRead(teacherId) {
  const result = await Notification.updateMany({ recipient: teacherId, isRead: false }, { $set: { isRead: true } });
  return { modifiedCount: result.modifiedCount };
}

export async function deleteNotification(teacherId, notificationId) {
  const result = await Notification.deleteOne({ _id: notificationId, recipient: teacherId });
  if (result.deletedCount === 0) throw ApiError.notFound('Notification not found.', 'NOTIFICATION_NOT_FOUND');
  return { id: notificationId };
}

export default { notifyTeacher, listNotifications, getUnreadCount, markAsRead, markAllAsRead, deleteNotification };
