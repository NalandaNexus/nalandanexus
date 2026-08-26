import { Router } from 'express';
import * as studentController from '../controllers/student.controller.js';
import * as noteController from '../controllers/note.controller.js';
import * as materialController from '../controllers/material.controller.js';
import * as notificationController from '../controllers/notification.controller.js';
import * as messageController from '../controllers/message.controller.js';
import * as communityController from '../controllers/community.controller.js';
import * as liveClassController from '../controllers/liveClass.controller.js';
import * as supportController from '../controllers/support.controller.js';
import * as announcementController from '../controllers/announcement.controller.js';
import { authenticate } from '../middleware/authenticate.js';
import { requireRole } from '../middleware/authorize.js';
import { validate } from '../middleware/validate.js';
import { avatarUpload, verifyImageSignature } from '../middleware/upload.js';
import { uploadToCloudinary } from '../middleware/cloudinaryStorage.js';
import { updateProfileSchema } from '../validators/profile.validators.js';
import { upsertNoteSchema } from '../validators/note.validators.js';
import { sendMessageSchema } from '../validators/message.validators.js';
import { createPostSchema, listPostsSchema } from '../validators/community.validators.js';
import { createTicketSchema } from '../validators/support.validators.js';

const router = Router();

router.use(authenticate, requireRole('student'));

router.get('/profile', studentController.getProfile);
router.patch('/profile', validate(updateProfileSchema), studentController.updateProfile);
router.post('/profile/avatar', avatarUpload.single('avatar'), verifyImageSignature, uploadToCloudinary('avatars'), studentController.uploadAvatar);
router.post('/onboarding/complete', studentController.completeOnboarding);
router.get('/dashboard', studentController.getDashboard);

router.get('/notifications', notificationController.listNotifications);
router.patch('/notifications/:id/read', notificationController.markNotificationRead);
router.patch('/notifications/read-all', notificationController.markAllNotificationsRead);

router.get('/materials', materialController.listMyMaterials);

router.get('/notes', noteController.listNotes);
router.post('/notes', validate(upsertNoteSchema), noteController.createNote);
router.patch('/notes/:id', validate(upsertNoteSchema), noteController.updateNote);
router.delete('/notes/:id', noteController.deleteNote);

router.get('/messages', messageController.listMessages);
router.post('/messages', validate(sendMessageSchema), messageController.sendMessage);

router.get('/community/posts', validate(listPostsSchema), communityController.listPosts);
router.post('/community/posts', validate(createPostSchema), communityController.createPost);
router.post('/community/posts/:id/like', communityController.toggleLike);

router.get('/live-classes', liveClassController.listLiveClasses);

router.get('/support-tickets', supportController.listMyTickets);
router.post('/support-tickets', validate(createTicketSchema), supportController.createTicket);

router.get('/announcements', announcementController.listAnnouncements);
router.patch('/announcements/:id/read', announcementController.markAnnouncementRead);

export default router;
