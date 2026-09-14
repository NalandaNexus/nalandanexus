import express from 'express';
import { authenticate, requireRole } from '../middleware/auth.js';
import * as controller from '../controllers/courseAssignments.controller.js';

const router = express.Router();

// Course assignments belong to the students on this teacher's roster; there is
// no unauthenticated or cross-role view of them.
router.use(authenticate, requireRole('teacher'));

router.get('/', controller.list);
router.patch('/:id/grade', controller.grade);

export default router;
