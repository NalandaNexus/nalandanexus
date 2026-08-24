import { body, query } from 'express-validator';
import mongoose from 'mongoose';

const objectId = (v) => mongoose.Types.ObjectId.isValid(v);

export const listScheduleValidator = [query('date').optional().isISO8601().withMessage('date must be a valid date')];

export const createSessionValidator = [
  body('classId').notEmpty().withMessage('classId is required').custom(objectId).withMessage('classId must be a valid identifier'),
  body('startAt').notEmpty().withMessage('startAt is required').isISO8601().withMessage('startAt must be a valid date'),
  body('durationMinutes').optional().isInt({ min: 5, max: 300 }).toInt(),
  body('subject').optional({ nullable: true }).trim().isLength({ max: 120 }),
  body('topic').optional({ nullable: true }).trim().isLength({ max: 300 }),
  body('room').optional({ nullable: true }).trim().isLength({ max: 60 }),
  body('youtubeUrl').optional({ nullable: true, checkFalsy: true }).trim().isURL().withMessage('Must be a valid URL'),
];

export const updateSessionValidator = [
  body('startAt').optional().isISO8601().withMessage('startAt must be a valid date'),
  body('durationMinutes').optional().isInt({ min: 5, max: 300 }).toInt(),
  body('topic').optional({ nullable: true }).trim().isLength({ max: 300 }),
  body('room').optional({ nullable: true }).trim().isLength({ max: 60 }),
  body('youtubeUrl').optional({ nullable: true, checkFalsy: true }).trim().isURL().withMessage('Must be a valid URL'),
  body('status').optional().isIn(['live', 'completed']).withMessage('status must be live or completed'),
  body('reason').optional({ nullable: true }).trim().isLength({ max: 300 }),
];

export const timetableQueryValidator = [
  query('from').optional().isISO8601().withMessage('from must be a valid date'),
  query('to').optional().isISO8601().withMessage('to must be a valid date'),
  query('classId').optional().custom(objectId).withMessage('classId must be a valid identifier'),
];

export default { listScheduleValidator, createSessionValidator, updateSessionValidator, timetableQueryValidator };
