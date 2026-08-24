import { catchAsync } from '../utils/catchAsync.js';
import { sendSuccess } from '../utils/ApiResponse.js';
import { ApiError } from '../utils/ApiError.js';
import * as resourceService from '../services/resource.service.js';

export const listResources = catchAsync(async (req, res) => {
  const resources = await resourceService.listResources(req.teacher._id);
  sendSuccess(res, { data: resources });
});

export const createResource = catchAsync(async (req, res, next) => {
  if (!req.file) return next(ApiError.badRequest('A file is required.', 'FILE_REQUIRED'));
  const resource = await resourceService.createResource(req.teacher._id, req.body, req.file, req.ip);
  sendSuccess(res, { statusCode: 201, message: 'Resource uploaded successfully.', data: resource });
});

export const downloadResource = catchAsync(async (req, res) => {
  const resource = await resourceService.registerDownload(req.teacher._id, req.params.id);
  sendSuccess(res, { data: resource });
});

export const deleteResource = catchAsync(async (req, res) => {
  const result = await resourceService.deleteResource(req.teacher._id, req.params.id, req.ip);
  sendSuccess(res, { message: 'Resource deleted successfully.', data: result });
});

export default { listResources, createResource, downloadResource, deleteResource };
