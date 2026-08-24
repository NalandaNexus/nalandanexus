import { Router } from 'express';
import * as teacherController from '../controllers/teacher.controller.js';
import { authenticate, requireRole } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { updateProfileValidator, updatePreferencesValidator } from '../validators/profile.validators.js';
import { uploaderFor } from '../middleware/upload.js';

const router = Router();
router.use(authenticate, requireRole('teacher'));

const avatarUpload = uploaderFor('avatars');

router.get('/profile', teacherController.getProfile);
router.patch('/profile', updateProfileValidator, validate, teacherController.updateProfile);
router.patch('/profile/preferences', updatePreferencesValidator, validate, teacherController.updatePreferences);
router.post('/profile/avatar', avatarUpload.single('avatar'), teacherController.uploadAvatar);

export default router;
