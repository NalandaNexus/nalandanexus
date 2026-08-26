import { catchAsync } from '../utils/catchAsync.js';
import { sendSuccess } from '../utils/ApiResponse.js';
import * as announcementService from '../services/announcement.service.js';

export const list = catchAsync(async (req, res) => {
  const { items, meta } = await announcementService.listAnnouncements(req.query);
  return sendSuccess(res, { data: items, meta });
});

export const create = catchAsync(async (req, res) => {
  const announcement = await announcementService.createAnnouncement(req.body, req.admin, req);
  return sendSuccess(res, { statusCode: 201, data: announcement, message: 'Announcement published' });
});

export const update = catchAsync(async (req, res) => {
  const announcement = await announcementService.updateAnnouncement(req.params.id, req.body, req.admin, req);
  return sendSuccess(res, { data: announcement, message: 'Announcement updated' });
});

export const remove = catchAsync(async (req, res) => {
  await announcementService.deleteAnnouncement(req.params.id, req.admin, req);
  return sendSuccess(res, { message: 'Announcement deleted' });
});

export const listFromTeachers = catchAsync(async (req, res) => {
  const { items, meta } = await announcementService.listTeacherAnnouncements(req.query);
  return sendSuccess(res, { data: items, meta });
});

export default { list, create, update, remove, listFromTeachers };
