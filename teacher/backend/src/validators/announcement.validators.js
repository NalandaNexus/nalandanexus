import { body, query } from 'express-validator';
import mongoose from 'mongoose';

const TYPES = ['ANNOUNCEMENT', 'CLASS_UPDATE', 'EVENT', 'CONVOCATION', 'ACADEMIC', 'URGENT'];
const PRIORITIES = ['low', 'normal', 'high', 'urgent'];
const AUDIENCES = ['classes', 'all_my_classes'];
const STATUSES = ['draft', 'scheduled', 'published', 'expired', 'archived'];

/**
 * `multipart/form-data` (when an attachment is attached) delivers every
 * field as a string, so `classes` — an array in the JSON case — may arrive
 * as a single id, a comma-separated string, or a JSON-encoded array
 * string. Normalized here, before validation, rather than duplicating this
 * parsing in the service.
 */
function normalizeClasses(req, res, next) {
  const raw = req.body.classes;
  if (raw === undefined || Array.isArray(raw)) return next();
  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw);
      req.body.classes = Array.isArray(parsed) ? parsed : [parsed];
    } catch {
      req.body.classes = raw.split(',').map((s) => s.trim()).filter(Boolean);
    }
  }
  next();
}

const sharedFields = [
  body('priority').optional().isIn(PRIORITIES).withMessage(`priority must be one of: ${PRIORITIES.join(', ')}`),
  body('classes').optional().isArray().withMessage('classes must be an array of class ids'),
  body('classes.*').optional().custom((v) => mongoose.Types.ObjectId.isValid(v)).withMessage('Each class id must be valid'),
  body('eventDate').optional({ nullable: true }).isISO8601().withMessage('eventDate must be a valid date').toDate(),
  body('startTime').optional({ nullable: true }).trim().isLength({ max: 20 }),
  body('endTime').optional({ nullable: true }).trim().isLength({ max: 20 }),
  body('venue').optional({ nullable: true }).trim().isLength({ max: 200 }),
  body('registrationLink').optional({ nullable: true }).trim().isURL().withMessage('registrationLink must be a valid URL'),
  body('publishAt').optional({ nullable: true }).isISO8601().withMessage('publishAt must be a valid date').toDate(),
  body('expiresAt').optional({ nullable: true }).isISO8601().withMessage('expiresAt must be a valid date').toDate(),
  body('status').optional().isIn(['draft']).withMessage('status may only explicitly be set to "draft" here'),
];

export const createAnnouncementValidator = [
  normalizeClasses,
  body('title').trim().notEmpty().withMessage('Title is required').isLength({ max: 200 }),
  body('description').trim().notEmpty().withMessage('Description is required').isLength({ max: 5000 }),
  body('type').isIn(TYPES).withMessage(`type must be one of: ${TYPES.join(', ')}`),
  body('audience').isIn(AUDIENCES).withMessage(`audience must be one of: ${AUDIENCES.join(', ')}`),
  ...sharedFields,
];

export const updateAnnouncementValidator = [
  normalizeClasses,
  body('title').optional().trim().notEmpty().isLength({ max: 200 }),
  body('description').optional().trim().notEmpty().isLength({ max: 5000 }),
  body('type').optional().isIn(TYPES).withMessage(`type must be one of: ${TYPES.join(', ')}`),
  body('audience').optional().isIn(AUDIENCES).withMessage(`audience must be one of: ${AUDIENCES.join(', ')}`),
  // Status can only be nudged to 'draft' through this endpoint (see
  // sharedFields below) — publish/archive/delete are dedicated endpoints
  // with their own explicit lifecycle checks in the service layer.
  ...sharedFields,
];

export const listAnnouncementsValidator = [
  query('type').optional().isIn(TYPES),
  query('status').optional().isIn(STATUSES),
  query('classId').optional().custom((v) => mongoose.Types.ObjectId.isValid(v)),
  query('search').optional().trim().isLength({ max: 200 }),
  query('from').optional().isISO8601(),
  query('to').optional().isISO8601(),
];

export default { createAnnouncementValidator, updateAnnouncementValidator, listAnnouncementsValidator };
