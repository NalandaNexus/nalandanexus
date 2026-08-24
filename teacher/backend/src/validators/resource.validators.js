import { body } from 'express-validator';
import mongoose from 'mongoose';

export const createResourceValidator = [
  body('title').trim().notEmpty().withMessage('Title is required').isLength({ max: 200 }),
  body('subject').optional({ nullable: true }).trim().isLength({ max: 120 }),
  body('classId').optional({ nullable: true }).custom((v) => !v || mongoose.Types.ObjectId.isValid(v)),
];

export default { createResourceValidator };
