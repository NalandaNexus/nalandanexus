import { body } from 'express-validator';
import mongoose from 'mongoose';

const objectId = (v) => mongoose.Types.ObjectId.isValid(v);

export const createAssignmentValidator = [
  body('title').trim().notEmpty().withMessage('Title is required').isLength({ max: 200 }),
  body('classId').notEmpty().withMessage('classId is required').custom(objectId).withMessage('classId must be a valid identifier'),
  body('dueDate').notEmpty().withMessage('Due date is required').isISO8601().withMessage('dueDate must be a valid date'),
  body('description').optional({ nullable: true }).trim().isLength({ max: 4000 }),
  body('instructions').optional({ nullable: true }).trim().isLength({ max: 4000 }),
  body('course').optional({ nullable: true }).trim().isLength({ max: 120 }),
  body('conceptId').optional({ nullable: true }).custom(objectId).withMessage('conceptId must be a valid identifier'),
  body('maxScore').optional().isInt({ min: 1, max: 1000 }).toInt(),
  body('status').optional().isIn(['draft', 'published', 'archived']),
];

export const updateAssignmentValidator = [
  body('title').optional().trim().isLength({ max: 200 }),
  body('dueDate').optional().isISO8601().withMessage('dueDate must be a valid date'),
  body('description').optional({ nullable: true }).trim().isLength({ max: 4000 }),
  body('instructions').optional({ nullable: true }).trim().isLength({ max: 4000 }),
  body('maxScore').optional().isInt({ min: 1, max: 1000 }).toInt(),
  body('status').optional().isIn(['draft', 'published', 'archived']),
];

export default { createAssignmentValidator, updateAssignmentValidator };
