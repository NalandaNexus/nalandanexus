import { catchAsync } from '../utils/catchAsync.js';
import { sendSuccess } from '../utils/ApiResponse.js';
import * as enrollmentService from '../services/enrollment.service.js';

export const list = catchAsync(async (req, res) => {
  const { items, meta } = await enrollmentService.listEnrollments(req.query);
  return sendSuccess(res, { data: items, meta });
});

export const create = catchAsync(async (req, res) => {
  const enrollment = await enrollmentService.createEnrollment(req.body, req.admin, req);
  return sendSuccess(res, { statusCode: 201, data: enrollment, message: 'Student enrolled successfully' });
});

export const update = catchAsync(async (req, res) => {
  const enrollment = await enrollmentService.updateEnrollment(req.params.id, req.body, req.admin, req);
  return sendSuccess(res, { data: enrollment, message: 'Enrollment updated successfully' });
});

export default { list, create, update };
