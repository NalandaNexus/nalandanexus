import { body, param } from 'express-validator';

export const teacherForCourseValidator = [param('studentCourseSlug').trim().notEmpty()];

export const deliverMessageValidator = [
  body('studentCourseSlug').trim().notEmpty(),
  body('externalStudentId').trim().notEmpty(),
  body('externalStudentName').optional({ nullable: true }).trim().isLength({ max: 160 }),
  body('text').trim().notEmpty().isLength({ max: 4000 }),
];

export const provisionTeacherValidator = [
  // Optional so any caller that doesn't supply one still works - this
  // backend falls back to generating its own (see auth.service.js).
  body('teacherId').optional({ nullable: true }).trim().isLength({ max: 40 }),
  body('name').trim().notEmpty().isLength({ max: 120 }),
  body('email').trim().isEmail().normalizeEmail(),
  body('phone').optional({ nullable: true }).trim().isLength({ max: 20 }),
  body('tempPassword').isString().isLength({ min: 8, max: 100 }),
  body('title').optional({ nullable: true }).trim().isLength({ max: 120 }),
  body('department').optional({ nullable: true }).trim().isLength({ max: 120 }),
  body('subject').optional({ nullable: true }).trim().isLength({ max: 120 }),
];

export const resetCredentialsValidator = [
  body('email').trim().isEmail().normalizeEmail(),
  body('newPassword').isString().isLength({ min: 8, max: 100 }),
];

export const setAccountStatusValidator = [
  body('email').trim().isEmail().normalizeEmail(),
  body('status').isIn(['active', 'inactive', 'suspended']),
];

export const sourceIdParamValidator = [param('sourceId').trim().notEmpty().isLength({ max: 64 })];

export const assignCourseValidator = [
  body('teacherEmail').trim().isEmail().normalizeEmail(),
  body('title').trim().notEmpty().isLength({ max: 200 }),
  body('courseCode').optional({ nullable: true }).trim().isLength({ max: 40 }),
  body('description').optional({ nullable: true }).trim().isLength({ max: 4000 }),
  body('image').optional({ nullable: true }).trim().isLength({ max: 500 }),
  body('priceInPaise').optional({ nullable: true }).isInt({ min: 0 }),
  body('status').optional({ nullable: true }).trim().isLength({ max: 40 }),
];

export const adminAnnouncementValidator = [
  body('sourceId').trim().notEmpty().isLength({ max: 64 }),
  body('title').trim().notEmpty().isLength({ max: 200 }),
  body('content').trim().notEmpty(),
  body('priority').optional({ nullable: true }).isIn(['LOW', 'MEDIUM', 'HIGH']),
  body('authorName').optional({ nullable: true }).trim().isLength({ max: 160 }),
  body('publishedAt').optional({ nullable: true }).isISO8601(),
];

export const receiveSubmissionValidator = [
  body('assignmentSourceId').trim().notEmpty(),
  body('studentUserId').trim().notEmpty(),
  body('studentName').optional({ nullable: true }).trim().isLength({ max: 160 }),
  body('studentEmail').optional({ nullable: true }).trim().isEmail().normalizeEmail(),
  body('submissionText').optional({ nullable: true }).trim().isLength({ max: 10000 }),
  body('isLate').optional().isBoolean().toBoolean(),
  body('submissionSourceId').optional({ nullable: true }).trim().isLength({ max: 100 }),
];

export const receiveQuizResultValidator = [
  body('examSourceId').trim().notEmpty(),
  body('studentUserId').trim().notEmpty(),
  body('studentName').optional({ nullable: true }).trim().isLength({ max: 160 }),
  body('studentEmail').optional({ nullable: true }).trim().isEmail().normalizeEmail(),
  body('scorePercentage').isFloat({ min: 0, max: 100 }).toFloat(),
  body('correctCount').isInt({ min: 0 }).toInt(),
  body('totalCount').isInt({ min: 0 }).toInt(),
];

export default {
  teacherForCourseValidator,
  deliverMessageValidator,
  provisionTeacherValidator,
  resetCredentialsValidator,
  setAccountStatusValidator,
  sourceIdParamValidator,
  assignCourseValidator,
  adminAnnouncementValidator,
  receiveSubmissionValidator,
};
