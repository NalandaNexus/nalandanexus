import { catchAsync } from '../utils/catchAsync.js';
import { sendSuccess } from '../utils/ApiResponse.js';
import * as submissionService from '../services/submission.service.js';

export const getSubmission = catchAsync(async (req, res) => {
  const submission = await submissionService.getSubmission(req.teacher._id, req.params.id);
  sendSuccess(res, { data: submission });
});

export const recordSubmission = catchAsync(async (req, res) => {
  const submission = await submissionService.recordSubmission(req.teacher._id, req.params.id, req.body, req.ip);
  sendSuccess(res, { message: 'Submission recorded.', data: submission });
});

export const gradeSubmission = catchAsync(async (req, res) => {
  const submission = await submissionService.gradeSubmission(req.teacher._id, req.params.id, req.body, req.ip);
  sendSuccess(res, { message: 'Submission graded successfully.', data: submission });
});

export default { getSubmission, recordSubmission, gradeSubmission };
