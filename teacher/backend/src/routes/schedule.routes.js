import { Router } from 'express';
import * as scheduleController from '../controllers/schedule.controller.js';
import { authenticate, requireRole } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { objectIdParam } from '../validators/common.js';
import { listScheduleValidator, createSessionValidator, updateSessionValidator } from '../validators/schedule.validators.js';

const router = Router();
router.use(authenticate, requireRole('teacher'));

// Backs CalendarPage (?date=) and, with no date, "today" (also used
// internally by dashboard.service.js via getTodaysSchedule).
router.get('/', listScheduleValidator, validate, scheduleController.listSchedule);
router.post('/', createSessionValidator, validate, scheduleController.createSession);
// Reschedule (startAt/durationMinutes change) and/or a status transition to
// 'live'/'completed'. Cancellation stays its own DELETE - a fundamentally
// different, terminal action.
router.patch('/:id', objectIdParam('id'), updateSessionValidator, validate, scheduleController.updateSession);
router.delete('/:id', objectIdParam('id'), validate, scheduleController.cancelSession);
// Backs LiveSchedulePage / LiveClassPanel's "is a class live right now" check.
router.get('/live', scheduleController.getLiveSession);

export default router;
