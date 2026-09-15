import { body, query, param } from 'express-validator';
import mongoose from 'mongoose';

export const createStudentValidator = [
  body('name').trim().notEmpty().withMessage('Student name is required').isLength({ max: 120 }),
  body('email').trim().notEmpty().withMessage('Email is required').isEmail().withMessage('Enter a valid email').normalizeEmail(),
  body('classId')
    .notEmpty()
    .withMessage('classId is required')
    .custom((v) => mongoose.Types.ObjectId.isValid(v))
    .withMessage('classId must be a valid identifier'),
  body('phone').optional({ nullable: true }).trim().isLength({ max: 20 }),
  body('rollNumber').optional({ nullable: true }).trim().isLength({ max: 40 }),
  body('guardianName').optional({ nullable: true }).trim().isLength({ max: 120 }),
  body('guardianPhone').optional({ nullable: true }).trim().isLength({ max: 20 }),
  body('guardianEmail').optional({ nullable: true }).trim().isEmail().withMessage('Enter a valid guardian email'),
];

export const updateStudentValidator = [
  body('name').optional().trim().isLength({ max: 120 }),
  body('phone').optional({ nullable: true }).trim().isLength({ max: 20 }),
  body('rollNumber').optional({ nullable: true }).trim().isLength({ max: 40 }),
  body('guardianName').optional({ nullable: true }).trim().isLength({ max: 120 }),
  body('guardianPhone').optional({ nullable: true }).trim().isLength({ max: 20 }),
  body('guardianEmail').optional({ nullable: true }).trim().isEmail(),
  body('status').optional().isIn(['active', 'inactive']),
  body('classId').optional().custom((v) => mongoose.Types.ObjectId.isValid(v)).withMessage('classId must be a valid identifier'),
];

/** The number as typed; the service reduces it to its canonical form, or refuses it. */
export const enrollmentNumberParamValidator = [
  param('enrollmentNumber').isString().isLength({ min: 1, max: 40 }).withMessage('Enter an enrollment number.'),
];

export const listStudentsValidator = [
  query('classId').optional().custom((v) => v === 'all' || mongoose.Types.ObjectId.isValid(v)),
  query('riskLevel').optional().isIn(['all', 'act_now', 'watch', 'good']),
  query('search').optional().trim().isLength({ max: 120 }),
  query('sortBy').optional().isIn(['name', 'score', 'attendance']),
  query('sortOrder').optional().isIn(['asc', 'desc']),
];

export default { createStudentValidator, updateStudentValidator, listStudentsValidator };
