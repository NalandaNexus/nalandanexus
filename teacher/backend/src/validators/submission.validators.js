import { body } from 'express-validator';

export const gradeSubmissionValidator = [
  body('score').notEmpty().withMessage('Score is required').isFloat({ min: 0 }).withMessage('Score must be a non-negative number').toFloat(),
  body('feedback').optional({ nullable: true }).trim().isLength({ max: 2000 }),
];

export default { gradeSubmissionValidator };
