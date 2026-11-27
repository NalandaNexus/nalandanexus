import { body, query } from 'express-validator';
import mongoose from 'mongoose';

const objectId = (v) => mongoose.Types.ObjectId.isValid(v);

export const markAttendanceValidator = [
  body('classId').notEmpty().withMessage('classId is required').custom(objectId).withMessage('classId must be a valid identifier'),
  body('date').notEmpty().withMessage('date is required').isISO8601().withMessage('date must be a valid date'),
  body('records').isArray({ min: 1 }).withMessage('records must be a non-empty array'),
  body('records.*.studentId').custom(objectId).withMessage('Each record needs a valid studentId'),
  body('records.*.status').isIn(['present', 'absent', 'late']).withMessage('status must be present, absent, or late'),
  body('records.*.remarks').optional({ nullable: true }).trim().isLength({ max: 500 }),
  // Optional per-record optimistic-concurrency guard: when a teacher is
  // correcting a mark they already saw (not filling in a blank one for the
  // first time), the client sends back the updatedAt it loaded so a
  // same-moment edit by a second course-access teacher is caught as a
  // conflict (409 ATTENDANCE_CHANGED) instead of silently overwritten. null
  // means "I saw this as never-yet-marked."
  body('records.*.expectedUpdatedAt').optional({ nullable: true }).isISO8601().withMessage('expectedUpdatedAt must be a valid date'),
];

export const listAttendanceValidator = [
  query('classId').optional().custom(objectId),
  query('date').optional().isISO8601(),
  query('studentId').optional().custom(objectId),
];

export default { markAttendanceValidator, listAttendanceValidator };
