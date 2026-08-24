import { catchAsync } from '../utils/catchAsync.js';
import { sendSuccess } from '../utils/ApiResponse.js';
import * as studentService from '../services/student.service.js';

export const listStudents = catchAsync(async (req, res) => {
  const { students, meta } = await studentService.listStudents(req.teacher._id, req.query);
  sendSuccess(res, { data: students, meta });
});

export const getStudent = catchAsync(async (req, res) => {
  const student = await studentService.getStudentDetail(req.teacher._id, req.params.id);
  sendSuccess(res, { data: student });
});

export const createStudent = catchAsync(async (req, res) => {
  const student = await studentService.createStudent(req.teacher._id, req.body, req.ip);
  sendSuccess(res, { statusCode: 201, message: 'Student added successfully.', data: student });
});

export const updateStudent = catchAsync(async (req, res) => {
  const student = await studentService.updateStudent(req.teacher._id, req.params.id, req.body, req.ip);
  sendSuccess(res, { message: 'Student updated successfully.', data: student });
});

export const archiveStudent = catchAsync(async (req, res) => {
  const result = await studentService.archiveStudent(req.teacher._id, req.params.id, req.ip);
  sendSuccess(res, { message: 'Student archived successfully.', data: result });
});

export default { listStudents, getStudent, createStudent, updateStudent, archiveStudent };
