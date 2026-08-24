import { Router } from 'express';
import * as academicsController from '../controllers/academics.controller.js';
import { authenticate, requirePermission } from '../middleware/auth.js';

const router = Router();

router.use(authenticate);
router.get('/overview', requirePermission('analytics.view'), academicsController.overview);
router.get('/attendance-summaries', requirePermission('analytics.view'), academicsController.attendanceSummaries);

export default router;
