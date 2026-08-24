import { Router } from 'express';
import * as reportController from '../controllers/report.controller.js';
import { authenticate, requireRole } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { exportReportValidator } from '../validators/report.validators.js';

const router = Router();
router.use(authenticate, requireRole('teacher'));

router.get('/export', exportReportValidator, validate, reportController.exportReport);

export default router;
