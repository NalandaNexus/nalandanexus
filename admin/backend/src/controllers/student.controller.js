import { catchAsync } from '../utils/catchAsync.js';
import { sendSuccess } from '../utils/ApiResponse.js';
import * as studentService from '../services/student.service.js';
import { ApiError } from '../utils/ApiError.js';
import { lookupStudentByEnrollmentNumber } from '../services/studentCourseBridge.service.js';

export const list = catchAsync(async (req, res) => {
  const { items, meta } = await studentService.listStudents(req.query);
  return sendSuccess(res, { data: items, meta });
});

export const getById = catchAsync(async (req, res) => {
  const student = await studentService.getStudentById(req.params.id);
  return sendSuccess(res, { data: student });
});

export const create = catchAsync(async (req, res) => {
  const student = await studentService.createStudent(req.body, req.admin, req);
  return sendSuccess(res, { statusCode: 201, data: student, message: 'Student created successfully' });
});

export const update = catchAsync(async (req, res) => {
  const student = await studentService.updateStudent(req.params.id, req.body, req.admin, req);
  return sendSuccess(res, { data: student, message: 'Student updated successfully' });
});

export const remove = catchAsync(async (req, res) => {
  await studentService.deleteStudent(req.params.id, req.admin, req);
  return sendSuccess(res, { message: 'Student removed successfully' });
});

/**
 * GET /api/admin/students/enrollment-number/:enrollmentNumber
 *
 * Any student, by enrollment number, from the student service. students.read
 * lets an admin search; payment status, purchase method, coupons and Razorpay
 * references are included only for an admin who also holds payments.view -
 * decided here, from the session, and passed on as a request for less data
 * rather than filtered out afterwards.
 */
export const findByEnrollmentNumber = catchAsync(async (req, res) => {
  const paymentsVisible = req.admin.hasPermission('payments.view');
  const student = await lookupStudentByEnrollmentNumber(req.params.enrollmentNumber, { includePayments: paymentsVisible });
  if (!student) throw ApiError.notFound('No student has that enrollment number.', 'STUDENT_NOT_FOUND');

  if (!paymentsVisible) {
    delete student.payments;
    delete student.couponRedemptions;
  }
  return sendSuccess(res, { data: { ...student, paymentsVisible } });
});

export default { list, getById, create, update, remove, findByEnrollmentNumber };
