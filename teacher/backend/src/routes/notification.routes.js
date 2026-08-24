import { Router } from 'express';
import * as notificationController from '../controllers/notification.controller.js';
import { authenticate, requireRole } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { objectIdParam } from '../validators/common.js';

const router = Router();
router.use(authenticate, requireRole('teacher'));

router.get('/', notificationController.listNotifications);
router.get('/unread-count', notificationController.getUnreadCount);
router.patch('/read-all', notificationController.markAllAsRead);
router.patch('/:id/read', objectIdParam('id'), validate, notificationController.markAsRead);
router.delete('/:id', objectIdParam('id'), validate, notificationController.deleteNotification);

export default router;
