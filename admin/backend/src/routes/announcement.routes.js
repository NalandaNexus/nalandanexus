import { Router } from 'express';
import * as announcementController from '../controllers/announcement.controller.js';
import { authenticate, requirePermission } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { listAnnouncementsQuery, createAnnouncementSchema } from '../validators/announcement.validator.js';

const router = Router();

router.use(authenticate);
router.get('/', requirePermission('announcements.manage'), validate(listAnnouncementsQuery), announcementController.list);
router.get('/teachers', requirePermission('announcements.manage'), announcementController.listFromTeachers);
router.post('/', requirePermission('announcements.manage'), validate(createAnnouncementSchema), announcementController.create);

export default router;
