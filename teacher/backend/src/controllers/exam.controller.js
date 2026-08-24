import { catchAsync } from '../utils/catchAsync.js';
import { sendSuccess } from '../utils/ApiResponse.js';
import * as examService from '../services/exam.service.js';

export const listExams = catchAsync(async (req, res) => {
  const exams = await examService.listExams(req.teacher._id);
  sendSuccess(res, { data: exams });
});

export const createExam = catchAsync(async (req, res) => {
  const exam = await examService.createExam(req.teacher._id, req.body, req.ip);
  sendSuccess(res, { statusCode: 201, message: 'Assessment created successfully.', data: exam });
});

export const updateExam = catchAsync(async (req, res) => {
  const exam = await examService.updateExam(req.teacher._id, req.params.id, req.body, req.ip);
  sendSuccess(res, { message: 'Assessment updated successfully.', data: exam });
});

export const deleteExam = catchAsync(async (req, res) => {
  const result = await examService.deleteExam(req.teacher._id, req.params.id, req.ip);
  sendSuccess(res, { message: 'Assessment deleted successfully.', data: result });
});

export default { listExams, createExam, updateExam, deleteExam };
