import { catchAsync } from '../utils/catchAsync.js';
import { sendSuccess } from '../utils/ApiResponse.js';
import { ApiError } from '../utils/ApiError.js';
import { publicUrlFor } from '../middleware/upload.js';
import * as resourceService from '../services/resource.service.js';

export const list = catchAsync(async (req, res) => {
  const { items, meta } = await resourceService.listResources(req.query);
  return sendSuccess(res, { data: items, meta });
});

export const getById = catchAsync(async (req, res) => {
  const resource = await resourceService.getResourceById(req.params.id);
  return sendSuccess(res, { data: resource });
});

export const create = catchAsync(async (req, res) => {
  if (!req.file) throw ApiError.badRequest('A file is required', 'FILE_REQUIRED');
  const data = {
    ...req.body,
    file: publicUrlFor('resources', req.file.filename),
    fileName: req.file.originalname,
    fileType: req.file.mimetype,
    fileSizeBytes: req.file.size,
  };
  const { resource, catalogSync } = await resourceService.createResource(data, req.admin, req);
  const message = catalogSync.synced
    ? 'Resource uploaded and published to the Landing Page.'
    : 'Resource uploaded, but publishing to the Landing Page failed — it will not appear publicly yet.';
  return sendSuccess(res, { statusCode: 201, data: resource, message, meta: { catalogSync } });
});

export const update = catchAsync(async (req, res) => {
  const data = { ...req.body };
  if (req.file) {
    data.file = publicUrlFor('resources', req.file.filename);
    data.fileName = req.file.originalname;
    data.fileType = req.file.mimetype;
    data.fileSizeBytes = req.file.size;
  }
  const { resource, catalogSync } = await resourceService.updateResource(req.params.id, data, req.admin, req);
  return sendSuccess(res, { data: resource, message: 'Resource updated successfully', meta: { catalogSync } });
});

export const remove = catchAsync(async (req, res) => {
  await resourceService.deleteResource(req.params.id, req.admin, req);
  return sendSuccess(res, { message: 'Resource deleted successfully' });
});

export default { list, getById, create, update, remove };
