import { Router } from 'express';
import * as searchController from '../controllers/search.controller.js';
import { authenticate, requireRole } from '../middleware/auth.js';

const router = Router();
router.use(authenticate, requireRole('teacher'));

router.get('/', searchController.search);

export default router;
