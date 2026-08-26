import { Router } from 'express';
import * as announcementController from '../controllers/announcement.controller.js';
import { authenticate, requirePermission } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { objectIdParam } from '../validators/common.js';
import { listAnnouncementsQuery, createAnnouncementSchema, updateAnnouncementSchema } from '../validators/announcement.validator.js';

const router = Router();

router.use(authenticate);
router.get('/', requirePermission('announcements.manage'), validate(listAnnouncementsQuery), announcementController.list);
router.get('/teachers', requirePermission('announcements.manage'), announcementController.listFromTeachers);
router.post('/', requirePermission('announcements.manage'), validate(createAnnouncementSchema), announcementController.create);
// Announcements used to be write-once: no way to correct a typo or take a
// published post off the student landing page. Both edits and deletions are
// mirrored to the student and teacher portals by the service layer.
router.patch(
  '/:id',
  requirePermission('announcements.manage'),
  validate({ params: objectIdParam(), ...updateAnnouncementSchema }),
  announcementController.update
);
router.delete(
  '/:id',
  requirePermission('announcements.manage'),
  validate({ params: objectIdParam() }),
  announcementController.remove
);

export default router;
