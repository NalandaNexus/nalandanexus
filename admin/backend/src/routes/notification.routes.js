import { Router } from 'express';
import * as notificationController from '../controllers/notification.controller.js';
import { authenticate } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { objectIdParam } from '../validators/common.js';

const router = Router();

router.use(authenticate);
router.get('/', notificationController.list);
router.post('/:id/read', validate({ params: objectIdParam() }), notificationController.markRead);
router.post('/read-all', notificationController.markAllRead);

export default router;
