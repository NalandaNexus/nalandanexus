import { Router } from 'express';
import * as leaderboardController from '../controllers/leaderboard.controller.js';
import { authenticate } from '../middleware/authenticate.js';
import { requireRole } from '../middleware/authorize.js';
import { requireEnrollment } from '../middleware/requireEnrollment.js';

const router = Router();

// Course-specific only - a student can only view the leaderboard for a
// course they are actually enrolled in (IDOR-safe: requireEnrollment
// rejects with 403 before any leaderboard data is computed).
router.get(
  '/:courseSlug',
  authenticate,
  requireRole('student'),
  requireEnrollment(leaderboardController.resolveCourseIdFromSlugParam),
  leaderboardController.getLeaderboardHandler
);

export default router;
