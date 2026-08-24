import { body } from 'express-validator';
import mongoose from 'mongoose';

export const createExamValidator = [
  body('title').trim().notEmpty().withMessage('Title is required').isLength({ max: 200 }),
  body('classId').notEmpty().withMessage('classId is required').custom((v) => mongoose.Types.ObjectId.isValid(v)),
  body('type').optional().isIn(['quiz', 'test', 'exam']),
  body('totalQuestions').optional().isInt({ min: 0, max: 500 }).toInt(),
  body('durationMinutes').optional().isInt({ min: 1, max: 600 }).toInt(),
  body('scheduledAt').optional({ nullable: true }).isISO8601(),
];

export const updateExamValidator = [
  body('title').optional().trim().isLength({ max: 200 }),
  body('type').optional().isIn(['quiz', 'test', 'exam']),
  body('totalQuestions').optional().isInt({ min: 0, max: 500 }).toInt(),
  body('durationMinutes').optional().isInt({ min: 1, max: 600 }).toInt(),
  body('scheduledAt').optional({ nullable: true }).isISO8601(),
  body('status').optional().isIn(['draft', 'scheduled', 'active', 'completed']),
  body('questions').optional().isArray({ max: 200 }).withMessage('questions must be an array'),
  body('questions.*.question').if(body('questions').exists()).trim().notEmpty().isLength({ max: 2000 }),
  body('questions.*.options').if(body('questions').exists()).isArray({ min: 2, max: 6 }).withMessage('Each question needs 2-6 options'),
  body('questions.*.options.*').if(body('questions').exists()).trim().notEmpty().isLength({ max: 300 }),
  body('questions.*.correctIndex').if(body('questions').exists()).isInt({ min: 0 }).toInt(),
  body('questions.*.explanation').optional({ nullable: true }).trim().isLength({ max: 2000 }),
  body('questions').custom((questions) => {
    if (!Array.isArray(questions)) return true;
    for (const q of questions) {
      if (Array.isArray(q?.options) && Number.isInteger(q?.correctIndex) && q.correctIndex >= q.options.length) {
        throw new Error('correctIndex must point at one of the provided options');
      }
    }
    return true;
  }),
];

export default { createExamValidator, updateExamValidator };
