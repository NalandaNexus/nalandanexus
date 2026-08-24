import { Router } from 'express';
import * as adminController from '../controllers/admin.controller.js';
import { authenticate } from '../middleware/authenticate.js';
import { requireRole } from '../middleware/authorize.js';
import { validate } from '../middleware/validate.js';
import {
  createAnnouncementSchema,
  updateAnnouncementSchema,
  createLiveClassSchema,
  updateLiveClassSchema,
} from '../validators/admin.validators.js';

const router = Router();

// Content authoring only (announcements, live classes) - no user/course/grading
// management exists here. Every route requires an admin/teacher/super_admin
// DB-backed role; there is no client-supplied way to escalate into this group
// (see backend/src/services/auth.service.js registerStudent - always 'student').
router.use(authenticate, requireRole('teacher', 'admin', 'super_admin'));

router.get('/announcements', adminController.listAllAnnouncements);
router.post('/announcements', validate(createAnnouncementSchema), adminController.createAnnouncement);
router.patch('/announcements/:id', validate(updateAnnouncementSchema), adminController.updateAnnouncement);
router.delete('/announcements/:id', adminController.deleteAnnouncement);

router.get('/live-classes', adminController.listAllLiveClasses);
router.post('/live-classes', validate(createLiveClassSchema), adminController.createLiveClass);
router.patch('/live-classes/:id', validate(updateLiveClassSchema), adminController.updateLiveClass);
router.delete('/live-classes/:id', adminController.deleteLiveClass);

export default router;
