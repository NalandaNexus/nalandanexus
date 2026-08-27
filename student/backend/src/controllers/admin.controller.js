import { asyncHandler } from '../utils/asyncHandler.js';
import { sendSuccess } from '../utils/apiResponse.js';
import { AppError } from '../utils/AppError.js';
import { Announcement } from '../models/Announcement.js';
import { LiveClass } from '../models/LiveClass.js';
import { Post } from '../models/Post.js';
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

// --- Community moderation (admin/teacher) ---------------------------------

/**
 * Posts students write are visible in the in-app community feed immediately,
 * but reach the anonymous Landing Page only once approved here. Before this
 * existed, anyone who could register could publish arbitrary text onto the
 * public homepage, and there was no route anywhere in the API to take it back
 * down again.
 */
export const listCommunityPosts = asyncHandler(async (req, res) => {
  const filter = {};
  if (req.query.approved === 'true') filter.isApprovedForPublic = true;
  if (req.query.approved === 'false') filter.isApprovedForPublic = false;

  const posts = await Post.find(filter)
    .sort({ createdAt: -1 })
    .limit(200)
    .populate('userId', 'name email')
    .lean();

  return sendSuccess(res, {
    data: posts.map((p) => ({
      id: String(p._id),
      body: p.body,
      isApprovedForPublic: Boolean(p.isApprovedForPublic),
      // Null when the author's account has since been deleted; such a post can
      // never render on the public feed, so surface it as reviewable here.
      author: p.userId ? { id: String(p.userId._id), name: p.userId.name, email: p.userId.email } : null,
      createdAt: p.createdAt,
    })),
  });
});

export const setCommunityPostApproval = asyncHandler(async (req, res) => {
  const post = await Post.findByIdAndUpdate(
    req.params.id,
    { isApprovedForPublic: Boolean(req.body.isApprovedForPublic) },
    { new: true }
  );
  if (!post) throw AppError.notFound('Post not found', 'POST_NOT_FOUND');
  return sendSuccess(res, {
    message: post.isApprovedForPublic ? 'Post approved for the public page.' : 'Post removed from the public page.',
    data: { id: String(post._id), isApprovedForPublic: post.isApprovedForPublic },
  });
});

/** Unlike the student route, this deletes any post regardless of author. */
export const deleteCommunityPost = asyncHandler(async (req, res) => {
  const post = await Post.findByIdAndDelete(req.params.id);
  if (!post) throw AppError.notFound('Post not found', 'POST_NOT_FOUND');

  try {
    const { emitCommunityPostDeleted } = await import('../sockets/index.js');
    emitCommunityPostDeleted({ id: String(post._id) });
  } catch {
    // socket layer optional
  }

  return sendSuccess(res, { message: 'Post deleted.', data: { id: String(post._id) } });
});
