import { query } from 'express-validator';
import mongoose from 'mongoose';

const objectId = (v) => mongoose.Types.ObjectId.isValid(v);

export const exportReportValidator = [
  query('type').isIn(['students', 'attendance', 'assignments', 'grades', 'classes']).withMessage('Invalid report type'),
  query('classId').optional().custom(objectId).withMessage('classId must be a valid identifier'),
  query('from').optional().isISO8601().withMessage('from must be a valid date'),
  query('to').optional().isISO8601().withMessage('to must be a valid date'),
];

export default { exportReportValidator };
