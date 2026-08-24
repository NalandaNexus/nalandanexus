import { catchAsync } from '../utils/catchAsync.js';
import { sendSuccess } from '../utils/ApiResponse.js';
import * as announcementService from '../services/announcement.service.js';

export const listAnnouncements = catchAsync(async (req, res) => {
  const { announcements, meta } = await announcementService.listAnnouncements(req.teacher._id, req.query);
  sendSuccess(res, { data: announcements, meta });
});

export const listAdminAnnouncements = catchAsync(async (req, res) => {
  const { announcements, meta } = await announcementService.listAdminAnnouncements(req.query);
  sendSuccess(res, { data: announcements, meta });
});

export const getAnnouncement = catchAsync(async (req, res) => {
  const announcement = await announcementService.getAnnouncement(req.teacher._id, req.params.id);
  sendSuccess(res, { data: announcement });
});

export const createAnnouncement = catchAsync(async (req, res) => {
  const announcement = await announcementService.createAnnouncement(req.teacher._id, req.body, req.file, req.ip);
  sendSuccess(res, { statusCode: 201, message: 'Announcement saved.', data: announcement });
});

export const updateAnnouncement = catchAsync(async (req, res) => {
  const announcement = await announcementService.updateAnnouncement(req.teacher._id, req.params.id, req.body, req.file, req.ip);
  sendSuccess(res, { message: 'Announcement updated.', data: announcement });
});

export const publishAnnouncement = catchAsync(async (req, res) => {
  const announcement = await announcementService.publishAnnouncement(req.teacher._id, req.params.id, req.ip);
  sendSuccess(res, { message: 'Announcement published.', data: announcement });
});

export const archiveAnnouncement = catchAsync(async (req, res) => {
  const announcement = await announcementService.archiveAnnouncement(req.teacher._id, req.params.id, req.ip);
  sendSuccess(res, { message: 'Announcement archived.', data: announcement });
});

export const deleteAnnouncement = catchAsync(async (req, res) => {
  const result = await announcementService.deleteAnnouncement(req.teacher._id, req.params.id, req.ip);
  sendSuccess(res, { message: 'Announcement deleted.', data: result });
});

export default {
  listAnnouncements,
  listAdminAnnouncements,
  getAnnouncement,
  createAnnouncement,
  updateAnnouncement,
  publishAnnouncement,
  archiveAnnouncement,
  deleteAnnouncement,
};
