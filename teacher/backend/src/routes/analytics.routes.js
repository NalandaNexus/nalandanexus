import { Router } from 'express';
import * as analyticsController from '../controllers/analytics.controller.js';
import { authenticate, requireRole, requirePro } from '../middleware/auth.js';

const router = Router();
router.use(authenticate, requireRole('teacher'));

router.get('/avg-score-breakdown', analyticsController.getAvgScoreBreakdown);
router.get('/concepts', analyticsController.getConceptPerformance);
router.get('/gradebook', analyticsController.getGradebook);
// "Advanced analytics" — matches the Pro-gated copy already shown in the sidebar (see middleware/auth.js#requirePro).
router.get('/performance-trend', requirePro, analyticsController.getPerformanceTrend);

export default router;
