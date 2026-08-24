import { catchAsync } from '../utils/catchAsync.js';
import { sendSuccess } from '../utils/ApiResponse.js';
import * as notificationService from '../services/notification.service.js';

export const listNotifications = catchAsync(async (req, res) => {
  const unreadOnly = req.query.unread === 'true';
  const { notifications, unreadCount, meta } = await notificationService.listNotifications(req.teacher._id, { ...req.query, unreadOnly });
  sendSuccess(res, { data: notifications, meta: { ...meta, unreadCount } });
});

export const getUnreadCount = catchAsync(async (req, res) => {
  const count = await notificationService.getUnreadCount(req.teacher._id);
  sendSuccess(res, { data: { count } });
});

export const markAsRead = catchAsync(async (req, res) => {
  const notification = await notificationService.markAsRead(req.teacher._id, req.params.id);
  sendSuccess(res, { data: notification });
});

export const markAllAsRead = catchAsync(async (req, res) => {
  const result = await notificationService.markAllAsRead(req.teacher._id);
  sendSuccess(res, { message: 'All notifications marked as read.', data: result });
});

export const deleteNotification = catchAsync(async (req, res) => {
  const result = await notificationService.deleteNotification(req.teacher._id, req.params.id);
  sendSuccess(res, { message: 'Notification deleted.', data: result });
});

export default { listNotifications, getUnreadCount, markAsRead, markAllAsRead, deleteNotification };
