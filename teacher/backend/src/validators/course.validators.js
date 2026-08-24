import { body } from 'express-validator';
import mongoose from 'mongoose';

export const createCourseValidator = [
  body('title').trim().notEmpty().withMessage('Title is required').isLength({ max: 200 }),
  body('category').optional({ nullable: true }).trim().isLength({ max: 120 }),
  body('modulesCount').optional().isInt({ min: 0, max: 500 }).toInt(),
  body('classIds').optional().isArray().withMessage('classIds must be an array'),
  body('classIds.*').optional().custom((v) => mongoose.Types.ObjectId.isValid(v)),
];

export const updateCourseValidator = [
  body('title').optional().trim().isLength({ max: 200 }),
  body('category').optional({ nullable: true }).trim().isLength({ max: 120 }),
  body('modulesCount').optional().isInt({ min: 0, max: 500 }).toInt(),
  body('status').optional().isIn(['active', 'draft', 'archived']),
];

export default { createCourseValidator, updateCourseValidator };
