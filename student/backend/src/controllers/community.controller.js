import { asyncHandler } from '../utils/asyncHandler.js';
import { sendSuccess } from '../utils/apiResponse.js';
import { AppError } from '../utils/AppError.js';
import { Post } from '../models/Post.js';

function toPublicPost(post, requestingUserId) {
  return {
    id: post._id,
    body: post.body,
    author: {
      id: post.userId?._id || post.userId,
      name: post.userId?.name || 'Student',
      avatar: post.userId?.avatar || null,
    },
    likesCount: post.likedBy?.length || 0,
    likedByMe: requestingUserId
      ? (post.likedBy || []).some((id) => String(id) === String(requestingUserId))
      : false,
    createdAt: post.createdAt,
  };
}

export const listPosts = asyncHandler(async (req, res) => {
  const page = Math.max(1, Number(req.query.page) || 1);
  const limit = Math.min(50, Math.max(1, Number(req.query.limit) || 20));

  const [posts, total] = await Promise.all([
    Post.find({})
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .populate('userId', 'name avatar'),
    Post.countDocuments({}),
  ]);

  return sendSuccess(res, {
    data: posts.map((p) => toPublicPost(p, req.user._id)),
    meta: { page, limit, total, hasMore: page * limit < total },
  });
});

export const createPost = asyncHandler(async (req, res) => {
  let post = await Post.create({ userId: req.user._id, body: req.body.body });
  post = await post.populate('userId', 'name avatar');
  const shaped = toPublicPost(post, req.user._id);

  try {
    const { emitCommunityPostCreated } = await import('../sockets/index.js');
    emitCommunityPostCreated(shaped);
  } catch {
    // socket layer optional
  }

  return sendSuccess(res, { status: 201, message: 'Post shared.', data: shaped });
});

export const toggleLike = asyncHandler(async (req, res) => {
  const post = await Post.findById(req.params.id);
  if (!post) throw AppError.notFound('Post not found', 'POST_NOT_FOUND');

  const userId = String(req.user._id);
  const alreadyLiked = post.likedBy.some((id) => String(id) === userId);

  if (alreadyLiked) {
    post.likedBy = post.likedBy.filter((id) => String(id) !== userId);
  } else {
    post.likedBy.push(req.user._id);
  }
  await post.save();
  await post.populate('userId', 'name avatar');
  const shaped = toPublicPost(post, req.user._id);

  try {
    // Only id/likesCount are actor-independent - `likedByMe` is relative to
    // whoever is viewing, so broadcasting the full shape would incorrectly
    // show every connected student as having liked it themselves.
    const { emitCommunityPostUpdated } = await import('../sockets/index.js');
    emitCommunityPostUpdated({ id: shaped.id, likesCount: shaped.likesCount });
  } catch {
    // socket layer optional
  }

  return sendSuccess(res, { data: shaped });
});
