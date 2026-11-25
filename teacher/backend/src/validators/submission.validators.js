import { body } from 'express-validator';

export const gradeSubmissionValidator = [
  body('score').notEmpty().withMessage('Score is required').isFloat({ min: 0 }).withMessage('Score must be a non-negative number').toFloat(),
  body('feedback').optional({ nullable: true }).trim().isLength({ max: 2000 }),
  // Optional optimistic-concurrency guard: when set, must match the
  // submission's real updatedAt or the write is refused as a 409
  // SUBMISSION_CHANGED (see submission.service.js#gradeSubmission) instead
  // of silently overwriting a grade another course-access teacher just
  // saved. null means "I saw this as never-yet-graded."
  body('expectedUpdatedAt').optional({ nullable: true }).isISO8601().withMessage('expectedUpdatedAt must be a valid date'),
];

export default { gradeSubmissionValidator };
