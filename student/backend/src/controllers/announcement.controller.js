import { asyncHandler } from '../utils/asyncHandler.js';
import { sendSuccess } from '../utils/apiResponse.js';
import { Announcement } from '../models/Announcement.js';
import { Enrollment } from '../models/Enrollment.js';

function toPublicAnnouncement(a, userId) {
  return {
    id: a._id,
    title: a.title,
    content: a.content,
    type: a.type,
    publishAt: a.publishAt,
    expiresAt: a.expiresAt,
    isRead: (a.readBy || []).some((id) => String(id) === String(userId)),
    author: a.createdBy
      ? { name: a.createdBy.name, role: a.createdBy.role }
      : a.externalAuthorName
        ? { name: a.externalAuthorName, role: 'teacher' }
        : null,
  };
}

export const listAnnouncements = asyncHandler(async (req, res) => {
  const now = new Date();
  const enrollments = await Enrollment.find({ userId: req.user._id, status: 'active' }).select('courseId');
  const courseIds = enrollments.map((e) => e.courseId);

  const announcements = await Announcement.find({
    isPublished: true,
    publishAt: { $lte: now },
    $or: [{ expiresAt: null }, { expiresAt: { $gte: now } }],
    // Institution-wide (empty courseIds) OR targeted at a course this
    // student is actually enrolled in - never a course they aren't.
    $and: [{ $or: [{ courseIds: { $size: 0 } }, { courseIds: { $in: courseIds } }] }],
  })
    .sort({ publishAt: -1 })
    .limit(100)
    .populate('createdBy', 'name role');

  return sendSuccess(res, { data: announcements.map((a) => toPublicAnnouncement(a, req.user._id)) });
});

export const markAnnouncementRead = asyncHandler(async (req, res) => {
  await Announcement.updateOne({ _id: req.params.id }, { $addToSet: { readBy: req.user._id } });
  return sendSuccess(res, { message: 'Marked as read.' });
});
