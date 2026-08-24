import { body } from 'express-validator';

export const updateProfileValidator = [
  body('name').optional().trim().isLength({ min: 2, max: 120 }),
  body('phone').optional({ nullable: true }).trim().isLength({ max: 20 }),
  body('title').optional({ nullable: true }).trim().isLength({ max: 160 }),
  body('department').optional({ nullable: true }).trim().isLength({ max: 120 }),
  body('subject').optional({ nullable: true }).trim().isLength({ max: 120 }),
  body('qualification').optional({ nullable: true }).trim().isLength({ max: 200 }),
  body('experienceYears').optional().isInt({ min: 0, max: 60 }).toInt(),
  body('bio').optional({ nullable: true }).trim().isLength({ max: 1000 }),
];

export const updatePreferencesValidator = [
  body('emailNotifications').optional().isBoolean().toBoolean(),
  body('pushNotifications').optional().isBoolean().toBoolean(),
  body('weeklyDigest').optional().isBoolean().toBoolean(),
  body('theme').optional().isIn(['dark', 'light']),
];

export default { updateProfileValidator, updatePreferencesValidator };
