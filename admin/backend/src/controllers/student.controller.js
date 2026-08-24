import { catchAsync } from '../utils/catchAsync.js';
import { sendSuccess } from '../utils/ApiResponse.js';
import * as studentService from '../services/student.service.js';

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

export default { list, getById, create, update, remove };
