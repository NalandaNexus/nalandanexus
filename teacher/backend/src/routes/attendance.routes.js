import { Router } from 'express';
import * as attendanceController from '../controllers/attendance.controller.js';
import { authenticate, requireRole } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { objectIdParam } from '../validators/common.js';
import { markAttendanceValidator, listAttendanceValidator } from '../validators/attendance.validators.js';

const router = Router();
router.use(authenticate, requireRole('teacher'));

router.get('/', listAttendanceValidator, validate, attendanceController.listAttendance);
router.post('/', markAttendanceValidator, validate, attendanceController.markAttendance);
router.get('/analytics/:classId', objectIdParam('classId'), validate, attendanceController.getAttendanceAnalytics);

export default router;
