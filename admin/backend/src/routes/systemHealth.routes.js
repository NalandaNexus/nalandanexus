import { Router } from 'express';
import * as systemHealthController from '../controllers/systemHealth.controller.js';
import { authenticate, requirePermission } from '../middleware/auth.js';

const router = Router();

router.use(authenticate);
router.get('/', requirePermission('analytics.view'), systemHealthController.get);

export default router;
