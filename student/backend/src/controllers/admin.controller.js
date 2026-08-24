import { asyncHandler } from '../utils/asyncHandler.js';
import { sendSuccess } from '../utils/apiResponse.js';
import { AppError } from '../utils/AppError.js';
import { Announcement } from '../models/Announcement.js';
import { LiveClass } from '../models/LiveClass.js';
import { createAnnouncement as createAnnouncementService } from '../services/announcement.service.js';

// --- Announcements (admin/teacher) ---------------------------------------

export const listAllAnnouncements = asyncHandler(async (req, res) => {
  const announcements = await Announcement.find({})
    .sort({ publishAt: -1 })
    .limit(200)
    .populate('createdBy', 'name role');
  return sendSuccess(res, { data: announcements });
});

export const createAnnouncement = asyncHandler(async (req, res) => {
  // Author is always the authenticated admin/teacher - never a client-supplied field.
  const announcement = await createAnnouncementService({ ...req.body, createdBy: req.user._id });
  return sendSuccess(res, { status: 201, message: 'Announcement published.', data: announcement });
});

export const updateAnnouncement = asyncHandler(async (req, res) => {
  const announcement = await Announcement.findByIdAndUpdate(req.params.id, req.body, { new: true });
  if (!announcement) throw AppError.notFound('Announcement not found', 'ANNOUNCEMENT_NOT_FOUND');
  return sendSuccess(res, { message: 'Announcement updated.', data: announcement });
});

export const deleteAnnouncement = asyncHandler(async (req, res) => {
  const announcement = await Announcement.findByIdAndDelete(req.params.id);
  if (!announcement) throw AppError.notFound('Announcement not found', 'ANNOUNCEMENT_NOT_FOUND');
  return sendSuccess(res, { message: 'Announcement deleted.' });
});

// --- Live classes (admin/teacher) -----------------------------------------

export const listAllLiveClasses = asyncHandler(async (req, res) => {
  const liveClasses = await LiveClass.find({}).sort({ scheduledAt: -1 }).limit(200);
  return sendSuccess(res, { data: liveClasses });
});

export const createLiveClass = asyncHandler(async (req, res) => {
  const liveClass = await LiveClass.create(req.body);
  return sendSuccess(res, { status: 201, message: 'Live class scheduled.', data: liveClass });
});

export const updateLiveClass = asyncHandler(async (req, res) => {
  const liveClass = await LiveClass.findByIdAndUpdate(req.params.id, req.body, { new: true });
  if (!liveClass) throw AppError.notFound('Live class not found', 'LIVE_CLASS_NOT_FOUND');
  return sendSuccess(res, { message: 'Live class updated.', data: liveClass });
});

export const deleteLiveClass = asyncHandler(async (req, res) => {
  const liveClass = await LiveClass.findByIdAndDelete(req.params.id);
  if (!liveClass) throw AppError.notFound('Live class not found', 'LIVE_CLASS_NOT_FOUND');
  return sendSuccess(res, { message: 'Live class deleted.' });
});
