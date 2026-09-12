import { Router } from 'express';
import { z } from 'zod';
import * as controller from '../controllers/progression.controller.js';
import { authenticate, requirePermission } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';

/**
 * Progression configuration.
 *
 * Guarded by `settings.manage` rather than `courses.manage`: these rules decide
 * who becomes eligible to buy the next stage, which is a platform-wide policy
 * decision rather than course administration.
 */
const router = Router();

router.use(authenticate);

const codeParam = (name) => ({ params: z.object({ [name]: z.string().trim().min(1).max(64) }) });

router.get('/rules', requirePermission('settings.manage'), controller.getRules);
router.put('/rules', requirePermission('settings.manage'), validate({ body: z.record(z.any()) }), controller.updateRules);
router.patch('/stages/:code', requirePermission('settings.manage'), validate({ ...codeParam('code'), body: z.record(z.any()) }), controller.updateStage);
router.patch('/achievements/:code', requirePermission('settings.manage'), validate({ ...codeParam('code'), body: z.record(z.any()) }), controller.updateAchievement);
router.post('/recalculate', requirePermission('settings.manage'), validate({ body: z.record(z.any()) }), controller.recalculate);
router.post('/journey/setup', requirePermission('settings.manage'), validate({ body: z.record(z.any()) }), controller.setupJourney);
router.get('/analytics', requirePermission('analytics.view'), controller.getAnalytics);

export default router;
