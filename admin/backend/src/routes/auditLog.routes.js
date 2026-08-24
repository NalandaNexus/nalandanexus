import { Router } from 'express';
import * as auditLogController from '../controllers/auditLog.controller.js';
import { authenticate, requirePermission } from '../middleware/auth.js';

const router = Router();

router.use(authenticate);
router.get('/', requirePermission('audit.view'), auditLogController.list);

export default router;
