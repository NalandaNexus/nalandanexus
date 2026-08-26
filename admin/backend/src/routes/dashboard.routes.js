import { Router } from 'express';
import * as dashboardController from '../controllers/dashboard.controller.js';
import { authenticate, requirePermission } from '../middleware/auth.js';

const router = Router();

// EventSource cannot set an Authorization header, which is why this stream
// used to be left unauthenticated - it leaked account totals, the suspended
// teacher count and database status to anyone who knew the URL. Now that the
// session travels in an httpOnly cookie (utils/sessionCookie.js), the
// browser attaches it to the SSE handshake on its own, so the stream can sit
// behind the same check as every other route. The client must open it with
// `withCredentials: true`.
router.use(authenticate);

router.get('/live-telemetry', dashboardController.liveTelemetry);
router.get('/overview', requirePermission('analytics.view'), dashboardController.overview);
router.get('/leaderboard', requirePermission('analytics.view'), dashboardController.leaderboard);

export default router;
