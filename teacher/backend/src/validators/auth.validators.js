import { body, param } from 'express-validator';
import { TEACHER_ID_PATTERN, normalizeEmail } from '../services/credentials.service.js';

// The `email` field carries either an email address or a Teacher ID (TCH-0001): the login
// box is labelled "Faculty Email / Educator ID" and the credentials email gives
// out both. An email is trimmed and lower-cased - the canonical form every
// teacher login is stored and looked up under (services/credentials.service.js,
// which also still finds accounts stored under the older normalised form).
const isTeacherId = (value) => TEACHER_ID_PATTERN.test(String(value || '').trim());

export const loginValidator = [
  body('email')
    .trim()
    .notEmpty()
    .withMessage('Email or Teacher ID is required')
    .bail()
    .customSanitizer((value) => (isTeacherId(value) ? String(value).trim().toUpperCase() : value))
    .if((value) => !isTeacherId(value))
    .isEmail()
    .withMessage('Enter a valid email address or Teacher ID')
    .customSanitizer(normalizeEmail),
  body('password').notEmpty().withMessage('Password is required').isLength({ min: 1, max: 200 }),
  body('rememberMe').optional().isBoolean().toBoolean(),
];

export const forgotPasswordValidator = [
  body('email').trim().notEmpty().withMessage('Email is required').bail().isEmail().withMessage('Enter a valid email address').customSanitizer(normalizeEmail),
];

export const changePasswordValidator = [
  body('currentPassword').notEmpty().withMessage('Current password is required'),
  body('newPassword')
    .isLength({ min: 8, max: 200 })
    .withMessage('New password must be at least 8 characters long')
    .matches(/\d/)
    .withMessage('New password must contain at least one number'),
];

const setupToken = (field, source = body) =>
  source(field).isString().trim().matches(/^[A-Za-z0-9_-]{32,128}$/).withMessage('This link is not valid.');

export const inspectPasswordSetupValidator = [setupToken('token', param)];

export const completePasswordSetupValidator = [
  setupToken('token'),
  body('password')
    .isString()
    .isLength({ min: 8, max: 200 })
    .withMessage('Password must be at least 8 characters long')
    .matches(/[A-Z]/)
    .withMessage('Password must contain an uppercase letter')
    .matches(/[a-z]/)
    .withMessage('Password must contain a lowercase letter')
    .matches(/\d/)
    .withMessage('Password must contain a number'),
];

export default { loginValidator, forgotPasswordValidator, changePasswordValidator, inspectPasswordSetupValidator, completePasswordSetupValidator };
