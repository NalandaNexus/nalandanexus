import { catchAsync } from '../utils/catchAsync.js';
import { sendSuccess } from '../utils/ApiResponse.js';
import * as assignmentService from '../services/assignment.service.js';

export const listAssignments = catchAsync(async (req, res) => {
  const assignments = await assignmentService.listAssignments(req.teacher._id, req.query);
  sendSuccess(res, { data: assignments });
});

export const getAssignment = catchAsync(async (req, res) => {
  const assignment = await assignmentService.getAssignmentById(req.teacher._id, req.params.id);
  sendSuccess(res, { data: assignment });
});

export const createAssignment = catchAsync(async (req, res) => {
  const assignment = await assignmentService.createAssignment(req.teacher._id, req.body, req.ip);
  sendSuccess(res, { statusCode: 201, message: 'Assignment created successfully.', data: assignment });
});

export const updateAssignment = catchAsync(async (req, res) => {
  const assignment = await assignmentService.updateAssignment(req.teacher._id, req.params.id, req.body, req.ip);
  sendSuccess(res, { message: 'Assignment updated successfully.', data: assignment });
});

export const archiveAssignment = catchAsync(async (req, res) => {
  const result = await assignmentService.archiveAssignment(req.teacher._id, req.params.id, req.ip);
  sendSuccess(res, { message: 'Assignment deleted successfully.', data: result });
});

export const listSubmissions = catchAsync(async (req, res) => {
  const submissions = await assignmentService.listSubmissionsForAssignment(req.teacher._id, req.params.id);
  sendSuccess(res, { data: submissions });
});

export default { listAssignments, getAssignment, createAssignment, updateAssignment, archiveAssignment, listSubmissions };
