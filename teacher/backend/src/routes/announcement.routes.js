import { Router } from 'express';
import * as announcementController from '../controllers/announcement.controller.js';
import { authenticate, requireRole } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { objectIdParam } from '../validators/common.js';
import {
  createAnnouncementValidator,
  updateAnnouncementValidator,
  listAnnouncementsValidator,
} from '../validators/announcement.validators.js';
import { uploaderFor } from '../middleware/upload.js';

const router = Router();
router.use(authenticate, requireRole('teacher'));

const announcementUpload = uploaderFor('announcements');

router.get('/', listAnnouncementsValidator, validate, announcementController.listAnnouncements);
// Must come before '/:id' - 'admin' would otherwise be swallowed by the
// ObjectId param route and rejected as an invalid identifier.
router.get('/admin', announcementController.listAdminAnnouncements);
router.get('/:id', objectIdParam('id'), validate, announcementController.getAnnouncement);
router.post('/', announcementUpload.single('attachment'), createAnnouncementValidator, validate, announcementController.createAnnouncement);
router.patch('/:id', objectIdParam('id'), announcementUpload.single('attachment'), updateAnnouncementValidator, validate, announcementController.updateAnnouncement);
router.post('/:id/publish', objectIdParam('id'), validate, announcementController.publishAnnouncement);
router.post('/:id/archive', objectIdParam('id'), validate, announcementController.archiveAnnouncement);
router.delete('/:id', objectIdParam('id'), validate, announcementController.deleteAnnouncement);

export default router;
