import { asyncHandler } from '../utils/asyncHandler.js';
import { sendSuccess } from '../utils/apiResponse.js';
import { AppError } from '../utils/AppError.js';
import { Notification } from '../models/Notification.js';

export const listNotifications = asyncHandler(async (req, res) => {
  const page = Math.max(1, Number(req.query.page) || 1);
  const limit = Math.min(50, Number(req.query.limit) || 20);

  const [items, total] = await Promise.all([
    Notification.find({ userId: req.user._id })
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit),
    Notification.countDocuments({ userId: req.user._id }),
  ]);

  return sendSuccess(res, { data: items, meta: { page, limit, total, totalPages: Math.ceil(total / limit) } });
});

export const markNotificationRead = asyncHandler(async (req, res) => {
  // Object-level authorization: only the owner can mark their own
  // notification as read (master doc section 34).
  const notification = await Notification.findOneAndUpdate(
    { _id: req.params.id, userId: req.user._id },
    { isRead: true },
    { new: true }
  );
  if (!notification) throw AppError.notFound('Notification not found', 'NOTIFICATION_NOT_FOUND');
  return sendSuccess(res, { data: notification });
});

export const markAllNotificationsRead = asyncHandler(async (req, res) => {
  await Notification.updateMany({ userId: req.user._id, isRead: false }, { isRead: true });
  return sendSuccess(res, { message: 'All notifications marked as read.' });
});
