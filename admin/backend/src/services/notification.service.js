import { Notification } from '../models/Notification.js';
import { Admin } from '../models/Admin.js';
import { ApiError } from '../utils/ApiError.js';
import { parsePagination, buildPaginationMeta } from '../utils/pagination.js';
import { withIds } from '../utils/serialize.js';
import { emitEvent } from '../sockets/index.js';

export async function listNotifications(adminId, query) {
  const { page, limit, skip } = parsePagination(query);
  const filter = { recipient: adminId };
  if (query.unreadOnly === 'true') filter.isRead = false;

  const [items, total, unreadCount] = await Promise.all([
    Notification.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
    Notification.countDocuments(filter),
    Notification.countDocuments({ recipient: adminId, isRead: false }),
  ]);
  return { items: withIds(items), meta: buildPaginationMeta({ page, limit, total }), unreadCount };
}

export async function createNotification({ recipient, type, title, message, relatedEntityType, relatedEntityId }) {
  const notification = await Notification.create({ recipient, type, title, message, relatedEntityType, relatedEntityId });
  emitEvent.notificationCreated(recipient, notification);
  return notification;
}

export async function markAsRead(id, adminId) {
  const notification = await Notification.findOneAndUpdate({ _id: id, recipient: adminId }, { isRead: true }, { new: true });
  if (!notification) throw ApiError.notFound('Notification not found', 'NOTIFICATION_NOT_FOUND');
  return notification;
}

export async function markAllAsRead(adminId) {
  await Notification.updateMany({ recipient: adminId, isRead: false }, { isRead: true });
}

/**
 * Fans a system event out to every active admin account (excluding the
 * actor who triggered it, so admins don't get notified of their own click).
 * Used for events other admins genuinely need to know about — a course
 * awaiting review, a teacher suspension, a payment received.
 */
export async function notifyAllAdmins({ excludeAdminId, type, title, message, relatedEntityType, relatedEntityId }) {
  const admins = await Admin.find({ status: 'ACTIVE', _id: { $ne: excludeAdminId } }).select('_id').lean();
  await Promise.all(admins.map((a) => createNotification({ recipient: a._id, type, title, message, relatedEntityType, relatedEntityId })));
}

export default { listNotifications, createNotification, markAsRead, markAllAsRead, notifyAllAdmins };
