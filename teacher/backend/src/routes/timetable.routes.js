import { Router } from 'express';
import * as scheduleController from '../controllers/schedule.controller.js';
import { authenticate, requireRole } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { timetableQueryValidator } from '../validators/schedule.validators.js';

// The Timetable is not a separate resource/model — every entry IS a real
// ClassSession (see services/schedule.service.js#getTimetable). This route
// exists as its own clean top-level path purely for a clearer frontend
// contract (`/api/teacher/timetable`), not a second source of truth.
const router = Router();
router.use(authenticate, requireRole('teacher'));

router.get('/', timetableQueryValidator, validate, scheduleController.getTimetable);

export default router;
