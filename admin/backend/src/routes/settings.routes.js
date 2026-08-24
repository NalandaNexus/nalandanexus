import { Router } from 'express';
import * as settingsController from '../controllers/settings.controller.js';
import { authenticate, requirePermission } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { updateSettingsSchema } from '../validators/settings.validator.js';

const router = Router();

router.use(authenticate);
router.get('/', requirePermission('settings.manage'), settingsController.get);
router.put('/', requirePermission('settings.manage'), validate(updateSettingsSchema), settingsController.update);

export default router;
