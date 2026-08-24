import { Router } from 'express';
import * as dashboardController from '../controllers/dashboard.controller.js';
import { authenticate, requirePermission } from '../middleware/auth.js';

const router = Router();

// SSE cannot carry an Authorization header from EventSource, so the live
// telemetry stream is intentionally read-only, low-sensitivity aggregate
// data only (connection counts, DB status) — nothing PII or write-capable.
router.get('/live-telemetry', dashboardController.liveTelemetry);

router.use(authenticate);
router.get('/overview', requirePermission('analytics.view'), dashboardController.overview);
router.get('/leaderboard', requirePermission('analytics.view'), dashboardController.leaderboard);

export default router;
