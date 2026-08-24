import { Router } from 'express';
import * as authController from '../controllers/auth.controller.js';
import { authenticate } from '../middleware/auth.js';
import { authLimiter } from '../middleware/rateLimiter.js';
import { validate } from '../middleware/validate.js';
import { loginValidator, changePasswordValidator } from '../validators/auth.validators.js';

const router = Router();

router.post('/login', authLimiter, loginValidator, validate, authController.login);
router.post('/logout', authenticate, authController.logout);
router.post('/logout-all', authenticate, authController.logoutAllSessions);
router.get('/me', authenticate, authController.me);
router.post('/change-password', authenticate, changePasswordValidator, validate, authController.changePassword);

export default router;
