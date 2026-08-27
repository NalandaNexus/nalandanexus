import { asyncHandler } from '../utils/asyncHandler.js';
import { sendSuccess } from '../utils/apiResponse.js';
import { AppError } from '../utils/AppError.js';
import { Review } from '../models/Review.js';
import { Course } from '../models/Course.js';
import { recalculateCourseRating } from '../services/review.service.js';

function shapeReview(review, author) {
  return {
    id: String(review._id),
    rating: review.rating,
    comment: review.comment || '',
    // Only a first name is exposed publicly - a review is attributable enough
    // to be credible without publishing a full identity or an email address.
    author: author ? author.name?.split(' ')[0] || 'A learner' : null,
    createdAt: review.createdAt,
    updatedAt: review.updatedAt,
  };
}

/**
 * Public list of a course's reviews. Readable by anyone (a prospective
 * student deciding whether to buy), but only ever written by an enrolled
 * student via the routes below.
 */
export const listCourseReviews = asyncHandler(async (req, res) => {
  const course = await Course.findOne({ slug: req.params.slug, isPublished: true }).select('_id rating reviewsCount');
  if (!course) throw AppError.notFound('Course not found', 'COURSE_NOT_FOUND');

  const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
  const pageSize = Math.min(Math.max(parseInt(req.query.pageSize, 10) || 10, 1), 50);

  const [reviews, total] = await Promise.all([
    Review.find({ courseId: course._id })
      .sort({ createdAt: -1 })
      .skip((page - 1) * pageSize)
      .limit(pageSize)
      .populate('userId', 'name'),
    Review.countDocuments({ courseId: course._id }),
  ]);

  return sendSuccess(res, {
    data: reviews.map((r) => shapeReview(r, r.userId)),
    meta: {
      page,
      pageSize,
      total,
      // Echoed from the Course so a client rendering the list and the summary
      // together cannot show two different numbers.
      rating: course.rating,
      reviewsCount: course.reviewsCount,
    },
  });
});

/** The authenticated student's own review for this course, or null. */
export const getMyReview = asyncHandler(async (req, res) => {
  const review = await Review.findOne({ userId: req.user._id, courseId: req.courseId });
  return sendSuccess(res, { data: review ? shapeReview(review, req.user) : null });
});

export const createReview = asyncHandler(async (req, res) => {
  const existing = await Review.findOne({ userId: req.user._id, courseId: req.courseId });
  if (existing) {
    throw AppError.conflict(
      'You have already reviewed this course. Update your existing review instead.',
      'REVIEW_ALREADY_EXISTS'
    );
  }

  let review;
  try {
    review = await Review.create({
      userId: req.user._id,
      courseId: req.courseId,
      rating: req.body.rating,
      comment: req.body.comment || '',
    });
  } catch (err) {
    // The unique index is the real guard - two concurrent submissions can both
    // pass the findOne above, and exactly one of them lands here.
    if (err.code === 11000) {
      throw AppError.conflict(
        'You have already reviewed this course. Update your existing review instead.',
        'REVIEW_ALREADY_EXISTS'
      );
    }
    throw err;
  }

  const summary = await recalculateCourseRating(req.courseId);

  return sendSuccess(res, {
    status: 201,
    message: 'Thanks for reviewing this course!',
    data: { review: shapeReview(review, req.user), course: summary },
  });
});

export const updateReview = asyncHandler(async (req, res) => {
  const review = await Review.findOne({ userId: req.user._id, courseId: req.courseId });
  if (!review) {
    throw AppError.notFound('You have not reviewed this course yet.', 'REVIEW_NOT_FOUND');
  }

  if (req.body.rating !== undefined) review.rating = req.body.rating;
  if (req.body.comment !== undefined) review.comment = req.body.comment;
  await review.save();

  const summary = await recalculateCourseRating(req.courseId);

  return sendSuccess(res, {
    message: 'Your review has been updated.',
    data: { review: shapeReview(review, req.user), course: summary },
  });
});

export const deleteReview = asyncHandler(async (req, res) => {
  const review = await Review.findOneAndDelete({ userId: req.user._id, courseId: req.courseId });
  if (!review) {
    throw AppError.notFound('You have not reviewed this course yet.', 'REVIEW_NOT_FOUND');
  }

  const summary = await recalculateCourseRating(req.courseId);

  return sendSuccess(res, {
    message: 'Your review has been removed.',
    data: { course: summary },
  });
});
