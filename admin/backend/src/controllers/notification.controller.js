import { catchAsync } from '../utils/catchAsync.js';
import { sendSuccess } from '../utils/ApiResponse.js';
import * as notificationService from '../services/notification.service.js';

export const list = catchAsync(async (req, res) => {
  const { items, meta, unreadCount } = await notificationService.listNotifications(req.admin._id, req.query);
  return sendSuccess(res, { data: items, meta: { ...meta, unreadCount } });
});

export const markRead = catchAsync(async (req, res) => {
  const notification = await notificationService.markAsRead(req.params.id, req.admin._id);
  return sendSuccess(res, { data: notification });
});

export const markAllRead = catchAsync(async (req, res) => {
  await notificationService.markAllAsRead(req.admin._id);
  return sendSuccess(res, { message: 'All notifications marked as read' });
});

export default { list, markRead, markAllRead };
