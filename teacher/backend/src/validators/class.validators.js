import { body } from 'express-validator';

export const createClassValidator = [
  body('name').trim().notEmpty().withMessage('Batch name is required').isLength({ max: 120 }),
  body('studentCourseSlug').trim().notEmpty().withMessage('Select the course this batch is for').isLength({ max: 200 }).matches(/^[a-z0-9-]+$/i).withMessage('Invalid course link.'),
  body('subject').optional({ nullable: true, checkFalsy: true }).trim().isLength({ max: 120 }),
  body('grade').optional({ nullable: true, checkFalsy: true }).trim().isLength({ max: 20 }),
  body('section').optional({ nullable: true, checkFalsy: true }).trim().isLength({ max: 10 }),
  body('room').optional({ nullable: true }).trim().isLength({ max: 60 }),
  body('schedule').optional({ nullable: true }).trim().isLength({ max: 200 }),
  body('capacity').optional().isInt({ min: 1, max: 500 }).toInt(),
  body('academicSession').optional({ nullable: true }).trim().isLength({ max: 40 }),
];

export const updateClassValidator = [
  body('name').optional().trim().isLength({ max: 120 }),
  body('subject').optional({ nullable: true, checkFalsy: true }).trim().isLength({ max: 120 }),
  body('room').optional({ nullable: true }).trim().isLength({ max: 60 }),
  body('schedule').optional({ nullable: true }).trim().isLength({ max: 200 }),
  body('capacity').optional().isInt({ min: 1, max: 500 }).toInt(),
  body('status').optional().isIn(['active', 'archived']),
  // Every batch belongs to a course, always — this can change WHICH course
  // (reassigning a batch), but never clear to empty; a teacher who wants to
  // stop offering a batch archives it (status) rather than unlinking it.
  body('studentCourseSlug').optional().trim().notEmpty().withMessage('A batch must stay linked to a course.').isLength({ max: 200 }).matches(/^[a-z0-9-]+$/i).withMessage('Invalid course link.'),
];

export default { createClassValidator, updateClassValidator };
