import { Router } from 'express';
import * as reportController from '../controllers/report.controller.js';
import { authenticate, requirePermission } from '../middleware/auth.js';

const router = Router();

router.use(authenticate);
router.get('/export', requirePermission('audit.view'), reportController.exportReport);

export default router;
